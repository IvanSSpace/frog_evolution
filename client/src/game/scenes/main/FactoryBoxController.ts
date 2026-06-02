// FactoryBoxController — фабрика Loc2 выпускает БОКСЫ (а не лягушек напрямую).
//
// Поток: фабрика выплёвывает фиолетовый бокс в точке P0 → бокс ЕДЕТ без прыжков
// P0→P1 → СПРЫГИВАЕТ P1→P2 → ПРЫЖКАМИ идёт к рандомной точке поля (на каждом
// прыжке рандомный разворот 0/90/180/270°). На поле: idle-бобинг + таймер
// авто-открытия (по умолч. 40с) + тап. Открытие → спавн лягушки на месте бокса.
//
// Координаты пути — в формате (xFrac, yFracZone), как EvolutionCenterController:
// worldPt = (xFrac*width, height*(1+yFracZone)) — нижняя (buildings) зона.
//
// Public API: emit(level) (на loc2 когда конвейер готов), count(), reset(), destroy().

import Phaser from 'phaser'
import type { MainScene } from '../MainScene'
import type { FrogSpawner } from './FrogSpawner'
import type { BuildingsController } from './BuildingsController'
import { useGameStore } from '../../../store/gameStore'
import { BOX_DISPLAY_SIZE, DPR } from './types'

type Pt = readonly [number, number] // [xFrac, yFracZone]

// Путь бокса от фабрики (заданы автором). Нижняя зона зданий.
const P0: Pt = [0.296, 0.402] // выход из фабрики
const P1: Pt = [0.432, 0.482] // едет (slide, без прыжков)
const P2: Pt = [0.517, 0.535] // спрыгивает сюда, дальше прыжками

// Зона поля куда бокс прыгает (рандомная точка). ⚠️ TUNABLE — подстроить визуально.
const FIELD_X_FRAC: readonly [number, number] = [0.18, 0.82]
const FIELD_Y_FRAC_ZONE: readonly [number, number] = [0.62, 0.82]

const BOX_TINT = 0x9d4edd // фиолетовый (эктоплазма-тематика Loc2)
const BOX_DEPTH = 90000 // выше поля, тапается
const AUTO_OPEN_MS = 40000 // авто-открытие если не трогали (Этап 2: апгрейд ускорит)
const SLIDE_MS = 700 // P0→P1 проезд
const DROP_MS = 420 // P1→P2 спрыгивание
const HOP_LEN = 70 * DPR // длина одного прыжка к полю
const HOP_MS = 360 // длительность одного прыжка
const HOP_HEIGHT = 26 * DPR // высота дуги прыжка

interface FactoryBox {
  sp: Phaser.GameObjects.Image
  autoTimer: Phaser.Time.TimerEvent | null
  opened: boolean
  level: number // уровень лягушки внутри (Этап 2: L8/L9 шанс)
}

export class FactoryBoxController {
  private scene: MainScene
  private spawner: FrogSpawner
  private buildings: BuildingsController
  private boxes: FactoryBox[] = []

  constructor(
    scene: MainScene,
    spawner: FrogSpawner,
    buildings: BuildingsController,
  ) {
    this.scene = scene
    this.spawner = spawner
    this.buildings = buildings
  }

  /** Squash-пульс фабрики — «выплёвывает» бокс. */
  private pulseFactory(): void {
    const factory = this.buildings.getFactorySprite()
    if (!factory) return
    const fs = factory.scaleY
    this.scene.tweens.killTweensOf(factory)
    this.scene.tweens.add({
      targets: factory,
      scaleY: fs * 0.9,
      duration: 90,
      ease: 'Power2.easeOut',
      yoyo: true,
      onComplete: () => {
        if (factory.active) factory.setScale(factory.scaleX, fs)
      },
    })
  }

  /** Сколько боксов сейчас в полёте/на поле (для cap-учёта в MainScene). */
  count(): number {
    return this.boxes.length
  }

  private worldPt(p: Pt): Phaser.Math.Vector2 {
    const { width, height } = this.scene.scale
    return new Phaser.Math.Vector2(p[0] * width, height * (1 + p[1]))
  }

  private randomFieldPoint(): Phaser.Math.Vector2 {
    const { width, height } = this.scene.scale
    const xf = Phaser.Math.FloatBetween(FIELD_X_FRAC[0], FIELD_X_FRAC[1])
    const yf = Phaser.Math.FloatBetween(FIELD_Y_FRAC_ZONE[0], FIELD_Y_FRAC_ZONE[1])
    return new Phaser.Math.Vector2(xf * width, height * (1 + yf))
  }

