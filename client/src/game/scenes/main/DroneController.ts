// DroneController: дроны-сборщики для апгрейда autoCollect (локация 1, Болото).
//
// 2026-05-30: multi-drone. DroneController — менеджер массива DroneInstance.
// Число дронов = upgrades.collectorDrones если autoCollect>0.
// Каждый DroneInstance — независимый дрон (своё движение/заряд/RTB/charge).
//
// Public API (без изменений для MainScene):
//   - tick(level, delta), ensureSpawned(), despawn(), getSprites().

import Phaser from 'phaser'
import {
  getAutoCollectCooldownMs,
  useGameStore,
} from '../../../store/gameStore'
import {
  BOX_DISPLAY_SIZE,
  DASH_RADIUS,
  DPR,
  FIELD_PAD_X,
  FIELD_PAD_Y,
  FIELD_PAD_Y_BOTTOM,
  type BoxData,
} from './types'
import { loadDroneBatteries, saveDroneBatteries } from './droneCharge'
import type { MainScene } from '../MainScene'
import type { BoxController } from './BoxController'

const REACH_DIST = 30 * DPR
const MAX_TILT = 0.15
const TILT_LERP = 0.12
const DRONE_DEPTH = 95000
const MOVE_MS = 550
const DRONE_SCALE_MULT = 0.76
const BOB_AMP = 4 * DPR
const BOB_PERIOD_MS = 3000
const FLY_SPEED = 70 * DPR
const FLY_MIN_MS = 250
// Полный заряд (100%) тратится за это время активной работы (8 минут).
const BATTERY_FULL_MS = 480000

type DroneMode = 'WANDER' | 'COLLECT' | 'RTB' | 'CHARGING' | 'EMERGING'

// Подзарядка на базе (мс) — за это время battery 0 → 100.
const RECHARGE_MS = 60000
// Дверь домика дронов (droner) — точка появления/исчезновения.
const DRONER_X_FRAC = 0.38
const DRONER_Y_FRAC = 0.74
// Маршрут (frac: xf от ширины, yf от высоты зоны строений; yf<0 = поле).
const ENTRY = { xf: 0.536, yf: 0.767 }
const RISE = { xf: 0.534, yf: 0.422 }
const BRANCH_LEFT = [
  { xf: 0.192, yf: 0.268 },
  { xf: 0.455, yf: -0.054 },
]
const BRANCH_RIGHT = [
  { xf: 0.808, yf: 0.272 },
  { xf: 0.574, yf: 0.065 },
  { xf: 0.619, yf: -0.08 },
]

// ─── Один дрон ───────────────────────────────────────────────────────────────
class DroneInstance {
  private scene: MainScene
  private box: BoxController
  private index: number
  // Общий набор «занятых» боксов (один бокс = один дрон).
  private claimed: Set<BoxData>

  private sprite: Phaser.GameObjects.Image | null = null
  private shadow: Phaser.GameObjects.Image | null = null
  private cooldownAccum = 0
  private mode: DroneMode = 'WANDER'
  private collectTarget: BoxData | null = null
  private isHopping = false
  private targetTilt = 0
  private baseScale = 0
  private bobPhase = 0
  private baselineY = 0
  private restTimer: Phaser.Time.TimerEvent | null = null
  private prePauseTimer: Phaser.Time.TimerEvent | null = null
  private isDragging = false
  private lastDragX = 0
  private battery = 100
  // Рассинхрон зарядки: per-дрон множитель скорости разряда (0.8..1.2). Вместе
  // со случайным стартовым зарядом даёт устойчивый десинк RTB/зарядки (после
  // полной зарядки все = 100, но разный дрейн снова разводит их по фазе).
  private batteryDrainMult = Phaser.Math.FloatBetween(0.8, 1.2)
  private tooltip: Phaser.GameObjects.Text | null = null
  private tooltipTimer: Phaser.Time.TimerEvent | null = null
  private chargeBg: Phaser.GameObjects.Rectangle | null = null
  private chargeFill: Phaser.GameObjects.Rectangle | null = null
  // Рассинхрон: per-дрон множитель длительности отдыха (одни ленивее).
  private restBias = Phaser.Math.FloatBetween(0.6, 1.7)

