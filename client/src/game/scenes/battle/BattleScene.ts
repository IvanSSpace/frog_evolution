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
import { useGameStore } from '../../../store/gameStore'
import {
  buildBotDeck,
  buildPlayerDeck,
  type BattleUnit,
} from './battleUnits'
import { BattleEngine, type BattleResult } from './battleEngine'

export class BattleScene extends Phaser.Scene {
  private locationId: number = 1
  private mapImage: Phaser.GameObjects.Image | null = null
  private gridLayout: GridLayout | null = null
  private gridGfx: Phaser.GameObjects.Graphics | null = null
  private titleText: Phaser.GameObjects.Text | null = null
  private playerUnits: BattleUnit[] = []
  private enemyUnits: BattleUnit[] = []
  private engine: BattleEngine | null = null
  private resultText: Phaser.GameObjects.Text | null = null

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

    // Спавн юнитов из казармы (player) + bot deck (enemy)
    const barracksGrid = useGameStore.getState().barracksGrid
    this.playerUnits = buildPlayerDeck(this, barracksGrid, this.gridLayout)
    this.enemyUnits = buildBotDeck(this, this.locationId, this.gridLayout)

    // Battle engine — старт после 1-сек паузы (даёт UI прогрузиться)
    this.engine = new BattleEngine(
      this,
      this.gridLayout,
      this.playerUnits,
      this.enemyUnits,
      { onEnd: (r) => this.onBattleEnd(r) },
    )
    this.time.delayedCall(800, () => this.engine?.start())

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

  private onBattleEnd(result: BattleResult): void {
    const { width, height } = this.scale
    const txt = result === 'win' ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'
    const color = result === 'win' ? '#4ade80' : '#dc2626'
    this.resultText = this.add.text(width / 2, height / 2, txt, {
      fontFamily: 'Russo One, sans-serif',
      fontSize: `${48 * DPR}px`,
      color,
      stroke: '#000',
      strokeThickness: 6 * DPR,
    })
    this.resultText.setOrigin(0.5, 0.5)
    this.resultText.setDepth(20)
    this.resultText.setScale(0.5)
    this.tweens.add({
      targets: this.resultText,
      scale: 1,
      duration: 400,
      ease: 'Back.easeOut',
    })
    // Авто-выход через 2 сек
    this.time.delayedCall(2200, () => {
      eventBus.emit('battle:exit', {})
    })
  }

  shutdown() {
    this.scale.off('resize', this.handleResize, this)
    this.engine?.stop()
    this.engine = null
    this.gridGfx?.destroy()
    this.gridGfx = null
    this.titleText?.destroy()
    this.titleText = null
    this.resultText?.destroy()
    this.resultText = null
    this.mapImage?.destroy()
    this.mapImage = null
    for (const u of this.playerUnits) {
      if (u.container.active) u.container.destroy()
    }
    for (const u of this.enemyUnits) {
      if (u.container.active) u.container.destroy()
    }
    this.playerUnits = []
    this.enemyUnits = []
  }
}