  /** Выпустить бокс из фабрики. level — уровень лягушки внутри (Этап 2: L8/L9 шанс). */
  emit(level = 7): void {
    this.pulseFactory()
    const start = this.worldPt(P0)
    const sp = this.scene.add.image(start.x, start.y, 'box')
    sp.setScale((BOX_DISPLAY_SIZE / sp.width) * 0.85)
    sp.setTint(BOX_TINT)
    sp.setDepth(BOX_DEPTH)
    sp.setAngle(0)

    const box: FactoryBox = { sp, autoTimer: null, opened: false, level }
    this.boxes.push(box)

    const p1 = this.worldPt(P1)
    const p2 = this.worldPt(P2)

    // 1) Едет P0→P1 (без прыжков, плавно).
    this.scene.tweens.add({
      targets: sp,
      x: p1.x,
      y: p1.y,
      duration: SLIDE_MS,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!sp.active) return
        // 2) Спрыгивает P1→P2 (дуга вниз).
        this.scene.tweens.add({
          targets: sp,
          x: p2.x,
          y: p2.y,
          duration: DROP_MS,
          ease: 'Quad.easeIn',
          onComplete: () => {
            if (!sp.active) return
            // 3) Прыжками к рандомной точке поля.
            this.hopToField(box, this.randomFieldPoint())
          },
        })
      },
    })
  }

  /** Рекурсивные прыжки к target; на каждом прыжке рандомный разворот 90°. */
  private hopToField(box: FactoryBox, target: Phaser.Math.Vector2): void {
    const sp = box.sp
    if (!sp.active) return
    const dx = target.x - sp.x
    const dy = target.y - sp.y
    const dist = Math.hypot(dx, dy)

    if (dist <= HOP_LEN) {
      // Финальный прыжок точно в target → приземление.
      this.singleHop(sp, target.x, target.y, () => this.land(box))
      return
    }
    const nx = sp.x + (dx / dist) * HOP_LEN
    const ny = sp.y + (dy / dist) * HOP_LEN
    this.singleHop(sp, nx, ny, () => this.hopToField(box, target))
  }

  /** Один прыжок с дугой по Y + рандомный разворот на 0/90/180/270°. */
  private singleHop(
    sp: Phaser.GameObjects.Image,
    toX: number,
    toY: number,
    onDone: () => void,
  ): void {
    const angle = Phaser.Math.RND.pick([0, 90, 180, 270])
    this.scene.tweens.add({ targets: sp, angle, duration: HOP_MS, ease: 'Sine.easeInOut' })
    // Горизонталь — линейно; вертикаль — дуга (вверх then вниз к toY).
    this.scene.tweens.add({
      targets: sp,
      x: toX,
      duration: HOP_MS,
      ease: 'Linear',
    })
    this.scene.tweens.add({
      targets: sp,
      y: toY - HOP_HEIGHT,
      duration: HOP_MS / 2,
      ease: 'Quad.easeOut',
      yoyo: false,
      onComplete: () => {
        if (!sp.active) return
        this.scene.tweens.add({
          targets: sp,
          y: toY,
          duration: HOP_MS / 2,
          ease: 'Quad.easeIn',
          onComplete: onDone,
        })
      },
    })
  }

  /** Приземление: idle-бобинг, тап, авто-таймер. */
  private land(box: FactoryBox): void {
    const sp = box.sp
    if (!sp.active) return
    sp.setAngle(0)
    // Лёгкий idle-бобинг.
    this.scene.tweens.add({
      targets: sp,
      y: sp.y - 4 * DPR,
      duration: 900,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
    sp.setInteractive({ useHandCursor: true })
    sp.on('pointerdown', () => this.openBox(box))
    box.autoTimer = this.scene.time.delayedCall(AUTO_OPEN_MS, () =>
      this.openBox(box),
    )
  }

  /** Открыть бокс → лягушка на месте + поп. */
  private openBox(box: FactoryBox): void {
    const level = box.level
    if (box.opened) return
    box.opened = true
    const sp = box.sp
    box.autoTimer?.remove()
    box.autoTimer = null
    this.scene.tweens.killTweensOf(sp)

    const x = sp.x
    const y = sp.y
    // Поф бокса.
    this.scene.tweens.add({
      targets: sp,
      scale: sp.scale * 1.3,
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => sp.destroy(),
    })
    this.removeBox(box)

    // Спавн лягушки на месте бокса.
    const frog = this.spawner.spawnFrog(x, y, level)
    useGameStore.getState().addFrogToLocation(2, level)
    frog.container.setScale(0)
    this.scene.tweens.add({
      targets: frog.container,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    })
  }

  private removeBox(box: FactoryBox): void {
    const i = this.boxes.indexOf(box)
    if (i >= 0) this.boxes.splice(i, 1)
  }

  /** Сброс при смене локации — убрать все боксы (не открывая). */
  reset(): void {
    for (const box of this.boxes) {
      box.autoTimer?.remove()
      this.scene.tweens.killTweensOf(box.sp)
      box.sp.destroy()
    }
    this.boxes = []
  }

  destroy(): void {
    this.reset()
  }
}
