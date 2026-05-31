// CapsuleMergeController: авто-мердж через капсулы репликации (loc2).
//
// Поток:
//   1. На поле появилась пара лягушек одного уровня (L7-11) → капсула резервирует
//      их и ждёт 4с (PENDING). Пара всё это время НОРМАЛЬНАЯ — игрок может
//      смерджить руками сам (приоритет игрока).
//   2. Через 4с над парой всплывает «!» — сигнал «идём в колбу».
//   3. Обе лягушки прыгают параллельными дорожками по маршруту в одну колбу,
//      сходятся → мердж → новая (+1) выпрыгивает обратно на поле.
//
// 3 капсулы = 3 параллельных станка. L12 не трогаем (будущий currency-event).
// Ручной мердж на поле НЕ затрагивается.
//
// Public API: tick() (вызывать на loc2), reset(), destroy().

import Phaser from 'phaser'
import type { MainScene } from '../MainScene'
import type { MergeController } from './MergeController'
import { BASE_SCALE, DPR } from './types'
import type { FrogData } from './types'

// Точки маршрута: [xFrac, yFracZone] (yFracZone: 0 = верх зоны строений = height,
// 1 = низ = 2*height; отрицательные = зона лягушек выше).
type Pt = readonly [number, number]

const TRUNK: readonly Pt[] = [
  [0.513, -0.091],
  [0.522, -0.012],
  [0.537, 0.051],
  [0.525, 0.127],
  [0.519, 0.315],
  [0.528, 0.42],
  [0.563, 0.48],
  [0.55, 0.559],
]

interface CapsuleRoute {
  entry: Pt
  float: Pt
}
const CAPSULE_ROUTES: readonly CapsuleRoute[] = [
  { entry: [0.308, 0.764], float: [0.306, 0.675] }, // левая
  { entry: [0.527, 0.849], float: [0.522, 0.762] }, // центральная
  { entry: [0.757, 0.766], float: [0.752, 0.668] }, // правая
]

const PENDING_DELAY = 4000 // мс ожидания на поле до отправки в колбу
const MARK_SHOW_MS = 600 // сколько «!» висит перед стартом маршрута
const HOP_DIST = 90 * DPR // длина прыжка вдоль маршрута
const HOP_DURATION = 420 // мс на прыжок
const INTER_HOP_PAUSE = 320 // мс паузы между прыжками
const SECOND_FROG_DELAY = 150 // мс — второй стартует чуть позже
const FLOAT_OFFSET_FRAC = 0.04 // разнос дорожек двух лягушек (доля W)
const CONVERGE_MS = 600 // схождение к центру перед мерджем
const VORTEX_WAIT = 480 // performMerge спавнит merged отложенно (~410мс)
const CAP_LEVEL = 12 // L12+ не авто-мерджим
const COOLDOWN_MS = 400 // пауза капсулы после цикла

type CapsuleState = 'idle' | 'pending' | 'busy' | 'cooldown'

interface CapsuleSlot {
  route: CapsuleRoute
  state: CapsuleState
  frogs: FrogData[]
  reservedIds: string[]
  arrived: number
  cooldownUntil: number
  tweens: Phaser.Tweens.Tween[]
  pendingTimer: Phaser.Time.TimerEvent | null
  marks: Phaser.GameObjects.Text[]
}

export class CapsuleMergeController {
  private scene: MainScene
  private merge: MergeController
  private slots: CapsuleSlot[]
  // id'ы лягушек, уже зарезервированных капсулами (pending/busy) — исключаем из
  // поиска новых пар.
  private reserved = new Set<string>()

  constructor(scene: MainScene, merge: MergeController) {
    this.scene = scene
    this.merge = merge
    this.slots = CAPSULE_ROUTES.map((route) => ({
      route,
      state: 'idle' as CapsuleState,
      frogs: [],
      reservedIds: [],
      arrived: 0,
      cooldownUntil: 0,
      tweens: [],
      pendingTimer: null,
      marks: [],
    }))
  }

  private worldPt(p: Pt): Phaser.Math.Vector2 {
    const { width, height } = this.scene.scale
    return new Phaser.Math.Vector2(p[0] * width, height * (1 + p[1]))
  }

  // ───────────────────────── tick / резерв пары ─────────────────────────