  // Случайная пауза отдыха с учётом bias дрона.
  private restDelay(): number {
    return Math.round(Phaser.Math.Between(2000, 4000) * this.restBias)
  }

  constructor(
    scene: MainScene,
    box: BoxController,
    index: number,
    claimed: Set<BoxData>,
    initialBattery: number,
  ) {
    this.scene = scene
    this.box = box
    this.index = index
    this.claimed = claimed
    this.battery = initialBattery
  }

  getBattery(): number {
    return this.battery
  }

  getCharging(): boolean {
    return this.mode === 'CHARGING'
  }

  // Назначить/снять цель + синхронно claim/release в общем наборе.
  private setCollectTarget(box: BoxData | null): void {
    if (this.collectTarget && this.collectTarget !== box) {
      this.claimed.delete(this.collectTarget)
    }
    this.collectTarget = box
    if (box) this.claimed.add(box)
  }

  ensureSpawned(): void {
    if (!this.sprite) this.spawn()
  }

  getSprites(): Phaser.GameObjects.Image[] {
    const out: Phaser.GameObjects.Image[] = []
    if (this.shadow) out.push(this.shadow)
    if (this.sprite) out.push(this.sprite)
    return out
  }

  private spawn(): void {
    if (this.sprite) return
    const { width, height } = this.scene.scale
    // Появляемся у двери droner-здания, дальше startEmerge выводит на поле.
    const cx = width * DRONER_X_FRAC
    const cy = height + height * DRONER_Y_FRAC

    this.shadow = this.scene.add.image(cx, cy, 'goo_collector')
    ;(this.shadow as unknown as { tintFill: boolean }).tintFill = true
    this.shadow.setTint(0x000000)
    this.shadow.setAlpha(0.32)
    this.shadow.setDepth(DRONE_DEPTH - 1)

    this.sprite = this.scene.add.image(cx, cy, 'goo_collector')
    this.baseScale = (BOX_DISPLAY_SIZE * DRONE_SCALE_MULT) / this.sprite.width
    this.sprite.setScale(this.baseScale)
    this.sprite.setDepth(DRONE_DEPTH)
    this.shadow.setScale(this.baseScale)
    this.baselineY = cy
    // Десинк парения: рандомная стартовая фаза bob — дроны качаются вразнобой.
    this.bobPhase = Math.random() * BOB_PERIOD_MS
    // Рассинхрон работы: отрицательный стартовый cooldown — дроны выходят на
    // сбор не одновременно (одни раньше, другие позже).
    this.cooldownAccum = -Phaser.Math.Between(0, 6000)

    this.sprite.setInteractive({ useHandCursor: true })
    this.scene.input.setDraggable(this.sprite)

    this.sprite.on('pointerup', () => {
      if (!this.isDragging) this.toggleTooltip()
    })
    this.sprite.on('dragstart', () => {
      if (!this.sprite) return
      this.isDragging = true
      if (this.restTimer) { this.restTimer.remove(false); this.restTimer = null }
      if (this.prePauseTimer) { this.prePauseTimer.remove(false); this.prePauseTimer = null }
      this.scene.tweens.killTweensOf(this.sprite)
      this.isHopping = false
      this.mode = 'WANDER'
      this.setCollectTarget(null)
      this.lastDragX = this.sprite.x
    })
    this.sprite.on('drag', (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!this.sprite) return
      const { width: w, height: h } = this.scene.scale
      const clampedX = Phaser.Math.Clamp(dragX, FIELD_PAD_X + 10 * DPR, w - FIELD_PAD_X - 10 * DPR)
      const clampedY = Phaser.Math.Clamp(dragY, FIELD_PAD_Y + 10 * DPR, h - FIELD_PAD_Y_BOTTOM - 10 * DPR)
      const dx = clampedX - this.lastDragX
      this.lastDragX = clampedX
      if (Math.abs(dx) > 0.5) {
        this.targetTilt = Math.sign(dx) * MAX_TILT
        this.sprite.scaleX = (dx > 0 ? -1 : 1) * this.baseScale
      }
      this.sprite.x = clampedX
      this.sprite.y = clampedY
    })
    this.sprite.on('dragend', () => {
      if (!this.sprite) return
      this.isDragging = false
      this.baselineY = this.sprite.y
      this.scheduleNextHop()
    })

