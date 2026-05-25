// Battle units — представление воина на поле боя.
//
// Этап 3b: MVP-рендер юнитов как круги с emoji класса + цифра уровня.
// SVG-спрайты + анимации добавим в Этап 3c вместе с движением.

import Phaser from 'phaser'
import {
  CLASS_META,
  getWarriorConfig,
  type WarriorClass,
} from '../../config/warriors'
import { DPR } from '../main/types'
import { textureKeyForLevel } from '../../config/frogs'
import {
  GRID_COLS,
  ENEMY_ROWS,
  PLAYER_ROWS,
  type GridLayout,
} from './battleGrid'
import type { BarracksCell } from '../../../store/barracks'
import { BATTLE_DECK_SIZE, BARRACKS_GRID_W } from '../../../store/barracks'
import { useGameStore } from '../../../store/gameStore'
import {
  combatDamageMult,
  combatHpMult,
  combatArmorFlat,
} from '../../config/combatTree'

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
  /** Броня — митигация полученного урона: dmg × 100/(100+armor). */
  armor: number
  /** Визуальный контейнер (sprite + label + hp bar). */
  container: Phaser.GameObjects.Container
  /** Сам sprite (для idle bob). */
  body: Phaser.GameObjects.GameObject
  /** Полоса HP — обновляется ticker'ом. */
  hpBar: Phaser.GameObjects.Rectangle
  /** Жив ли. */
  alive: boolean
  /** Source barracks slot idx (только для player units). null = enemy/bot. */
  sourceBarracksIdx?: number | null
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
  enemyTint: number = 0xff5555,
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

  // Маленький side-индикатор — точка под лягушкой (а не огромное кольцо).
  const indicator = scene.add.circle(
    0,
    radius * 0.85,
    radius * 0.18,
    SIDE_COLOR[side],
    1,
  )
  indicator.setStrokeStyle(1 * DPR, 0x111827, 0.7)
  container.add(indicator)

  // Frog SVG sprite — текстура уже preloaded в MainScene.preload().
  const texKey = textureKeyForLevel(level, tier)
  let sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Arc
  if (scene.textures.exists(texKey)) {
    const img = scene.add.image(0, 0, texKey)
    // Сохраняем пропорции SVG — берём scale так чтобы максимальное
    // измерение вписалось в target. width/height = native pixel dims.
    const target = radius * 2.5
    const baseScale = target / Math.max(img.width, img.height)
    img.setScale(baseScale)
    // Противникам — tint по биому планеты (fire/ice/desert/toxic).
    // Phaser MULTIPLY mode: накладывается на baked level-tint в SVG.
    if (side === 'enemy') {
      img.setTint(enemyTint)
    }
    sprite = img
  } else {
    // Fallback — круг с emoji (если текстура ещё не загружена)
    const fallbackColor = side === 'enemy' ? enemyTint : meta.color
    const circle = scene.add.circle(0, 0, radius * 0.85, fallbackColor, 0.9)
    circle.setStrokeStyle(2 * DPR, 0x111827, 1)
    container.add(circle)
    const emoji = scene.add.text(0, 0, meta.emoji, {
      fontFamily: 'sans-serif',
      fontSize: `${radius * 0.9}px`,
    })
    emoji.setOrigin(0.5, 0.5)
    container.add(emoji)
    sprite = circle
  }
  container.add(sprite)

  // Сохраняем базовый scale для восстановления после move/attack.
  const baseScaleY = sprite.scaleY
  const baseScaleX = sprite.scaleX
  sprite.setData('baseScaleY', baseScaleY)
  sprite.setData('baseScaleX', baseScaleX)

  // Idle bob — yoyo от base до base × 0.92, 700ms repeat infinite,
  // random delay чтобы лягушки дышали в рассинхрон.
  scene.tweens.add({
    targets: sprite,
    scaleY: { from: baseScaleY, to: baseScaleY * 0.92 },
    duration: 600 + Math.random() * 300,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
    delay: Math.random() * 1000,
  })

  // L-номер в левом нижнем углу (внутри лягушки).
  const levelText = scene.add.text(-radius * 0.7, radius * 0.55, `L${level}`, {
    fontFamily: 'Russo One, sans-serif',
    fontSize: `${radius * 0.4}px`,
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

  // Глобальная боевая прокачка (combat tree) — только для стороны игрока.
  const tree = useGameStore.getState().combatTree
  const isPlayer = side === 'player'
  const hpMul = isPlayer ? combatHpMult(tree.hp) : 1
  const dmgMul = isPlayer ? combatDamageMult(tree.damage) : 1
  const armorAdd = isPlayer ? combatArmorFlat(tree.armor) : 0
  const maxHp = Math.round(wcfg.baseHp * hpMul)

  return {
    side,
    cls: wcfg.class,
    level,
    tier,
    cellIdx,
    hp: maxHp,
    maxHp,
    damage: wcfg.baseDamage * dmgMul,
    attackSpeed: wcfg.baseAttackSpeed,
    armor: (wcfg.baseArmor ?? 0) + armorAdd,
    container,
    body: sprite,
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
    const unit = createUnit(
      scene,
      'player',
      cell.level,
      cell.tier,
      battleIdx,
      layout,
    )
    if (unit) {
      unit.sourceBarracksIdx = i
      units.push(unit)
    }
  }
  return units
}

/**
 * Сгенерировать deck бота. MVP пресеты:
 *   loc1 (Болото) — воины противника, полные статы. Сложный бой.
 *   loc2 (Лес)    — обычные слабые лягушки (×0.25 HP/dmg) — гражданские.
 *   loc3 (Континент) — слабые лягушки (×0.3 HP/dmg) — гражданские.
 *
 * После победы на loc1 (убил воинов) loc2/3 — лёгкие чаны со стражами-
 * мирянами вместо солдат, как в дизайне.
 */
/** Пресет вражеского отряда на локации. Один источник для боя и scout-превью. */
export interface BotDeckPreset {
  count: number
  levels: readonly number[]
  statMul: number
}

export const BOT_DECK_PRESETS: Record<number, BotDeckPreset> = {
  1: { count: 5, levels: [1, 2, 3, 4], statMul: 1.0 },
  2: { count: 6, levels: [1, 2, 3, 4, 5], statMul: 0.25 },
  3: { count: 7, levels: [2, 3, 4, 5, 6], statMul: 0.3 },
}

// Детерминированный seed из строки (FNV-1a) + mulberry32 PRNG. Нужны чтобы у
// каждой планеты был СВОЙ стабильный отряд (одинаковый между сессиями).
function strHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Уровни лягушек на локации (для scout-превью и боя). Если передан planetId —
 * отряд варьируется seed'ом планеты (у каждой планеты свой файт), иначе
 * детерминированный fallback (i % levels).
 */
export function botDeckLevels(
  locationId: number,
  planetId?: string | null,
): number[] {
  const cfg = BOT_DECK_PRESETS[locationId] ?? BOT_DECK_PRESETS[1]
  const pool: number[] = []
  if (!planetId) {
    for (let i = 0; i < cfg.count; i++) {
      pool.push(cfg.levels[i % cfg.levels.length])
    }
    return pool
  }
  const rng = mulberry32(strHash(`${planetId}:${locationId}`))
  for (let i = 0; i < cfg.count; i++) {
    pool.push(cfg.levels[Math.floor(rng() * cfg.levels.length)])
  }
  return pool
}

export function buildBotDeck(
  scene: Phaser.Scene,
  locationId: number,
  layout: GridLayout,
  enemyTint: number = 0xff5555,
  planetId?: string | null,
): BattleUnit[] {
  const cfg = BOT_DECK_PRESETS[locationId] ?? BOT_DECK_PRESETS[1]
  const pool = botDeckLevels(locationId, planetId)

  // Распределение по верхним 3 рядам (ENEMY_ROWS = [0,1,2]) × 4 cols = 12 клеток.
  const enemyCells: number[] = []
  for (const row of ENEMY_ROWS) {
    for (let col = 0; col < GRID_COLS; col++) {
      enemyCells.push(row * GRID_COLS + col)
    }
  }
  // Seeded shuffle (стабильная расстановка на планету), берём первые `count`.
  const cellRng = mulberry32(strHash(`${planetId ?? 'x'}:cells:${locationId}`))
  const shuffled = enemyCells.slice().sort(() => cellRng() - 0.5)
  const occupied = shuffled.slice(0, pool.length)

  const units: BattleUnit[] = []
  for (let i = 0; i < pool.length; i++) {
    const unit = createUnit(
      scene,
      'enemy',
      pool[i],
      0,
      occupied[i],
      layout,
      enemyTint,
    )
    if (!unit) continue
    // Применяем stat multiplier для loc2/3 — обычные лягушки слабые.
    if (cfg.statMul !== 1) {
      unit.hp = Math.max(1, Math.round(unit.hp * cfg.statMul))
      unit.maxHp = unit.hp
      unit.damage = Math.max(1, unit.damage * cfg.statMul)
      unit.hpBar.scaleX = 1
    }
    units.push(unit)
  }
  return units
}
