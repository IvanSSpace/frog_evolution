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
const FLY_SPEED = 70 * DPR
const FLY_MIN_MS = 250
// Полный заряд (100%) тратится за это время активной работы (8 минут).
const BATTERY_FULL_MS = 480000

type DroneMode = 'WANDER' | 'COLLECT' | 'RTB' | 'CHARGING' | 'EMERGING'

// Подзарядка на базе (мс) — за это время battery 0 → 100.
const RECHARGE_MS = 60000
// Раскладка зданий (SYNC с BuildingsController): main центр, droner слева.
const MAIN_X_FRAC = 0.5
const MAIN_Y_FRAC = 0.34
const DRONER_X_FRAC = 0.32
const DRONER_Y_FRAC = 0.74

export class DroneController {
  private scene: MainScene
  private box: BoxController

  private sprite: Phaser.GameObjects.Image | null = null
  // 2026-05-30: тень дрона — чёрный силуэт того же спрайта, под ним, со
  // смещением. Синхронизируется с дроном в tick (pos/rotation/flip/scale).
  private shadow: Phaser.GameObjects.Image | null = null

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

  private isDragging = false

  // Последняя X при перетаскивании — для расчёта направления наклона
  private lastDragX = 0

  // 2026-05-30: заряд дрона (0..100). Тратится со временем работы; при 0 дрон
  // улетит на базу заряжаться. Тултип по тапу показывает %.
  // TEST: стартовый 2% — быстрый RTB для проверки. Вернуть на 100.
  private battery = 2
  private tooltip: Phaser.GameObjects.Text | null = null
  private tooltipTimer: Phaser.Time.TimerEvent | null = null


  constructor(scene: MainScene, box: BoxController) {
    this.scene = scene
    this.box = box
  }

  private spawn(): void {
    if (this.sprite) return
    const { width, height } = this.scene.scale
    // TEST: спавн на входе droner для подгонки позиции. Вернуть на random:
    //   const cx = Phaser.Math.Between(FIELD_PAD_X+10*DPR, width-FIELD_PAD_X-10*DPR)
    //   const cy = Phaser.Math.Between(FIELD_PAD_Y+10*DPR, height-FIELD_PAD_Y_BOTTOM-10*DPR)
    const cx = width * DRONER_X_FRAC
    const cy = height + height * DRONER_Y_FRAC

    // Тень — создаём ПЕРВОЙ (ниже дрона по z), чёрный силуэт того же спрайта.
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

    // Тап (pointerup без drag) → тултип заряда.
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

    this.sprite.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!this.sprite) return
      const { width, height } = this.scene.scale
      const clampedX = Phaser.Math.Clamp(dragX, FIELD_PAD_X + 10 * DPR, width - FIELD_PAD_X - 10 * DPR)
      const clampedY = Phaser.Math.Clamp(dragY, FIELD_PAD_Y + 10 * DPR, height - FIELD_PAD_Y_BOTTOM - 10 * DPR)
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
    if (!this.sprite) return

    this.hideTooltip()
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

  /** Показать дрон если его ещё нет (без запуска движения сверх spawn-логики).
   *  Вызывается во время location-transition, чтобы дрон появлялся синхронно
   *  с лягушками, а не после unfreeze update-loop'а. */
  ensureSpawned(): void {
    if (!this.sprite) this.spawn()
  }

  /** Спрайты (дрон + тень) для reparent в transition-контейнер (зум). */
  getSprites(): Phaser.GameObjects.Image[] {
    const out: Phaser.GameObjects.Image[] = []
    if (this.shadow) out.push(this.shadow)
    if (this.sprite) out.push(this.sprite)
    return out
  }

  /** Тап по дрону → показать/скрыть тултип с зарядом. Auto-hide 2.5с. */
  private toggleTooltip(): void {
    if (!this.sprite) return
    if (this.tooltip) {
      this.hideTooltip()
      return
    }
    const scene = this.scene
    this.tooltip = scene.add
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
    this.tooltipTimer = scene.time.delayedCall(2500, () => this.hideTooltip())
  }

  private hideTooltip(): void {
    if (this.tooltipTimer) {
      this.tooltipTimer.remove(false)
      this.tooltipTimer = null
    }
    if (this.tooltip) {
      this.tooltip.destroy()
      this.tooltip = null
    }
  }