    // Выходим из здания (emerge-маршрут дверь→подъём→развилка→поле).
    this.startEmerge()
  }

  despawn(): void {
    this.hideTooltip()
    this.hideChargeBar()
    if (this.restTimer) { this.restTimer.remove(false); this.restTimer = null }
    if (this.prePauseTimer) { this.prePauseTimer.remove(false); this.prePauseTimer = null }
    if (this.sprite) {
      this.scene.tweens.killTweensOf(this.sprite)
      this.sprite.destroy()
      this.sprite = null
    }
    if (this.shadow) {
      this.scene.tweens.killTweensOf(this.shadow)
      this.shadow.destroy()
      this.shadow = null
    }
    this.isDragging = false
    this.cooldownAccum = 0
    this.targetTilt = 0
    this.mode = 'WANDER'
    this.setCollectTarget(null)
    this.isHopping = false
    this.bobPhase = 0
    this.baselineY = 0
  }

  // Уход с локации в transition: sprite+shadow УЖЕ reparent'нуты в зум-контейнер,
  // который уничтожит их через destroy(true). Роняем ссылки БЕЗ destroy (иначе
  // double-destroy) + чистим вспомогательное (tooltip/charge-bar/таймеры).
  releaseForTransition(): void {
    this.hideTooltip()
    this.hideChargeBar()
    if (this.restTimer) { this.restTimer.remove(false); this.restTimer = null }
    if (this.prePauseTimer) { this.prePauseTimer.remove(false); this.prePauseTimer = null }
    if (this.sprite) { this.scene.tweens.killTweensOf(this.sprite); this.sprite = null }
    if (this.shadow) { this.scene.tweens.killTweensOf(this.shadow); this.shadow = null }
    this.setCollectTarget(null)
  }

  private toggleTooltip(): void {
    if (!this.sprite) return
    if (this.tooltip) { this.hideTooltip(); return }
    this.tooltip = this.scene.add
      .text(this.sprite.x, this.sprite.y, `🔋 ${Math.round(this.battery)}%`, {
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: `${Math.round(13 * DPR)}px`,
        color: '#eaf5e6',
        backgroundColor: '#0c1611',
        padding: { x: 6 * DPR, y: 3 * DPR },
      })
      .setOrigin(0.5, 1)
      .setDepth(DRONE_DEPTH + 10)
    this.positionTooltip()
    this.tooltipTimer = this.scene.time.delayedCall(2500, () => this.hideTooltip())
  }

  private hideTooltip(): void {
    if (this.tooltipTimer) { this.tooltipTimer.remove(false); this.tooltipTimer = null }
    if (this.tooltip) { this.tooltip.destroy(); this.tooltip = null }
  }

  private positionTooltip(): void {
    if (!this.tooltip || !this.sprite) return
    this.tooltip.setPosition(this.sprite.x, this.sprite.y - this.sprite.displayHeight * 0.55)
    this.tooltip.setText(`🔋 ${Math.round(this.battery)}%`)
  }

  private startRTB(): void {
    if (!this.sprite) return
    this.mode = 'RTB'
    this.hideTooltip()
    if (this.restTimer) { this.restTimer.remove(false); this.restTimer = null }
    if (this.prePauseTimer) { this.prePauseTimer.remove(false); this.prePauseTimer = null }
    this.scene.tweens.killTweensOf(this.sprite)
    this.isHopping = false
    this.setCollectTarget(null)

    const { width, height } = this.scene.scale
    const toW = (f: { xf: number; yf: number }) => ({ x: f.xf * width, y: height + f.yf * height })
    const branch = Math.random() < 0.5 ? BRANCH_LEFT : BRANCH_RIGHT
    this.flyWaypoints(
      [
        ...[...branch].reverse().map(toW),
        toW(RISE),
        toW(ENTRY),
        toW({ xf: DRONER_X_FRAC, yf: DRONER_Y_FRAC }),
      ],
      () => this.enterDroner(),
    )
  }

  private flyWaypoints(pts: { x: number; y: number }[], onDone: () => void): void {
    if (!this.sprite || pts.length === 0) { onDone(); return }
    const [next, ...rest] = pts
    const sprite = this.sprite
    const dx = next.x - sprite.x
    this.targetTilt = dx !== 0 ? Math.sign(dx) * MAX_TILT : 0
    if (dx !== 0) sprite.scaleX = (dx > 0 ? -1 : 1) * this.baseScale
    const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, next.x, next.y)
    this.scene.tweens.add({
      targets: sprite,
      x: next.x,
      y: next.y,
      duration: Phaser.Math.Clamp((dist / FLY_SPEED) * 1000, FLY_MIN_MS, 4000),
      ease: 'Linear',
      onComplete: () => {
        if (this.sprite) this.flyWaypoints(rest, onDone)
      },
    })
  }

  private enterDroner(): void {
    if (!this.sprite) return
    this.targetTilt = 0
    this.sprite.rotation = 0
    this.scene.tweens.add({
      targets: [this.sprite, this.shadow].filter(Boolean),
      alpha: 0,
      scale: this.baseScale * 0.6,
      duration: 350,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (this.sprite) this.sprite.setVisible(false)
        if (this.shadow) this.shadow.setVisible(false)
        this.mode = 'CHARGING'
        this.showChargeBar()
      },
    })
  }

  private showChargeBar(): void {
    this.hideChargeBar()
    const { width, height } = this.scene.scale
    // Бары соседних дронов раздвигаем по x (index * 13).
    const x = width * DRONER_X_FRAC - 45 * DPR + this.index * 13 * DPR
    const y = height + height * DRONER_Y_FRAC - 75 * DPR
    const w = 9 * DPR
    const h = 48 * DPR
    this.chargeBg = this.scene.add
      .rectangle(x, y, w, h, 0x0c1611, 0.92)
      .setOrigin(0.5, 1)
      .setDepth(210000)
    this.chargeFill = this.scene.add
      .rectangle(x, y, w - 4 * DPR, 0, 0x5fd83a, 1)
      .setOrigin(0.5, 1)
      .setDepth(210001)
  }

  private updateChargeBar(): void {
    if (!this.chargeFill || !this.chargeBg) return
    const fullH = (this.chargeBg.height - 4 * DPR) * (this.battery / 100)
    this.chargeFill.setSize(this.chargeFill.width, fullH)
  }

  private hideChargeBar(): void {
    this.chargeBg?.destroy()
    this.chargeFill?.destroy()
    this.chargeBg = null
    this.chargeFill = null
  }

  private startEmerge(): void {
    this.hideChargeBar()
    if (!this.sprite) return
    this.mode = 'EMERGING'
    const { width, height } = this.scene.scale
    const dronerX = width * DRONER_X_FRAC
    const dronerY = height + height * DRONER_Y_FRAC
    this.sprite.setPosition(dronerX, dronerY)
    this.sprite.setAlpha(0).setScale(this.baseScale * 0.6).setVisible(true)
    if (this.shadow) {
      this.shadow.setPosition(dronerX + 4 * DPR, dronerY + 28 * DPR)
      this.shadow.setAlpha(0).setScale(this.baseScale * 0.6).setVisible(true)
      this.scene.tweens.add({
        targets: this.shadow,
        alpha: 0.32,
        scale: this.baseScale,
        duration: 350,
        ease: 'Back.easeOut',
      })
    }
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      scale: this.baseScale,
      duration: 350,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.sprite) return
        const toW = (f: { xf: number; yf: number }) => ({ x: f.xf * width, y: height + f.yf * height })
        const branch = Math.random() < 0.5 ? BRANCH_LEFT : BRANCH_RIGHT
        this.flyWaypoints([toW(ENTRY), toW(RISE), ...branch.map(toW)], () => {
          this.targetTilt = 0
          if (this.sprite) this.baselineY = this.sprite.y
          this.mode = 'WANDER'
          this.cooldownAccum = 0
          this.scheduleNextHop()
        })
      },
    })
  }

  tick(level: number, delta: number): void {
    // Не спавним из tick — спавн только через ensureSpawned (staggered менеджером).
    if (!this.sprite) return
    const sprite = this.sprite

    if (!this.isDragging && (this.mode === 'WANDER' || this.mode === 'COLLECT')) {
      this.battery = Math.max(0, this.battery - ((100 * delta) / BATTERY_FULL_MS) * this.batteryDrainMult)
      if (this.battery <= 0) this.startRTB()
    }
    if (this.mode === 'CHARGING') {
      this.battery = Math.min(100, this.battery + (100 * delta) / RECHARGE_MS)
      this.updateChargeBar()
      if (this.battery >= 100) this.startEmerge()
    }
    if (this.tooltip) this.positionTooltip()

    sprite.rotation = Phaser.Math.Linear(sprite.rotation, this.targetTilt, TILT_LERP)

    if (this.shadow) {
      const shScale = 0.85
      this.shadow.x = sprite.x + 4 * DPR
      this.shadow.y = sprite.y + 28 * DPR
      this.shadow.rotation = sprite.rotation
      this.shadow.scaleX = sprite.scaleX * shScale
      this.shadow.scaleY = sprite.scaleY * shScale
    }
    if (this.isDragging) {
      this.targetTilt = Phaser.Math.Linear(this.targetTilt, 0, TILT_LERP)
      return
    }

    if (this.mode !== 'WANDER' && this.mode !== 'COLLECT') return

    const cooldown = getAutoCollectCooldownMs(level)
    this.cooldownAccum = Math.min(this.cooldownAccum + delta, cooldown * 2)

    if (this.mode === 'COLLECT') {
      if (
        this.collectTarget === null ||
        !this.scene.boxes.includes(this.collectTarget) ||
        !this.collectTarget.img.active
      ) {
        const nearest = this.findNearestNormalBox(sprite.x, sprite.y)
        if (nearest) {
          this.setCollectTarget(nearest)
          if (this.isHopping) { this.scene.tweens.killTweensOf(sprite); this.isHopping = false; this.baselineY = sprite.y }
          this.startHop()
        } else {
          // Отмена hop'а: фиксируем baselineY на текущую позицию — иначе bob в
          // WANDER снапнет дрон к старому baselineY (отбрасывание назад).
          if (this.isHopping) { this.scene.tweens.killTweensOf(sprite); this.isHopping = false; this.baselineY = sprite.y }
          this.mode = 'WANDER'
          this.setCollectTarget(null)
          this.cooldownAccum = cooldown
        }
      }
    }

    if (this.mode === 'WANDER' && this.cooldownAccum >= cooldown) {
      const nearest = this.findNearestNormalBox(sprite.x, sprite.y)
      if (nearest) {
        this.mode = 'COLLECT'
        this.setCollectTarget(nearest)
        if (!this.isHopping) {
          if (this.restTimer) { this.restTimer.remove(false); this.restTimer = null }
          this.startHop()
        }
      } else {
        this.cooldownAccum = cooldown
      }
    }

    this.bobPhase += delta
    if (!this.isHopping) {
      const bob = BOB_AMP * Math.sin((this.bobPhase * 2 * Math.PI) / BOB_PERIOD_MS)
      sprite.y = this.baselineY + bob
    }
  }

  private scheduleNextHop(): void {
    if (!this.sprite) return
    this.restTimer = this.scene.time.delayedCall(this.restDelay(), () => {
      this.restTimer = null
      if (this.sprite) this.startHop()
    })
  }

  private startHop(): void {
    if (!this.sprite || this.isHopping) return
    const sprite = this.sprite
    const { width, height } = this.scene.scale

    let toX: number
    let toY: number
    let prePauseMs: number
    let moveDuration: number
    let moveEase: string

    if (this.mode === 'COLLECT' && this.collectTarget) {
      const target = this.collectTarget
      toX = Phaser.Math.Clamp(target.img.x, FIELD_PAD_X + 10 * DPR, width - FIELD_PAD_X - 10 * DPR)
      toY = Phaser.Math.Clamp(target.img.y, FIELD_PAD_Y + 10 * DPR, height - FIELD_PAD_Y_BOTTOM - 10 * DPR)
      prePauseMs = 0
      const dx = toX - sprite.x
      const dy = toY - sprite.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      moveDuration = Phaser.Math.Clamp((dist / FLY_SPEED) * 1000, FLY_MIN_MS, 60000)
      moveEase = 'Sine.easeInOut'
    } else {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const dist = Phaser.Math.FloatBetween(40 * DPR, DASH_RADIUS)
      toX = Phaser.Math.Clamp(sprite.x + Math.cos(angle) * dist, FIELD_PAD_X + 10 * DPR, width - FIELD_PAD_X - 10 * DPR)
      toY = Phaser.Math.Clamp(sprite.y + Math.sin(angle) * dist, FIELD_PAD_Y + 10 * DPR, height - FIELD_PAD_Y_BOTTOM - 10 * DPR)
      prePauseMs = 350
      moveDuration = MOVE_MS
      moveEase = 'Power2.easeOut'
    }

    this.isHopping = true

    const doTween = () => {
      if (!this.sprite) return
      const dx = toX - this.sprite.x
      this.targetTilt = dx !== 0 ? Math.sign(dx) * MAX_TILT : 0
      if (dx !== 0) this.sprite.scaleX = (dx > 0 ? -1 : 1) * this.baseScale
      this.scene.tweens.add({
        targets: this.sprite,
        x: toX,
        y: toY,
        duration: moveDuration,
        ease: moveEase,
        onComplete: () => {
          if (!this.sprite) return
          this.baselineY = this.sprite.y
          this.targetTilt = 0
          this.isHopping = false

          if (this.mode === 'COLLECT' && this.collectTarget) {
            const dist = Phaser.Math.Distance.Between(
              this.sprite.x, this.sprite.y,
              this.collectTarget.img.x, this.collectTarget.img.y,
            )
            if (dist < REACH_DIST) {
              this.box.onBoxTapped(this.collectTarget)
              this.cooldownAccum = 0
              this.mode = 'WANDER'
              this.setCollectTarget(null)
              this.restTimer = this.scene.time.delayedCall(this.restDelay(), () => {
                this.restTimer = null
                if (this.sprite) this.startHop()
              })
              return
            }
            this.startHop()
            return
          }
          this.scheduleNextHop()
        },
      })
    }

    if (prePauseMs > 0) {
      this.prePauseTimer = this.scene.time.delayedCall(prePauseMs, () => {
        this.prePauseTimer = null
        if (!this.sprite) { this.isHopping = false; return }
        doTween()
      })
    } else {
      doTween()
    }
  }

  private findNearestNormalBox(x: number, y: number): BoxData | null {
    const normalBoxes = this.scene.boxes.filter(
      (b) =>
        !b.isRare &&
        b.img.active &&
        !b.isLanding &&
        (b === this.collectTarget || !this.claimed.has(b)),
    )
    if (normalBoxes.length === 0) return null
    let closest = normalBoxes[0]
    let minDist = Phaser.Math.Distance.Between(x, y, closest.img.x, closest.img.y)
    for (let i = 1; i < normalBoxes.length; i++) {
      const d = Phaser.Math.Distance.Between(x, y, normalBoxes[i].img.x, normalBoxes[i].img.y)
      if (d < minDist) { minDist = d; closest = normalBoxes[i] }
    }
    return closest
  }
}

