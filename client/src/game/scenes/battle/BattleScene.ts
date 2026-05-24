// BattleScene — PvP raid mode. MVP shell.
//
// Сцена показывает фон выбранной локации (Болото/Лес/Континент),
// рисует сетку 7×4 (через battleGrid) и плейсхолдеры юнитов.
//
// Запускается через event bus 'battle:start' с payload { locationId }.
// Закрывается через 'battle:exit' → возврат на MainScene.
//
// Этап 3a: shell + grid + map background.
// Этапы 3b/3c (unit rendering, auto-chess engine, 3-loc flow) — позже.

import Phaser from 'phaser'
import { computeGrid, drawGridLines, type GridLayout } from './battleGrid'
import { mapKeyForLocation, DPR } from '../main/types'
import { eventBus } from '../../../store/eventBus'

export class BattleScene extends Phaser.Scene {
  private locationId: number = 1
  private mapImage: Phaser.GameObjects.Image | null = null
  private gridLayout: GridLayout | null = null
  private gridGfx: Phaser.GameObjects.Graphics | null = null
  private titleText: Phaser.GameObjects.Text | null = null

  constructor() {
    super({ key: 'BattleScene' })
  }

  /** Init params from scene.start('BattleScene', { locationId }). */
  init(data: { locationId?: number }) {
    this.locationId = data.locationId ?? 1
  }

  create() {
    const { width, height } = this.scale

    // Фон карты — переиспользуем те же текстуры, что в MainScene.
    const mapKey = mapKeyForLocation(this.locationId)
    if (this.textures.exists(mapKey)) {
      const img = this.add.image(width / 2, height / 2, mapKey)
      img.setDisplaySize(width, height)
      img.setDepth(0)
      this.mapImage = img
    } else {
      // Fallback — заливка
      this.add.rectangle(width / 2, height / 2, width, height, 0x1a2e1a)
    }

    // Сетка
    this.gridLayout = computeGrid(width, height)
    this.gridGfx = drawGridLines(this, this.gridLayout)

    // Заголовок битвы (временный — заменим UI позже)
    this.titleText = this.add.text(
      width / 2,
      24 * DPR,
      `БОЙ · loc ${this.locationId}`,
      {
        fontFamily: 'Russo One, sans-serif',
        fontSize: `${24 * DPR}px`,
        color: '#fff',
        stroke: '#000',
        strokeThickness: 4 * DPR,
      },
    )
    this.titleText.setOrigin(0.5, 0)
    this.titleText.setDepth(10)

    // Кнопка выхода (заглушка)
    const exitBtn = this.add.text(
      width - 16 * DPR,
      24 * DPR,
      '✕',
      {
        fontFamily: 'Russo One, sans-serif',
        fontSize: `${28 * DPR}px`,
        color: '#fff',
        backgroundColor: '#7f1d1d',
        padding: { left: 12, right: 12, top: 4, bottom: 4 },
      },
    )
    exitBtn.setOrigin(1, 0)
    exitBtn.setDepth(10)
    exitBtn.setInteractive({ useHandCursor: true })
    exitBtn.on('pointerdown', () => {
      eventBus.emit('battle:exit', {})
    })

    // Resize handler
    this.scale.on('resize', this.handleResize, this)
  }

  private handleResize = (gameSize: Phaser.Structs.Size) => {
    const { width, height } = gameSize
    if (this.mapImage) {
      this.mapImage.setPosition(width / 2, height / 2)
      this.mapImage.setDisplaySize(width, height)
    }
    if (this.gridGfx) {
      this.gridGfx.destroy()
      this.gridLayout = computeGrid(width, height)
      this.gridGfx = drawGridLines(this, this.gridLayout)
    }
    if (this.titleText) this.titleText.setPosition(width / 2, 24 * DPR)
  }

  shutdown() {
    this.scale.off('resize', this.handleResize, this)
    this.gridGfx?.destroy()
    this.gridGfx = null
    this.titleText?.destroy()
    this.titleText = null
    this.mapImage?.destroy()
    this.mapImage = null
  }
}
