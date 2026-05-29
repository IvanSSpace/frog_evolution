// DroneController: дрон-сборщик для апгрейда autoCollect (локация 1, Болото).
//
// Дрон двигается рывками (dash-hop) как лягушки, но без дуги прыжка и squash/stretch.
// Только онлайн, только на локации 1 при upgrades.autoCollect > 0.
//
// Public API:
//   - tick(level, delta): вызывается из MainScene.update() при условии loc=1 + level>0.
//   - despawn(): уничтожить спрайт (при смене локации / level=0 / destroy сцены).

import Phaser from 'phaser'
import { getAutoCollectCooldownMs } from '../../../store/gameStore'
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

// Дистанция «достиг бокса» (px)
const REACH_DIST = 30 * DPR
// Максимальный наклон спрайта (рад)
const MAX_TILT = 0.15
// Коэффициент сглаживания наклона (lerp на кадр)
const TILT_LERP = 0.12
// Глубина отрисовки дрона — поверх боксов, под UI
const DRONE_DEPTH = 95000
// Длительность фазы перемещения (мс) — медленнее лягушачьего рывка
const MOVE_MS = 550
// Масштаб дрона относительно BOX_DISPLAY_SIZE
const DRONE_SCALE_MULT = 0.76
// Лёгкое парение вверх-вниз в покое
const BOB_AMP = 4 * DPR
const BOB_PERIOD_MS = 3000

// Плавный полёт к боксу в режиме сбора (px/с) + мин. длительность
const FLY_SPEED = 130 * DPR
const FLY_MIN_MS = 250

type DroneMode = 'WANDER' | 'COLLECT'

export class DroneController {
  private scene: MainScene
  private box: BoxController

  private sprite: Phaser.GameObjects.Image | null = null

  // Накопленный кулдаун (мс)
  private cooldownAccum = 0

  // Режим
  private mode: DroneMode = 'WANDER'

  // Цель в COLLECT режиме
  private collectTarget: BoxData | null = null

  // Флаг: сейчас выполняется hop-твин (блокирует запуск нового)
  private isHopping = false

  // Целевой наклон (обновляется в начале hop или при idle)
  private targetTilt = 0

  // Базовый масштаб (модуль) — для зеркалирования по направлению
  private baseScale = 0

  // Парение (bob) — фаза и базовая линия Y
  private bobPhase = 0
  private baselineY = 0

  // Ссылки на таймеры для despawn-cleanup
  private restTimer: Phaser.Time.TimerEvent | null = null
  private prePauseTimer: Phaser.Time.TimerEvent | null = null


  constructor(scene: MainScene, box: BoxController) {
    this.scene = scene
    this.box = box
  }

  private spawn(): void {
    if (this.sprite) return
    const { width, height } = this.scene.scale
    const cx = width / 2
    const cy = (FIELD_PAD_Y + (height - FIELD_PAD_Y_BOTTOM)) / 2

    this.sprite = this.scene.add.image(cx, cy, 'goo_collector')
    this.baseScale = (BOX_DISPLAY_SIZE * DRONE_SCALE_MULT) / this.sprite.width
    this.sprite.setScale(this.baseScale)
    this.sprite.setDepth(DRONE_DEPTH)
    this.baselineY = cy

    this.scheduleNextHop()
  }

  despawn(): void {
    if (!this.sprite) return

    // Убиваем все таймеры
    if (this.restTimer) {
      this.restTimer.remove(false)
      this.restTimer = null
    }
    if (this.prePauseTimer) {
      this.prePauseTimer.remove(false)
      this.prePauseTimer = null
    }

    this.scene.tweens.killTweensOf(this.sprite)
    this.sprite.destroy()
    this.sprite = null

    this.cooldownAccum = 0
    this.targetTilt = 0
    this.mode = 'WANDER'
    this.collectTarget = null
    this.isHopping = false
    this.bobPhase = 0
    this.baselineY = 0
  }

  tick(level: number, delta: number): void {
    if (!this.sprite) this.spawn()
    const sprite = this.sprite!

    const cooldown = getAutoCollectCooldownMs(level)

    // Накапливаем кулдаун (cap cooldown*2)
    this.cooldownAccum = Math.min(this.cooldownAccum + delta, cooldown * 2)

    // Валидируем collect-цель каждый кадр
    if (this.mode === 'COLLECT') {
      if (
        this.collectTarget === null ||
        !this.scene.boxes.includes(this.collectTarget) ||
        !this.collectTarget.img.active
      ) {
        // Ищем новую ближайшую нормальную коробку
        const nearest = this.findNearestNormalBox(sprite.x, sprite.y)
        if (nearest) {
          // Переключаем цель и прерываем устаревший полёт
          this.collectTarget = nearest
          if (this.isHopping) {
            this.scene.tweens.killTweensOf(sprite)
            this.isHopping = false
          }
          this.startHop()
        } else {
          // Боксов нет — выходим из COLLECT, держим accum на cooldown
          if (this.isHopping) {
            this.scene.tweens.killTweensOf(sprite)
            this.isHopping = false
          }
          this.mode = 'WANDER'
          this.collectTarget = null
          this.cooldownAccum = cooldown
        }
      }
    }

    // Проверяем переход в COLLECT
    if (this.mode === 'WANDER' && this.cooldownAccum >= cooldown) {
      const nearest = this.findNearestNormalBox(sprite.x, sprite.y)
      if (nearest) {
        this.mode = 'COLLECT'
        this.collectTarget = nearest
        // Начинаем лететь немедленно, если не в прыжке
        if (!this.isHopping) {
          if (this.restTimer) {
            this.restTimer.remove(false)
            this.restTimer = null
          }
          this.startHop()
        }
        // Если isHopping — текущий hop завершится и увидит COLLECT в onComplete
      } else {
        // Нет боксов — держим accum на cooldown
        this.cooldownAccum = cooldown
      }
    }

    // Плавный наклон каждый кадр (hop устанавливает targetTilt, idle сбрасывает)
    sprite.rotation = Phaser.Math.Linear(sprite.rotation, this.targetTilt, TILT_LERP)

    // Парение: смещаем Y вокруг baselineY только в покое
    this.bobPhase += delta
    if (!this.isHopping) {
      const bob =
        BOB_AMP * Math.sin((this.bobPhase * 2 * Math.PI) / BOB_PERIOD_MS)
      sprite.y = this.baselineY + bob
    }
  }

