// ShipScene — интерьер корабля с экипажем (боевой отряд, загруженный из казармы).
//
// Визуально как казарма (арта интерьера пока нет → fallback на barracks/map3 bg).
// Показывает shipCrew сеткой. Кнопки (✕ выход / 🛬 выгрузить) — React-оверлей
// ShipActionButtons (как BarracksActionButtons).
//
// Открывается событием 'ship:open' (из BarracksActionButtons после загрузки),
// закрывается 'ship:exit'. Переключение сцен — в game/index.ts.

import Phaser from 'phaser'
import {
  DPR,
  FIELD_PAD_X_MILITARY,
  FIELD_PAD_Y_MILITARY,
  FIELD_PAD_Y_BOTTOM_MILITARY,
} from '../main/types'
import { useGameStore } from '../../../store/gameStore'
import { SHIP_CREW_SIZE, type BarracksCell } from '../../../store/barracks'
import { textureKeyForLevel } from '../../config/frogs'
import { CLASS_META, getWarriorConfig } from '../../config/warriors'

const COLS = 4
const ROWS = Math.ceil(SHIP_CREW_SIZE / COLS) // 7 → 2 ряда

export class ShipScene extends Phaser.Scene {
  private cellContainers: (Phaser.GameObjects.Container | null)[] = []
  private storeUnsub: (() => void) | null = null
  private cells: { x: number; y: number; w: number; h: number }[] = []

  constructor() {
    super({ key: 'ShipScene' })
  }

  create() {
    const { width, height } = this.scale

    // Фон — пока заглушка (арта интерьера нет): barracks → map3 → заливка.
    const bgKey = this.textures.exists('barracks')
      ? 'barracks'
      : this.textures.exists('map3')
        ? 'map3'
        : null
    if (bgKey) {
      const img = this.add.image(width / 2, height / 2, bgKey)
      img.setDisplaySize(width, height)
      img.setDepth(0)
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, 0x0b1626)
    }
    // Холодный «корабельный» тинт поверх + контраст сетки.
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x0e2740, 0.35)
      .setDepth(0.5)

    this.computeLayout()
    this.drawGrid()

    const title = this.add.text(width / 2, 20 * DPR, '🚀 КОРАБЛЬ', {
      fontFamily: 'Russo One, sans-serif',
      fontSize: `${28 * DPR}px`,
      color: '#fff',
      stroke: '#000',
      strokeThickness: 5 * DPR,
    })
    title.setOrigin(0.5, 0)
    title.setDepth(10)

    this.renderCrew()

    this.storeUnsub = useGameStore.subscribe((state, prev) => {
      if (state.shipCrew !== prev.shipCrew) this.renderCrew()
    })

    this.scale.on('resize', this.handleResize, this)
  }

  private computeLayout() {
    const { width, height } = this.scale
    const padX = FIELD_PAD_X_MILITARY
    const padY = FIELD_PAD_Y_MILITARY + 40 * DPR
    const padYBottom = FIELD_PAD_Y_BOTTOM_MILITARY + 30 * DPR
    const fieldW = width - padX * 2
    const fieldH = height - padY - padYBottom
    const cellW = fieldW / COLS
    const cellH = fieldH / ROWS
    this.cells = []
    for (let i = 0; i < SHIP_CREW_SIZE; i++) {
      const r = Math.floor(i / COLS)
      const c = i % COLS
      this.cells.push({
        x: padX + c * cellW + cellW / 2,
        y: padY + r * cellH + cellH / 2,
        w: cellW,
        h: cellH,
      })
    }
  }

  private drawGrid() {
    const g = this.add.graphics()
    g.setDepth(2)
    g.lineStyle(1 * DPR, 0xffffff, 0.18)
    for (const cell of this.cells) {
      g.strokeRect(cell.x - cell.w / 2, cell.y - cell.h / 2, cell.w, cell.h)
    }
  }

  private renderCrew() {
    for (const c of this.cellContainers) {
      if (c && c.active) c.destroy()
    }
    const crew = useGameStore.getState().shipCrew
    this.cellContainers = new Array(SHIP_CREW_SIZE).fill(null)
    for (let i = 0; i < SHIP_CREW_SIZE; i++) {
      this.cellContainers[i] = this.renderCell(i, crew[i] ?? null)
    }
  }

  private renderCell(
    idx: number,
    cell: BarracksCell | null,
  ): Phaser.GameObjects.Container {
    const slot = this.cells[idx]
    const container = this.add.container(slot.x, slot.y)
    container.setDepth(5)
    if (!cell) return container

    const radius = Math.min(slot.w, slot.h) * 0.36
    const wcfg = getWarriorConfig(cell.level)
    const meta = wcfg ? CLASS_META[wcfg.class] : null
    const texKey = textureKeyForLevel(cell.level, cell.tier)

    let sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Arc
    if (this.textures.exists(texKey)) {
      const img = this.add.image(0, 0, texKey)
      img.setScale((radius * 2.5) / Math.max(img.width, img.height))
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
      const circle = this.add.circle(
        0,
        0,
        radius * 0.85,
        meta?.color ?? 0x16a34a,
        0.9,
      )
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
    const lvl = this.add.text(-radius * 0.7, radius * 0.55, `L${cell.level}`, {
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

  private handleResize = () => {
    this.computeLayout()
    this.renderCrew()
  }

  shutdown() {
    this.storeUnsub?.()
    this.storeUnsub = null
    this.scale.off('resize', this.handleResize, this)
  }
}
