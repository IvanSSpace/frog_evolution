// RaidScoutScene — Phaser-просмотр противников перед рейдом.
//
// Заменяет старую RaidPickModal (плоская React-карусель). Игрок «заходит»
// к противнику и видит его так же, как смотрит свои локации:
//   - фон локации (mapKeyForLocation) — как ферма
//   - отряд противника сеткой 4×3 поверх — как казармы (гибрид-визуал)
//
// Навигация:
//   - свайп влево/вправо → следующий / предыдущий противник (slide-карусель)
//   - кнопки локаций — React-оверлей RaidScoutLocationStack (те же кнопки что
//     на ферме). Переключение локации = тот же dual-container zoom что на ферме
//     (см. LocationTransition.onLocationChanged): старая локация сжимается в
//     точку / новая разворачивается из точки. Синхрон со сценой через eventBus
//     ('raid:scout-changed' ← сцена, 'raid:scout-set-loc' → сцена).
//   - АТАКОВАТЬ → emit 'battle:start' { botId, locationId }
//   - ✕ → 'raid:scout-exit' (назад в казарму)
//
// «Доска» (bg + сетка + отряд) живёт в zoom-контейнере at (cx,cy) — масштабируется
// при переходе. Chrome (аватар/имя/✕/АТАКОВАТЬ/точки) — на root, depth 1000, не
// зумится (как HUD на ферме).
//
// MVP: пул ботов перегенерируется при каждом открытии (reset()). Server-PvP заменит.

import Phaser from 'phaser'
import {
  DPR,
  mapKeyForLocation,
  biomeMapKeyForLocation,
  biomeFrogTint,
  FIELD_PAD_X_MILITARY,
  FIELD_PAD_Y_MILITARY,
  FIELD_PAD_Y_BOTTOM_MILITARY,
} from '../main/types'
import { eventBus } from '../../../store/eventBus'
import { textureKeyForLevel } from '../../config/frogs'
import { CLASS_META, getWarriorConfig } from '../../config/warriors'
import type { BotData, BotDeckEntry } from '../../config/bots'
import { botDeckLevels } from '../battle/battleUnits'
import { useGameStore } from '../../../store/gameStore'
import { biomeForPlanetId, planetNameById } from '../starmap/planetarium'

// Сетка отряда: 4 колонки × 3 ряда = 12 клеток (enemy zone battle grid).
const DECK_COLS = 4
const DECK_ROWS = 3
const LOC_NAMES = ['Болото', 'Лес', 'Континент'] as const

// Параметры zoom-перехода — 1-в-1 с LocationTransition (ферма).
const ZOOM_DURATION = 450

interface DeckLayout {
  cellW: number
  cellH: number
  originX: number
  originY: number
  width: number
  centers: { x: number; y: number }[]
}

function computeDeckLayout(w: number, h: number): DeckLayout {
  const padX = FIELD_PAD_X_MILITARY
  const padY = FIELD_PAD_Y_MILITARY + 60 * DPR // место под шапку
  const padYBottom = FIELD_PAD_Y_BOTTOM_MILITARY + 40 * DPR // место под АТАКОВАТЬ
  const width = w - padX * 2
  const fieldH = h - padY - padYBottom
  const cellW = width / DECK_COLS
  const cellH = fieldH / DECK_ROWS
  const centers: { x: number; y: number }[] = []
  for (let r = 0; r < DECK_ROWS; r++) {
    for (let c = 0; c < DECK_COLS; c++) {
      centers.push({
        x: padX + c * cellW + cellW / 2,
        y: padY + r * cellH + cellH / 2,
      })
    }
  }
  return { cellW, cellH, originX: padX, originY: padY, width, centers }
}

/** Доска одной локации: zoom-контейнер + ссылки на deck для slide-карусели. */
interface Board {
  container: Phaser.GameObjects.Container
  deck: Phaser.GameObjects.Container
  locIdx: number
}

