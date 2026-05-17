// Phase 17 + 18: bestiary bitset helpers.
// Bit indexing для (element, rarity, level) → unique bit index 0..1535.
// Phase 17 — write-through из feedCarrier success/stabilize + mergeCarriers.
// Phase 18 — read-side UI (TanStack Virtual, filter pills).
//
// Phase 22: Rarity type removed from main cosmic types. Bestiary still uses
// 4-tier layout (16×4×18 = 1152 bits). Plan 22-07 will decide whether to
// shrink the bitset. LegacyRarity inlined here to keep bitset shape stable.

import { ELEMENTS, type Element } from './types'
import { MAX_LEVEL } from '../../game/config/frogs'

// Phase 22: Rarity removed from types.ts; inlined locally to preserve bitset
// layout until Plan 22-07 decides on shrink.
export type LegacyRarity = 'common' | 'rare' | 'epic' | 'legendary'
export const LEGACY_RARITIES: readonly LegacyRarity[] = [
  'common',
  'rare',
  'epic',
  'legendary',
]

/** 16 elements × 4 rarities × 18 levels = 1152 уникальных combos. */
export const BESTIARY_BIT_COUNT = ELEMENTS.length * LEGACY_RARITIES.length * MAX_LEVEL
/** Bytes = 1152 / 8. */
export const BESTIARY_BYTE_COUNT = BESTIARY_BIT_COUNT / 8

/**
 * Linear bit index для (element, rarity, level).
 * Layout: 18 уровней × 64 cells/уровень (16 elements × 4 rarities = 64).
 *   index = (level - 1) * 64 + ELEMENTS.indexOf(element) * 4 + LEGACY_RARITIES.indexOf(rarity)
 * Range: 0..1151. Returns -1 если invalid.
 */
export function bestiaryIndex(
  element: Element,
  rarity: LegacyRarity,
  level: number,
): number {
  const e = ELEMENTS.indexOf(element)
  const r = LEGACY_RARITIES.indexOf(rarity)
  if (e < 0 || r < 0 || level < 1 || level > MAX_LEVEL) return -1
  return (level - 1) * 64 + e * 4 + r
}

export function readBit(bitset: ReadonlyArray<number>, idx: number): boolean {
  if (idx < 0 || idx >= BESTIARY_BIT_COUNT) return false
  const byte = bitset[idx >> 3] ?? 0
  return ((byte >> (idx & 7)) & 1) === 1
}

/**
 * Returns NEW bitset с установленным бит. Никогда не мутирует input.
 * Auto-pads до BESTIARY_BYTE_COUNT (handles legacy Phase 11 placeholder Array(24)).
 *
 * Phase 18 NOTE: всегда returns number[] (для Phase 17 backward compat).
 * Чтобы проверить «no change» — caller сам сравнивает byte values
 * (через countUnlocked или direct readBit).
 */
export function setBit(bitset: ReadonlyArray<number>, idx: number): number[] {
  if (idx < 0 || idx >= BESTIARY_BIT_COUNT) return bitset.slice()
  const byteIdx = idx >> 3
  const bitOffset = idx & 7
  const next = bitset.slice()
  while (next.length < BESTIARY_BYTE_COUNT) next.push(0)
  next[byteIdx] = (next[byteIdx] ?? 0) | (1 << bitOffset)
  return next
}

/**
 * Phase 18 helper: returns true if bit at idx is already set.
 * Cheaper чем setBit когда нужно только проверить.
 */
export function isBitSet(bitset: ReadonlyArray<number>, idx: number): boolean {
  return readBit(bitset, idx)
}

/**
 * Phase 18: подсчёт unlocked cells в bitset.
 * Использует popcount (Brian Kernighan) на каждом byte.
 * O(BESTIARY_BYTE_COUNT) = O(144) worst case.
 */
export function countUnlocked(bitset: ReadonlyArray<number>): number {
  let count = 0
  const limit = Math.min(bitset.length, BESTIARY_BYTE_COUNT)
  for (let i = 0; i < limit; i++) {
    let b = bitset[i] ?? 0
    while (b) {
      b &= b - 1
      count++
    }
  }
  return count
}

/**
 * Phase 18: подсчёт unlocked cells для одной rarity (= одной локации).
 * 4 локации = 4 rarity tiers (BESTIARY-01 + REQUIREMENTS:109-111):
 *   common = Лужа, rare = Болото, epic = Лес, legendary = Континент.
 * Каждая локация = 16 elements × 18 levels = 288 cells.
 */
export function unlockedInLocation(
  bitset: ReadonlyArray<number>,
  rarity: LegacyRarity,
): number {
  let count = 0
  const r = LEGACY_RARITIES.indexOf(rarity)
  if (r < 0) return 0
  for (let level = 1; level <= MAX_LEVEL; level++) {
    for (let e = 0; e < ELEMENTS.length; e++) {
      const idx = (level - 1) * 64 + e * 4 + r
      if (readBit(bitset, idx)) count++
    }
  }
  return count
}

/**
 * Phase 18 sub-completion milestones (REQ BESTIARY-07).
 * Triggered в cosmicSlice.setBestiaryBit когда cross threshold.
 */
// Milestones rebalanced для 1152 total (ratio 0.75 от старых значений при 1536):
//   10 → 8, 24 → 18, 96 → 72, 576 → 432.
export const BESTIARY_MILESTONES = [
  { threshold: 8, reward: { type: 'coins', amount: 1000 } },
  { threshold: 18, reward: { type: 'serum' } },
  { threshold: 72, reward: { type: 'serum' } },
  { threshold: 432, reward: { type: 'frog-exclusive' } },
] as const

export type BestiaryMilestone = (typeof BESTIARY_MILESTONES)[number]
export type BestiaryReward = BestiaryMilestone['reward']

/**
 * Возвращает milestones которые пересечены в transition prev → next, ascending.
 * Empty array если no crossing.
 */
export function milestonesCrossed(
  prev: number,
  next: number,
): readonly BestiaryMilestone[] {
  if (next <= prev) return []
  return BESTIARY_MILESTONES.filter(
    (m) => prev < m.threshold && next >= m.threshold,
  )
}