  private positionTooltip(): void {
    if (!this.tooltip || !this.sprite) return
    this.tooltip.setPosition(
      this.sprite.x,
      this.sprite.y - this.sprite.displayHeight * 0.55,
    )
    this.tooltip.setText(`🔋 ${Math.round(this.battery)}%`)
  }

  // ─── RTB: разрядился → летим на базу (droner) заряжаться ───
  // Маршрут: центр поля → вниз к границе зон → обход main (50% слева/справа)
  // → к droner → заход (fade out). Затем CHARGING, потом EMERGING (всплытие).
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
    const side = Math.random() < 0.5 ? -1 : 1 // обход main слева/справа
    const mainX = width * MAIN_X_FRAC
    const mainY = height + height * MAIN_Y_FRAC
    const dronerX = width * DRONER_X_FRAC
    const dronerY = height + height * DRONER_Y_FRAC

    const waypoints: { x: number; y: number }[] = [
      { x: mainX, y: height - FIELD_PAD_Y_BOTTOM }, // центр-низ frogs-зоны
      { x: mainX, y: height + height * 0.12 }, // вошли в зону строений сверху
      { x: mainX + side * width * 0.3, y: mainY }, // обход main сбоку
      { x: dronerX, y: dronerY }, // к droner
    ]
    this.flyWaypoints(waypoints, () => this.enterDroner())
  }

  private flyWaypoints(
    pts: { x: number; y: number }[],
    onDone: () => void,
  ): void {
    if (!this.sprite || pts.length === 0) {
      onDone()
      return
    }
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
      ease: 'Linear', // прямые сегменты, резкие повороты на waypoints
      onComplete: () => {
        if (!this.sprite) return
        this.flyWaypoints(rest, onDone)
      },
    })
  }

  private enterDroner(): void {
    if (!this.sprite) return
    this.targetTilt = 0
    this.sprite.rotation = 0
    // Заход: останавливается на droner и исчезает (fade + scale down).
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
      },
    })
  }

  private startEmerge(): void {
    if (!this.sprite) return
    this.mode = 'EMERGING'
    const { width, height } = this.scene.scale
    const dronerX = width * DRONER_X_FRAC
    const dronerY = height + height * DRONER_Y_FRAC
    // Плавно появляемся на droner.
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
        // Поднимаемся вверх на поле лягушек к случайной точке.
        const toX = Phaser.Math.Between(FIELD_PAD_X + 20 * DPR, width - FIELD_PAD_X - 20 * DPR)
        const toY = Phaser.Math.Between(FIELD_PAD_Y + 20 * DPR, height - FIELD_PAD_Y_BOTTOM - 20 * DPR)
        // 2026-05-30: прямой полёт droner→поле одним сегментом. Раньше был
        // промежуточный waypoint на границе зон → резкий flip/наклон = «отдёрг».
        this.flyWaypoints([{ x: toX, y: toY }], () => {
          this.targetTilt = 0
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

    // Разряд батареи только в активных режимах (не drag/RTB/charge).
    if (!this.isDragging && (this.mode === 'WANDER' || this.mode === 'COLLECT')) {
      this.battery = Math.max(0, this.battery - (100 * delta) / BATTERY_FULL_MS)
      if (this.battery <= 0) this.startRTB()
    }
    if (this.mode === 'CHARGING') {
      this.battery = Math.min(100, this.battery + (100 * delta) / RECHARGE_MS)
      if (this.battery >= 100) this.startEmerge()
    }
    // Тултип следует за дроном пока открыт.
    if (this.tooltip) this.positionTooltip()

    sprite.rotation = Phaser.Math.Linear(sprite.rotation, this.targetTilt, TILT_LERP)

    // Синхронизируем тень с дроном. Дрон ПАРИТ → тень отбрасывается заметно
    // ниже (28px) и чуть меньше (0.85) — отрыв от тени читается как парение.
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

    // RTB / CHARGING / EMERGING — движение ведётся tween-цепочкой/таймером,
    // обычную WANDER/COLLECT логику пропускаем.
    if (this.mode !== 'WANDER' && this.mode !== 'COLLECT') return

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
