import Phaser from 'phaser'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { FROG_LEVELS, MAX_LEVEL, textureKeyForLevel } from '../config/frogs'

// Игра рендерится в физических пикселях (window * DPR), CSS-зум 1/DPR в game/index.ts
// Все размеры/координаты ниже задаются в CSS-пикселях, умножение на DPR делается здесь
const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))

const DASH_RADIUS = 70 * DPR
const FIELD_PAD_X = 48 * DPR
const FIELD_PAD_Y = 24 * DPR
const MERGE_RADIUS = 50 * DPR

// Бокс-дропы
const MAX_ENTITIES = 16            // суммарный лимит лягушки + коробки
const BOX_INTERVAL_MS = 10000      // интервал заполнения прогресс-бара
const BOX_FALL_DURATION = 380      // длительность падения (быстрее)
const BOX_DISPLAY_SIZE = 56 * DPR  // размер коробки на экране
const BOX_IDLE_INTERVAL = 5500     // период подпрыгивания

// SVG грузится в физических пикселях (CSS * DPR), плюс +50% для запаса
const TEXTURE_QUALITY = DPR * 1.5
const BASE_SCALE = DPR / TEXTURE_QUALITY  // = 1/1.5 ≈ 0.667

interface Poop {
  img: Phaser.GameObjects.Image
  value: number
  expiresAt: number
}

interface BoxData {
  img: Phaser.GameObjects.Image
  isLanding: boolean
  baseScale: number
  baseY: number
  idleTween: Phaser.Tweens.TweenChain | null
}

interface FrogData {
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Image
  facingRight: boolean
  isMoving: boolean
  isDragging: boolean
  isMerging: boolean
  level: number
  dragPoopTimer: Phaser.Time.TimerEvent | null
}

export class MainScene extends Phaser.Scene {
  private frogs: FrogData[] = []
  private poops: Poop[] = []
  private boxes: BoxData[] = []
  private boxProgressMs = 0
  private boxWaiting = false

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
    const fieldH = height - FIELD_PAD_Y * 2
    this.add.rectangle(width / 2, height / 2, fieldW, fieldH)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setFillStyle(0x000000, 0)

    // Тест: по одной лягушке каждого уровня в сетке — для подгонки размеров
    const cols = 3
    const rows = Math.ceil(MAX_LEVEL / cols)
    const cellW = (width - FIELD_PAD_X * 2) / cols
    const cellH = (height - FIELD_PAD_Y * 2) / rows
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
    body.setInteractive({ useHandCursor: true })
    this.input.setDraggable(body)

    container.add(body)

    const frog: FrogData = {
      container, body,
      facingRight: true,
      isMoving: false,
      isDragging: false,
      isMerging: false,
      level,
      dragPoopTimer: null,
    }
    this.frogs.push(frog)

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

