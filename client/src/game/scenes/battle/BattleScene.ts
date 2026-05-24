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
  createUnit,
  type BattleUnit,
} from './battleUnits'
import { BattleEngine, type BattleResult } from './battleEngine'

export class BattleScene extends Phaser.Scene {
  private locationId: number = 1
  private mapImage: Phaser.GameObjects.Image | null = null
  private overlay: Phaser.GameObjects.Rectangle | null = null
  private gridLayout: GridLayout | null = null
  private gridGfx: Phaser.GameObjects.Graphics | null = null
  private titleText: Phaser.GameObjects.Text | null = null
  private playerUnits: BattleUnit[] = []
  private enemyUnits: BattleUnit[] = []
  private engine: BattleEngine | null = null
  private resultText: Phaser.GameObjects.Text | null = null
  /** Уровни/tier/hp выживших player-юнитов для переноса между локациями. */
  private survivorState: Array<{
    level: number
    tier: 0 | 1 | 2
    cellIdx: number
    hp: number
  }> | null = null
  /** Сколько локаций успешно зачищено в этом рейде (= количество звёзд). */
  private starsEarned: number = 0

  constructor() {
    super({ key: 'BattleScene' })
  }

  /** Init params from scene.start('BattleScene', { locationId }). */
  init(data: { locationId?: number }) {
    this.locationId = data.locationId ?? 1
    // Каждый новый заход в сцену с locationId=1 = свежий рейд → сброс выживших + звёзд.
    if (this.locationId === 1) {
      this.survivorState = null
      this.starsEarned = 0
    }
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

    // Полупрозрачный tint поверх карты — визуально отличает вражескую
    // локацию от своей. Цвет зависит от locationId.
    this.applyOverlayTint()

    // Сетка
    this.gridLayout = computeGrid(width, height)
    this.gridGfx = drawGridLines(this, this.gridLayout)

    // Спавн юнитов из казармы (player) + bot deck (enemy)
    const barracksGrid = useGameStore.getState().barracksGrid
    this.playerUnits = this.survivorState
      ? this.spawnFromSurvivors()
      : buildPlayerDeck(this, barracksGrid, this.gridLayout)
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

  private applyOverlayTint(): void {
    const { width, height } = this.scale
    if (this.overlay) {
      this.overlay.destroy()
    }
    const tintColor =
      this.locationId === 1
        ? 0x991b1b // болото — багровый
        : this.locationId === 2
          ? 0x7c3aed // лес — фиолетовый
          : 0xb45309 // континент — оранжевый
    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      tintColor,
      0.25,
    )
    overlay.setDepth(0.5)
    this.overlay = overlay
  }

  private spawnFromSurvivors(): BattleUnit[] {
    if (!this.gridLayout || !this.survivorState) return []
    const units: BattleUnit[] = []
    for (const s of this.survivorState) {
      const unit = createUnit(this, 'player', s.level, s.tier, s.cellIdx, this.gridLayout)
      if (!unit) continue
      // Перенос текущего HP
      unit.hp = s.hp
      unit.hpBar.scaleX = Math.max(0, s.hp / unit.maxHp)
      units.push(unit)
    }
    return units
  }

  private saveSurvivors(): void {
    this.survivorState = this.playerUnits
      .filter((u) => u.alive)
      .map((u) => ({
        level: u.level,
        tier: u.tier,
        cellIdx: u.cellIdx,
        hp: u.hp,
      }))
  }

  /** Награда за победу на локации — синтетические vat-значения бота × 80%. */
  private rewardForLocation(locId: number): number {
    const VAT_BASE = { 1: 1000, 2: 5000, 3: 20000 } as const
    const base = (VAT_BASE as Record<number, number>)[locId] ?? 0
    return Math.floor(base * 0.8)
  }

