// BarracksScene — отдельная Phaser локация казармы. Заменяет старую модалку.
//
// Показывает фон карты (map3.webp Континент — «крепость казармы») + поле
// 5×4 = 20 клеток в зоне FIELD_PAD_*_MILITARY. В каждой непустой клетке
// рендерится SVG-лягушка (как в BattleScene). Верхние 3 ряда подсвечены
// как боевая зона. Tap empty slot → 'barracks:add-request' (React-pool открывается).
// Tap filled slot → 'barracks:remove-request'.
//
// Snapshot UI:
//   - Заголовок 'КАЗАРМА' + счётчик В бой N/7 (вверху).
//   - Кнопка 'В РЕЙД' внизу.
//   - Кнопка ✕ возврата на MainScene в правом верхнем углу.

import Phaser from 'phaser'
import {
  DPR,
  FIELD_PAD_X_MILITARY,
  FIELD_PAD_Y_MILITARY,
  FIELD_PAD_Y_BOTTOM_MILITARY,
} from '../main/types'
import { eventBus } from '../../../store/eventBus'
import { useGameStore } from '../../../store/gameStore'
import {
  BARRACKS_GRID_W,
  BARRACKS_GRID_H,
  BATTLE_DECK_ROWS,
  MAX_DECK_SIZE,
  deckCount,
  type BarracksCell,
} from '../../../store/barracks'
import { textureKeyForLevel, FROG_LEVELS } from '../../config/frogs'
import { CLASS_META, getWarriorConfig } from '../../config/warriors'

interface CellLayout {
  cellW: number
  cellH: number
  originX: number
  originY: number
  width: number
  height: number
  centers: { x: number; y: number }[]
}

function computeBarracksLayout(
  sceneWidth: number,
  sceneHeight: number,
): CellLayout {
  const padX = FIELD_PAD_X_MILITARY
  const padY = FIELD_PAD_Y_MILITARY
  const padYBottom = FIELD_PAD_Y_BOTTOM_MILITARY
  const width = sceneWidth - padX * 2
  const height = sceneHeight - padY - padYBottom
  const cellW = width / BARRACKS_GRID_W
  const cellH = height / BARRACKS_GRID_H

  const centers: { x: number; y: number }[] = []
  for (let r = 0; r < BARRACKS_GRID_H; r++) {
    for (let c = 0; c < BARRACKS_GRID_W; c++) {
      centers.push({
        x: padX + c * cellW + cellW / 2,
        y: padY + r * cellH + cellH / 2,
      })
    }
  }
  return { cellW, cellH, originX: padX, originY: padY, width, height, centers }
}

export class BarracksScene extends Phaser.Scene {
  private mapImage: Phaser.GameObjects.Image | null = null
  private overlay: Phaser.GameObjects.Rectangle | null = null
  private gridGfx: Phaser.GameObjects.Graphics | null = null
  private deckHighlight: Phaser.GameObjects.Rectangle | null = null
  private layout: CellLayout | null = null
  private cellContainers: (Phaser.GameObjects.Container | null)[] = []
  private titleText: Phaser.GameObjects.Text | null = null
  private deckCountText: Phaser.GameObjects.Text | null = null
  private storeUnsub: (() => void) | null = null

  constructor() {
    super({ key: 'BarracksScene' })
  }

