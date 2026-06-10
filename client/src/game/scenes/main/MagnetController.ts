// Phase 21-04: Magnet controller.
//
// 2026-05-30: магнит — persistent летающий дрон (magnet_drone.png). Движется
// ТОЧНО как goo_collector (DroneController): hop-модель (rest-pause → pre-pause
// → tween), наклон в момент старта, парение в покое, тень. Разница: вместо
// сбора бокса (COLLECT) — летит к паре одноуровневых лягушек (WORK), долетев
// стягивает их (PULLING) и мерджит.
//
// 2026-06-11 (30-09): single-drone после удаления DroneController/droneCharge.
// Гейт активности (болото / !serumPaused) делает MainScene через tick/clearAll.
//
// Public API (без изменений для MainScene):
//   - tick(level, delta): per-frame. Спавнит/синкает дронов.
//   - resetSpawnTimer(): сброс рабочего кулдауна всех дронов.
//   - clearAll(): despawn всех дронов.

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
// Полный заряд (100%) тратится за 8 минут активной работы.
const BATTERY_FULL_MS = 480000
// Подзарядка на базе (мс).
const RECHARGE_MS = 60000
// Дверь домика дронов (droner) — точка появления/исчезновения (настроена ранее).
const DRONER_X_FRAC = 0.38
const DRONER_Y_FRAC = 0.74
// Маршрут (frac: xf от ширины, yf от высоты зоны строений; yf<0 = поле).
// ENTRY — первая точка у домика, затем подъём, затем развилка.
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

type MagnetMode =
  | 'WANDER'
  | 'WORK'
  | 'PULLING'
  | 'RTB'
  | 'CHARGING'
  | 'EMERGING'

// ─── Один магнит-дрон ──────────────────────────────────────────────────────────
class MagnetInstance {
  private scene: MainScene
  private merge: MergeController
  private index: number

  private sprite: Phaser.GameObjects.Image | null = null
  private shadow: Phaser.GameObjects.Image | null = null
  private baseScale = 0

  private mode: MagnetMode = 'WANDER'
  private targetTilt = 0
  private bobPhase = 0
  private baselineY = 0
  private isHopping = false
  private isDragging = false
  private lastDragX = 0
  private restTimer: Phaser.Time.TimerEvent | null = null
  private prePauseTimer: Phaser.Time.TimerEvent | null = null

  // 2026-05-30: заряд + тултип по тапу (как goo_collector).
  private battery = 100
  // Восстановлен на зарядке (reload во время зарядки на базе) → spawn появляет
  // дрона у базы в режиме CHARGING, а не на поле.
  private initialCharging = false
  // Рассинхрон зарядки: per-дрон множитель скорости разряда (0.8..1.2). Вместе
  // со случайным стартовым зарядом даёт устойчивый десинк RTB/зарядки.
  private batteryDrainMult = Phaser.Math.FloatBetween(0.8, 1.2)
  private tooltip: Phaser.GameObjects.Text | null = null
  private tooltipTimer: Phaser.Time.TimerEvent | null = null
  private chargeBg: Phaser.GameObjects.Rectangle | null = null
  private chargeFill: Phaser.GameObjects.Rectangle | null = null

  // Рабочий кулдаун (мс).
  private workAccum = 0
  // Пара в работе.
  private pair: [FrogData, FrogData] | null = null
  private mergesDone = 0
  private mergesTarget = 1
  // Рассинхрон: per-дрон множитель длительности отдыха (одни ленивее).
  private restBias = Phaser.Math.FloatBetween(0.6, 1.7)

  // Случайная пауза отдыха с учётом bias дрона.
  private restDelay(): number {
    return Math.round(Phaser.Math.Between(2000, 4000) * this.restBias)
  }

  constructor(
    scene: MainScene,
    merge: MergeController,
    index: number,
    initialBattery: number,
    initialCharging: boolean,
  ) {
    this.scene = scene
    this.merge = merge
    this.index = index
    this.battery = initialBattery
    this.initialCharging = initialCharging
  }

  getBattery(): number {
    return this.battery
  }

  getCharging(): boolean {
    return this.mode === 'CHARGING'
  }

