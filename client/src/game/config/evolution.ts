// Конфиг механики эволюции лягушек (брейншторм 2026-05-23, см. obsidian/Glossary/Эволюция лягушки.md).
//
// Доступна после открытия космоса (hasCosmosUnlocked).
// Цены: gold (формула) + essence (lookup-таблица).
// Награда: постоянный аддитивный % к total income (lookup-таблица, multiples of 2.5%).
// Кулдаун: 24h per frog level после любой эволюции этой лягушки.
// Internal gate: 10 эволюций на прошлой локации (frog1-6/frog7-12/frog13-18) разблокирует следующую.

import { MAX_LEVEL } from './frogs'

// 24h в миллисекундах.
export const EVOLUTION_COOLDOWN_MS = 24 * 60 * 60 * 1000

// Порог разблокировки следующей локации эволюций (любые 10 из 12 slot'ов).
export const LOCATION_GATE_THRESHOLD = 10

// Gold-формула: `gold(L, tier) = BASE × LEVEL_GROWTH^(L-1) × TIER_MULT^(tier-1)`
// где tier ∈ {1, 2} (целевой tier).
const GOLD_BASE = 15_000_000_000
const GOLD_LEVEL_GROWTH = 1.25
const GOLD_TIER_MULT = 2.5

// Essence-цена в зависимости от уровня лягушки и целевого тира.
// Индексация: ESSENCE_COST[level-1][targetTier-1] где targetTier ∈ {1, 2}.
const ESSENCE_COST: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // frog1
  [0, 1], // frog2
  [1, 1], // frog3
  [1, 1], // frog4
  [1, 1], // frog5
  [1, 2], // frog6
  [1, 2], // frog7
  [2, 3], // frog8
  [2, 4], // frog9
  [2, 4], // frog10
  [3, 5], // frog11
  [3, 5], // frog12
  [3, 6], // frog13
  [4, 7], // frog14
  [4, 7], // frog15
  [4, 8], // frog16
  [5, 8], // frog17
  [5, 9], // frog18
]

// % к total income в зависимости от уровня и целевого тира (multiples of 2.5).
// Аддитивный бонус — складывается с другими % бонусами.
const BONUS_PERCENT: ReadonlyArray<readonly [number, number]> = [
  [2.5, 2.5], // frog1
  [2.5, 2.5], // frog2
  [2.5, 2.5], // frog3
  [2.5, 2.5], // frog4
  [2.5, 2.5], // frog5
  [2.5, 5.0], // frog6
  [2.5, 5.0], // frog7
  [2.5, 5.0], // frog8
  [5.0, 5.0], // frog9
  [5.0, 5.0], // frog10
  [5.0, 5.0], // frog11
  [5.0, 7.5], // frog12
  [5.0, 7.5], // frog13
  [5.0, 10.0], // frog14
  [7.5, 10.0], // frog15
  [7.5, 12.5], // frog16
  [7.5, 12.5], // frog17
  [10.0, 15.0], // frog18
]

// Группировка лягушек по локациям (1-indexed уровни, индексы локаций 0-based).
const LOCATION_GROUPS: ReadonlyArray<readonly number[]> = [
  [1, 2, 3, 4, 5, 6], // L1 frogs
  [7, 8, 9, 10, 11, 12], // L2 frogs
  [13, 14, 15, 16, 17, 18], // L3 frogs
]

// Мутаген (🧬 космо-лут) — нужен на эволюцию вместе с эссенцией.
// MUTAGEN_COST[level-1][targetTier-1]. Растёт по локации + целевому тиру.
const MUTAGEN_COST: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // frog1
  [0, 1], // frog2
  [0, 1], // frog3
  [1, 1], // frog4
  [1, 1], // frog5
  [1, 2], // frog6
  [1, 2], // frog7
  [1, 2], // frog8
  [1, 2], // frog9
  [2, 2], // frog10
  [2, 3], // frog11
  [2, 3], // frog12
  [2, 3], // frog13
  [2, 4], // frog14
  [3, 4], // frog15
  [3, 4], // frog16
  [3, 5], // frog17
  [3, 5], // frog18
]

// Стоимость эволюции frog level с currentTier до currentTier+1.
// Возвращает gold + essence + mutagen для следующего апгрейда.
export function getEvolutionCost(
  level: number,
  currentTier: number,
): { gold: number; essence: number; mutagen: number } {
  if (level < 1 || level > MAX_LEVEL)
    return { gold: 0, essence: 0, mutagen: 0 }
  if (currentTier < 0 || currentTier >= 2)
    return { gold: 0, essence: 0, mutagen: 0 }
  const targetTier = currentTier + 1
  const gold = Math.floor(
    GOLD_BASE *
      Math.pow(GOLD_LEVEL_GROWTH, level - 1) *
      Math.pow(GOLD_TIER_MULT, targetTier - 1),
  )
  const essence = ESSENCE_COST[level - 1][targetTier - 1]
  const mutagen = MUTAGEN_COST[level - 1][targetTier - 1]
  return { gold, essence, mutagen }
}

// % бонус к income за конкретную эволюцию.
export function getEvolutionBonusPercent(
  level: number,
  targetTier: number,
): number {
  if (level < 1 || level > MAX_LEVEL) return 0
  if (targetTier < 1 || targetTier > 2) return 0
  return BONUS_PERCENT[level - 1][targetTier - 1]
}

// Суммарный % бонус ко всем достигнутым tier'ам по всем лягушкам.
// Возвращает дробь (200% → 2.0), готовую к сложению с другими multiplier'ами.
export function getEvolutionBonusFraction(frogTiers: number[]): number {
  let total = 0
  for (let i = 0; i < Math.min(frogTiers.length, MAX_LEVEL); i++) {
    const tier = frogTiers[i] ?? 0
    for (let t = 1; t <= tier; t++) {
      total += getEvolutionBonusPercent(i + 1, t)
    }
  }
  return total / 100
}

// Количество эволюций (сумма tier'ов) среди лягушек заданной локации.
// Используется для проверки 10-evolution gate.
export function countEvolutionsInLocation(
  frogTiers: number[],
  locationGroupIdx: number,
): number {
  const group = LOCATION_GROUPS[locationGroupIdx]
  if (!group) return 0
  let total = 0
  for (const lvl of group) {
    total += frogTiers[lvl - 1] ?? 0
  }
  return total
}

// Доступна ли эволюция лягушек данной локации (location group index 0/1/2).
// L1 (idx 0) — доступна сразу. L2/L3 — после 10 эволюций на предыдущей.
export function isEvolutionUnlockedForLocation(
  frogTiers: number[],
  locationGroupIdx: number,
): boolean {
  if (locationGroupIdx < 0 || locationGroupIdx >= LOCATION_GROUPS.length) {
    return false
  }
  if (locationGroupIdx === 0) return true
  return (
    countEvolutionsInLocation(frogTiers, locationGroupIdx - 1) >=
    LOCATION_GATE_THRESHOLD
  )
}

// Возвращает индекс локационной группы (0/1/2) для уровня лягушки.
export function locationGroupForLevel(level: number): number {
  if (level <= 6) return 0
  if (level <= 12) return 1
  return 2
}
