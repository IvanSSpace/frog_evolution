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
import { DPR } from './types'
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
    this.sprite.setScale((width * FACTORY_WIDTH_FRAC) / this.sprite.width)
    // верх зоны строений = world y `height`; bottom-origin → bottom = height + высота + отступ
    this.sprite.setPosition(width / 2, height + this.sprite.displayHeight + FACTORY_TOP_Y)
    this.sprite.setDepth(FACTORY_DEPTH)
  }

  hide(): void {
    if (this.sprite) {
      this.sprite.setVisible(false)
    }
  }

  /** Спрайт для reparent в transition-контейнер (зум при смене локации). */
  getSprite(): Phaser.GameObjects.Image | null {
    return this.sprite
  }

  destroy(): void {
    if (this.sprite) {
      this.scene.tweens.killTweensOf(this.sprite)
      this.sprite.destroy()
      this.sprite = null
    }
  }
}
