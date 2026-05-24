// Battle units — представление воина на поле боя.
//
// Этап 3b: MVP-рендер юнитов как круги с emoji класса + цифра уровня.
// SVG-спрайты + анимации добавим в Этап 3c вместе с движением.

import Phaser from 'phaser'
import { CLASS_META, getWarriorConfig, type WarriorClass } from '../../config/warriors'
import { DPR } from '../main/types'
import { GRID_COLS, ENEMY_ROWS, PLAYER_ROWS, type GridLayout } from './battleGrid'
import type { BarracksCell } from '../../../store/barracks'
import { BATTLE_DECK_SIZE, BARRACKS_GRID_W } from '../../../store/barracks'

export type Side = 'player' | 'enemy'

export interface BattleUnit {
  /** Сторона (player/enemy). */
  side: Side
  /** Класс из warriors.ts. */
  cls: WarriorClass
  /** Уровень исходной жабы (1..18). Влияет на статы. */
  level: number
  /** Tier эволюции (0/1/2). */
  tier: 0 | 1 | 2
  /** Текущая клетка на боевой сетке (row*GRID_COLS+col). */
  cellIdx: number
  /** Текущее HP (mutate во время боя). */
  hp: number
  /** Максимальное HP. */
  maxHp: number
  /** Damage per hit. */
  damage: number
  /** Атак в секунду. */
  attackSpeed: number
  /** Визуальный контейнер (sprite + label + hp bar). */
  container: Phaser.GameObjects.Container
  /** Полоса HP — обновляется ticker'ом. */
  hpBar: Phaser.GameObjects.Rectangle
  /** Жив ли. */
  alive: boolean
}

const SIDE_COLOR: Record<Side, number> = {
  player: 0x16a34a, // зелёный — наши
  enemy: 0xdc2626, // красный — враги
}

/**
 * Создать визуальный контейнер для юнита. Возвращает BattleUnit структуру
 * с уже добавленными графическими элементами.
 */
export function createUnit(
  scene: Phaser.Scene,
  side: Side,
  level: number,
  tier: 0 | 1 | 2,
  cellIdx: number,
  layout: GridLayout,
): BattleUnit | null {
  const wcfg = getWarriorConfig(level)
  if (!wcfg) return null
  const meta = CLASS_META[wcfg.class]

  const center = layout.cellCenters[cellIdx]
  if (!center) return null

  const cellSize = Math.min(layout.cellW, layout.cellH)
  const radius = cellSize * 0.36

  const container = scene.add.container(center.x, center.y)
  container.setDepth(5)

  // Тело — круг цветом стороны
  const bodyCircle = scene.add.circle(0, 0, radius, SIDE_COLOR[side], 1)
  bodyCircle.setStrokeStyle(2 * DPR, 0x111827, 1)
  container.add(bodyCircle)

  // Бордер класса — внутренний круг с цветом класса
  const classCircle = scene.add.circle(0, 0, radius * 0.7, meta.color, 0.7)
  container.add(classCircle)

  // Emoji класса
  const emoji = scene.add.text(0, -radius * 0.15, meta.emoji, {
    fontFamily: 'sans-serif',
    fontSize: `${radius * 0.9}px`,
  })
  emoji.setOrigin(0.5, 0.5)
  container.add(emoji)

  // Уровень снизу
  const levelText = scene.add.text(0, radius * 0.45, `L${level}`, {
    fontFamily: 'Russo One, sans-serif',
    fontSize: `${radius * 0.55}px`,
    color: '#fff',
    stroke: '#000',
    strokeThickness: 2 * DPR,
  })
  levelText.setOrigin(0.5, 0.5)
  container.add(levelText)

  // HP-бар над юнитом
  const hpBarW = cellSize * 0.7
  const hpBarH = 4 * DPR
  const hpBarBg = scene.add.rectangle(
    0,
    -radius - 6 * DPR,
    hpBarW,
    hpBarH,
    0x1f2937,
    0.85,
  )
  hpBarBg.setStrokeStyle(1 * DPR, 0x000, 1)
  container.add(hpBarBg)
  const hpBar = scene.add.rectangle(
    -hpBarW / 2,
    -radius - 6 * DPR,
    hpBarW,
    hpBarH,
    side === 'player' ? 0x4ade80 : 0xfca5a5,
    1,
  )
  hpBar.setOrigin(0, 0.5)
  container.add(hpBar)

  return {
    side,
    cls: wcfg.class,
    level,
    tier,
    cellIdx,
    hp: wcfg.baseHp,
    maxHp: wcfg.baseHp,
    damage: wcfg.baseDamage,
    attackSpeed: wcfg.baseAttackSpeed,
    container,
    hpBar,
    alive: true,
  }
}