      // Poop periodically while held, but no jumping
      frog.dragPoopTimer = this.time.addEvent({
        delay: 1200,
        loop: true,
        callback: () => {
          this.spawnPoop(frog.container.x, frog.container.y, frog.facingRight)
          // Squish при каждой какашке
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
              })
            },
          })
        },
      })
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
      frog.dragPoopTimer?.remove()
      frog.dragPoopTimer = null

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
      const maxY = height - FIELD_PAD_Y - margin
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
    const toY = Phaser.Math.Clamp(fromY + Math.sin(angle) * dist, FIELD_PAD_Y + 10 * DPR, height - FIELD_PAD_Y - 10 * DPR)

    const movingRight = toX >= fromX
    if (movingRight !== frog.facingRight) {
      frog.container.scaleX = (movingRight ? 1 : -1) * BASE_SCALE
      frog.facingRight = movingRight
    }

    frog.isMoving = true
    this.tweens.killTweensOf(frog.body)

    // 1. Poop appears at current position
    this.spawnPoop(fromX, fromY, frog.facingRight)

    // 2. Short pause, then leap
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

    // Иначе обычная какашка + squish
    this.spawnPoop(frog.container.x, frog.container.y, frog.facingRight)

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

  private spawnPoop(x: number, y: number, facingRight: boolean) {
    const value = 1
    // Spawn from behind the frog, slightly above center
    const behindX = x + (facingRight ? -10 * DPR : 10 * DPR)
    const img = this.add.image(behindX, y + 6 * DPR, 'poop')
    img.setInteractive({ useHandCursor: true })
    img.setAlpha(0)
    img.setScale(0.4 * BASE_SCALE)

    // Shoot diagonally: 75° from vertical = mostly backward, little downward
    const rad = (75 * Math.PI) / 180
    const dist = 16 * DPR
    const dx = dist * Math.sin(rad)
    const dy = dist * Math.cos(rad)
    const landX = behindX + (facingRight ? -dx : dx)
    const landY = y + 10 * DPR + dy

    this.tweens.add({
      targets: img,
      x: landX,
      y: landY,
      alpha: 1,
      scale: BASE_SCALE,
      duration: 220,
      ease: 'Power2.easeOut',
    })

    const poopObj: Poop = { img, value, expiresAt: Date.now() + 1000 }
    img.on('pointerdown', () => this.collectPoop(poopObj))
    this.poops.push(poopObj)
  }

  private collectPoop(poopObj: Poop) {
    const { img, value } = poopObj
    if (!img.active) return

    useGameStore.getState().addGold(value)
    eventBus.emit('poop:collected', { value })

    this.tweens.add({
      targets: img,
      y: img.y - 40 * DPR,
      alpha: 0,
      scale: 1.5 * BASE_SCALE,
      duration: 350,
      ease: 'Power2',
      onComplete: () => {
        img.destroy()
        this.poops = this.poops.filter((p) => p !== poopObj)
      },
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
    a.dragPoopTimer?.remove()
    a.dragPoopTimer = null
    b.dragPoopTimer?.remove()
    b.dragPoopTimer = null

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
    frog.dragPoopTimer?.remove()
    frog.container.destroy()
  }

  // ============== БОКС-ДРОПЫ ==============

  private canSpawnBox(): boolean {
    return this.frogs.length + this.boxes.length < MAX_ENTITIES
  }

  private spawnBox() {
    const { width, height } = this.scale
    const x = Phaser.Math.Between(FIELD_PAD_X + 40 * DPR, width - FIELD_PAD_X - 40 * DPR)
    const targetY = Phaser.Math.Between(FIELD_PAD_Y + 40 * DPR, height - FIELD_PAD_Y - 40 * DPR)

    // Стартуем выше канваса — коробка просто влетает в кадр без fade
    const startY = -BOX_DISPLAY_SIZE
    const img = this.add.image(x, startY, 'box')
    img.setDisplaySize(BOX_DISPLAY_SIZE, BOX_DISPLAY_SIZE)
    img.setDepth(targetY) // сразу высокий depth чтобы не перекрывалось лягушками
    const baseScale = img.scaleX

    const box: BoxData = { img, isLanding: true, baseScale, baseY: targetY, idleTween: null }
    this.boxes.push(box)

    // Инпут вешаем сразу, во время падения handler игнорирует через isLanding
    img.setInteractive({ useHandCursor: true })
    img.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      if (box.isLanding) return
      event.stopPropagation()
      this.onBoxTapped(box)
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

    // Спавн лягушки level 1 с pop
    this.time.delayedCall(80, () => {
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

    // Если ждали освободившегося слота — спавним новую коробку
    if (this.boxWaiting) {
      this.time.delayedCall(250, () => {
        if (this.canSpawnBox()) {
          this.spawnBox()
          this.boxProgressMs = 0
          this.boxWaiting = false
          useGameStore.getState().setBoxWaiting(false)
        }
      })
    }
  }

  // ============== UPDATE ==============

  update(_time: number, delta: number) {
    // Прогресс падения коробки
    if (!this.boxWaiting) {
      this.boxProgressMs += delta
      if (this.boxProgressMs >= BOX_INTERVAL_MS) {
        if (this.canSpawnBox()) {
          this.spawnBox()
          this.boxProgressMs = 0
        } else {
          this.boxProgressMs = BOX_INTERVAL_MS // фиксируем на 100%
          this.boxWaiting = true
          useGameStore.getState().setBoxWaiting(true)
        }
      }
    }
    const progress = Math.min(1, this.boxProgressMs / BOX_INTERVAL_MS)
    const store = useGameStore.getState()
    if (Math.abs(store.boxProgress - progress) > 0.005) {
      store.setBoxProgress(progress)
    }

    // Depth sort: чем ниже лягушка/коробка, тем она поверх
    for (const frog of this.frogs) {
      if (!frog.isDragging && !frog.isMerging) {
        frog.container.setDepth(frog.container.y)
      }
    }
    for (const box of this.boxes) {
      box.img.setDepth(box.baseY)
    }

    const now = Date.now()
    this.poops = this.poops.filter((p) => {
      if (p.expiresAt < now && p.img.active) {
        this.tweens.add({
          targets: p.img,
          alpha: 0,
          duration: 200,
          onComplete: () => p.img.destroy(),
        })
        return false
      }
      return true
    })
  }
}