  create() {
    const { width, height } = this.scale

    // Фон — выделенный арт казармы (barracks.png). Fallback на map3 если
    // barracks.png не положен в /public/maps/.
    const mapKey = this.textures.exists('barracks')
      ? 'barracks'
      : this.textures.exists('map3')
        ? 'map3'
        : null
    if (mapKey) {
      const img = this.add.image(width / 2, height / 2, mapKey)
      img.setDisplaySize(width, height)
      img.setDepth(0)
      this.mapImage = img
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, 0x1a2e1a)
    }
    // Очень лёгкий тинт для контраста сетки поверх арта.
    const tint = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.08,
    )
    tint.setDepth(0.5)
    this.overlay = tint

    // Layout сетки + подсветка верхних 3 рядов
    this.layout = computeBarracksLayout(width, height)
    this.drawDeckHighlight()
    this.drawGridLines()

    // Title + counter в шапке (внутри сцены, поскольку HUD скрыт)
    this.titleText = this.add.text(width / 2, 20 * DPR, 'КАЗАРМА', {
      fontFamily: 'Russo One, sans-serif',
      fontSize: `${28 * DPR}px`,
      color: '#fff',
      stroke: '#000',
      strokeThickness: 5 * DPR,
    })
    this.titleText.setOrigin(0.5, 0)
    this.titleText.setDepth(10)

    this.deckCountText = this.add.text(
      width / 2,
      55 * DPR,
      this.deckCountLabel(),
      {
        fontFamily: 'Russo One, sans-serif',
        fontSize: `${18 * DPR}px`,
        color: '#facc15',
        stroke: '#000',
        strokeThickness: 3 * DPR,
      },
    )
    this.deckCountText.setOrigin(0.5, 0)
    this.deckCountText.setDepth(10)

    // Кнопки действий (✕ ВЫХОД / ⚔ В РЕЙД / ⬆ ПРОКАЧКА) вынесены в React-оверлей
    // BarracksActionButtons.tsx — app-стиль (ff-btn) вместо сырых Phaser add.text.

    // Render warriors из текущего state
    this.renderAllCells()

    // Подписка на изменения barracksGrid из стора (после add/remove из React)
    this.storeUnsub = useGameStore.subscribe((state, prev) => {
      if (state.barracksGrid !== prev.barracksGrid) {
        this.renderAllCells()
        if (this.deckCountText) {
          this.deckCountText.setText(this.deckCountLabel())
        }
      }
    })

    // Resize
    this.scale.on('resize', this.handleResize, this)
  }

  private deckCountLabel(): string {
    const grid = useGameStore.getState().barracksGrid
    return `В бой: ${deckCount(grid)}/${MAX_DECK_SIZE}`
  }

  /** Возвращает index клетки в которой находится точка (worldX, worldY), либо null. */
  private cellIndexAt(worldX: number, worldY: number): number | null {
    if (!this.layout) return null
    const h = this.layout
    if (
      worldX < h.originX ||
      worldX > h.originX + h.width ||
      worldY < h.originY ||
      worldY > h.originY + h.height
    ) {
      return null
    }
    const col = Math.floor((worldX - h.originX) / h.cellW)
    const row = Math.floor((worldY - h.originY) / h.cellH)
    if (col < 0 || col >= BARRACKS_GRID_W) return null
    if (row < 0 || row >= BARRACKS_GRID_H) return null
    return row * BARRACKS_GRID_W + col
  }

  private drawDeckHighlight() {
    if (!this.layout) return
    this.deckHighlight?.destroy()
    const h = this.layout
    const top = h.originY
    const deckHeight = h.cellH * BATTLE_DECK_ROWS
    const rect = this.add.rectangle(
      h.originX + h.width / 2,
      top + deckHeight / 2,
      h.width,
      deckHeight,
      0xfbbf24,
      0.15,
    )
    rect.setDepth(1)
    this.deckHighlight = rect
  }

  private drawGridLines() {
    if (!this.layout) return
    this.gridGfx?.destroy()
    const h = this.layout
    const g = this.add.graphics()
    g.setDepth(2)

    g.lineStyle(1 * DPR, 0xffffff, 0.25)
    for (let c = 0; c <= BARRACKS_GRID_W; c++) {
      const x = h.originX + c * h.cellW
      g.beginPath()
      g.moveTo(x, h.originY)
      g.lineTo(x, h.originY + h.height)
      g.strokePath()
    }
    for (let r = 0; r <= BARRACKS_GRID_H; r++) {
      const y = h.originY + r * h.cellH
      g.beginPath()
      g.moveTo(h.originX, y)
      g.lineTo(h.originX + h.width, y)
      g.strokePath()
    }
    // Двойная линия между deck-зоной и резервом
    g.lineStyle(2 * DPR, 0xfbbf24, 0.65)
    const yMid = h.originY + h.cellH * BATTLE_DECK_ROWS
    g.beginPath()
    g.moveTo(h.originX, yMid)
    g.lineTo(h.originX + h.width, yMid)
    g.strokePath()

    this.gridGfx = g
  }

  private renderAllCells() {
    if (!this.layout) return
    const grid = useGameStore.getState().barracksGrid
    // Cleanup всех старых контейнеров
    for (const c of this.cellContainers) {
      if (c && c.active) c.destroy()
    }
    this.cellContainers = new Array(grid.length).fill(null)

    grid.forEach((cell, idx) => {
      this.cellContainers[idx] = this.renderCell(idx, cell)
    })
  }

  private renderCell(
    idx: number,
    cell: BarracksCell | null,
  ): Phaser.GameObjects.Container {
    if (!this.layout) throw new Error('layout missing')
    const center = this.layout.centers[idx]
    const container = this.add.container(center.x, center.y)
    container.setDepth(5)

    // Hitbox — невидимый прямоугольник на всю клетку, чтобы tap работал
    // даже на пустых клетках.
    const hit = this.add.rectangle(
      0,
      0,
      this.layout.cellW * 0.85,
      this.layout.cellH * 0.85,
      0xffffff,
      0,
    )
    hit.setInteractive({ useHandCursor: true })
    container.add(hit)

    // Tap по пустой клетке — open pool. Tap по занятой — НИЧЕГО (delete не
    // допускается, перемещение делается drag'ом ниже).
    hit.on('pointerdown', () => {
      if (!cell) {
        eventBus.emit('barracks:add-request', { slotIdx: idx })
      }
    })

    if (!cell) return container

    // Drag-and-drop для занятых клеток. Снимаем frog, тащим по экрану,
    // на dragend — snap к ближайшей клетке: move если пустая, swap если
    // занятая, revert если вне grid.
    hit.input!.draggable = true
    this.input.setDraggable(hit, true)
    let originalDepth = container.depth
    hit.on('dragstart', () => {
      originalDepth = container.depth
      container.setDepth(50) // на верх во время drag
    })
    hit.on('drag', (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      // dragX/dragY — local относительно объекта hit (он в container'е).
      // Сдвигаем сам container в мировых координатах.
      container.x = center.x + dragX
      container.y = center.y + dragY
    })
    hit.on('dragend', (p: Phaser.Input.Pointer) => {
      container.setDepth(originalDepth)
      const target = this.cellIndexAt(p.worldX, p.worldY)
      if (target === null || target === idx) {
        // Revert
        container.x = center.x
        container.y = center.y
        return
      }
      const grid = useGameStore.getState().barracksGrid
      const targetCell = grid[target]
      const setCell = useGameStore.getState().setBarracksCell
      if (!targetCell) {
        // Move
        setCell(idx, null)
        setCell(target, cell)
      } else {
        // Swap
        setCell(idx, targetCell)
        setCell(target, cell)
      }
      // renderAllCells() триггерится через store subscribe — controllers пересоздадутся.
    })

    // Лягушка-воин
    const cfg = FROG_LEVELS[cell.level - 1]
    const radius = Math.min(this.layout.cellW, this.layout.cellH) * 0.36
    const wcfg = getWarriorConfig(cell.level)
    const meta = wcfg ? CLASS_META[wcfg.class] : null

    const texKey = textureKeyForLevel(cell.level, cell.tier)
    let sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Arc
    if (this.textures.exists(texKey)) {
      const img = this.add.image(0, 0, texKey)
      const target = radius * 2.5
      const baseScale = target / Math.max(img.width, img.height)
      img.setScale(baseScale)
      sprite = img
      // Idle bob
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
      const circle = this.add.circle(
        0,
        0,
        radius * 0.85,
        meta?.color ?? 0x16a34a,
        0.9,
      )
      circle.setStrokeStyle(2 * DPR, 0x111827, 1)
      sprite = circle
      void cfg
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
    const lvlText = this.add.text(
      -radius * 0.7,
      radius * 0.55,
      `L${cell.level}`,
      {
        fontFamily: 'Russo One, sans-serif',
        fontSize: `${radius * 0.4}px`,
        color: '#fff',
        stroke: '#000',
        strokeThickness: 2 * DPR,
      },
    )
    lvlText.setOrigin(0.5, 0.5)
    container.add(lvlText)

    return container
  }

  private handleResize = (gameSize: Phaser.Structs.Size) => {
    const { width, height } = gameSize
    if (this.mapImage) {
      this.mapImage.setPosition(width / 2, height / 2)
      this.mapImage.setDisplaySize(width, height)
    }
    if (this.overlay) {
      this.overlay.setPosition(width / 2, height / 2)
      this.overlay.setSize(width, height)
    }
    this.layout = computeBarracksLayout(width, height)
    this.drawDeckHighlight()
    this.drawGridLines()
    this.renderAllCells()
  }

  shutdown() {
    this.scale.off('resize', this.handleResize, this)
    this.storeUnsub?.()
    this.storeUnsub = null
    this.mapImage?.destroy()
    this.mapImage = null
    this.overlay?.destroy()
    this.overlay = null
    this.gridGfx?.destroy()
    this.gridGfx = null
    this.deckHighlight?.destroy()
    this.deckHighlight = null
    for (const c of this.cellContainers) {
      if (c && c.active) c.destroy()
    }
    this.cellContainers = []
    this.titleText?.destroy()
    this.titleText = null
    this.deckCountText?.destroy()
    this.deckCountText = null
  }
}