  tick(): void {
    const now = this.scene.time.now
    for (const slot of this.slots) {
      if (slot.state === 'cooldown' && now >= slot.cooldownUntil) {
        slot.state = 'idle'
      }
      if (slot.state !== 'idle') continue
      const pair = this.merge.findClosestSameLevelPair(CAP_LEVEL, this.reserved)
      if (!pair) break
      this.startPending(slot, pair)
    }
  }

  // Пара найдена → резервируем, ждём 4с (лягушки остаются нормальными).
  private startPending(slot: CapsuleSlot, [a, b]: [FrogData, FrogData]): void {
    slot.state = 'pending'
    slot.frogs = [a, b]
    slot.reservedIds = [a.id, b.id]
    this.reserved.add(a.id)
    this.reserved.add(b.id)
    slot.pendingTimer = this.scene.time.delayedCall(PENDING_DELAY, () =>
      this.onPendingFire(slot),
    )
  }

  // 4с прошло: пара всё ещё валидна? → «!» + маршрут. Иначе — отмена.
  private onPendingFire(slot: CapsuleSlot): void {
    slot.pendingTimer = null
    if (!this.pairValid(slot)) {
      this.freeSlot(slot)
      return
    }
    this.showMark(slot)
    this.scene.time.delayedCall(MARK_SHOW_MS, () => {
      if (slot.state !== 'pending' || !this.pairValid(slot)) {
        this.clearMark(slot)
        this.freeSlot(slot)
        return
      }
      this.clearMark(slot)
      this.beginRouting(slot)
    })
  }

  private pairValid(slot: CapsuleSlot): boolean {
    const [a, b] = slot.frogs
    return (
      !!a &&
      !!b &&
      a.container.active &&
      b.container.active &&
      this.scene.frogs.includes(a) &&
      this.scene.frogs.includes(b) &&
      a.level === b.level &&
      a.level < CAP_LEVEL &&
      !a.isAttracted &&
      !b.isAttracted &&
      !a.isDragging &&
      !b.isDragging &&
      !a.isMerging &&
      !b.isMerging
    )
  }

  // «!» над КАЖДОЙ из двух лягушек — сигнал «идём в колбу».
  private showMark(slot: CapsuleSlot): void {
    slot.marks = []
    for (const f of slot.frogs) {
      const mx = f.container.x
      const my = f.container.y - 52 * DPR
      const txt = this.scene.add
        .text(mx, my, '!', {
          fontFamily: "'Russo One', system-ui, sans-serif",
          fontSize: `${Math.round(40 * DPR)}px`,
          color: '#ffe14d',
        })
        .setOrigin(0.5)
        .setDepth(1000000)
      txt.setStroke('#7a4b00', 6 * DPR)
      txt.setScale(0)
      slot.marks.push(txt)
      this.scene.tweens.add({
        targets: txt,
        scale: 1,
        duration: 200,
        ease: 'Back.easeOut',
      })
      this.scene.tweens.add({
        targets: txt,
        y: my - 10 * DPR,
        duration: MARK_SHOW_MS,
        ease: 'Sine.easeOut',
      })
    }
  }

  private clearMark(slot: CapsuleSlot): void {
    for (const m of slot.marks) {
      this.scene.tweens.killTweensOf(m)
      m.destroy()
    }
    slot.marks = []
  }

  // ───────────────────────── маршрут в колбу ─────────────────────────

  private beginRouting(slot: CapsuleSlot): void {
    slot.state = 'busy'
    slot.arrived = 0
    slot.tweens = []
    const [a, b] = slot.frogs
    const offset = this.scene.scale.width * FLOAT_OFFSET_FRAC
    this.prepFrog(a)
    this.prepFrog(b)
    this.routeIn(slot, a, -offset, 0)
    this.routeIn(slot, b, +offset, SECOND_FROG_DELAY)
  }

  // Вывести лягушку из нормальной жизни на время маршрута.
  private prepFrog(f: FrogData): void {
    f.isAttracted = true
    f.isMoving = false
    if (f.dashTimer) {
      f.dashTimer.remove()
      f.dashTimer = null
    }
    this.scene.tweens.killTweensOf(f.container)
    this.scene.tweens.killTweensOf(f.body)
    f.body.y = 0
    f.body.scaleY = 1
    if (f.body.input) f.body.input.enabled = false
  }

