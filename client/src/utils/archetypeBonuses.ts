// Phase 22 Plan 22-03: archetype bonus pool.
//
// Two-tier scheme (per D-Archetype Bonuses):
//   - FULL bonus  — granted per ASCENDED carrier (L18 → instant ascend).
//                   Stacks LINEARLY (3 ascended fire-cat → 3× the bonus).
//   - MINI bonus  — granted while carrier is ON FIELD (L1..L17).
//                   Teaser ≈10% of full. NOT stacked within same category
//                   (multiple fire-category carriers contribute mini fire bonus
//                   only ONCE — max per category). Different categories DO stack.
//
// Placeholder amounts: balance pass is Plan 22-07.
// Plan 22-04 consumes aggregateFullBonuses + aggregateMiniBonuses for HUD render.

import type { Element } from '../store/cosmic/types'

export type ArchetypeCategory = 'fire' | 'water' | 'stone' | 'shadow' | 'other'

/**
 * 2026-05-23: Element union сокращён до 11 (см. cosmic/types.ts).
 * Категории сохранены — теперь:
 *
 *   Огонь (fire):   fire, plasma         (2)
 *   Вода  (water):  water, forest, gas   (3)
 *   Камень(stone):  crystal, ring        (2)
 *   Тень  (shadow): binary               (1)  ← теперь только binary
 *   Прочее(other): ice, toxic, desert    (3)
 *
 *   Total: 2+3+2+1+3 = 11 ✓
 */
export const ELEMENT_TO_CATEGORY: Record<Element, ArchetypeCategory> = {
  // fire-category
  fire: 'fire',
  plasma: 'fire',
  // water-category
  water: 'water',
  forest: 'water',
  gas: 'water',
  // stone-category
  crystal: 'stone',
  ring: 'stone',
  // shadow-category
  binary: 'shadow',
  // other-category
  ice: 'other',
  toxic: 'other',
  desert: 'other',
}

export type BonusKey =
  | 'boxDropSpeed'
  | 'tractorGold'
  | 'offlineCap'
  | 'serumDrop'
  | 'flatGold'

export interface CategoryBonus {
  key: BonusKey
  amount: number
}

/**
 * FULL bonus per category — applied per ascended carrier (linear stack).
 * Placeholder amounts; balance in Plan 22-07.
 */
export const BONUS_PER_CATEGORY: Record<ArchetypeCategory, CategoryBonus> = {
  fire: { key: 'boxDropSpeed', amount: 0.05 }, // +5%
  water: { key: 'tractorGold', amount: 0.05 }, // +5%
  stone: { key: 'offlineCap', amount: 0.1 }, // +10%
  shadow: { key: 'serumDrop', amount: 0.01 }, // +1%
  other: { key: 'flatGold', amount: 0.03 }, // +3%
}

/**
 * MINI bonus per category — applied while carrier on field (L1..L17).
 * ≈10% of full. Max per category (NOT stacked within same category).
 * Teaser to motivate ascension.
 */
export const MINI_BONUS_PER_CATEGORY: Record<
  ArchetypeCategory,
  CategoryBonus
> = {
  fire: { key: 'boxDropSpeed', amount: 0.005 }, // +0.5%
  water: { key: 'tractorGold', amount: 0.005 }, // +0.5%
  stone: { key: 'offlineCap', amount: 0.01 }, // +1%
  shadow: { key: 'serumDrop', amount: 0.001 }, // +0.1%
  other: { key: 'flatGold', amount: 0.003 }, // +0.3%
}

export interface AggregatedBonuses {
  boxDropSpeed: number
  tractorGold: number
  offlineCap: number
  serumDrop: number
  flatGold: number
}

function emptyBonuses(): AggregatedBonuses {
  return {
    boxDropSpeed: 0,
    tractorGold: 0,
    offlineCap: 0,
    serumDrop: 0,
    flatGold: 0,
  }
}

/**
 * FULL bonus aggregator: each ascended carrier adds its category bonus.
 * Stacks LINEARLY — 3 ascended fire-category carriers give 3× the fire bonus.
 */
export function aggregateFullBonuses(
  ascendedCarriers: ReadonlyArray<{ element: Element }>,
): AggregatedBonuses {
  const result = emptyBonuses()
  for (const c of ascendedCarriers) {
    const cat = ELEMENT_TO_CATEGORY[c.element]
    const bonus = BONUS_PER_CATEGORY[cat]
    result[bonus.key] += bonus.amount
  }
  return result
}

/**
 * MINI bonus aggregator: each UNIQUE category present among on-field carriers
 * contributes its mini bonus exactly once. Multiple carriers of the same
 * category do NOT stack. Different categories DO stack with each other.
 */
export function aggregateMiniBonuses(
  onFieldCarriers: ReadonlyArray<{ element: Element }>,
): AggregatedBonuses {
  const result = emptyBonuses()
  const categoriesPresent = new Set<ArchetypeCategory>()
  for (const c of onFieldCarriers) {
    categoriesPresent.add(ELEMENT_TO_CATEGORY[c.element])
  }
  for (const cat of categoriesPresent) {
    const bonus = MINI_BONUS_PER_CATEGORY[cat]
    result[bonus.key] += bonus.amount
  }
  return result
}
