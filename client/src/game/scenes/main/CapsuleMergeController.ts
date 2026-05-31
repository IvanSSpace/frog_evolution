// CapsuleMergeController: авто-мердж через капсулы репликации (loc2).
//
// Когда на поле образуется пара лягушек одного уровня (L7-11), свободная
// капсула «забирает» обе: они ПЛАВНО едут по маршруту (непрерывный путь:
// trunk → вход капсулы → точка парения), там парят/крутятся, и когда обе
// доехали — мердж. Результат (+1) рождается в колбе и ВОЗВРАЩАЕТСЯ по тому же
// маршруту назад на поле. Ручной мердж на поле НЕ затрагивается — это помощник.
//
// 3 капсулы = 3 параллельных станка (берут пары независимо). L12 не трогаем
// (capLevel=12) — это будущий currency-event анлока loc3.
//
// Public API:
//   - tick(): попытка заклеймить пары свободными капсулами (вызывать на loc2).
//   - reset(): сброс при смене локации / переходе (вернуть лягушек в норму).
//   - destroy().

import Phaser from 'phaser'
import type { MainScene } from '../MainScene'
import type { MergeController } from './MergeController'
import { BASE_SCALE, DPR } from './types'
import type { FrogData } from './types'

// Точки маршрута: [xFrac (от ширины), yFracZone (0 = верх зоны строений =
// height, 1 = низ = 2*height; отрицательные = зона лягушек выше)].
type Pt = readonly [number, number]

// Общий ствол (с поля вниз в зону строений).
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

// Ветка каждой капсулы: вход + точка парения внутри колбы.
interface CapsuleRoute {
  entry: Pt
  float: Pt
}
const CAPSULE_ROUTES: readonly CapsuleRoute[] = [
  { entry: [0.308, 0.764], float: [0.306, 0.675] }, // левая
  { entry: [0.527, 0.849], float: [0.522, 0.762] }, // центральная
  { entry: [0.757, 0.766], float: [0.752, 0.668] }, // правая
]

const HOP_DIST = 80 * DPR // длина одного прыжка вдоль маршрута
const HOP_DURATION = 200 // мс на прыжок (как dash на поле)
const SECOND_FROG_DELAY = 350 // мс — второй стартует позже (single-file)
const FLOAT_OFFSET_FRAC = 0.045 // разнос двух лягушек в точке парения (доля W)
const MERGE_PAUSE_MS = 250 // пауза «обе в колбе» перед мерджем
const CAP_LEVEL = 12 // L12+ не авто-мерджим
const COOLDOWN_MS = 400 // пауза капсулы после полного цикла

type CapsuleState = 'idle' | 'busy' | 'cooldown'

interface CapsuleSlot {
  route: CapsuleRoute
  state: CapsuleState
  frogs: FrogData[]
  arrived: number
  cooldownUntil: number
  tweens: Phaser.Tweens.Tween[]
}

export class CapsuleMergeController {
  private scene: MainScene
  private merge: MergeController
  private slots: CapsuleSlot[]

  constructor(scene: MainScene, merge: MergeController) {
    this.scene = scene
    this.merge = merge
    this.slots = CAPSULE_ROUTES.map((route) => ({
      route,
      state: 'idle' as CapsuleState,
      frogs: [],
      arrived: 0,
      cooldownUntil: 0,
      tweens: [],
    }))
  }

  private worldPt(p: Pt): Phaser.Math.Vector2 {
    const { width, height } = this.scene.scale
    return new Phaser.Math.Vector2(p[0] * width, height * (1 + p[1]))
  }

  // Каждый кадр: свободные капсулы пытаются забрать пару.
  tick(): void {
    const now = this.scene.time.now
    for (const slot of this.slots) {
      if (slot.state === 'cooldown' && now >= slot.cooldownUntil) {
        slot.state = 'idle'
      }
      if (slot.state !== 'idle') continue
      const pair = this.merge.findClosestSameLevelPair(CAP_LEVEL)
      if (!pair) break
      this.claim(slot, pair)
    }
  }

  private claim(slot: CapsuleSlot, [a, b]: [FrogData, FrogData]): void {
    slot.state = 'busy'
    slot.frogs = [a, b]
    slot.arrived = 0
    slot.tweens = []

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
    // Нельзя схватить пока едет (dragstart убил бы route → колба зависла).
    if (f.body.input) f.body.input.enabled = false
  }

