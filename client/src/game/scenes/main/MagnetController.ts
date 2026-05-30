// Phase 21-04: Magnet controller.
//
// 2026-05-30: магнит — persistent летающий дрон (magnet_drone.png). Движется
// ТОЧНО как goo_collector (DroneController): hop-модель (rest-pause → pre-pause
// → tween), наклон в момент старта, парение в покое, тень. Разница: вместо
// сбора бокса (COLLECT) — летит к паре одноуровневых лягушек (WORK), долетев
// стягивает их (PULLING) и мерджит.
//
// Public API:
//   - tick(level, delta): per-frame (caller проверил magnetEnabled/болото/
//     !serumPaused). Спавнит дрон при первом вызове.
//   - resetSpawnTimer(): сброс рабочего кулдауна.
//   - clearAll(): despawn дрона.

import Phaser from 'phaser'
import {
  getMagnetSpawnInterval,
  getMagnetMergesPerCycle,
} from '../../../store/gameStore'
import {
  MERGE_RADIUS,
  BOX_DISPLAY_SIZE,
  DASH_RADIUS,
  DPR,
  FIELD_PAD_X,
  FIELD_PAD_Y,
  FIELD_PAD_Y_BOTTOM,
  type FrogData,
} from './types'
import type { MainScene } from '../MainScene'
import type { MergeController } from './MergeController'

// SYNC с DroneController — одинаковое ощущение полёта.
const MAX_TILT = 0.15
const TILT_LERP = 0.12
const MOVE_MS = 550
const BOB_AMP = 4 * DPR
const BOB_PERIOD_MS = 3000
const FLY_SPEED = 70 * DPR
const FLY_MIN_MS = 250
const REACH_DIST = 30 * DPR
const MAGNET_DEPTH = 96000
// Притяжение пары к дрону в фазе PULLING (lerp за кадр).
const PULL = 0.08
// Размер дрона.
const DRONE_SCALE_MULT = 0.7

type MagnetMode = 'WANDER' | 'WORK' | 'PULLING'

export class MagnetController {
  private scene: MainScene
  private merge: MergeController

  private sprite: Phaser.GameObjects.Image | null = null
  private shadow: Phaser.GameObjects.Image | null = null
  private baseScale = 0

  private mode: MagnetMode = 'WANDER'
  private targetTilt = 0
  private bobPhase = 0
  private baselineY = 0
  private isHopping = false
  private restTimer: Phaser.Time.TimerEvent | null = null
  private prePauseTimer: Phaser.Time.TimerEvent | null = null

  // Рабочий кулдаун (мс).
  private workAccum = 0
  // Пара в работе.
  private pair: [FrogData, FrogData] | null = null
  private mergesDone = 0
  private mergesTarget = 1

  constructor(scene: MainScene, merge: MergeController) {
    this.scene = scene
    this.merge = merge
  }

  get magnets(): readonly never[] {
    return []
  }

  resetSpawnTimer(): void {
    this.workAccum = 0
  }

  clearAll(): void {
    const scene = this.scene
    if (this.restTimer) {
      this.restTimer.remove(false)
      this.restTimer = null
    }
    if (this.prePauseTimer) {
      this.prePauseTimer.remove(false)
      this.prePauseTimer = null
    }
    if (this.sprite) {
      scene.tweens.killTweensOf(this.sprite)
      this.sprite.destroy()
      this.sprite = null
    }
    if (this.shadow) {
      scene.tweens.killTweensOf(this.shadow)
      this.shadow.destroy()
      this.shadow = null
    }
    this.mode = 'WANDER'
    this.pair = null
    this.workAccum = 0
    this.isHopping = false
    this.targetTilt = 0
    this.bobPhase = 0
    this.baselineY = 0
  }

  private spawn(): void {
    const scene = this.scene
    const { width, height } = scene.scale
    const cx = width / 2
    const cy = (FIELD_PAD_Y + (height - FIELD_PAD_Y_BOTTOM)) / 2

    this.shadow = scene.add.image(cx, cy, 'magnet_drone')
    ;(this.shadow as unknown as { tintFill: boolean }).tintFill = true
    this.shadow.setTint(0x000000)
    this.shadow.setAlpha(0.3)
    this.shadow.setDepth(MAGNET_DEPTH - 1)

    this.sprite = scene.add.image(cx, cy, 'magnet_drone')
    this.baseScale = (BOX_DISPLAY_SIZE * DRONE_SCALE_MULT) / this.sprite.width
    this.sprite.setScale(this.baseScale)
    this.sprite.setDepth(MAGNET_DEPTH)
    this.shadow.setScale(this.baseScale)
    this.baselineY = cy

    this.scheduleNextHop()
  }