  private onBattleEnd(result: BattleResult): void {
    const { width, height } = this.scale
    const isFinalLoc = this.locationId >= 3
    const winAndMore = result === 'win' && !isFinalLoc

    // Награда + звезда за каждую зачищенную локацию.
    if (result === 'win') {
      this.starsEarned = Math.min(3, this.starsEarned + 1)
      const reward = this.rewardForLocation(this.locationId)
      if (reward > 0) {
        useGameStore.getState().addGold(reward)
      }
    }

    if (winAndMore) {
      // Промежуточная победа на loc1/loc2 — короткий toast, дальше переход.
      const txt = `ЛОКАЦИЯ ${this.locationId} ВЗЯТА!\n+${this.rewardForLocation(this.locationId)} 💧`
      this.resultText = this.add.text(width / 2, height / 2, txt, {
        fontFamily: 'Russo One, sans-serif',
        fontSize: `${32 * DPR}px`,
        color: '#4ade80',
        stroke: '#000',
        strokeThickness: 6 * DPR,
        align: 'center',
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
      this.saveSurvivors()
      this.time.delayedCall(1500, () => this.transitionToNextLocation())
      return
    }

    // Финальный экран — итог рейда со звёздами.
    this.showFinalResult(result)
    this.time.delayedCall(2800, () => {
      eventBus.emit('battle:exit', {})
    })
  }

  /** Показывает финальный результат рейда с 3-звёздным рейтингом. */
  private showFinalResult(result: BattleResult): void {
    const { width, height } = this.scale
    const isWin = result === 'win'
    const stars = this.starsEarned // 0..3

    // Заголовок — победа/поражение + награда total
    const totalReward = this.computeTotalReward()
    const headTxt =
      isWin && stars === 3
        ? 'РЕЙД ЗАВЕРШЁН!'
        : stars > 0
          ? `РЕЙД ПРЕРВАН`
          : 'РЕЙД ПРОВАЛЕН'
    const headColor = stars === 3 ? '#facc15' : stars > 0 ? '#fb923c' : '#dc2626'
    const header = this.add.text(width / 2, height / 2 - 60 * DPR, headTxt, {
      fontFamily: 'Russo One, sans-serif',
      fontSize: `${36 * DPR}px`,
      color: headColor,
      stroke: '#000',
      strokeThickness: 6 * DPR,
      align: 'center',
    })
    header.setOrigin(0.5, 0.5)
    header.setDepth(20)
    header.setScale(0.5)
    this.tweens.add({
      targets: header,
      scale: 1,
      duration: 400,
      ease: 'Back.easeOut',
    })
    this.resultText = header

    // Три звезды по центру — заполненные = золотые, пустые = серые
    const starSize = 48 * DPR
    const starGap = 14 * DPR
    const totalStarsW = starSize * 3 + starGap * 2
    const startX = width / 2 - totalStarsW / 2 + starSize / 2
    for (let i = 0; i < 3; i++) {
      const starX = startX + i * (starSize + starGap)
      const starY = height / 2 + 10 * DPR
      const filled = i < stars
      const star = this.add.text(starX, starY, filled ? '⭐' : '☆', {
        fontFamily: 'sans-serif',
        fontSize: `${starSize}px`,
        color: filled ? '#facc15' : '#64748b',
      })
      star.setOrigin(0.5, 0.5)
      star.setDepth(20)
      star.setScale(0)
      this.tweens.add({
        targets: star,
        scale: 1,
        duration: 320,
        delay: 400 + i * 180,
        ease: 'Back.easeOut',
      })
    }

    // Подпись с наградой
    if (totalReward > 0) {
      const rewardTxt = this.add.text(
        width / 2,
        height / 2 + 80 * DPR,
        `+${totalReward} 💧`,
        {
          fontFamily: 'Russo One, sans-serif',
          fontSize: `${28 * DPR}px`,
          color: '#fff',
          stroke: '#000',
          strokeThickness: 5 * DPR,
        },
      )
      rewardTxt.setOrigin(0.5, 0.5)
      rewardTxt.setDepth(20)
      rewardTxt.setAlpha(0)
      this.tweens.add({
        targets: rewardTxt,
        alpha: 1,
        duration: 300,
        delay: 900,
      })
    }
  }

  /** Сумма наград за все зачищенные локации. */
  private computeTotalReward(): number {
    let sum = 0
    for (let i = 1; i <= this.starsEarned; i++) {
      sum += this.rewardForLocation(i)
    }
    return sum
  }

  private transitionToNextLocation(): void {
    if (!this.gridLayout) return
    // Cleanup текущих юнитов и эффектов
    this.engine?.stop()
    this.engine = null
    for (const u of this.playerUnits) {
      if (u.container.active) u.container.destroy()
    }
    for (const u of this.enemyUnits) {
      if (u.container.active) u.container.destroy()
    }
    this.playerUnits = []
    this.enemyUnits = []
    this.resultText?.destroy()
    this.resultText = null

    // Обновить фон + overlay под новую локацию
    this.locationId += 1
    const { width, height } = this.scale
    const newMapKey = mapKeyForLocation(this.locationId)
    if (this.mapImage) this.mapImage.destroy()
    if (this.textures.exists(newMapKey)) {
      const img = this.add.image(width / 2, height / 2, newMapKey)
      img.setDisplaySize(width, height)
      img.setDepth(0)
      this.mapImage = img
    }
    this.applyOverlayTint()

    if (this.titleText) {
      this.titleText.setText(`БОЙ · loc ${this.locationId}`)
    }

    // Re-spawn survivors + новая bot deck
    this.playerUnits = this.spawnFromSurvivors()
    this.enemyUnits = buildBotDeck(this, this.locationId, this.gridLayout)

    // Re-start engine
    this.engine = new BattleEngine(
      this,
      this.gridLayout,
      this.playerUnits,
      this.enemyUnits,
      { onEnd: (r) => this.onBattleEnd(r) },
    )
    this.time.delayedCall(600, () => this.engine?.start())
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
    this.overlay?.destroy()
    this.overlay = null
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
    this.survivorState = null
  }
}
