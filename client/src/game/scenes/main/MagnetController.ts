// Phase 21-04: Magnet controller.
//
// 2026-05-30: магнит — persistent летающий дрон (magnet_drone.png), как
// goo_collector. Постоянно бродит по полю (WANDER), периодически (раз в
// spawnInterval) находит ближайшую пару одноуровневых лягушек, летит к ним
// (WORK), стягивает и мерджит. Затем возвращается к блужданию.
//
// Public API:
//   - tick(level, delta): per-frame (caller проверил magnetEnabled / болото /
//     !serumPaused). Спавнит дрон при первом вызове.
//   - resetSpawnTimer(): сброс рабочего кулдауна (после transition/serum).
//   - clearAll(): despawn дрона (при transition / уходе с локации).

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

// Максимальный наклон по ходу (рад) + сглаживание.
const MAX_TILT = 0.13
const TILT_LERP = 0.14
// Скорость движения к цели (lerp-фактор за кадр).
const CHASE_LERP = 0.08
// Парение в покое.
const BOB_AMP = 4 * DPR
const BOB_PERIOD_MS = 2800
// Притяжение лягушек к дрону (lerp за кадр).
const PULL = 0.07
// Депт — поверх лягушек/боксов.
const MAGNET_DEPTH = 96000

type MagnetMode = 'WANDER' | 'WORK'

export class MagnetController {
  private scene: MainScene
  private merge: MergeController

  private sprite: Phaser.GameObjects.Image | null = null
  private shadow: Phaser.GameObjects.Image | null = null
  private baseScale = 1

  private mode: MagnetMode = 'WANDER'
  private targetX = 0
  private targetY = 0
  private prevX = 0
  private targetTilt = 0
  private bobPhase = 0
  private baselineY = 0

  // Рабочий кулдаун (мс) — раз в spawnInterval дрон идёт мерджить пару.
  private workAccum = 0
  // Пара в работе.
  private pair: [FrogData, FrogData] | null = null
  private mergesDone = 0
  private mergesTarget = 1
  // Таймер смены wander-цели.
  private wanderTimer = 0

  constructor(scene: MainScene, merge: MergeController) {
    this.scene = scene
    this.merge = merge
  }

  // Совместимость: старый getter (никто не читает содержимое, но оставлен).
  get magnets(): readonly never[] {
    return []
  }

  resetSpawnTimer(): void {
    this.workAccum = 0
  }

  clearAll(): void {
    const scene = this.scene
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
    this.wanderTimer = 0
    this.targetTilt = 0
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
    this.baseScale = (BOX_DISPLAY_SIZE * 0.7) / this.sprite.width
    this.sprite.setScale(this.baseScale)
    this.sprite.setDepth(MAGNET_DEPTH)
    this.shadow.setScale(this.baseScale)

    this.baselineY = cy
    this.targetX = cx
    this.targetY = cy
    this.prevX = cx
    this.pickWanderTarget()
  }

  private pickWanderTarget(): void {
    if (!this.sprite) return
    const { width, height } = this.scene.scale
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const dist = Phaser.Math.FloatBetween(60 * DPR, DASH_RADIUS * 1.4)
    this.targetX = Phaser.Math.Clamp(
      this.sprite.x + Math.cos(angle) * dist,
      FIELD_PAD_X + 20 * DPR,
      width - FIELD_PAD_X - 20 * DPR,
    )
    this.targetY = Phaser.Math.Clamp(
      this.sprite.y + Math.sin(angle) * dist,
      FIELD_PAD_Y + 20 * DPR,
      height - FIELD_PAD_Y_BOTTOM - 20 * DPR,
    )
  }