/** Маппинг barracks idx (0..11) → battle cellIdx (row 4-6 player zone). */
export function barracksIdxToBattleCell(barracksIdx: number): number {
  // barracks row 0 → battle row 4 (player front)
  // barracks row 1 → battle row 5
  // barracks row 2 → battle row 6 (back)
  const barracksRow = Math.floor(barracksIdx / BARRACKS_GRID_W)
  const barracksCol = barracksIdx % BARRACKS_GRID_W
  const battleRow = PLAYER_ROWS[barracksRow] // PLAYER_ROWS = [4,5,6]
  return battleRow * GRID_COLS + barracksCol
}

/** Сгенерировать deck игрока из barracksGrid[0..11]. */
export function buildPlayerDeck(
  scene: Phaser.Scene,
  barracksGrid: readonly (BarracksCell | null)[],
  layout: GridLayout,
): BattleUnit[] {
  const units: BattleUnit[] = []
  for (let i = 0; i < BATTLE_DECK_SIZE; i++) {
    const cell = barracksGrid[i]
    if (!cell) continue
    const battleIdx = barracksIdxToBattleCell(i)
    const unit = createUnit(scene, 'player', cell.level, cell.tier, battleIdx, layout)
    if (unit) units.push(unit)
  }
  return units
}

/**
 * Сгенерировать deck бота. MVP: фиксированный пресет по локации.
 * loc1 (Болото): 4-6 юнитов L1-L4, разные классы.
 * loc2 (Лес):    5-7 юнитов L4-L9.
 * loc3 (Континент): 6-7 юнитов L10-L15.
 */
export function buildBotDeck(
  scene: Phaser.Scene,
  locationId: number,
  layout: GridLayout,
): BattleUnit[] {
  const presets: Record<
    number,
    { count: number; levels: readonly number[] }
  > = {
    1: { count: 5, levels: [1, 2, 3, 4] },
    2: { count: 6, levels: [4, 5, 6, 7, 8, 9] },
    3: { count: 7, levels: [10, 11, 12, 13, 14, 15] },
  }
  const cfg = presets[locationId] ?? presets[1]
  const pool: number[] = []
  for (let i = 0; i < cfg.count; i++) {
    pool.push(cfg.levels[i % cfg.levels.length])
  }

  // Распределение по верхним 3 рядам (ENEMY_ROWS = [0,1,2]) × 4 cols = 12 клеток.
  const enemyCells: number[] = []
  for (const row of ENEMY_ROWS) {
    for (let col = 0; col < GRID_COLS; col++) {
      enemyCells.push(row * GRID_COLS + col)
    }
  }
  // Shuffle и берём первые `count`
  const shuffled = enemyCells.slice().sort(() => Math.random() - 0.5)
  const occupied = shuffled.slice(0, pool.length)

  const units: BattleUnit[] = []
  for (let i = 0; i < pool.length; i++) {
    const unit = createUnit(scene, 'enemy', pool[i], 0, occupied[i], layout)
    if (unit) units.push(unit)
  }
  return units
}
