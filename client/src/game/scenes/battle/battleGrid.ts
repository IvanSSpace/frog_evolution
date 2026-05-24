// Battle grid: 7×4 (rows × cols) layout для PvP raid боёв.
//
// Сетка — это абстрактные клетки, в которых стоят/двигаются юниты.
// Размер сетки фиксированный: 7 строк × 4 колонки = 28 клеток.
//
// Координаты:
//   row 0 (верх)   — задняя линия противника
//   row 1-2        — front line противника
//   row 3          — нейтральная полоса (no man's land)
//   row 4-5        — front line игрока
//   row 6 (низ)    — задняя линия игрока
//
// Сетка вписывается в зону `FIELD_PAD_*_MILITARY` сцены. Использовать
// `computeGrid(width, height)` для пересчёта при resize / разных сценах.

import Phaser from 'phaser'
import {
  DPR,
  FIELD_PAD_X_MILITARY,
  FIELD_PAD_Y_MILITARY,
  FIELD_PAD_Y_BOTTOM_MILITARY,
} from '../main/types'

export const GRID_COLS = 4
export const GRID_ROWS = 7
export const GRID_TOTAL = GRID_COLS * GRID_ROWS // 28

/** Игровые зоны по строкам (player занимает 3 нижние строки, enemy 3 верхние). */
export const PLAYER_ROWS = [4, 5, 6] as const
export const ENEMY_ROWS = [0, 1, 2] as const
export const NEUTRAL_ROW = 3

export interface GridLayout {
  /** Координаты центра клетки (мировые px) — индекс = row * GRID_COLS + col. */
  cellCenters: { x: number; y: number }[]
  cellW: number
  cellH: number
  /** Левый верхний угол всей сетки. */
  originX: number
  originY: number
  /** Полная ширина и высота сетки. */
  width: number
  height: number
}

/**
 * Считает раскладку 7×4 в зоне { padX → width-padX, padY → height-padYBottom }.
 * Использует FIELD_PAD_*_MILITARY константы.
 */
export function computeGrid(
  sceneWidth: number,
  sceneHeight: number,
): GridLayout {
  const padX = FIELD_PAD_X_MILITARY
  const padY = FIELD_PAD_Y_MILITARY
  const padYBottom = FIELD_PAD_Y_BOTTOM_MILITARY

  const width = sceneWidth - padX * 2
  const height = sceneHeight - padY - padYBottom

  const cellW = width / GRID_COLS
  const cellH = height / GRID_ROWS

  const cellCenters: { x: number; y: number }[] = []
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      cellCenters.push({
        x: padX + col * cellW + cellW / 2,
        y: padY + row * cellH + cellH / 2,
      })
    }
  }

  return {
    cellCenters,
    cellW,
    cellH,
    originX: padX,
    originY: padY,
    width,
    height,
  }
}

/** Индекс клетки в плоском массиве по (row, col). */
export const cellIndex = (row: number, col: number): number =>
  row * GRID_COLS + col

/** Обратное преобразование индекса → (row, col). */
export function cellRC(idx: number): { row: number; col: number } {
  return { row: Math.floor(idx / GRID_COLS), col: idx % GRID_COLS }
}

/** Манхэттенское расстояние между клетками — для melee-ближайший-таргет. */
export function cellDistance(a: number, b: number): number {
  const ra = Math.floor(a / GRID_COLS)
  const ca = a % GRID_COLS
  const rb = Math.floor(b / GRID_COLS)
  const cb = b % GRID_COLS
  return Math.abs(ra - rb) + Math.abs(ca - cb)
}

/**
 * Нарисовать сетку слабыми линиями. Возвращает Graphics object, который
 * можно скрыть/удалить вызвавшим. Линии — белые с alpha 0.18.
 */
export function drawGridLines(
  scene: Phaser.Scene,
  layout: GridLayout,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics()
  g.lineStyle(1 * DPR, 0xffffff, 0.18)

  // Вертикальные линии (cols + 1)
  for (let c = 0; c <= GRID_COLS; c++) {
    const x = layout.originX + c * layout.cellW
    g.beginPath()
    g.moveTo(x, layout.originY)
    g.lineTo(x, layout.originY + layout.height)
    g.strokePath()
  }
  // Горизонтальные линии (rows + 1)
  for (let r = 0; r <= GRID_ROWS; r++) {
    const y = layout.originY + r * layout.cellH
    g.beginPath()
    g.moveTo(layout.originX, y)
    g.lineTo(layout.originX + layout.width, y)
    g.strokePath()
  }

  // Нейтральная полоса — чуть более яркая линия по центру (row 3)
  g.lineStyle(2 * DPR, 0xfbbf24, 0.35)
  const midY = layout.originY + NEUTRAL_ROW * layout.cellH + layout.cellH / 2
  g.beginPath()
  g.moveTo(layout.originX, midY)
  g.lineTo(layout.originX + layout.width, midY)
  g.strokePath()

  g.setDepth(1) // под юнитами но над фоном
  return g
}