  tick(level: number, delta: number): void {
    if (!this.sprite) this.spawn()
    const sprite = this.sprite!

    const spawnInterval = getMagnetSpawnInterval(level)
    this.workAccum = Math.min(this.workAccum + delta, spawnInterval * 2)

    // ─── WANDER: бродим, копим кулдаун, ищем работу ───
    if (this.mode === 'WANDER') {
      this.wanderTimer += delta
      if (this.wanderTimer > 1800) {
        this.wanderTimer = 0
        this.pickWanderTarget()
      }
      // Готов работать + есть пара → WORK
      if (
        this.workAccum >= spawnInterval &&
        this.merge.hasMergeablePair()
      ) {
        const pair = this.merge.findClosestSameLevelPair()
        if (pair) {
          this.pair = pair
          this.mergesDone = 0
          this.mergesTarget = getMagnetMergesPerCycle(level) || 1
          this.mode = 'WORK'
        }
      }
    }

    // ─── WORK: летим к паре, стягиваем, мерджим ───
    if (this.mode === 'WORK') {
      this.updateWork(delta)
    }

    // ─── Движение к цели (lerp-chase) ───
    sprite.x = Phaser.Math.Linear(sprite.x, this.targetX, CHASE_LERP)
    sprite.y = Phaser.Math.Linear(sprite.y, this.targetY, CHASE_LERP)

    // Наклон по ходу + flip.
    const dx = sprite.x - this.prevX
    this.prevX = sprite.x
    if (Math.abs(dx) > 0.3) {
      this.targetTilt = Phaser.Math.Clamp(dx * 0.02, -MAX_TILT, MAX_TILT)
      sprite.scaleX = (dx > 0 ? 1 : -1) * this.baseScale
    } else {
      this.targetTilt = 0
    }
    sprite.rotation = Phaser.Math.Linear(sprite.rotation, this.targetTilt, TILT_LERP)

    // Парение в покое (далеко от цели не бобаем — там idle-движения нет).
    this.bobPhase += delta
    const nearTarget =
      Phaser.Math.Distance.Between(sprite.x, sprite.y, this.targetX, this.targetY) <
      8 * DPR
    if (nearTarget && this.mode === 'WANDER') {
      const bob = BOB_AMP * Math.sin((this.bobPhase * 2 * Math.PI) / BOB_PERIOD_MS)
      sprite.y = this.baselineY + bob
    } else {
      this.baselineY = sprite.y
    }

    // Тень.
    if (this.shadow) {
      this.shadow.x = sprite.x + 4 * DPR
      this.shadow.y = sprite.y + 26 * DPR
      this.shadow.rotation = sprite.rotation
      this.shadow.scaleX = sprite.scaleX * 0.85
      this.shadow.scaleY = sprite.scaleY * 0.85
    }
  }

  private updateWork(_delta: number): void {
    const scene = this.scene
    const pair = this.pair
    if (!pair) {
      this.endWork()
      return
    }
    const [a, b] = pair

    // Пара невалидна → бросаем работу.
    if (
      !scene.frogs.includes(a) ||
      !scene.frogs.includes(b) ||
      a.isDragging ||
      a.isMerging ||
      b.isDragging ||
      b.isMerging
    ) {
      this.endWork()
      return
    }

    // Цель дрона = midpoint пары.
    const midX = (a.container.x + b.container.x) / 2
    const midY = (a.container.y + b.container.y) / 2
    this.targetX = midX
    this.targetY = midY

    // Тянем пару к текущей позиции дрона.
    const sx = this.sprite!.x
    const sy = this.sprite!.y
    a.container.x = Phaser.Math.Linear(a.container.x, sx, PULL)
    a.container.y = Phaser.Math.Linear(a.container.y, sy, PULL)
    b.container.x = Phaser.Math.Linear(b.container.x, sx, PULL)
    b.container.y = Phaser.Math.Linear(b.container.y, sy, PULL)
    a.isAttracted = true
    b.isAttracted = true

    // Сошлись → merge.
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
      // Следующая пара того же цикла.
      const next = this.merge.findClosestSameLevelPair()
      if (next) {
        this.pair = next
      } else {
        this.endWork()
      }
    }
  }

  private endWork(): void {
    // Сбрасываем isAttracted у бывшей пары.
    if (this.pair) {
      for (const f of this.pair) {
        if (this.scene.frogs.includes(f)) f.isAttracted = false
      }
    }
    this.pair = null
    this.mode = 'WANDER'
    this.workAccum = 0
    this.wanderTimer = 0
    this.pickWanderTarget()
  }
}
