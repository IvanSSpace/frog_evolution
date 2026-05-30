// DroneController: дроны-сборщики для апгрейда autoCollect (локация 1, Болото).
//
// 2026-05-30: multi-drone. DroneController — менеджер массива DroneInstance.
// Число дронов = dronesFromCount(upgrades.droneCount) если autoCollect>0.
// Каждый DroneInstance — независимый дрон (своё движение/заряд/RTB/charge).
//
// Public API (без изменений для MainScene):
//   - tick(level, delta), ensureSpawned(), despawn(), getSprites().

import Phaser from 'phaser'
import {
  getAutoCollectCooldownMs,
  useGameStore,
} from '../../../store/gameStore'
import { dronesFromCount } from '../../config/upgrades'
import {
  BOX_DISPLAY_SIZE,
  DASH_RADIUS,
  DPR,
  FIELD_PAD_X,
  FIELD_PAD_Y,
  FIELD_PAD_Y_BOTTOM,
  type BoxData,
} from './types'
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
  private tooltip: Phaser.GameObjects.Text | null = null
  private tooltipTimer: Phaser.Time.TimerEvent | null = null
  private chargeBg: Phaser.GameObjects.Rectangle | null = null
  private chargeFill: Phaser.GameObjects.Rectangle | null = null

  constructor(scene: MainScene, box: BoxController, index: number) {
    this.scene = scene
    this.box = box
    this.index = index
  }

  getBattery(): number {
    return this.battery
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
    const cx = Phaser.Math.Between(FIELD_PAD_X + 10 * DPR, width - FIELD_PAD_X - 10 * DPR)
    const cy = Phaser.Math.Between(FIELD_PAD_Y + 10 * DPR, height - FIELD_PAD_Y_BOTTOM - 10 * DPR)

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
      this.collectTarget = null
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

    this.scheduleNextHop()
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
    this.collectTarget = null
    this.isHopping = false
    this.bobPhase = 0
    this.baselineY = 0
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
    this.collectTarget = null

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
    if (!this.sprite) this.spawn()
    const sprite = this.sprite!

    if (!this.isDragging && (this.mode === 'WANDER' || this.mode === 'COLLECT')) {
      this.battery = Math.max(0, this.battery - (100 * delta) / BATTERY_FULL_MS)
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
          this.collectTarget = nearest
          if (this.isHopping) { this.scene.tweens.killTweensOf(sprite); this.isHopping = false }
          this.startHop()
        } else {
          if (this.isHopping) { this.scene.tweens.killTweensOf(sprite); this.isHopping = false }
          this.mode = 'WANDER'
          this.collectTarget = null
          this.cooldownAccum = cooldown
        }
      }
    }

    if (this.mode === 'WANDER' && this.cooldownAccum >= cooldown) {
      const nearest = this.findNearestNormalBox(sprite.x, sprite.y)
      if (nearest) {
        this.mode = 'COLLECT'
        this.collectTarget = nearest
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
    this.restTimer = this.scene.time.delayedCall(Phaser.Math.Between(2000, 4000), () => {
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
              this.collectTarget = null
              this.restTimer = this.scene.time.delayedCall(Phaser.Math.Between(2000, 4000), () => {
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
      (b) => !b.isRare && b.img.active && !b.isLanding,
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

  constructor(scene: MainScene, box: BoxController) {
    this.scene = scene
    this.box = box
  }

  // Желаемое число дронов: 0 если autoCollect не куплен, иначе 1..4 по droneCount.
  private targetCount(): number {
    const s = useGameStore.getState()
    if ((s.upgrades.autoCollect ?? 0) <= 0) return 0
    return dronesFromCount(s.upgrades.droneCount)
  }

  private sync(want: number): void {
    while (this.instances.length < want) {
      const inst = new DroneInstance(this.scene, this.box, this.instances.length)
      inst.ensureSpawned()
      this.instances.push(inst)
    }
    while (this.instances.length > want) {
      this.instances.pop()!.despawn()
    }
  }

  ensureSpawned(): void {
    this.sync(this.targetCount())
    for (const d of this.instances) d.ensureSpawned()
  }

  tick(level: number, delta: number): void {
    this.sync(this.targetCount())
    for (const d of this.instances) d.tick(level, delta)
    // В store кладём минимальный заряд активных дронов (для модалки).
    const bats = this.instances.map((d) => d.getBattery())
    useGameStore
      .getState()
      .setDroneBattery(bats.length ? Math.round(Math.min(...bats)) : -1)
  }

  despawn(): void {
    for (const d of this.instances) d.despawn()
    this.instances = []
    useGameStore.getState().setDroneBattery(-1)
  }

  getSprites(): Phaser.GameObjects.Image[] {
    return this.instances.flatMap((d) => d.getSprites())
  }
}