export class RaidScoutScene extends Phaser.Scene {
  private bots: BotData[] = []
  private botIdx = 0
  private locIdx = 0
  // Биом осматриваемой планеты — определяет фон локаций (fire/ice/desert/toxic).
  private biome = 'fire'

  private board: Board | null = null
  private titleText: Phaser.GameObjects.Text | null = null
  private subText: Phaser.GameObjects.Text | null = null
  private avatarText: Phaser.GameObjects.Text | null = null
  private dots: Phaser.GameObjects.Arc[] = []
  private layout: DeckLayout | null = null

  // Свайп-стейт
  private dragStartX: number | null = null
  private dragStartY: number | null = null
  private dragAxis: 'x' | 'y' | null = null
  private animating = false

  constructor() {
    super({ key: 'RaidScoutScene' })
  }

  create() {
    const { width } = this.scale
    this.layout = computeDeckLayout(width, this.scale.height)

    // Шапка: аватар + имя + слизь
    this.avatarText = this.add.text(20 * DPR, 16 * DPR, '🐸', {
      fontFamily: 'sans-serif',
      fontSize: `${30 * DPR}px`,
    })
    this.avatarText.setOrigin(0, 0)
    this.avatarText.setDepth(1000)

    this.titleText = this.add.text(60 * DPR, 16 * DPR, '', {
      fontFamily: 'Russo One, sans-serif',
      fontSize: `${22 * DPR}px`,
      color: '#fff',
      stroke: '#000',
      strokeThickness: 4 * DPR,
    })
    this.titleText.setOrigin(0, 0)
    this.titleText.setDepth(1000)

    this.subText = this.add.text(60 * DPR, 44 * DPR, '', {
      fontFamily: 'Russo One, sans-serif',
      fontSize: `${15 * DPR}px`,
      color: '#facc15',
      stroke: '#000',
      strokeThickness: 3 * DPR,
    })
    this.subText.setOrigin(0, 0)
    this.subText.setDepth(1000)

    // Кнопка выхода ✕ — низ-лево (top-right занят React-кнопками локаций).
    const exitBtn = this.add.text(14 * DPR, this.scale.height - 24 * DPR, '✕', {
      fontFamily: 'Russo One, sans-serif',
      fontSize: `${22 * DPR}px`,
      color: '#fff',
      backgroundColor: '#7f1d1d',
      padding: { left: 9, right: 9, top: 4, bottom: 4 },
    })
    exitBtn.setOrigin(0, 1)
    exitBtn.setDepth(1001)
    exitBtn.setInteractive({ useHandCursor: true })
    exitBtn.on('pointerdown', () => eventBus.emit('raid:scout-exit', {}))

    // Кнопка НАЗАД (низ) — осмотр view-only, возврат в InvestigateModal.
    const backBtn = this.add.text(
      width / 2,
      this.scale.height - 24 * DPR,
      '← НАЗАД',
      {
        fontFamily: 'Russo One, sans-serif',
        fontSize: `${22 * DPR}px`,
        color: '#fff',
        backgroundColor: '#0e7490',
        padding: { left: 22, right: 22, top: 9, bottom: 9 },
      },
    )
    backBtn.setOrigin(0.5, 1)
    backBtn.setDepth(1001)
    backBtn.setInteractive({ useHandCursor: true })
    backBtn.on('pointerdown', () => eventBus.emit('raid:scout-exit', {}))

    // Кнопки локаций — React-оверлей RaidScoutLocationStack (те же кнопки что
    // на ферме). Сцена шлёт 'raid:scout-changed' и слушает 'raid:scout-set-loc'.
    eventBus.on('raid:scout-set-loc', this.onSetLoc)

    // Свайп-инпут по сцене
    this.input.on('pointerdown', this.onPointerDown, this)
    this.input.on('pointermove', this.onPointerMove, this)
    this.input.on('pointerup', this.onPointerUp, this)
    this.input.on('pointerupoutside', this.onPointerUp, this)

    this.scale.on('resize', this.handleResize, this)

    this.reset()
  }

