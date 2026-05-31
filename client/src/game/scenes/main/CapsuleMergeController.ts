// CapsuleMergeController: авто-мердж через капсулы репликации (loc2).
//
// Когда на поле образуется пара лягушек одного уровня (L7-11), свободная
// капсула «забирает» обе: они идут по маршруту (trunk → вход капсулы → точка
// парения), там парят/крутятся, и когда обе доехали — мердж, результат (+1)
// появляется на поле. Ручной мердж на поле НЕ затрагивается — это помощник.
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

const TRAVEL_SPEED = 650 // px/сек по маршруту
const SECOND_FROG_DELAY = 350 // мс — второй стартует позже (single-file)
const FLOAT_OFFSET_FRAC = 0.045 // разнос двух лягушек в точке парения (доля W)
const CAP_LEVEL = 12 // L12+ не авто-мерджим
const COOLDOWN_MS = 500 // пауза капсулы после мерджа

type CapsuleState = 'idle' | 'busy' | 'merging' | 'cooldown'

interface CapsuleSlot {
  route: CapsuleRoute
  state: CapsuleState
  frogs: FrogData[]
  arrived: number
  outX: number
  outY: number
  cooldownUntil: number
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
      outX: 0,
      outY: 0,
      cooldownUntil: 0,
    }))
  }

  private worldPt(p: Pt): { x: number; y: number } {
    const { width, height } = this.scene.scale
    return { x: p[0] * width, y: height * (1 + p[1]) }
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
      if (!pair) break // нет пар — дальше тоже не будет
      this.claim(slot, pair)
    }
  }

  private claim(slot: CapsuleSlot, [a, b]: [FrogData, FrogData]): void {
    slot.state = 'busy'
    slot.frogs = [a, b]
    slot.arrived = 0
    // Точка выхода результата — середина исходных позиций (на поле).
    slot.outX = (a.container.x + b.container.x) / 2
    slot.outY = (a.container.y + b.container.y) / 2

    const offset = this.scene.scale.width * FLOAT_OFFSET_FRAC
    this.prepFrog(a)
    this.prepFrog(b)
    this.routeFrog(slot, a, -offset, 0)
    this.routeFrog(slot, b, +offset, SECOND_FROG_DELAY)
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
    // Нельзя схватить пока едет (dragstart убил бы route-tween → колба зависла).
    // input.enabled сохраняет hitArea/draggable — чисто включаем обратно.
    if (f.body.input) f.body.input.enabled = false
  }

  private routeFrog(
    slot: CapsuleSlot,
    f: FrogData,
    floatDx: number,
    delay: number,
  ): void {
    const pts = TRUNK.map((p) => this.worldPt(p))
    pts.push(this.worldPt(slot.route.entry))
    const fl = this.worldPt(slot.route.float)
    pts.push({ x: fl.x + floatDx, y: fl.y })

    const startSeg = (i: number) => {
      if (!f.container.active || slot.state !== 'busy') return
      if (i >= pts.length) {
        this.startBob(f, floatDx < 0 ? -1 : 1)
        slot.arrived++
        if (slot.arrived >= 2) this.doMerge(slot)
        return
      }
      const target = pts[i]
      const dist = Phaser.Math.Distance.Between(
        f.container.x,
        f.container.y,
        target.x,
        target.y,
      )
      this.scene.tweens.add({
        targets: f.container,
        x: target.x,
        y: target.y,
        duration: Math.max(120, (dist / TRAVEL_SPEED) * 1000),
        ease: 'Sine.easeInOut',
        onComplete: () => startSeg(i + 1),
      })
    }

    if (delay > 0) {
      this.scene.time.delayedCall(delay, () => startSeg(0))
    } else {
      startSeg(0)
    }
  }

  // Парение в колбе: лёгкое покачивание + медленное вращение.
  private startBob(f: FrogData, _dir: number): void {
    if (!f.container.active) return
    this.scene.tweens.add({
      targets: f.container,
      y: f.container.y - 12,
      duration: 700,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
    this.scene.tweens.add({
      targets: f.container,
      angle: 360,
      duration: 3000,
      repeat: -1,
    })
  }

  private doMerge(slot: CapsuleSlot): void {
    const [a, b] = slot.frogs
    // Защита: обе ещё живы и в сцене?
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
    slot.state = 'merging'
    this.scene.tweens.killTweensOf(a.container)
    this.scene.tweens.killTweensOf(b.container)
    a.container.angle = 0
    b.container.angle = 0
    // performMerge сам removeFrog(a)/(b) + spawnFrog(+1) в (outX,outY) на поле.
    this.merge.performMerge(a, b, slot.outX, slot.outY)
    this.freeSlot(slot)
  }

  private freeSlot(slot: CapsuleSlot): void {
    slot.frogs = []
    slot.arrived = 0
    slot.state = 'cooldown'
    slot.cooldownUntil = this.scene.time.now + COOLDOWN_MS
  }

  // Если мердж сорвался — вернуть уцелевших лягушек в нормальную жизнь.
  private releaseSurvivors(slot: CapsuleSlot): void {
    for (const f of slot.frogs) {
      if (!f || !f.container.active) continue
      this.restoreFrog(f)
    }
  }

  private restoreFrog(f: FrogData): void {
    this.scene.tweens.killTweensOf(f.container)
    f.container.angle = 0
    f.isAttracted = false
    if (f.body.input) f.body.input.enabled = true
  }

  // Сброс при смене локации/переходе: вернуть всех едущих лягушек в норму.
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