  // Прямой маршрут (вся ломаная смещена на floatDx → параллельные дорожки).
  private routeIn(
    slot: CapsuleSlot,
    f: FrogData,
    floatDx: number,
    delay: number,
  ): void {
    // Маршрут начинается с ТЕКУЩЕЙ позиции лягушки — она допрыгивает до старта
    // пути (а не телепортируется туда). Остальные точки смещены на floatDx.
    const route = [
      ...TRUNK.map((p) => this.worldPt(p)),
      this.worldPt(slot.route.entry),
      this.worldPt(slot.route.float),
    ].map((p) => new Phaser.Math.Vector2(p.x + floatDx, p.y))
    const pts = [
      new Phaser.Math.Vector2(f.container.x, f.container.y),
      ...route,
    ]
    const go = () =>
      this.hopAlong(slot, f, pts, () => {
        this.startBob(slot, f)
        slot.arrived++
        if (slot.arrived >= 2) this.doMerge(slot)
      })
    if (delay > 0) this.scene.time.delayedCall(delay, go)
    else go()
  }

  // Движение ПРЫЖКАМИ: ломаную семплим через HOP_DIST, лягушка допрыгивает до
  // каждой точки естественной дугой (как dash на поле).
  private hopAlong(
    slot: CapsuleSlot,
    f: FrogData,
    pts: Phaser.Math.Vector2[],
    onDone: () => void,
  ): void {
    const samples = this.sampleEvery(pts, HOP_DIST)
    const step = (i: number) => {
      if (!f.container.active || slot.state !== 'busy') return
      if (i >= samples.length) {
        onDone()
        return
      }
      this.hop(slot, f, samples[i].x, samples[i].y, () => {
        this.scene.time.delayedCall(INTER_HOP_PAUSE, () => step(i + 1))
      })
    }
    step(0)
  }

  private hop(
    slot: CapsuleSlot,
    f: FrogData,
    toX: number,
    toY: number,
    onDone: () => void,
  ): void {
    if (!f.container.active) return
    const fromX = f.container.x
    const fromY = f.container.y
    const dist = Math.hypot(toX - fromX, toY - fromY)
    const movingRight = toX >= fromX
    if (movingRight !== f.facingRight) {
      f.container.scaleX = (movingRight ? 1 : -1) * BASE_SCALE
      f.facingRight = movingRight
    }
    const arcH = Math.min(22, 8 + dist * 0.18) * DPR
    this.scene.tweens.add({
      targets: f.body,
      scaleY: 1.2,
      duration: 90,
      ease: 'Power2.easeOut',
    })
    const js = { t: 0 }
    const tw = this.scene.tweens.add({
      targets: js,
      t: 1,
      duration: HOP_DURATION,
      ease: 'Power2.easeOut',
      onUpdate: () => {
        if (!f.container.active) return
        const t = js.t
        f.container.x = fromX + (toX - fromX) * t
        f.container.y = fromY + (toY - fromY) * t
        f.body.y = -(4 * t * (1 - t) * arcH)
      },
      onComplete: () => {
        if (!f.container.active) return
        f.body.y = 0
        this.scene.tweens.add({
          targets: f.body,
          scaleY: 0.85,
          duration: 70,
          yoyo: true,
          ease: 'Power2.easeIn',
        })
        onDone()
      },
    })
    slot.tweens.push(tw)
  }