  resetSpawnTimer(): void {
    this.workAccum = 0
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

  // Индикатор зарядки (в зоне зданий) — в transition вместе со зданиями, чтобы
  // плавно зумился, а не появлялся резко после анимации.
  getChargeBarSprites(): Phaser.GameObjects.Rectangle[] {
    const out: Phaser.GameObjects.Rectangle[] = []
    if (this.chargeBg) out.push(this.chargeBg)
    if (this.chargeFill) out.push(this.chargeFill)
    return out
  }

  // Уход с локации в transition: sprite+shadow УЖЕ reparent'нуты в зум-контейнер
  // (destroy(true) его уничтожит). Роняем ссылки БЕЗ destroy (иначе double-destroy)
  // + чистим вспомогательное (tooltip/charge-bar/таймеры/пара).
  releaseForTransition(): void {
    const scene = this.scene
    this.hideTooltip()
    this.hideChargeBar()
    if (this.restTimer) {
      this.restTimer.remove(false)
      this.restTimer = null
    }
    if (this.prePauseTimer) {
      this.prePauseTimer.remove(false)
      this.prePauseTimer = null
    }
    if (this.pair) {
      for (const f of this.pair) {
        if (scene.frogs.includes(f)) f.isAttracted = false
      }
      this.pair = null
    }
    if (this.sprite) {
      scene.tweens.killTweensOf(this.sprite)
      this.sprite = null
    }
    if (this.shadow) {
      scene.tweens.killTweensOf(this.shadow)
      this.shadow = null
    }
  }

  despawn(): void {
    const scene = this.scene
    this.hideTooltip()
    this.hideChargeBar()
    if (this.restTimer) {
      this.restTimer.remove(false)
      this.restTimer = null
    }
    if (this.prePauseTimer) {
      this.prePauseTimer.remove(false)
      this.prePauseTimer = null
    }
    // Освобождаем пару если была в работе.
    if (this.pair) {
      for (const f of this.pair) {
        if (scene.frogs.includes(f)) f.isAttracted = false
      }
      this.pair = null
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
    this.workAccum = 0
    this.isHopping = false
    this.isDragging = false
    this.targetTilt = 0
    this.bobPhase = 0
    this.baselineY = 0
  }

  private spawn(): void {
    const scene = this.scene
    const { width, height } = scene.scale
    // Восстановлен на зарядке → появляемся у базы (скрыт, идёт дозарядка).
    // Иначе — СРАЗУ на поле (живём своей жизнью), не выходим из домика при
    // заходе/перезаходе. emerge оставлен только для возврата после зарядки.
    const { x: cx, y: cy } = this.initialCharging
      ? { x: width * DRONER_X_FRAC, y: height + height * DRONER_Y_FRAC }
      : scene.randomFieldPos()

    this.shadow = scene.add.image(cx, cy, 'magnet_drone')
    ;(this.shadow as unknown as { tintFill: boolean }).tintFill = true
    this.shadow.setTint(0x000000)
    this.shadow.setAlpha(0.3)
    this.shadow.setDepth(MAGNET_DEPTH - 1)

    this.sprite = scene.add.image(cx, cy, 'magnet_drone')
    this.baseScale = (BOX_DISPLAY_SIZE * DRONE_SCALE_MULT) / this.sprite.width
    this.sprite.setScale(this.baseScale)
    this.sprite.setDepth(MAGNET_DEPTH)
    // Сразу ставим тень в offset-позицию и shScale (как в tick), иначе на спавне
    // и во время зум-перехода (tick гейтнут) тень сидит точно за спрайтом и не
    // видна — «появляется» только после анимации, когда первый tick её сдвинет.
    this.shadow.setScale(this.baseScale * 0.85)
    this.shadow.setPosition(cx + 4 * DPR, cy + 26 * DPR)
    this.baselineY = cy
    // Десинк парения: рандомная стартовая фаза bob — дроны качаются вразнобой.
    this.bobPhase = Math.random() * BOB_PERIOD_MS
    // Рассинхрон работы: отрицательный стартовый кулдаун — магниты выходят на
    // работу не одновременно.
    this.workAccum = -Phaser.Math.Between(0, 6000)

    // Перетаскивание (как goo_collector): берём в любой точке, тянем.
    this.sprite.setInteractive({ useHandCursor: true })
    scene.input.setDraggable(this.sprite)
    // Тап (pointerup без drag) → тултип заряда.
    this.sprite.on('pointerup', () => {
      if (!this.isDragging) this.toggleTooltip()
    })
    this.sprite.on('dragstart', () => {
      if (!this.sprite) return
      this.isDragging = true
      if (this.restTimer) {
        this.restTimer.remove(false)
        this.restTimer = null
      }
      if (this.prePauseTimer) {
        this.prePauseTimer.remove(false)
        this.prePauseTimer = null
      }
      scene.tweens.killTweensOf(this.sprite)
      this.isHopping = false
      this.mode = 'WANDER'
      this.pair = null
      this.lastDragX = this.sprite.x
    })
    this.sprite.on(
      'drag',
      (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (!this.sprite) return
        const { width: w, height: h } = scene.scale
        const cxX = Phaser.Math.Clamp(
          dragX,
          FIELD_PAD_X + 10 * DPR,
          w - FIELD_PAD_X - 10 * DPR,
        )
        const cyY = Phaser.Math.Clamp(
          dragY,
          FIELD_PAD_Y + 10 * DPR,
          h - FIELD_PAD_Y_BOTTOM - 10 * DPR,
        )
        const dx = cxX - this.lastDragX
        this.lastDragX = cxX
        if (Math.abs(dx) > 0.5) {
          this.targetTilt = Math.sign(dx) * MAX_TILT
          this.sprite.scaleX = (dx > 0 ? -1 : 1) * this.baseScale
        }
        this.sprite.x = cxX
        this.sprite.y = cyY
      },
    )
    this.sprite.on('dragend', () => {
      if (!this.sprite) return
      this.isDragging = false
      this.baselineY = this.sprite.y
      this.scheduleNextHop()
    })

    if (this.initialCharging) {
      // На базе: спрайт скрыт, видна только зарядная шкала; tick дозарядит и
      // выпустит на поле (startEmerge) при 100%.
      this.initialCharging = false
      this.sprite.setVisible(false)
      this.shadow.setVisible(false)
      this.mode = 'CHARGING'
      this.showChargeBar()
    } else {
      // Уже на поле — сразу в WANDER, планируем первый прыжок (без emerge).
      this.mode = 'WANDER'
      this.scheduleNextHop()
    }
  }

  /** Тап → тултип заряда. Auto-hide 2.5с, toggle повторным тапом. */
  private toggleTooltip(): void {
    if (!this.sprite) return
    if (this.tooltip) {
      this.hideTooltip()
      return
    }
    this.tooltip = this.scene.add
      .text(this.sprite.x, this.sprite.y, `🔋 ${Math.round(this.battery)}%`, {
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: `${Math.round(13 * DPR)}px`,
        color: '#eaf5e6',
        backgroundColor: '#0c1611',
        padding: { x: 6 * DPR, y: 3 * DPR },
      })
      .setOrigin(0.5, 1)
      .setDepth(MAGNET_DEPTH + 10)
    this.positionTooltip()
    this.tooltipTimer = this.scene.time.delayedCall(2500, () =>
      this.hideTooltip(),
    )
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

  // ─── RTB: разрядился → на базу (droner) заряжаться. Прямые повороты. ───
  private startRTB(): void {
    if (!this.sprite) return
    this.mode = 'RTB'
    this.hideTooltip()
    if (this.restTimer) {
      this.restTimer.remove(false)
      this.restTimer = null
    }
    if (this.prePauseTimer) {
      this.prePauseTimer.remove(false)
      this.prePauseTimer = null
    }
    this.scene.tweens.killTweensOf(this.sprite)
    this.isHopping = false
    // Освобождаем пару если была в работе.
    if (this.pair) {
      for (const f of this.pair) {
        if (this.scene.frogs.includes(f)) f.isAttracted = false
      }
      this.pair = null
    }

    const { width, height } = this.scene.scale
    const toW = (f: { xf: number; yf: number }) => ({
      x: f.xf * width,
      y: height + f.yf * height,
    })
    // Заход — обратный маршрут выхода: поле → развилка (reverse) → подъём → дверь.
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
    const dist = Phaser.Math.Distance.Between(
      sprite.x,
      sprite.y,
      next.x,
      next.y,
    )
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

  // Зарядная шкала у двери — вытянутый прямоугольник, заполняется зелёным.
  private showChargeBar(): void {
    this.hideChargeBar()
    const { width, height } = this.scene.scale
    // Бары соседних дронов раздвигаем по x (index * 13).
    const x = width * DRONER_X_FRAC - 33 * DPR + this.index * 13 * DPR
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
    // Переустанавливаем видимость: в зум-переходе reparent мог скрыть бар (если
    // приземление на зону frogs); первый post-transition tick вернёт его.
    this.chargeBg.setVisible(true)
    this.chargeFill.setVisible(true)
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
    this.sprite
      .setAlpha(0)
      .setScale(this.baseScale * 0.6)
      .setVisible(true)
    if (this.shadow) {
      this.shadow.setPosition(dronerX + 4 * DPR, dronerY + 26 * DPR)
      this.shadow
        .setAlpha(0)
        .setScale(this.baseScale * 0.6)
        .setVisible(true)
      this.scene.tweens.add({
        targets: this.shadow,
        alpha: 0.3,
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
        // Выход: дверь → подъём → развилка (50% лево/право) → на поле.
        const toW = (f: { xf: number; yf: number }) => ({
          x: f.xf * width,
          y: height + f.yf * height,
        })
        const branch = Math.random() < 0.5 ? BRANCH_LEFT : BRANCH_RIGHT
        this.flyWaypoints([toW(ENTRY), toW(RISE), ...branch.map(toW)], () => {
          this.targetTilt = 0
          // Обновляем baselineY на финальную точку — иначе bob в WANDER
          // прыгнул бы дрон к устаревшему baselineY (телепорт).
          if (this.sprite) this.baselineY = this.sprite.y
          this.mode = 'WANDER'
          this.workAccum = 0
          this.scheduleNextHop()
        })
      },
    })
  }

  tick(level: number, delta: number): void {
    // Не спавним из tick — спавн только через ensureSpawned (staggered менеджером).
    if (!this.sprite) return
    const sprite = this.sprite

    // Разряд только в активных режимах.
    const active =
      this.mode === 'WANDER' || this.mode === 'WORK' || this.mode === 'PULLING'
    if (!this.isDragging && active) {
      this.battery = Math.max(
        0,
        this.battery -
          ((100 * delta) / BATTERY_FULL_MS) * this.batteryDrainMult,
      )
      if (this.battery <= 0) this.startRTB()
    }
    if (this.mode === 'CHARGING') {
      this.battery = Math.min(100, this.battery + (100 * delta) / RECHARGE_MS)
      this.updateChargeBar()
      if (this.battery >= 100) this.startEmerge()
    }
    if (this.tooltip) this.positionTooltip()

    sprite.rotation = Phaser.Math.Linear(
      sprite.rotation,
      this.targetTilt,
      TILT_LERP,
    )

    // Тень (как у goo_collector: ниже + меньше = парение).
    if (this.shadow) {
      this.shadow.x = sprite.x + 4 * DPR
      this.shadow.y = sprite.y + 26 * DPR
      this.shadow.rotation = sprite.rotation
      this.shadow.scaleX = sprite.scaleX * 0.85
      this.shadow.scaleY = sprite.scaleY * 0.85
    }

    // При перетаскивании — наклон гасим, остальную логику пропускаем.
    if (this.isDragging) {
      this.targetTilt = Phaser.Math.Linear(this.targetTilt, 0, TILT_LERP)
      return
    }

    // RTB/CHARGING/EMERGING — движение в tween-цепочке, обычную логику скип.
    if (!active) return

    const spawnInterval = getMagnetSpawnInterval(level)
    this.workAccum = Math.min(this.workAccum + delta, spawnInterval * 2)

    // ─── PULLING: стягиваем пару к дрону, мерджим ───
    if (this.mode === 'PULLING') {
      this.updatePull()
    }

    // ─── Валидация WORK-цели ───
    if (this.mode === 'WORK') {
      if (!this.isPairValid()) {
        // Пара пропала (другой магнит смерджил) — назад в WANDER. Фиксируем
        // baselineY на текущую позицию: иначе bob в WANDER снапнет дрон к
        // старому baselineY (телепорт на стартовую точку hop'а).
        if (this.isHopping) {
          this.scene.tweens.killTweensOf(sprite)
          this.isHopping = false
          this.baselineY = sprite.y
        }
        this.mode = 'WANDER'
        this.pair = null
        this.workAccum = spawnInterval
      } else if (this.pair) {
        // Замораживаем пару пока дрон летит: isAttracted=true → performDash
        // их пропускает (см. FrogSpawner), + гасим текущий dash-tween. Иначе
        // лягушки прыгают, midpoint убегает и дрон гоняется за ними.
        for (const f of this.pair) {
          f.isAttracted = true
          if (f.isMoving) {
            this.scene.tweens.killTweensOf(f.container)
            f.isMoving = false
          }
        }
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
      this.restTimer = this.scene.time.delayedCall(this.restDelay(), () => {
        this.restTimer = null
        if (this.sprite) this.startHop()
      })
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

    const mid = this.mode === 'WORK' ? this.pairMidpoint() : null
    if (mid) {
      // Летим прямо к паре (полная дистанция).
      toX = Phaser.Math.Clamp(
        mid.x,
        FIELD_PAD_X + 10 * DPR,
        width - FIELD_PAD_X - 10 * DPR,
      )
      toY = Phaser.Math.Clamp(
        mid.y,
        FIELD_PAD_Y + 10 * DPR,
        height - FIELD_PAD_Y_BOTTOM - 10 * DPR,
      )
      prePauseMs = 0
      const dx = toX - sprite.x
      const dy = toY - sprite.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      moveDuration = Phaser.Math.Clamp(
        (dist / FLY_SPEED) * 1000,
        FLY_MIN_MS,
        60000,
      )
      moveEase = 'Sine.easeInOut'
    } else {
      // WANDER hop.
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
              ? Phaser.Math.Distance.Between(
                  this.sprite.x,
                  this.sprite.y,
                  mp.x,
                  mp.y,
                )
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

// ─── Менеджер магнит-дронов ────────────────────────────────────────────────────
// 2026-06-11 (30-09): после удаления DroneController/droneCharge в Phase 30
// MagnetController управляет ровно 1 дроном (multi-slot убран вместе с системой
// дронов). MainScene управляет гейтом активности через tick()/clearAll().
export class MagnetController {
  private scene: MainScene
  private merge: MergeController
  private instances: MagnetInstance[] = []

  constructor(scene: MainScene, merge: MergeController) {
    this.scene = scene
    this.merge = merge
  }

  // Магнит всегда single-instance — MainScene управляет его активностью.
  private targetCount(): number {
    return 1
  }

  private sync(want: number): void {
    while (this.instances.length < want) {
      const idx = this.instances.length
      const inst = new MagnetInstance(
        this.scene,
        this.merge,
        idx,
        Phaser.Math.Between(45, 100),
        false,
      )
      // Спавним сразу на поле (WANDER).
      this.instances.push(inst)
      inst.ensureSpawned()
    }
    while (this.instances.length > want) {
      const removed = this.instances.pop()!
      removed.despawn()
    }
  }

  resetSpawnTimer(): void {
    for (const m of this.instances) m.resetSpawnTimer()
  }

  // Спавн магнит-дрона до transition-gate.
  ensureSpawned(): void {
    this.sync(this.targetCount())
  }

  getSprites(): Phaser.GameObjects.Image[] {
    return this.instances.flatMap((m) => m.getSprites())
  }

  getChargeBarSprites(): Phaser.GameObjects.Rectangle[] {
    return this.instances.flatMap((m) => m.getChargeBarSprites())
  }

  // Спрайты reparent'нуты в зум-контейнер — роняем ссылки без destroy.
  releaseForTransition(): void {
    for (const m of this.instances) m.releaseForTransition()
    this.instances = []
  }

  tick(level: number, delta: number): void {
    this.sync(this.targetCount())
    for (const m of this.instances) m.tick(level, delta)
  }

  clearAll(): void {
    for (const m of this.instances) m.despawn()
    this.instances = []
  }
}
