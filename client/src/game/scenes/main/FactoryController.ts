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
// Отступ верхнего края фабрики от верха канваса (px)
const FACTORY_TOP_Y = 40 * DPR
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
    const { width } = this.scene.scale
    this.sprite = this.scene.add.image(width / 2, FACTORY_TOP_Y, 'factory1')
    this.sprite.setOrigin(0.5, 0)
    this.sprite.setScale((width * FACTORY_WIDTH_FRAC) / this.sprite.width)
    this.sprite.setDepth(FACTORY_DEPTH)
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