  private sampleEvery(
    pts: Phaser.Math.Vector2[],
    stepLen: number,
  ): Phaser.Math.Vector2[] {
    const out: Phaser.Math.Vector2[] = []
    let carry = 0
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      const segLen = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y)
      let d = stepLen - carry
      while (d <= segLen) {
        const t = d / segLen
        out.push(
          new Phaser.Math.Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t),
        )
        d += stepLen
      }
      carry = segLen - (d - stepLen)
    }
    const end = pts[pts.length - 1]
    const last = out[out.length - 1]
    if (
      !last ||
      Phaser.Math.Distance.Between(last.x, last.y, end.x, end.y) > 4
    ) {
      out.push(end)
    }
    return out
  }

  // Парение в колбе: покачивание + медленное вращение.
  private startBob(slot: CapsuleSlot, f: FrogData): void {
    if (!f.container.active) return
    slot.tweens.push(
      this.scene.tweens.add({
        targets: f.container,
        y: f.container.y - 12,
        duration: 700,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      }),
      this.scene.tweens.add({
        targets: f.container,
        angle: 360,
        duration: 3000,
        repeat: -1,
      }),
    )
  }

  // ───────────────────────── мердж + выход ─────────────────────────

  private doMerge(slot: CapsuleSlot): void {
    const [a, b] = slot.frogs
    if (
      !a?.container.active ||
      !b?.container.active ||
      !this.scene.frogs.includes(a) ||
      !this.scene.frogs.includes(b)
    ) {
      this.releaseSurvivors(slot)
      this.freeSlot(slot)
      return
    }
    this.killSlotTweens(slot)
    a.container.angle = 0
    b.container.angle = 0
    const fl = this.worldPt(slot.route.float)

    // Слияние (подольше): обе медленно сходятся к центру + пульс body.
    slot.tweens.push(
      this.scene.tweens.add({
        targets: [a.container, b.container],
        x: fl.x,
        y: fl.y,
        duration: CONVERGE_MS,
        ease: 'Sine.easeInOut',
      }),
      this.scene.tweens.add({
        targets: [a.body, b.body],
        scaleX: 1.15,
        scaleY: 1.15,
        duration: CONVERGE_MS / 2,
        yoyo: true,
        ease: 'Sine.easeInOut',
      }),
    )

    this.scene.time.delayedCall(CONVERGE_MS, () => {
      if (slot.state !== 'busy') return
      if (!a.container.active || !b.container.active) {
        this.releaseSurvivors(slot)
        this.freeSlot(slot)
        return
      }
      // performMerge: спираль + removeFrog + spawnFrog ОТЛОЖЕННО (~410мс).
      const beforeIds = new Set(this.scene.frogs.map((f) => f.id))
      this.merge.performMerge(a, b, fl.x, fl.y)
      this.scene.time.delayedCall(VORTEX_WAIT, () => {
        if (slot.state !== 'busy') return
        const fresh = this.scene.frogs.filter((f) => !beforeIds.has(f.id))
        const merged = fresh.sort(
          (p, q) =>
            Phaser.Math.Distance.Between(p.container.x, p.container.y, fl.x, fl.y) -
            Phaser.Math.Distance.Between(q.container.x, q.container.y, fl.x, fl.y),
        )[0]
        if (!merged) {
          this.freeSlot(slot)
          return
        }
        this.routeOut(slot, merged)
      })
    })
  }

  // merged едет из колбы назад на поле (реверс маршрута).
  private routeOut(slot: CapsuleSlot, merged: FrogData): void {
    this.prepFrog(merged)
    merged.container.setScale(BASE_SCALE) // performMerge оставил scale 0 → вернуть
    const pts = [
      this.worldPt(slot.route.float),
      this.worldPt(slot.route.entry),
      ...[...TRUNK].reverse().map((p) => this.worldPt(p)),
    ]
    this.hopAlong(slot, merged, pts, () => {
      this.restoreFrog(merged)
      this.freeSlot(slot)
    })
  }

  // ───────────────────────── teardown / helpers ─────────────────────────

  private freeSlot(slot: CapsuleSlot): void {
    this.killSlotTweens(slot)
    this.clearMark(slot)
    if (slot.pendingTimer) {
      slot.pendingTimer.remove()
      slot.pendingTimer = null
    }
    for (const id of slot.reservedIds) this.reserved.delete(id)
    slot.reservedIds = []
    slot.frogs = []
    slot.arrived = 0
    slot.state = 'cooldown'
    slot.cooldownUntil = this.scene.time.now + COOLDOWN_MS
  }

  private killSlotTweens(slot: CapsuleSlot): void {
    for (const tw of slot.tweens) tw.remove()
    slot.tweens = []
  }

  private releaseSurvivors(slot: CapsuleSlot): void {
    this.killSlotTweens(slot)
    for (const f of slot.frogs) {
      if (f && f.container.active && f.isAttracted) this.restoreFrog(f)
    }
  }

  private restoreFrog(f: FrogData): void {
    this.scene.tweens.killTweensOf(f.container)
    f.container.angle = 0
    f.isAttracted = false
    if (f.body.input) f.body.input.enabled = true
  }

  reset(): void {
    for (const slot of this.slots) {
      if (slot.pendingTimer) {
        slot.pendingTimer.remove()
        slot.pendingTimer = null
      }
      this.clearMark(slot)
      this.releaseSurvivors(slot)
      slot.frogs = []
      slot.reservedIds = []
      slot.arrived = 0
      slot.state = 'idle'
      slot.cooldownUntil = 0
    }
    this.reserved.clear()
  }

  destroy(): void {
    this.reset()
  }
}