// ─── Менеджер дронов ─────────────────────────────────────────────────────────
export class DroneController {
  private scene: MainScene
  private box: BoxController
  private instances: DroneInstance[] = []
  // Один бокс = один дрон. Общий набор для всех инстансов.
  private claimed: Set<BoxData> = new Set()
  // Throttle синка зарядов в store (для модалки).
  private syncMs = 0
  // Восстановленные (досчитанные офлайн) заряды по индексу. Раздаём новым
  // инстансам; для индексов сверх массива — случайный заряд.
  private restored: number[] = loadDroneBatteries('c')
  // Throttle персиста заряда в localStorage.
  private persistMs = 0
  // Очередь спавна: новые дроны выходят из здания по одному (не все разом).
  private spawnQueue: DroneInstance[] = []
  private spawnAccum = 0

  constructor(scene: MainScene, box: BoxController) {
    this.scene = scene
    this.box = box
  }

  private initialBatteryFor(index: number): number {
    const r = this.restored[index]
    return typeof r === 'number' ? r : Phaser.Math.Between(45, 100)
  }

  private persist(): void {
    if (this.instances.length > 0) {
      saveDroneBatteries(
        'c',
        this.instances.map((d) => d.getBattery()),
        this.instances.map((d) => d.getCharging()),
      )
    }
  }

