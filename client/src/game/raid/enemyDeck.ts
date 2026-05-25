// Builder вражеского отряда для рейда на конкретную планету.
// Deterministic seed = hash(planetId). Future: PvP игроки заменят bot decks.

import { getWarriorConfig } from '../config/warriors'
import { MAIN_RACES } from '../scenes/starmap/planetarium'
import { getPlanetInhabitant } from '../data/habitablePlanets'
import { RACES_BY_ID, type RaceId } from '../config/races'
import type { Element } from '../../store/cosmic/types'

const GRID_COLS = 4
// 12 cells total в enemy zone (rows 0-2), но spawn'им 6-9 юнитов для разнообразия.

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export interface EnemyDeckEntry {
  level: number
  cellIdx: number // 0..11 в enemy zone
}

export interface EnemyDeck {
  planetId: string
  entries: EnemyDeckEntry[]
  /** Element планеты (по affinity расы-инхабитанта) — для loot calculation. */
  element: Element | null
  /** Базовый уровень — самая высокоуровневая лягушка в decке. */
  highestLevel: number
}

/** Возвращает affinity element планеты или null если планета не race-планета. */
export function getPlanetElement(planetId: string): Element | null {
  const inhabitant = getPlanetInhabitant(planetId)
  if (!inhabitant) return null
  const race = RACES_BY_ID[inhabitant.raceId as RaceId]
  if (!race) return null
  return race.affinity
}

/** Возвращает «уровень планеты» — производное от planetId hash. 1-18. */
function planetTier(planetId: string): number {
  // Hash → 1..18 (по уровням лягушек).
  const h = hashString(planetId)
  return 1 + (h % 18)
}

/**
 * Строит детерминированный enemy deck для planetId.
 * - Размер: 4-8 юнитов (зависит от tier).
 * - Уровни: ±2 от planetTier, clamped 1-18.
 * - Позиции: top 3 rows (cellIdx 0-11), random но без коллизий.
 */
export function buildEnemyDeckFromPlanet(planetId: string): EnemyDeck {
  // Дополнительная защита — если planetId не из MAIN_RACES, deck всё равно строим.
  const isMain = MAIN_RACES.some((r) => r.id === planetId)
  const baseTier = planetTier(planetId)
  const seed = hashString(planetId)
  const rng = mulberry32(seed)

  // Размер — 4-8 на main race планетах, 3-5 на bg.
  const sizeMin = isMain ? 4 : 3
  const sizeMax = isMain ? 8 : 5
  const size = sizeMin + Math.floor(rng() * (sizeMax - sizeMin + 1))

  // Доступные клетки enemy zone (rows 0-2 = cellIdx 0..11).
  const available: number[] = []
  for (let i = 0; i < 3 * GRID_COLS; i++) available.push(i)
  // Shuffle through Fisher-Yates с seeded rng.
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[available[i], available[j]] = [available[j], available[i]]
  }
  const cells = available.slice(0, size)

  const entries: EnemyDeckEntry[] = []
  let highest = 1
  for (const cellIdx of cells) {
    // Level = baseTier ± 2, clamp 1..18.
    const delta = Math.floor(rng() * 5) - 2
    const lvl = Math.max(1, Math.min(18, baseTier + delta))
    // Дополнительный гейт — только level'и с warrior config (есть config для всех 1-18).
    if (!getWarriorConfig(lvl)) continue
    entries.push({ level: lvl, cellIdx })
    if (lvl > highest) highest = lvl
  }

  return {
    planetId,
    entries,
    element: getPlanetElement(planetId),
    highestLevel: highest,
  }
}
