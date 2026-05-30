// StorageController: статичный спрайт склада на поле (локация 1, Болото).
//
// Только визуальный объект — геймплей не реализован. Стоит рядом с фабрикой
// в зоне строений. Паттерн идентичен FactoryController.
//
// Public API:
//   - show(): отобразить спрайт (создаёт при первом вызове).
//   - hide(): скрыть спрайт (без уничтожения — для повторного показа).
//   - destroy(): уничтожить спрайт (вызывается при уничтожении сцены).

import Phaser from 'phaser'
import { DPR } from './types'
import type { MainScene } from '../MainScene'

// Доля ширины экрана под спрайт склада (меньше фабрики).
const STORAGE_WIDTH_FRAC = 0.28
// Горизонтальная позиция (доля ширины) — справа от фабрики (она в центре).
const STORAGE_X_FRAC = 0.76
// Отступ верхнего края от верха зоны строений (px) — как у фабрики.
const STORAGE_TOP_Y = 100 * DPR
// Глубина — фоновый объект, под лягушками/боксами.
const STORAGE_DEPTH = 0

export class StorageController {
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
    this.sprite = this.scene.add.image(0, 0, 'storage')
    this.sprite.setOrigin(0.5, 1)
    this.sprite.setScale((width * STORAGE_WIDTH_FRAC) / this.sprite.width)
    this.sprite.setPosition(
      width * STORAGE_X_FRAC,
      height + this.sprite.displayHeight + STORAGE_TOP_Y,
    )
    this.sprite.setDepth(STORAGE_DEPTH)
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