  // Желаемое число дронов-сборщиков: 0 если autoCollect не куплен, иначе
  // collectorDrones (сколько слотов отдано под сборщиков).
  private targetCount(): number {
    const s = useGameStore.getState()
    if ((s.upgrades.autoCollect ?? 0) <= 0) return 0
    return Math.max(0, s.upgrades.collectorDrones ?? 0)
  }

  private sync(want: number): void {
    while (this.instances.length < want) {
      const idx = this.instances.length
      const inst = new DroneInstance(this.scene, this.box, idx, this.claimed, this.initialBatteryFor(idx))
      // НЕ спавним сразу — ставим в очередь, выходят по одному (см. drainSpawnQueue).
      this.instances.push(inst)
      this.spawnQueue.push(inst)
    }
    while (this.instances.length > want) {
      const removed = this.instances.pop()!
      const qi = this.spawnQueue.indexOf(removed)
      if (qi >= 0) this.spawnQueue.splice(qi, 1)
      removed.despawn()
    }
  }

  // Выпускаем из очереди по одному дрону раз в STAGGER (выход из здания).
  private drainSpawnQueue(delta: number): void {
    if (this.spawnQueue.length === 0) return
    const STAGGER_MS = 450
    this.spawnAccum += delta
    if (this.spawnAccum >= STAGGER_MS) {
      this.spawnAccum = 0
      this.spawnQueue.shift()!.ensureSpawned()
    }
  }

