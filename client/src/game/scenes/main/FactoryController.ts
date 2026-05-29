// FactoryController: статичный спрайт фабрики на поле (локация 1, Болото).
//
// Только визуальный объект — геймплей не реализован.
// Показывается по центру верхней части поля только на локации 1.
//
// Public API:
//   - show(): отобразить спрайт (создаёт при первом вызове).
//   - hide(): скрыть спрайт (без уничтожения — для повторного показа).
//   - destroy(): уничтожить спрайт (вызывается при уничтожении сцены).

import Phaser from 'phaser'
import { DPR, BOX_DISPLAY_SIZE } from './types'
import type { MainScene } from '../MainScene'

// Доля ширины экрана под спрайт фабрики (подгоняемо)
const FACTORY_WIDTH_FRAC = 0.35
// Отступ верхнего края фабрики от верха зоны строений (px)
const FACTORY_TOP_Y = 100 * DPR
// Глубина — фоновый объект, под лягушками/боксами
const FACTORY_DEPTH = 0

export class FactoryController {
  private scene: MainScene
  private sprite: Phaser.GameObjects.Image | null = null
  // Базовый scale (origin низ-центр) — pulse() анимирует относительно него.
  private baseScale = 1

  constructor(scene: MainScene) {
    this.scene = scene
  }

  show(): void {
    if (this.sprite) {
      this.sprite.setVisible(true)
      return
    }
    const { width, height } = this.scene.scale
    this.sprite = this.scene.add.image(0, 0, 'factory3_shadow')
    this.sprite.setOrigin(0.5, 1)
    this.baseScale = (width * FACTORY_WIDTH_FRAC) / this.sprite.width
    this.sprite.setScale(this.baseScale)
    // верх зоны строений = world y `height`; bottom-origin → bottom = height + высота + отступ
    this.sprite.setPosition(width / 2, height + this.sprite.displayHeight + FACTORY_TOP_Y)
    this.sprite.setDepth(FACTORY_DEPTH)
  }

  /**
   * Squash-«выстрел»: фабрика сжимается по вертикали и слегка раздаётся вширь,
   * затем отпружинивает. Origin = низ-центр → сжатие к земле (отдача при
   * выбросе бокса из трубы). Вызывается из MainScene.spawnBox при дропе на
   * Болоте — связывает «фабрика выстрелила» ↔ «бокс падает с неба».
   */
  pulse(): void {
    if (!this.sprite || !this.sprite.visible) return
    const s = this.sprite
    this.scene.tweens.killTweensOf(s)
    s.setScale(this.baseScale)
    // Косметический бокс «вылетает» из трубы фабрики вверх и гаснет ВНУТРИ зоны
    // строений — не долетает до поля лягушек (на их экране видно только падение).
    const mouthY = s.y - s.displayHeight * 0.85
    const box = this.scene.add.image(s.x, mouthY, 'box')
    box.setDisplaySize(BOX_DISPLAY_SIZE * 0.7, BOX_DISPLAY_SIZE * 0.7)
    box.setDepth(FACTORY_DEPTH + 1)
    this.scene.tweens.add({
      targets: box,
      y: mouthY - 200 * DPR,
      scaleX: box.scaleX * 0.6,
      scaleY: box.scaleY * 0.6,
      alpha: 0,
      duration: 480,
      ease: 'Quad.easeOut',
      onComplete: () => box.destroy(),
    })
    this.scene.tweens.add({
      targets: s,
      scaleY: this.baseScale * 0.88,
      scaleX: this.baseScale * 1.07,
      duration: 90,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        if (!s.active) return
        this.scene.tweens.add({
          targets: s,
          scaleY: this.baseScale,
          scaleX: this.baseScale,
          duration: 140,
          ease: 'Back.easeOut',
        })
      },
    })
  }

  hide(): void {
    if (this.sprite) {
      this.sprite.setVisible(false)
    }
  }

  destroy(): void {
    if (this.sprite) {
      this.scene.tweens.killTweensOf(this.sprite)
      this.sprite.destroy()
      this.sprite = null
    }
  }
}