  // Выбор следующего hop — точка назначения + pre-pause + tween
  private scheduleNextHop(): void {
    if (!this.sprite) return

    const restMs = Phaser.Math.Between(2000, 4000)

    this.restTimer = this.scene.time.delayedCall(restMs, () => {
      this.restTimer = null
      if (!this.sprite) return
      this.startHop()
    })
  }

  private startHop(): void {
    if (!this.sprite) return
    if (this.isHopping) return

    const sprite = this.sprite
    const { width, height } = this.scene.scale

    let toX: number
    let toY: number
    let prePauseMs: number
    let moveDuration: number
    let moveEase: string

    if (this.mode === 'COLLECT' && this.collectTarget) {
      const target = this.collectTarget
      // Летим прямо к боксу (полная дистанция, не DASH_RADIUS)
      toX = Phaser.Math.Clamp(
        target.img.x,
        FIELD_PAD_X + 10 * DPR,
        width - FIELD_PAD_X - 10 * DPR,
      )
      toY = Phaser.Math.Clamp(
        target.img.y,
        FIELD_PAD_Y + 10 * DPR,
        height - FIELD_PAD_Y_BOTTOM - 10 * DPR,
      )
      prePauseMs = 0
      const dx = toX - sprite.x
      const dy = toY - sprite.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      moveDuration = Phaser.Math.Clamp(dist / FLY_SPEED * 1000, FLY_MIN_MS, 60000)
      moveEase = 'Sine.easeInOut'
    } else {
      // WANDER
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const dist = Phaser.Math.FloatBetween(40 * DPR, DASH_RADIUS)
      toX = Phaser.Math.Clamp(
        sprite.x + Math.cos(angle) * dist,
        FIELD_PAD_X + 10 * DPR,
        width - FIELD_PAD_X - 10 * DPR,
      )
      toY = Phaser.Math.Clamp(
        sprite.y + Math.sin(angle) * dist,
        FIELD_PAD_Y + 10 * DPR,
        height - FIELD_PAD_Y_BOTTOM - 10 * DPR,
      )
      prePauseMs = 350
      moveDuration = MOVE_MS
      moveEase = 'Power2.easeOut'
    }

    this.isHopping = true

    const doTween = () => {
      if (!this.sprite) return
      // Наклон выставляем в момент реального старта движения (не во время pre-pause)
      const dx = toX - this.sprite.x
      this.targetTilt = dx !== 0 ? Math.sign(dx) * MAX_TILT : 0
      // Разворот по направлению: арт смотрит влево, движение вправо → зеркалим.
      if (dx !== 0) {
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

          // Idle: наклон сбрасываем
          this.targetTilt = 0
          this.isHopping = false

          // Проверяем достижение бокса в COLLECT режиме
          if (this.mode === 'COLLECT' && this.collectTarget) {
            const dist = Phaser.Math.Distance.Between(
              this.sprite.x,
              this.sprite.y,
              this.collectTarget.img.x,
              this.collectTarget.img.y,
            )
            if (dist < REACH_DIST) {
              this.box.onBoxTapped(this.collectTarget)
              this.cooldownAccum = 0
              this.mode = 'WANDER'
              this.collectTarget = null
              // После сбора — нормальный отдых 2000-4000мс перед следующим wander hop
              this.restTimer = this.scene.time.delayedCall(
                Phaser.Math.Between(2000, 4000),
                () => {
                  this.restTimer = null
                  if (!this.sprite) return
                  this.startHop()
                },
              )
              return
            }
            // Цель ещё не достигнута (например, сменилась) — продолжаем лететь без паузы
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

  private findNearestNormalBox(
    x: number,
    y: number,
  ): BoxData | null {
    const normalBoxes = this.scene.boxes.filter(
      (b) => !b.isRare && b.img.active && !b.isLanding,
    )
    if (normalBoxes.length === 0) return null

    let closest = normalBoxes[0]
    let minDist = Phaser.Math.Distance.Between(x, y, closest.img.x, closest.img.y)
    for (let i = 1; i < normalBoxes.length; i++) {
      const d = Phaser.Math.Distance.Between(x, y, normalBoxes[i].img.x, normalBoxes[i].img.y)
      if (d < minDist) {
        minDist = d
        closest = normalBoxes[i]
      }
    }
    return closest
  }
}