  ensureSpawned(): void {
    this.sync(this.targetCount())
  }

  tick(level: number, delta: number): void {
    this.sync(this.targetCount())
    this.drainSpawnQueue(delta)
    // Снимаем claim с боксов, которых уже нет на поле (защита от утечки).
    for (const b of this.claimed) {
      if (!this.scene.boxes.includes(b) || !b.img.active) this.claimed.delete(b)
    }
    for (const d of this.instances) d.tick(level, delta)
    // В store кладём заряд каждого дрона (для модалки). Throttle ~500мс.
    this.syncMs += delta
    if (this.syncMs >= 500) {
      this.syncMs = 0
      useGameStore
        .getState()
        .setDroneBatteries(this.instances.map((d) => Math.round(d.getBattery())))
    }
    // Персист заряда ~ раз в 3с (для восстановления после reload).
    this.persistMs += delta
    if (this.persistMs >= 3000) {
      this.persistMs = 0
      this.persist()
    }
  }

  despawn(): void {
    this.persist() // сохраняем перед уходом с локации
    for (const d of this.instances) d.despawn()
    this.instances = []
    this.spawnQueue = []
    this.claimed.clear()
    useGameStore.getState().setDroneBatteries([])
  }

  // Уход с Болота в transition: спрайты дронов reparent'нуты в зум-контейнер
  // (он их уничтожит). Persist'им заряд, роняем ссылки БЕЗ destroy, чистим
  // менеджерское состояние. На возврате ensureSpawned() пересоздаст дронов.
  releaseForTransition(): void {
    this.persist()
    for (const d of this.instances) d.releaseForTransition()
    this.instances = []
    this.spawnQueue = []
    this.claimed.clear()
    useGameStore.getState().setDroneBatteries([])
  }

  getSprites(): Phaser.GameObjects.Image[] {
    return this.instances.flatMap((d) => d.getSprites())
  }
}
