// DroneController: дрон-сборщик для апгрейда autoCollect (локация 1, Болото).
//
// Дрон плавно летает по полю и периодически открывает ближайший обычный бокс.
// Только онлайн, только на локации 1 при upgrades.autoCollect > 0.
//
// Public API:
//   - tick(level, delta): вызывается из MainScene.update() при условии loc=1 + level>0.
//   - despawn(): уничтожить спрайт (при смене локации / level=0 / destroy сцены).

import Phaser from 'phaser'
import { getAutoCollectCooldownMs } from '../../../store/gameStore'
import {
  BOX_DISPLAY_SIZE,
  DPR,
  FIELD_PAD_X,
  FIELD_PAD_Y,
  FIELD_PAD_Y_BOTTOM,
  type BoxData,
} from './types'
import type { MainScene } from '../MainScene'
import type { BoxController } from './BoxController'

// Скорость дрона в пикселях/с при свободном гулянии — неспешно, как лягушки
const WANDER_SPEED = 45 * DPR
// Скорость полёта к боксу
const FLY_SPEED = 95 * DPR
// Пауза-отдых на точке гуляния (мс) — имитирует рывково-отдыхающий ритм лягушек
const WANDER_REST_MIN_MS = 700
const WANDER_REST_MAX_MS = 1800
// Дистанция «достиг бокса» (px)
const REACH_DIST = 30 * DPR
// Максимальный наклон спрайта (рад)
const MAX_TILT = 0.15
// Коэффициент сглаживания наклона (lerp на кадр)
const TILT_LERP = 0.12
// Глубина отрисовки дрона — поверх боксов, под UI
const DRONE_DEPTH = 95000

export class DroneController {
  private scene: MainScene
  private box: BoxController

  private sprite: Phaser.GameObjects.Image | null = null

  // Цель гуляния
  private wanderX = 0
  private wanderY = 0

  // Накопленный кулдаун (мс)
  private cooldownAccum = 0

  // Режим полёта к конкретному боксу
  private flyTarget: BoxData | null = null

  // Остаток паузы-отдыха на точке гуляния (мс)
  private wanderRestMs = 0

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
    // Uniform scale по целевой ширине — сохраняем пропорции картинки
    // (setDisplaySize квадратом давил непропорциональный спрайт по высоте).
    this.sprite.setScale(BOX_DISPLAY_SIZE / this.sprite.width)
    this.sprite.setDepth(DRONE_DEPTH)

    this.pickNewWanderTarget()
  }

  despawn(): void {
    if (!this.sprite) return
    this.scene.tweens.killTweensOf(this.sprite)
    this.sprite.destroy()
    this.sprite = null
    this.flyTarget = null
    this.cooldownAccum = 0
    this.wanderRestMs = 0
  }

  tick(level: number, delta: number): void {
    if (!this.sprite) this.spawn()
    const sprite = this.sprite!

    const cooldown = getAutoCollectCooldownMs(level)

    // Накапливаем кулдаун — не растём бесконечно (cap на cooldown)
    this.cooldownAccum = Math.min(this.cooldownAccum + delta, cooldown * 2)

    if (this.flyTarget !== null) {
      // Проверяем что цель ещё жива
      if (
        !this.scene.boxes.includes(this.flyTarget) ||
        !this.flyTarget.img.active
      ) {
        this.flyTarget = null
        this.pickNewWanderTarget()
      } else {
        // Летим к боксу
        const tx = this.flyTarget.img.x
        const ty = this.flyTarget.img.y
        const dx = tx - sprite.x
        const dy = ty - sprite.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < REACH_DIST) {
          // Открываем бокс
          this.box.onBoxTapped(this.flyTarget)
          this.flyTarget = null
          this.cooldownAccum = 0
          this.pickNewWanderTarget()
        } else {
          const step = FLY_SPEED * (delta / 1000)
          const ratio = Math.min(step / dist, 1)
          sprite.x += dx * ratio
          sprite.y += dy * ratio
          sprite.rotation = Phaser.Math.Linear(
            sprite.rotation,
            Math.sign(dx) * MAX_TILT,
            TILT_LERP,
          )
        }
        return
      }
    }

    // Режим гуляния — неспешно, с паузами-отдыхом (ритм как у лягушек)
    if (this.wanderRestMs > 0) {
      this.wanderRestMs -= delta
      // Выравниваем наклон во время отдыха
      sprite.rotation = Phaser.Math.Linear(sprite.rotation, 0, TILT_LERP)
    } else {
      const dx = this.wanderX - sprite.x
      const dy = this.wanderY - sprite.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 4 * DPR) {
        this.pickNewWanderTarget()
        this.wanderRestMs = Phaser.Math.Between(
          WANDER_REST_MIN_MS,
          WANDER_REST_MAX_MS,
        )
      } else {
        const step = WANDER_SPEED * (delta / 1000)
        const ratio = Math.min(step / dist, 1)
        sprite.x += dx * ratio
        sprite.y += dy * ratio
        const targetTilt = dx !== 0 ? Math.sign(dx) * MAX_TILT : 0
        sprite.rotation = Phaser.Math.Linear(
          sprite.rotation,
          targetTilt,
          TILT_LERP,
        )
      }
    }

    // Проверяем кулдаун и наличие обычного бокса
    if (this.cooldownAccum >= cooldown) {
      const normalBoxes = this.scene.boxes.filter(
        (b) => !b.isRare && b.img.active && !b.isLanding,
      )
      if (normalBoxes.length > 0) {
        // Ищем ближайший
        let closest = normalBoxes[0]
        let minDist = Phaser.Math.Distance.Between(
          sprite.x,
          sprite.y,
          closest.img.x,
          closest.img.y,
        )
        for (let i = 1; i < normalBoxes.length; i++) {
          const d = Phaser.Math.Distance.Between(
            sprite.x,
            sprite.y,
            normalBoxes[i].img.x,
            normalBoxes[i].img.y,
          )
          if (d < minDist) {
            minDist = d
            closest = normalBoxes[i]
          }
        }
        this.flyTarget = closest
      } else {
        // Боксов нет — держим cooldownAccum на максимуме (не копим бесконечно)
        this.cooldownAccum = cooldown
      }
    }
  }

  private pickNewWanderTarget(): void {
    const { width, height } = this.scene.scale
    this.wanderX = Phaser.Math.Between(
      FIELD_PAD_X + 10 * DPR,
      width - FIELD_PAD_X - 10 * DPR,
    )
    this.wanderY = Phaser.Math.Between(
      FIELD_PAD_Y + 10 * DPR,
      height - FIELD_PAD_Y_BOTTOM - 10 * DPR,
    )
  }
}