  // Прямой маршрут: trunk → вход → точка парения (со смещением dx).
  private routeIn(
    slot: CapsuleSlot,
    f: FrogData,
    floatDx: number,
    delay: number,
  ): void {
    const fl = this.worldPt(slot.route.float)
    const pts = [
      ...TRUNK.map((p) => this.worldPt(p)),
      this.worldPt(slot.route.entry),
      new Phaser.Math.Vector2(fl.x + floatDx, fl.y),
    ]
    const go = () =>
      this.hopAlong(slot, f, pts, () => {
        this.startBob(slot, f)
        slot.arrived++
        if (slot.arrived >= 2) {
          this.scene.time.delayedCall(MERGE_PAUSE_MS, () => this.doMerge(slot))
        }
      })
    if (delay > 0) this.scene.time.delayedCall(delay, go)
    else go()
  }

  // Движение ПРЫЖКАМИ вдоль маршрута: ломаную семплим через HOP_DIST и лягушка
  // допрыгивает до каждой точки своей естественной дугой (как dash на поле).
  private hopAlong(
    slot: CapsuleSlot,
    f: FrogData,
    pts: Phaser.Math.Vector2[],
    onDone: () => void,
  ): void {
    const samples = this.sampleEvery(pts, HOP_DIST)
    const step = (i: number) => {
      if (!f.container.active || slot.state === 'idle') return
      if (i >= samples.length) {
        onDone()
        return
      }
      this.hop(slot, f, samples[i].x, samples[i].y, () => step(i + 1))
    }
    step(0)
  }

  // Один прыжок (дуга 4t(1-t) на body.y + stretch/squish, как FrogSpawner.dash).
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
      duration: 80,
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
          scaleY: 0.8,
          duration: 60,
          yoyo: true,
          ease: 'Power2.easeIn',
        })
        onDone()
      },
    })
    slot.tweens.push(tw)
  }

  // Семплинг ломаной по дуговой длине: точки через каждые `step` px + конец.
  private sampleEvery(
    pts: Phaser.Math.Vector2[],
    step: number,
  ): Phaser.Math.Vector2[] {
    const out: Phaser.Math.Vector2[] = []
    let carry = 0
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      const segLen = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y)
      let d = step - carry
      while (d <= segLen) {
        const t = d / segLen
        out.push(
          new Phaser.Math.Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t),
        )
        d += step
      }
      carry = segLen - (d - step)
    }
    const end = pts[pts.length - 1]
    const last = out[out.length - 1]
    if (!last || Phaser.Math.Distance.Between(last.x, last.y, end.x, end.y) > 4) {
      out.push(end)
    }
    return out
  }

  // Парение в колбе: лёгкое покачивание + медленное вращение.
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

  private doMerge(slot: CapsuleSlot): void {
    const [a, b] = slot.frogs
    const alive =
      a?.container.active &&
      b?.container.active &&
      this.scene.frogs.includes(a) &&
      this.scene.frogs.includes(b)
    if (!alive) {
      this.releaseSurvivors(slot)
      this.freeSlot(slot)
      return
    }
    this.killSlotTweens(slot)
    a.container.angle = 0
    b.container.angle = 0
    const fl = this.worldPt(slot.route.float)
    // performMerge сам removeFrog(a)/(b) + spawnFrog(+1) в (fl) — ловим новую.
    const before = new Set(this.scene.frogs)
    this.merge.performMerge(a, b, fl.x, fl.y)
    const merged = this.scene.frogs.find((f) => !before.has(f))
    if (!merged) {
      // cross-location / blocked — мерджа на поле нет, просто освобождаем.
      this.freeSlot(slot)
      return
    }
    this.routeOut(slot, merged)
  }

  // Обратный маршрут: merged едет из колбы назад на поле (реверс пути).
  private routeOut(slot: CapsuleSlot, merged: FrogData): void {
    this.prepFrog(merged)
    // performMerge спавнит merged со scale 0 + tween роста; prepFrog убил tween —
    // выставляем нормальный масштаб явно, иначе лягушка осталась бы невидимой.
    merged.container.setScale(BASE_SCALE)
    const fl = this.worldPt(slot.route.float)
    const pts = [
      fl,
      this.worldPt(slot.route.entry),
      ...[...TRUNK].reverse().map((p) => this.worldPt(p)),
    ]
    this.hopAlong(slot, merged, pts, () => {
      this.restoreFrog(merged)
      this.freeSlot(slot)
    })
  }

  private freeSlot(slot: CapsuleSlot): void {
    this.killSlotTweens(slot)
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
      if (f && f.container.active) this.restoreFrog(f)
    }
  }

  private restoreFrog(f: FrogData): void {
    this.scene.tweens.killTweensOf(f.container)
    f.container.angle = 0
    f.isAttracted = false
    if (f.body.input) f.body.input.enabled = true
  }

  // Сброс при смене локации/переходе.
  reset(): void {
    for (const slot of this.slots) {
      this.releaseSurvivors(slot)
      slot.frogs = []
      slot.arrived = 0
      slot.state = 'idle'
      slot.cooldownUntil = 0
    }
  }

  destroy(): void {
    this.reset()
  }
}
