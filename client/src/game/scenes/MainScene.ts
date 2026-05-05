import Phaser from 'phaser'
import { useGameStore, getDropIntervalMs, getMagnetSpawnInterval, getMagnetDuration, getMagnetMergesPerCycle } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { FROG_LEVELS, MAX_LEVEL, textureKeyForLevel, rollPoopType, POOP_INTERVAL_MS, getTargetIncomePerSec, getPoopValueExact, stochasticRound, type PoopType } from '../config/frogs'

// Игра рендерится в физических пикселях (window * DPR), CSS-зум 1/DPR в game/index.ts
// Все размеры/координаты ниже задаются в CSS-пикселях, умножение на DPR делается здесь
const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))

const DASH_RADIUS = 70 * DPR
const FIELD_PAD_X = 48 * DPR
const FIELD_PAD_Y = 60 * DPR        // верхний отступ от верха канваса
const FIELD_PAD_Y_BOTTOM = 90 * DPR // нижний отступ — крупнее, чтобы лягушки не уходили слишком вниз
const MERGE_RADIUS = 50 * DPR

// Бокс-дропы
const MAX_ENTITIES = 16            // суммарный лимит лягушки + коробки
const BOX_FALL_DURATION = 380      // длительность падения (быстрее)
const BOX_DISPLAY_SIZE = 56 * DPR  // размер коробки на экране
const BOX_IDLE_INTERVAL = 5500     // период подпрыгивания
const BOX_OPEN_RADIUS = 80 * DPR   // радиус разлёта тапа — открывает все коробки рядом

// SVG грузится в физических пикселях (CSS * DPR), плюс +50% для запаса
const TEXTURE_QUALITY = DPR * 1.5
const BASE_SCALE = DPR / TEXTURE_QUALITY  // = 1/1.5 ≈ 0.667

interface BoxData {
  img: Phaser.GameObjects.Image
  isLanding: boolean
  baseScale: number
  baseY: number
  idleTween: Phaser.Tweens.TweenChain | null
}

interface MagnetData {
  container: Phaser.GameObjects.Container
  emoji: Phaser.GameObjects.Text
  x: number
  y: number
  expiresAt: number
  pair: [FrogData, FrogData]
  mergesDone: number
  mergesTarget: number
}

interface FrogData {
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Image
  facingRight: boolean
  isMoving: boolean
  isDragging: boolean
  isMerging: boolean
  isAttracted: boolean
  level: number
  poopTimer: Phaser.Time.TimerEvent | null
}

export class MainScene extends Phaser.Scene {
  private frogs: FrogData[] = []
  private boxes: BoxData[] = []
  private boxProgressMs = 0

  private magnets: MagnetData[] = []
  private magnetSpawnMs = 0

  constructor() {
    super({ key: 'MainScene' })
  }

  preload() {
    // Каждый уровень — свой SVG файл из /public/frogs_svg/ со своим размером
    FROG_LEVELS.forEach((cfg, idx) => {
      const level = idx + 1
      this.load.svg(textureKeyForLevel(level), cfg.path, {
        width: 50 * TEXTURE_QUALITY * cfg.size,
        height: 47 * TEXTURE_QUALITY * cfg.size,
      })
    })

    this.load.svg('poop', '/poop.svg', { width: 18 * TEXTURE_QUALITY, height: 18 * TEXTURE_QUALITY })
    this.load.image('map', '/map.webp')
    this.load.image('box', '/box.webp')
  }