  tick(level: number, delta: number): void {
    if (!this.sprite) this.spawn()
    const sprite = this.sprite!

    sprite.rotation = Phaser.Math.Linear(sprite.rotation, this.targetTilt, TILT_LERP)

    // Тень (как у goo_collector: ниже + меньше = парение).
    if (this.shadow) {
      this.shadow.x = sprite.x + 4 * DPR
      this.shadow.y = sprite.y + 26 * DPR
      this.shadow.rotation = sprite.rotation
      this.shadow.scaleX = sprite.scaleX * 0.85
      this.shadow.scaleY = sprite.scaleY * 0.85
    }

    const spawnInterval = getMagnetSpawnInterval(level)
    this.workAccum = Math.min(this.workAccum + delta, spawnInterval * 2)

    // ─── PULLING: стягиваем пару к дрону, мерджим ───
    if (this.mode === 'PULLING') {
      this.updatePull()
    }

    // ─── Валидация WORK-цели ───
    if (this.mode === 'WORK') {
      if (!this.isPairValid()) {
        // Пара пропала — назад в WANDER
        if (this.isHopping) {
          this.scene.tweens.killTweensOf(sprite)
          this.isHopping = false
        }
        this.mode = 'WANDER'
        this.pair = null
        this.workAccum = spawnInterval
      }
    }

    // ─── WANDER → WORK переход ───
    if (this.mode === 'WANDER' && this.workAccum >= spawnInterval) {
      const pair = this.merge.findClosestSameLevelPair()
      if (pair) {
        this.pair = pair
        this.mergesDone = 0
        this.mergesTarget = getMagnetMergesPerCycle(level) || 1
        this.mode = 'WORK'
        if (!this.isHopping) {
          if (this.restTimer) {
            this.restTimer.remove(false)
            this.restTimer = null
          }
          this.startHop()
        }
      } else {
        this.workAccum = spawnInterval
      }
    }

    // Парение в покое.
    this.bobPhase += delta
    if (!this.isHopping && this.mode !== 'PULLING') {
      const bob =
        BOB_AMP * Math.sin((this.bobPhase * 2 * Math.PI) / BOB_PERIOD_MS)
      sprite.y = this.baselineY + bob
    }
  }

  private isPairValid(): boolean {
    if (!this.pair) return false
    const [a, b] = this.pair
    return (
      this.scene.frogs.includes(a) &&
      this.scene.frogs.includes(b) &&
      !a.isDragging &&
      !a.isMerging &&
      !b.isDragging &&
      !b.isMerging
    )
  }

  private pairMidpoint(): { x: number; y: number } | null {
    if (!this.pair) return null
    const [a, b] = this.pair
    return {
      x: (a.container.x + b.container.x) / 2,
      y: (a.container.y + b.container.y) / 2,
    }
  }

  private updatePull(): void {
    if (!this.isPairValid() || !this.sprite) {
      this.endWork()
      return
    }
    const [a, b] = this.pair!
    const sx = this.sprite.x
    const sy = this.sprite.y
    a.container.x = Phaser.Math.Linear(a.container.x, sx, PULL)
    a.container.y = Phaser.Math.Linear(a.container.y, sy, PULL)
    b.container.x = Phaser.Math.Linear(b.container.x, sx, PULL)
    b.container.y = Phaser.Math.Linear(b.container.y, sy, PULL)
    a.isAttracted = true
    b.isAttracted = true

    const d = Phaser.Math.Distance.Between(
      a.container.x,
      a.container.y,
      b.container.x,
      b.container.y,
    )
    if (d < MERGE_RADIUS * 0.7) {
      this.merge.performMerge(a, b, sx, sy)
      this.mergesDone += 1
      if (this.mergesDone >= this.mergesTarget) {
        this.endWork()
        return
      }
      const next = this.merge.findClosestSameLevelPair()
      if (next) {
        this.pair = next
        this.mode = 'WORK'
        if (!this.isHopping) this.startHop()
      } else {
        this.endWork()
      }
    }
  }

  private endWork(): void {
    if (this.pair) {
      for (const f of this.pair) {
        if (this.scene.frogs.includes(f)) f.isAttracted = false
      }
    }
    this.pair = null
    this.mode = 'WANDER'
    this.workAccum = 0
    if (!this.isHopping) {
      this.restTimer = this.scene.time.delayedCall(
        Phaser.Math.Between(2000, 4000),
        () => {
          this.restTimer = null
          if (this.sprite) this.startHop()
        },
      )
    }
  }

  private scheduleNextHop(): void {
    if (!this.sprite) return
    this.restTimer = this.scene.time.delayedCall(
      Phaser.Math.Between(2000, 4000),
      () => {
        this.restTimer = null
        if (this.sprite) this.startHop()
      },
    )
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

    const mid = this.mode === 'WORK' ? this.pairMidpoint() : null
    if (mid) {
      // Летим прямо к паре (полная дистанция).
      toX = Phaser.Math.Clamp(mid.x, FIELD_PAD_X + 10 * DPR, width - FIELD_PAD_X - 10 * DPR)
      toY = Phaser.Math.Clamp(mid.y, FIELD_PAD_Y + 10 * DPR, height - FIELD_PAD_Y_BOTTOM - 10 * DPR)
      prePauseMs = 0
      const dx = toX - sprite.x
      const dy = toY - sprite.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      moveDuration = Phaser.Math.Clamp((dist / FLY_SPEED) * 1000, FLY_MIN_MS, 60000)
      moveEase = 'Sine.easeInOut'
    } else {
      // WANDER hop.
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
      if (dx !== 0) {
        // Арт смотрит влево → зеркалим при движении вправо (как goo_collector).
        this.sprite.scaleX = (dx > 0 ? -1 : 1) * this.baseScale
      }
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

          if (this.mode === 'WORK' && this.pair) {
            const mp = this.pairMidpoint()
            const dist = mp
              ? Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, mp.x, mp.y)
              : Infinity
            if (dist < REACH_DIST) {
              // Долетели — стягиваем пару.
              this.mode = 'PULLING'
              return
            }
            // Цель сместилась — продолжаем лететь.
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
        if (!this.sprite) {
          this.isHopping = false
          return
        }
        doTween()
      })
    } else {
      doTween()
    }
  }
}