  /** Построить осмотр для текущей scoutPlanetId. Зовётся из index.ts при wake. */
  reset() {
    // Единый «bot» = осматриваемая планета. Отряд детерминирован пресетами
    // локаций (botDeckLevels), planetId берём из store (set при «Осмотреть»).
    this.bots = [this.buildPlanetBot()]
    this.botIdx = 0
    this.locIdx = 0
    this.animating = false
    if (this.board) {
      this.board.container.destroy(true)
      this.board = null
    }
    // Entry-анимация «приближения» к планете (как заход на локацию с фермы):
    // промежуточный кадр map4 → zoom-in на локацию 1.
    this.enterZoom()
    this.buildDots()
    this.updateChrome()
  }

  /**
   * Анимация входа в осмотр — копия runCloseStarMapTransition (ферма):
   * map4 промежуточным фоном (scale 1→8 + fade), доска локации 1 растёт из
   * точки (scale 0.005→1). Всегда садимся на локацию 1.
   */
  private enterZoom() {
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2

    // Промежуточный фон — биом-вариант map4 планеты (fire_map4/ice_map4/...),
    // как при заходе на локацию из космоса. Fallback на обычный map4.
    const oldContainer = this.add.container(cx, cy)
    const biomeMap4 = biomeMapKeyForLocation(this.biome, 4)
    const map4Key = this.textures.exists(biomeMap4)
      ? biomeMap4
      : this.textures.exists('map4')
        ? 'map4'
        : mapKeyForLocation(1)
    const map4 = this.add.image(0, 0, map4Key)
    map4.setDisplaySize(width, height)
    oldContainer.add(map4)
    oldContainer.setDepth(100)

    // Новая доска = локация 1, растёт из точки.
    const board = this.createBoard(this.locIdx, 0)
    board.container.setPosition(cx, cy)
    board.container.setScale(0.005)
    board.container.setAlpha(0)
    board.container.setDepth(200)
    this.board = board

    this.animating = true
    const duration = 450
    this.tweens.add({
      targets: oldContainer,
      scale: 8,
      duration,
      ease: 'Sine.easeInOut',
    })
    this.tweens.add({
      targets: oldContainer,
      alpha: 0,
      duration: duration * 0.22,
      delay: duration * 0.78,
      ease: 'Sine.easeIn',
    })
    this.tweens.add({
      targets: board.container,
      alpha: 1,
      duration: duration * 0.35,
      ease: 'Sine.easeOut',
    })
    this.tweens.add({
      targets: board.container,
      scale: 1,
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        oldContainer.destroy(true)
        board.container.setDepth(1)
        this.animating = false
      },
    })
  }

  /** Синтетический BotData осматриваемой планеты: отряд из пресетов локаций. */
  private buildPlanetBot(): BotData {
    const planetId = useGameStore.getState().scoutPlanetId
    const name = planetId ? planetNameById(planetId) : 'Цель'
    // Биом любой планеты (не только 16 main) по её archetype — иначе bg-планеты
    // всегда были бы fire. Неизвестный биом → fire fallback в biomeMapKeyForLocation.
    this.biome = biomeForPlanetId(planetId)
    // cellIdx последовательно 0..n — заполняет верхние ряды слева-направо.
    const deckFor = (locId: number): BotDeckEntry[] =>
      botDeckLevels(locId, planetId).map((level, i) => ({ level, cellIdx: i }))
    return {
      id: planetId ?? 'scout',
      name,
      avatar: '🛰',
      decks: [deckFor(1), deckFor(2), deckFor(3)],
      vats: [{ slime: 0 }, { slime: 0 }, { slime: 0 }],
    }
  }

  // ─── Навигация локаций (zoom-переход, как на ферме) ──────────────────────

  // Приходит из React-оверлея RaidScoutLocationStack (locId 1..3).
  private onSetLoc = ({ locId }: { locId: number }) => {
    this.selectLoc(locId - 1)
  }

  private selectLoc(i: number) {
    if (this.animating || i === this.locIdx || i < 0 || i >= LOC_NAMES.length)
      return
    const goingUp = i > this.locIdx
    this.locIdx = i
    this.updateChrome() // имя/слизь новой локации — сразу
    this.runZoom(goingUp)
  }

  /**
   * Dual-container zoom между локациями — копия LocationTransition (ферма).
   * goingUp:   старая (1 → 0.01) сжимается в точку, новая (8 → 1) разворачивается сзади.
   * goingDown: старая (1 → 8) разлетается за экран, новая (0.005 → 1) растёт из точки.
   */
  private runZoom(goingUp: boolean) {
    const old = this.board
    const newBoard = this.createBoard(this.locIdx, this.botIdx)
    this.board = newBoard
    if (!old) return

    this.animating = true
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2

    const newStartScale = goingUp ? 8 : 0.005
    const oldEndScale = goingUp ? 0.01 : 8
    newBoard.container.setPosition(cx, cy)
    newBoard.container.setScale(newStartScale)
    newBoard.container.setAlpha(0)
    old.container.setPosition(cx, cy)

    // Слой-порядок: при подъёме старая впереди (видим как сжимается), иначе новая.
    if (goingUp) {
      old.container.setDepth(200)
      newBoard.container.setDepth(100)
    } else {
      newBoard.container.setDepth(200)
      old.container.setDepth(100)
    }

    this.tweens.add({
      targets: old.container,
      scale: oldEndScale,
      duration: ZOOM_DURATION,
      ease: 'Sine.easeInOut',
    })
    this.tweens.add({
      targets: old.container,
      alpha: 0,
      duration: ZOOM_DURATION * 0.22,
      delay: ZOOM_DURATION * 0.78,
      ease: 'Sine.easeIn',
    })
    this.tweens.add({
      targets: newBoard.container,
      alpha: 1,
      duration: ZOOM_DURATION * 0.35,
      ease: 'Sine.easeOut',
    })
    this.tweens.add({
      targets: newBoard.container,
      scale: 1,
      duration: ZOOM_DURATION,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        old.container.destroy(true)
        newBoard.container.setDepth(1)
        this.animating = false
      },
    })
  }

  // ─── Карусель ботов (slide) ──────────────────────────────────────────────

  private nextBot() {
    if (this.animating || this.botIdx >= this.bots.length - 1) return
    this.botIdx++
    this.updateChrome()
    this.rebuildDeck(-1)
  }

  private prevBot() {
    if (this.animating || this.botIdx <= 0) return
    this.botIdx--
    this.updateChrome()
    this.rebuildDeck(1)
  }

  /** Пересобрать отряд внутри текущей доски + slide-in (свайп между ботами). */
  private rebuildDeck(fromDir: number) {
    if (!this.board || !this.layout) return
    const oldDeck = this.board.deck
    const deck = this.buildDeck(this.botIdx, this.board.locIdx)
    this.board.container.add(deck)
    this.board.deck = deck

    const { width } = this.scale
    deck.x = fromDir < 0 ? width : -width
    this.tweens.add({
      targets: deck,
      x: 0,
      duration: 280,
      ease: 'Cubic.easeOut',
    })
    this.tweens.add({
      targets: oldDeck,
      x: fromDir < 0 ? -width : width,
      duration: 280,
      ease: 'Cubic.easeOut',
      onComplete: () => oldDeck.destroy(),
    })
  }

  private buildDots() {
    const { width, height } = this.scale
    for (const d of this.dots) d.destroy()
    this.dots = []
    const n = this.bots.length
    // Одна планета — карусель ботов не нужна, точки не рисуем.
    if (n <= 1) return
    const r = 4 * DPR
    const gap = 12 * DPR
    const totalW = (n - 1) * gap
    const startX = width / 2 - totalW / 2
    for (let i = 0; i < n; i++) {
      const dot = this.add.circle(
        startX + i * gap,
        height - 58 * DPR,
        r,
        0xffffff,
        0.4,
      )
      dot.setDepth(1000)
      this.dots.push(dot)
    }
  }

  private highlightDots() {
    this.dots.forEach((d, i) => {
      d.setFillStyle(0xffffff, i === this.botIdx ? 1 : 0.35)
      d.setScale(i === this.botIdx ? 1.4 : 1)
    })
  }

  // ─── Построение доски ──────────────────────────────────────────────────

  private bot(idx: number): BotData | null {
    return this.bots[idx] ?? null
  }

  /**
   * Доска локации: zoom-контейнер at (cx,cy) с фоном + тинтом + сеткой + отрядом.
   * Дети в локальных координатах относительно центра экрана.
   */
  private createBoard(locIdx: number, botIdx: number): Board {
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2
    const container = this.add.container(cx, cy)
    container.setDepth(1)

    // Фон локации — биом-вариант планеты; fallback на обычную карту.
    const biomeKey = biomeMapKeyForLocation(this.biome, locIdx + 1)
    const key = this.textures.exists(biomeKey)
      ? biomeKey
      : mapKeyForLocation(locIdx + 1)
    if (this.textures.exists(key)) {
      const bg = this.add.image(0, 0, key)
      bg.setDisplaySize(width, height)
      container.add(bg)
    } else {
      container.add(this.add.rectangle(0, 0, width, height, 0x1e1b4b))
    }
    // Сетка (локальные координаты — смещены на -cx,-cy)
    container.add(this.drawGrid(cx, cy))

    // Отряд
    const deck = this.buildDeck(botIdx, locIdx)
    container.add(deck)

    return { container, deck, locIdx }
  }

  private drawGrid(cx: number, cy: number): Phaser.GameObjects.Graphics {
    const L = this.layout!
    const g = this.add.graphics()
    g.lineStyle(1 * DPR, 0xffffff, 0.2)
    const fieldH = L.cellH * DECK_ROWS
    for (let c = 0; c <= DECK_COLS; c++) {
      const x = L.originX + c * L.cellW - cx
      g.beginPath()
      g.moveTo(x, L.originY - cy)
      g.lineTo(x, L.originY + fieldH - cy)
      g.strokePath()
    }
    for (let r = 0; r <= DECK_ROWS; r++) {
      const y = L.originY + r * L.cellH - cy
      g.beginPath()
      g.moveTo(L.originX - cx, y)
      g.lineTo(L.originX + L.width - cx, y)
      g.strokePath()
    }
    return g
  }

  /** Контейнер отряда (локальные координаты относительно центра экрана). */
  private buildDeck(
    botIdx: number,
    locIdx: number,
  ): Phaser.GameObjects.Container {
    const L = this.layout!
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2
    const deck = this.add.container(0, 0)
    const bot = this.bot(botIdx)
    if (!bot) return deck
    const entries = bot.decks[locIdx] ?? []
    for (const entry of entries) {
      const idx = entry.cellIdx
      if (idx < 0 || idx >= L.centers.length) continue
      const center = L.centers[idx]
      deck.add(this.buildFrogCell(entry.level, center.x - cx, center.y - cy))
    }
    return deck
  }

  private buildFrogCell(
    level: number,
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const L = this.layout!
    const container = this.add.container(x, y)
    const radius = Math.min(L.cellW, L.cellH) * 0.36
    const wcfg = getWarriorConfig(level)
    const meta = wcfg ? CLASS_META[wcfg.class] : null

    const texKey = textureKeyForLevel(level, 0)
    let sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Arc
    if (this.textures.exists(texKey)) {
      const img = this.add.image(0, 0, texKey)
      const target = radius * 2.5
      img.setScale(target / Math.max(img.width, img.height))
      // Raid scout — все лягушки = enemy bot deck. Tint по биому планеты
      // (consistency с BattleScene).
      img.setTint(biomeFrogTint(this.biome))
      sprite = img
      this.tweens.add({
        targets: img,
        scaleY: { from: img.scaleY, to: img.scaleY * 0.92 },
        duration: 600 + Math.random() * 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1000,
      })
    } else {
      const circle = this.add.circle(0, 0, radius * 0.85, 0xdc2626, 0.9)
      circle.setStrokeStyle(2 * DPR, 0x111827, 1)
      sprite = circle
    }
    container.add(sprite)

    if (meta) {
      const badge = this.add.text(radius * 0.7, -radius * 0.7, meta.emoji, {
        fontFamily: 'sans-serif',
        fontSize: `${radius * 0.55}px`,
      })
      badge.setOrigin(0.5, 0.5)
      container.add(badge)
    }
    const lvl = this.add.text(-radius * 0.7, radius * 0.55, `L${level}`, {
      fontFamily: 'Russo One, sans-serif',
      fontSize: `${radius * 0.4}px`,
      color: '#fff',
      stroke: '#000',
      strokeThickness: 2 * DPR,
    })
    lvl.setOrigin(0.5, 0.5)
    container.add(lvl)
    return container
  }

  // ─── Chrome ──────────────────────────────────────────────────────────────

  private updateChrome() {
    const bot = this.bot(this.botIdx)
    if (!bot) return
    this.avatarText?.setText(bot.avatar)
    this.titleText?.setText(bot.name)
    this.subText?.setText(`${LOC_NAMES[this.locIdx]}  •  отряд врага`)
    this.highlightDots()
    // Синхрон React-оверлея кнопок локаций.
    eventBus.emit('raid:scout-changed', { locId: this.locIdx + 1 })
  }

  // ─── Свайп ─────────────────────────────────────────────────────────────

  private onPointerDown(p: Phaser.Input.Pointer) {
    if (this.animating) return
    this.dragStartX = p.x
    this.dragStartY = p.y
    this.dragAxis = null
  }

  private onPointerMove(p: Phaser.Input.Pointer) {
    if (this.dragStartX === null || this.dragStartY === null) return
    if (!p.isDown) return
    const dx = p.x - this.dragStartX
    const dy = p.y - this.dragStartY
    if (this.dragAxis === null) {
      if (Math.abs(dx) + Math.abs(dy) < 8 * DPR) return
      this.dragAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (this.dragAxis === 'x' && this.board) {
      this.board.deck.x = dx * 0.4 // лёгкий drag-feedback
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer) {
    if (this.dragStartX === null) return
    const dx = p.x - this.dragStartX
    const axis = this.dragAxis
    this.dragStartX = null
    this.dragStartY = null
    this.dragAxis = null
    if (this.board && !this.animating) {
      this.tweens.add({ targets: this.board.deck, x: 0, duration: 120 })
    }
    if (axis !== 'x' || this.animating) return
    const threshold = Math.max(40 * DPR, this.scale.width * 0.18)
    if (dx < -threshold) this.nextBot()
    else if (dx > threshold) this.prevBot()
  }

  private handleResize = (gameSize: Phaser.Structs.Size) => {
    const { width, height } = gameSize
    this.layout = computeDeckLayout(width, height)
    if (this.board) {
      this.board.container.destroy(true)
      this.board = null
    }
    this.board = this.createBoard(this.locIdx, this.botIdx)
    this.buildDots()
    this.updateChrome()
  }

  shutdown() {
    eventBus.off('raid:scout-set-loc', this.onSetLoc)
    this.input.off('pointerdown', this.onPointerDown, this)
    this.input.off('pointermove', this.onPointerMove, this)
    this.input.off('pointerup', this.onPointerUp, this)
    this.input.off('pointerupoutside', this.onPointerUp, this)
    this.scale.off('resize', this.handleResize, this)
  }
}