  create() {
    const { width, height } = this.scale

    const bg = this.add.image(width / 2, height / 2, 'map')
    bg.setDisplaySize(width, height)

    // Временная рамка игрового поля
    const fieldW = width - FIELD_PAD_X * 2
    const fieldH = height - FIELD_PAD_Y - FIELD_PAD_Y_BOTTOM
    const fieldCenterY = (FIELD_PAD_Y + (height - FIELD_PAD_Y_BOTTOM)) / 2
    this.add.rectangle(width / 2, fieldCenterY, fieldW, fieldH)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setFillStyle(0x000000, 0)

    // Подписка на покупку лягушки из магазина
    eventBus.on('frog:purchased', this.onFrogPurchased)

    // ТЕСТ: по одной лягушке каждого уровня (1..7), сетка 3+3+1
    const cols = 3
    const rows = Math.ceil(MAX_LEVEL / cols)
    const cellW = (width - FIELD_PAD_X * 2) / cols
    const cellH = (height - FIELD_PAD_Y - FIELD_PAD_Y_BOTTOM) / rows
    for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
      const idx = lvl - 1
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = FIELD_PAD_X + cellW * (col + 0.5)
      const y = FIELD_PAD_Y + cellH * (row + 0.5)
      this.spawnFrog(x, y, lvl)
    }
  }

  private spawnFrog(x: number, y: number, level: number = 1): FrogData {
    const container = this.add.container(x, y)
    container.setScale(BASE_SCALE)

    const body = this.add.image(0, 0, textureKeyForLevel(level))
    body.scaleY = 1.0
    body.setTint(FROG_LEVELS[level - 1].tint)
    body.setInteractive({ useHandCursor: true })
    this.input.setDraggable(body)

    container.add(body)

    const frog: FrogData = {
      container, body,
      facingRight: true,
      isMoving: false,
      isDragging: false,
      isMerging: false,
      isAttracted: false,
      level,
      poopTimer: null,
    }
    this.frogs.push(frog)
    this.syncEntityCount()

    // Лягушка какает по своему таймеру 1.7с — независимо от прыжка/драга
    // startAt со случайным смещением — чтобы лягушки какали вразнобой, а не синхронно
    frog.poopTimer = this.time.addEvent({
      delay: POOP_INTERVAL_MS,
      startAt: Math.random() * POOP_INTERVAL_MS,
      loop: true,
      callback: () => {
        if (frog.isMerging) return
        const type = rollPoopType(frog.level)
        this.spawnAutoPoop(frog, type)
        // Лёгкое сжатие тела на каждый пук (поверх idle, не блокирует)
        this.tweens.add({
          targets: frog.body,
          scaleY: 0.85,
          duration: 70,
          yoyo: true,
          ease: 'Power2.easeIn',
        })
      },
    })

    let dragMoved = false
    let dragStartX = 0
    let dragStartY = 0
    let prevDragX = 0

    body.on('dragstart', (pointer: Phaser.Input.Pointer) => {
      dragStartX = pointer.x
      dragStartY = pointer.y
      prevDragX = pointer.x
      dragMoved = false
      this.tweens.killTweensOf(frog.container)
      this.tweens.killTweensOf(frog.body)
      frog.isMoving = true
      frog.isDragging = true
      frog.container.setDepth(99999)

      // Pickup: быстро 0.8 → вернуть на 1.0
      this.tweens.add({
        targets: frog.body,
        scaleY: 0.8,
        duration: 60,
        ease: 'Power2.easeIn',
        onComplete: () => {
          this.tweens.add({
            targets: frog.body,
            scaleY: 1.0,
            duration: 120,
            ease: 'Power2.easeOut',
          })
        },
      })

      // Какание идёт по своему таймеру (frog.poopTimer) — драг его не блокирует
    })

    body.on('drag', (pointer: Phaser.Input.Pointer) => {
      if (Phaser.Math.Distance.Between(dragStartX, dragStartY, pointer.x, pointer.y) > 8) {
        dragMoved = true
      }

      const dx = pointer.x - prevDragX
      if (Math.abs(dx) > 2) {
        const movingRight = dx > 0
        if (movingRight !== frog.facingRight) {
          frog.container.scaleX = (movingRight ? 1 : -1) * BASE_SCALE
          frog.facingRight = movingRight
        }
      }
      prevDragX = pointer.x

      frog.container.x = pointer.x
      frog.container.y = pointer.y
      frog.body.x = 0
      frog.body.y = 0
    })

    body.on('dragend', (pointer: Phaser.Input.Pointer) => {
      frog.isDragging = false

      // Сначала проверяем мердж в позиции отпускания пальца
      if (frog.level < MAX_LEVEL) {
        const target = this.findMergeTarget(pointer.x, pointer.y, frog.level, frog)
        if (target) {
          this.performMerge(frog, target, pointer.x, pointer.y)
          return
        }
      }

      if (!dragMoved) {
        this.onFrogTapped(frog, pointer.x, pointer.y)
        return
      }

      // Если отпустил за полем — плавно тянем обратно к ближайшей валидной точке
      const margin = 20 * DPR
      const { width, height } = this.scale
      const minX = FIELD_PAD_X + margin
      const maxX = width - FIELD_PAD_X - margin
      const minY = FIELD_PAD_Y + margin
      const maxY = height - FIELD_PAD_Y_BOTTOM - margin
      const clampedX = Phaser.Math.Clamp(frog.container.x, minX, maxX)
      const clampedY = Phaser.Math.Clamp(frog.container.y, minY, maxY)
      const outOfBounds = clampedX !== frog.container.x || clampedY !== frog.container.y

      const playDropSquish = () => {
        this.tweens.killTweensOf(frog.body)
        this.tweens.add({
          targets: frog.body,
          scaleY: 0.8,
          duration: 70,
          ease: 'Power2.easeIn',
          onComplete: () => {
            this.tweens.add({
              targets: frog.body,
              scaleY: 1.0,
              duration: 220,
              ease: 'Back.easeOut',
              onComplete: () => {
                frog.isMoving = false
                this.startIdleAnim(frog)
                this.scheduleNextDash(frog)
              },
            })
          },
        })
      }

      if (outOfBounds) {
        // Плавно подтягиваем к границе, потом drop squish
        this.tweens.add({
          targets: frog.container,
          x: clampedX,
          y: clampedY,
          duration: 280,
          ease: 'Power2.easeOut',
          onComplete: playDropSquish,
        })
      } else {
        playDropSquish()
      }
    })

    this.startIdleAnim(frog)
    this.scheduleNextDash(frog)

    return frog
  }

  private startIdleAnim(frog: FrogData) {
    this.tweens.add({
      targets: frog.body,
      scaleY: 0.92,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private scheduleNextDash(frog: FrogData) {
    this.time.addEvent({
      delay: Phaser.Math.Between(2000, 4000),
      callback: () => this.performDash(frog),
    })
  }

  private performDash(frog: FrogData) {
    if (frog.isMerging) return
    if (frog.isAttracted) {
      this.scheduleNextDash(frog)
      return
    }
    if (frog.isMoving) {
      this.scheduleNextDash(frog)
      return
    }

    const { width, height } = this.scale
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const dist = Phaser.Math.FloatBetween(40 * DPR, DASH_RADIUS)

    const fromX = frog.container.x
    const fromY = frog.container.y
    const toX = Phaser.Math.Clamp(fromX + Math.cos(angle) * dist, FIELD_PAD_X + 10 * DPR, width - FIELD_PAD_X - 10 * DPR)
    const toY = Phaser.Math.Clamp(fromY + Math.sin(angle) * dist, FIELD_PAD_Y + 10 * DPR, height - FIELD_PAD_Y_BOTTOM - 10 * DPR)

    const movingRight = toX >= fromX
    if (movingRight !== frog.facingRight) {
      frog.container.scaleX = (movingRight ? 1 : -1) * BASE_SCALE
      frog.facingRight = movingRight
    }

    frog.isMoving = true
    this.tweens.killTweensOf(frog.body)

    // Какашки идут по своему таймеру (frog.poopTimer), независимо от прыжка

    // Короткая пауза перед прыжком
    this.time.delayedCall(350, () => {
      // Лягушку взяли пока шла пауза — отменяем прыжок
      if (frog.isDragging) {
        frog.isMoving = false
        return
      }

      // Stretch during dash
      this.tweens.add({
        targets: frog.body,
        scaleY: 1.2,
        duration: 120,
        ease: 'Power2.easeOut',
      })

      // Move to target
      this.tweens.add({
        targets: frog.container,
        x: toX,
        y: toY,
        duration: 200,
        ease: 'Power2.easeOut',
        onComplete: () => {
          if (frog.isDragging) return

          this.tweens.killTweensOf(frog.body)

          // Landing squish → settle
          this.tweens.add({
            targets: frog.body,
            scaleY: 0.8,
            duration: 80,
            ease: 'Power2.easeIn',
            onComplete: () => {
              if (frog.isDragging) return

              this.tweens.add({
                targets: frog.body,
                scaleY: 1.0,
                duration: 180,
                ease: 'Back.easeOut',
                onComplete: () => {
                  if (frog.isDragging) return
                  frog.isMoving = false
                  this.startIdleAnim(frog)
                  this.scheduleNextDash(frog)
                },
              })
            },
          })
        },
      })
    })
  }

  private onFrogTapped(frog: FrogData, tapX: number = frog.container.x, tapY: number = frog.container.y) {
    // Тап-мердж: ищем рядом с точкой тапа другую лягушку того же уровня
    if (frog.level < MAX_LEVEL) {
      const target = this.findMergeTarget(tapX, tapY, frog.level, frog)
      if (target) {
        this.performMerge(frog, target, tapX, tapY)
        return
      }
    }

    // Тап = +1 монета (не зависит от уровня), отдельно от какашек
    useGameStore.getState().addGold(1)
    this.spawnFloatingText(frog.container.x, frog.container.y - 20 * DPR, '+1', 'regular')

    this.tweens.killTweensOf(frog.body)
    this.tweens.add({
      targets: frog.body,
      scaleY: 0.8,
      duration: 60,
      ease: 'Power2.easeIn',
      onComplete: () => {
        this.tweens.add({
          targets: frog.body,
          scaleY: 1.0,
          duration: 150,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (!frog.isMoving && !frog.isMerging) this.startIdleAnim(frog)
          },
        })
      },
    })
  }

  // ============== КАКАШКИ (auto-collect) ==============

  private spawnAutoPoop(frog: FrogData, type: PoopType) {
    const x = frog.container.x
    const y = frog.container.y
    const facingRight = frog.facingRight
    // Сумма вычисляется по точной цели уровня (target/sec × interval),
    // округляется стохастически — среднее за время точно матчит target.
    const value = stochasticRound(getPoopValueExact(frog.level))

    const tintByType: Record<PoopType, number> = {
      regular: 0x8b5a2b, // тёмно-коричневый
      big: 0xc88b4c,     // светло-золотисто-коричневый
      huge: 0xc0c0c0,    // серебряный
    }
    // Размер у всех типов одинаковый, но крупнее базы
    const finalScale = BASE_SCALE * 1.3

    // Положение приземления какашки — отдельно по X и Y, индекс = уровень-1
    // horizDistByLevel — насколько далеко по ГОРИЗОНТАЛИ от лягушки (положительное — назад от неё)
    // vertOffsetByLevel — насколько НИЖЕ центра лягушки приземлится (положительное — вниз, отрицательное — вверх)
    const horizDistByLevel = [20, 26, 34, 38, 40, 42, 42] // L1..L7
    const vertOffsetByLevel = [14, 16, 16, 18, 20, 10, 26] // L1..L7

    const horizDist = (horizDistByLevel[Math.min(frog.level - 1, 6)] ?? 28) * DPR
    const vertOffset = (vertOffsetByLevel[Math.min(frog.level - 1, 6)] ?? 16) * DPR

    const behindX = x + (facingRight ? -10 * DPR : 10 * DPR)
    const startY = y + 6 * DPR
    const img = this.add.image(behindX, startY, 'poop')
    img.setAlpha(0)
    img.setScale(0.4 * finalScale)
    img.setTint(tintByType[type])

    // Phase 1: какашка появляется сзади и приземляется на (landX, landY)
    const landX = behindX + (facingRight ? -horizDist : horizDist)
    const landY = y + vertOffset

    this.tweens.add({
      targets: img,
      x: landX,
      y: landY,
      alpha: 1,
      scale: finalScale,
      duration: 220,
      ease: 'Power2.easeOut',
      onComplete: () => {
        // Какашка статична, медленно тает на месте.
        // Если стохастический round дал 0 (для совсем малых таргетов) — без денег и цифры,
        // визуал какашки всё равно показываем.
        if (value > 0) {
          useGameStore.getState().addGold(value)
          eventBus.emit('poop:collected', { value })
          this.spawnFloatingText(landX, landY - 22 * DPR, `+${value}`, type)
        }

        this.tweens.add({
          targets: img,
          alpha: 0,
          duration: 1100,
          ease: 'Sine.easeIn',
          onComplete: () => img.destroy(),
        })
      },
    })
  }

  private spawnFloatingText(x: number, y: number, text: string, _type: PoopType) {
    // Все цифры — золотые, очень мелкие, медленно поднимаются
    const t = this.add.text(x, y, text, {
      fontFamily: 'Russo One, sans-serif',
      fontSize: `${11 * DPR}px`,
      color: '#fde047',
      stroke: '#3a2207',
      strokeThickness: 2.5 * DPR,
    })
    t.setOrigin(0.5)
    t.setDepth(99998)

    // Сначала летит вверх без затухания
    this.tweens.add({
      targets: t,
      y: y - 32 * DPR,
      duration: 1800,
      ease: 'Sine.easeOut',
    })
    // Затухание стартует позже и идёт быстрее, продолжая полёт
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1000,
      duration: 700,
      ease: 'Sine.easeIn',
      onComplete: () => t.destroy(),
    })
  }

  // ============== МЕРДЖ ==============

  private findMergeTarget(x: number, y: number, level: number, exclude: FrogData): FrogData | null {
    let best: FrogData | null = null
    let bestDist = MERGE_RADIUS
    for (const other of this.frogs) {
      if (other === exclude) continue
      if (other.isMerging || other.isDragging) continue
      if (other.level !== level) continue
      const d = Phaser.Math.Distance.Between(x, y, other.container.x, other.container.y)
      if (d <= bestDist) {
        bestDist = d
        best = other
      }
    }
    return best
  }

  private performMerge(a: FrogData, b: FrogData, cx: number, cy: number) {
    // Заморозка: убрать лягушек из активных, отключить инпут, прервать твины
    a.isMerging = true
    b.isMerging = true
    a.isMoving = true
    b.isMoving = true
    this.tweens.killTweensOf(a.container)
    this.tweens.killTweensOf(a.body)
    this.tweens.killTweensOf(b.container)
    this.tweens.killTweensOf(b.body)
    a.body.disableInteractive()
    b.body.disableInteractive()
    a.poopTimer?.remove()
    a.poopTimer = null
    b.poopTimer?.remove()
    b.poopTimer = null

    eventBus.emit('merge:happened', { level: a.level })

    const VORTEX_DURATION = 350
    a.container.setDepth(99997)
    b.container.setDepth(99997)

    this.spiralFrogTo(a, cx, cy, VORTEX_DURATION)
    this.spiralFrogTo(b, cx, cy, VORTEX_DURATION)
    this.spawnVortexParticles(cx, cy, VORTEX_DURATION)

    this.time.delayedCall(VORTEX_DURATION, () => {
      this.removeFrog(a)
      this.removeFrog(b)
      this.flashAt(cx, cy)

      const newLevel = Math.min(a.level + 1, MAX_LEVEL)
      this.time.delayedCall(60, () => {
        const newFrog = this.spawnFrog(cx, cy, newLevel)
        // Pop-in: scale 0 → 1.2 → 1.0 (учитывая BASE_SCALE)
        newFrog.container.setScale(0)
        this.tweens.add({
          targets: newFrog.container,
          scale: BASE_SCALE * 1.2,
          duration: 160,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: newFrog.container,
              scale: BASE_SCALE,
              duration: 100,
              ease: 'Power2.easeOut',
            })
          },
        })

        // Если уровень открыт впервые — эмитим событие для модалки
        console.log('[performMerge] newLevel=', newLevel, 'a.level=', a.level, 'b.level=', b.level)
        const wasNew = useGameStore.getState().markDiscovered(newLevel)
        console.log('[performMerge] markDiscovered returned', wasNew)
        if (wasNew) {
          console.log('[performMerge] emitting frog:discovered')
          eventBus.emit('frog:discovered', { level: newLevel })
        }
      })
    })
  }

  private spiralFrogTo(frog: FrogData, cx: number, cy: number, duration: number) {
    const startX = frog.container.x
    const startY = frog.container.y
    const startAngle = Math.atan2(startY - cy, startX - cx)
    const startRadius = Math.max(Phaser.Math.Distance.Between(startX, startY, cx, cy), 1)

    const obj = { p: 0 }
    this.tweens.add({
      targets: obj,
      p: 1,
      duration,
      ease: 'Power2.easeIn',
      onUpdate: () => {
        const a = startAngle + obj.p * Math.PI * 4 // 2 полных оборота
        const r = startRadius * (1 - obj.p)
        frog.container.x = cx + Math.cos(a) * r
        frog.container.y = cy + Math.sin(a) * r
      },
    })

    // Вращение вокруг своей оси и схлопывание
    this.tweens.add({
      targets: frog.container,
      rotation: Math.PI * 4,
      scale: 0,
      duration,
      ease: 'Power2.easeIn',
    })
  }

  private spawnVortexParticles(cx: number, cy: number, duration: number) {
    const COUNT = 12
    for (let i = 0; i < COUNT; i++) {
      const baseAngle = (i / COUNT) * Math.PI * 2
      const startRadius = (50 + Math.random() * 30) * DPR
      const px = cx + Math.cos(baseAngle) * startRadius
      const py = cy + Math.sin(baseAngle) * startRadius

      const particle = this.add.circle(px, py, 3 * DPR, 0xffffaa, 0.85)
      particle.setDepth(99998)

      const obj = { p: 0 }
      this.tweens.add({
        targets: obj,
        p: 1,
        duration,
        ease: 'Power2.easeIn',
        onUpdate: () => {
          const a = baseAngle + obj.p * Math.PI * 3
          const r = startRadius * (1 - obj.p)
          particle.x = cx + Math.cos(a) * r
          particle.y = cy + Math.sin(a) * r
          particle.setAlpha(0.85 * (1 - obj.p))
        },
        onComplete: () => particle.destroy(),
      })
    }
  }

  private flashAt(x: number, y: number) {
    const flash = this.add.circle(x, y, 12 * DPR, 0xffffff, 1)
    flash.setDepth(99999)
    this.tweens.add({
      targets: flash,
      scale: 4,
      alpha: 0,
      duration: 220,
      ease: 'Power2.easeOut',
      onComplete: () => flash.destroy(),
    })
  }

  private removeFrog(frog: FrogData) {
    this.frogs = this.frogs.filter((f) => f !== frog)
    frog.poopTimer?.remove()
    frog.poopTimer = null
    frog.container.destroy()
    this.syncEntityCount()
  }

  // ============== БОКС-ДРОПЫ ==============

  private canSpawnBox(): boolean {
    return this.frogs.length + this.boxes.length < MAX_ENTITIES
  }

  private spawnBox() {
    const { width, height } = this.scale
    const x = Phaser.Math.Between(FIELD_PAD_X + 40 * DPR, width - FIELD_PAD_X - 40 * DPR)
    const targetY = Phaser.Math.Between(FIELD_PAD_Y + 40 * DPR, height - FIELD_PAD_Y_BOTTOM - 40 * DPR)

    // Стартуем выше канваса — коробка просто влетает в кадр без fade
    const startY = -BOX_DISPLAY_SIZE
    const img = this.add.image(x, startY, 'box')
    img.setDisplaySize(BOX_DISPLAY_SIZE, BOX_DISPLAY_SIZE)
    img.setDepth(targetY) // сразу высокий depth чтобы не перекрывалось лягушками
    const baseScale = img.scaleX

    const box: BoxData = { img, isLanding: true, baseScale, baseY: targetY, idleTween: null }
    this.boxes.push(box)
    this.syncEntityCount()

    // Инпут вешаем сразу, во время падения handler игнорирует через isLanding
    img.setInteractive({ useHandCursor: true })
    img.on('pointerdown', () => {
      if (box.isLanding) return
      // Открываем тапнутую коробку + все приземлившиеся в радиусе
      const cx = box.img.x
      const cy = box.img.y
      const targets: BoxData[] = []
      for (const b of this.boxes) {
        if (b.isLanding) continue
        const d = Phaser.Math.Distance.Between(cx, cy, b.img.x, b.img.y)
        if (d <= BOX_OPEN_RADIUS) targets.push(b)
      }
      for (const t of targets) this.onBoxTapped(t)
    })

    this.tweens.add({
      targets: img,
      y: targetY,
      duration: BOX_FALL_DURATION,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Squash при приземлении
        this.tweens.add({
          targets: img,
          scaleY: baseScale * 0.7,
          scaleX: baseScale * 1.15,
          duration: 80,
          yoyo: true,
          ease: 'Power2',
          onComplete: () => {
            img.scaleX = baseScale
            img.scaleY = baseScale
            box.isLanding = false
            this.startBoxIdleAnim(box)
          },
        })
      },
    })
  }

  private startBoxIdleAnim(box: BoxData) {
    const { baseScale, baseY } = box
    const jumpHeight = 7 * DPR

    const cycle = () => {
      if (!box.img.active || !this.boxes.includes(box)) return

      box.idleTween = this.tweens.chain({
        targets: box.img,
        tweens: [
          // Squash перед прыжком: шире, ниже
          {
            scaleX: baseScale * 1.12,
            scaleY: baseScale * 0.88,
            duration: 100,
            ease: 'Power2.easeIn',
          },
          // Подпрыг + растяжка вверх
          {
            scaleX: baseScale * 0.96,
            scaleY: baseScale * 1.06,
            y: baseY - jumpHeight,
            duration: 150,
            ease: 'Power2.easeOut',
          },
          // Приземление: снова squash
          {
            scaleX: baseScale * 1.1,
            scaleY: baseScale * 0.9,
            y: baseY,
            duration: 80,
            ease: 'Power2.easeIn',
          },
          // Settle к норме
          {
            scaleX: baseScale,
            scaleY: baseScale,
            duration: 100,
            ease: 'Back.easeOut',
          },
        ],
        onComplete: () => {
          box.idleTween = null
          this.time.delayedCall(BOX_IDLE_INTERVAL, cycle)
        },
      })
    }

    // Первая пауза перед первым прыжком
    this.time.delayedCall(BOX_IDLE_INTERVAL, cycle)
  }

  private onBoxTapped(box: BoxData) {
    if (box.isLanding) return
    if (!box.img.active) return

    const x = box.img.x
    const y = box.img.y
    const baseScale = box.baseScale

    this.boxes = this.boxes.filter((b) => b !== box)
    this.syncEntityCount()
    this.tweens.killTweensOf(box.img)
    box.idleTween = null
    box.img.disableInteractive()

    // Коробка увеличивается и исчезает
    this.tweens.add({
      targets: box.img,
      scaleX: baseScale * 1.4,
      scaleY: baseScale * 1.4,
      alpha: 0,
      rotation: 0.4,
      duration: 220,
      ease: 'Power2.easeOut',
      onComplete: () => box.img.destroy(),
    })

    // Частицы взрыва
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4
      const dist = (40 + Math.random() * 30) * DPR
      const p = this.add.circle(x, y, 3 * DPR, 0xc8a572, 0.9)
      p.setDepth(99998)
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist + 25 * DPR,
        alpha: 0,
        duration: 350,
        ease: 'Power2.easeOut',
        onComplete: () => p.destroy(),
      })
    }

    // Camera shake + flash
    this.cameras.main.shake(120, 0.005)
    this.flashAt(x, y)

    // Спавн лягушки level 1 с pop — без задержки, реакция мгновенная
    this.time.delayedCall(0, () => {
      const newFrog = this.spawnFrog(x, y, 1)
      newFrog.container.setScale(0)
      this.tweens.add({
        targets: newFrog.container,
        scale: BASE_SCALE * 1.2,
        duration: 160,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: newFrog.container,
            scale: BASE_SCALE,
            duration: 100,
            ease: 'Power2.easeOut',
          })
        },
      })
    })

    // Освободившийся слот подхватит сам update() — не нужно дёргать вручную
  }

  // ============== МАГНИТ ==============

  // Ищет ближайшую пару лягушек одного уровня — кандидата для магнита
  private findClosestSameLevelPair(): [FrogData, FrogData] | null {
    const byLevel = new Map<number, FrogData[]>()
    for (const f of this.frogs) {
      if (f.isMerging || f.isDragging || f.isAttracted) continue
      if (f.level >= MAX_LEVEL) continue
      const arr = byLevel.get(f.level) ?? []
      arr.push(f)
      byLevel.set(f.level, arr)
    }

    let bestPair: [FrogData, FrogData] | null = null
    let bestDist = Infinity
    for (const frogs of byLevel.values()) {
      if (frogs.length < 2) continue
      for (let i = 0; i < frogs.length; i++) {
        for (let j = i + 1; j < frogs.length; j++) {
          const a = frogs[i]
          const b = frogs[j]
          const d = Phaser.Math.Distance.Between(a.container.x, a.container.y, b.container.x, b.container.y)
          if (d < bestDist) {
            bestDist = d
            bestPair = [a, b]
          }
        }
      }
    }
    return bestPair
  }

  private hasMergeablePair(): boolean {
    return this.findClosestSameLevelPair() !== null
  }

  private spawnMagnet(level: number) {
    const pair = this.findClosestSameLevelPair()
    if (!pair) return

    const [a, b] = pair

    // Освобождаем пару от их текущих движений чтобы магнит чисто тянул
    for (const f of [a, b]) {
      this.tweens.killTweensOf(f.container)
      f.isMoving = false
    }

    const x = (a.container.x + b.container.x) / 2
    const y = (a.container.y + b.container.y) / 2
    const duration = getMagnetDuration(level)

    const container = this.add.container(x, y)
    container.setDepth(99000)

    const emoji = this.add.text(0, 0, '🧲', { fontSize: `${30 * DPR}px` })
    emoji.setOrigin(0.5)
    container.add(emoji)
    container.setScale(0)

    // Pop-in
    this.tweens.add({
      targets: container,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    })

    // Лёгкая пульсация эмодзи
    this.tweens.add({
      targets: emoji,
      scale: 1.12,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    const magnet: MagnetData = {
      container, emoji, x, y,
      expiresAt: Date.now() + duration,
      pair,
      mergesDone: 0,
      mergesTarget: getMagnetMergesPerCycle(level),
    }
    this.magnets.push(magnet)
  }

  private removeMagnet(magnet: MagnetData) {
    this.magnets = this.magnets.filter((m) => m !== magnet)
    this.tweens.killTweensOf(magnet.emoji)
    this.tweens.killTweensOf(magnet.container)
    this.tweens.add({
      targets: magnet.container,
      scale: 0,
      alpha: 0,
      duration: 180,
      ease: 'Power2.easeIn',
      onComplete: () => magnet.container.destroy(),
    })
  }

  private updateMagnets() {
    const now = Date.now()

    // Сбрасываем флаг притяжения — переустановим у целевой пары
    for (const f of this.frogs) f.isAttracted = false

    for (const m of [...this.magnets]) {
      if (now >= m.expiresAt) {
        this.removeMagnet(m)
        continue
      }

      const [a, b] = m.pair

      // Если кто-то из пары уничтожен / в drag / merge — отменяем магнит
      if (
        !this.frogs.includes(a) || !this.frogs.includes(b) ||
        a.isDragging || a.isMerging || b.isDragging || b.isMerging
      ) {
        this.removeMagnet(m)
        continue
      }

      // Притягиваем именно эту пару к точке магнита
      const pull = 0.06
      a.container.x = Phaser.Math.Linear(a.container.x, m.x, pull)
      a.container.y = Phaser.Math.Linear(a.container.y, m.y, pull)
      b.container.x = Phaser.Math.Linear(b.container.x, m.x, pull)
      b.container.y = Phaser.Math.Linear(b.container.y, m.y, pull)
      a.isAttracted = true
      b.isAttracted = true

      // Когда сошлись — мерджим в точке магнита
      const d = Phaser.Math.Distance.Between(a.container.x, a.container.y, b.container.x, b.container.y)
      if (d < MERGE_RADIUS * 0.7) {
        this.performMerge(a, b, m.x, m.y)
        m.mergesDone += 1

        if (m.mergesDone >= m.mergesTarget) {
          this.removeMagnet(m)
          continue
        }

        // Ищем следующую пару — если есть, переезжаем магнит к ней
        const next = this.findClosestSameLevelPair()
        if (!next) {
          this.removeMagnet(m)
          continue
        }
        const [na, nb] = next
        for (const f of [na, nb]) {
          this.tweens.killTweensOf(f.container)
          f.isMoving = false
        }
        const newX = (na.container.x + nb.container.x) / 2
        const newY = (na.container.y + nb.container.y) / 2
        m.pair = next
        m.x = newX
        m.y = newY
        // Плавный полёт магнита к новой паре
        this.tweens.add({
          targets: m.container,
          x: newX,
          y: newY,
          duration: 220,
          ease: 'Power2.easeOut',
        })
      }
    }
  }

  // ============== ПОКУПКА ЛЯГУШЕК ==============

  private onFrogPurchased = ({ level }: { level: number }) => {
    const { width, height } = this.scale
    const x = Phaser.Math.Between(FIELD_PAD_X + 30 * DPR, width - FIELD_PAD_X - 30 * DPR)
    const y = Phaser.Math.Between(FIELD_PAD_Y + 30 * DPR, height - FIELD_PAD_Y_BOTTOM - 30 * DPR)
    const newFrog = this.spawnFrog(x, y, level)
    // Pop-in
    newFrog.container.setScale(0)
    this.tweens.add({
      targets: newFrog.container,
      scale: BASE_SCALE * 1.2,
      duration: 160,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: newFrog.container,
          scale: BASE_SCALE,
          duration: 100,
          ease: 'Power2.easeOut',
        })
      },
    })
  }

  private syncEntityCount() {
    useGameStore.getState().setEntityCount(this.frogs.length + this.boxes.length)
    this.syncIncomePerSec()
  }

  private syncIncomePerSec() {
    let total = 0
    for (const f of this.frogs) total += getTargetIncomePerSec(f.level)
    useGameStore.getState().setIncomePerSec(total)
  }

  // ============== UPDATE ==============

  update(_time: number, delta: number) {
    // Динамический интервал из апгрейда "Скорость дропа"
    const store = useGameStore.getState()
    const intervalMs = getDropIntervalMs(store.upgrades.dropSpeed)

    // Прогресс копится до 100%, дальше ждёт освободившегося слота
    this.boxProgressMs = Math.min(this.boxProgressMs + delta, intervalMs)
    if (this.boxProgressMs >= intervalMs && this.canSpawnBox()) {
      this.spawnBox()
      this.boxProgressMs = 0
    }
    const progress = Math.min(1, this.boxProgressMs / intervalMs)
    const waiting = this.boxProgressMs >= intervalMs && !this.canSpawnBox()
    if (Math.abs(store.boxProgress - progress) > 0.005) {
      store.setBoxProgress(progress)
    }
    if (store.boxWaiting !== waiting) {
      store.setBoxWaiting(waiting)
    }

    // Магнит — спавн по таймеру если куплен И включён И есть пара
    const magnetLevel = store.upgrades.magnet
    if (magnetLevel > 0 && store.magnetEnabled) {
      this.magnetSpawnMs += delta
      const spawnInt = getMagnetSpawnInterval(magnetLevel)
      if (this.magnetSpawnMs >= spawnInt) {
        if (this.hasMergeablePair() && this.magnets.length === 0) {
          this.spawnMagnet(magnetLevel)
          this.magnetSpawnMs = 0
        } else {
          // Замираем на 100% и ждём появления пары
          this.magnetSpawnMs = spawnInt
        }
      }
    } else {
      this.magnetSpawnMs = 0
    }
    if (this.magnets.length > 0) this.updateMagnets()

    // Depth sort: чем ниже лягушка/коробка, тем она поверх
    for (const frog of this.frogs) {
      if (!frog.isDragging && !frog.isMerging) {
        frog.container.setDepth(frog.container.y)
      }
    }
    for (const box of this.boxes) {
      box.img.setDepth(box.baseY)
    }

    // Какашки auto-collect через onComplete твинов — никакой ручной очистки не нужно
  }
}
