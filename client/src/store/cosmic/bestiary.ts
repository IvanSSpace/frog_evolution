// Phase 17 + 18: bestiary bitset helpers.
// Bit indexing для (element, rarity, level) → unique bit index 0..1535.
// Phase 17 — write-through из feedCarrier success/stabilize + mergeCarriers.
// Phase 18 — read-side UI (TanStack Virtual, filter pills).

import { ELEMENTS, RARITIES, type Element, type Rarity } from './types'

/** 16 elements × 4 rarities × 24 levels = 1536 уникальных combos. */
export const BESTIARY_BIT_COUNT = ELEMENTS.length * RARITIES.length * 24
/** Bytes = 1536 / 8. */
export const BESTIARY_BYTE_COUNT = BESTIARY_BIT_COUNT / 8

/**
 * Linear bit index для (element, rarity, level).
 * Layout: 24 уровня × 64 cells/уровень (16 elements × 4 rarities = 64).
 *   index = (level - 1) * 64 + ELEMENTS.indexOf(element) * 4 + RARITIES.indexOf(rarity)
 * Range: 0..1535. Returns -1 если invalid.
 */
export function bestiaryIndex(element: Element, rarity: Rarity, level: number): number {
  const e = ELEMENTS.indexOf(element)
  const r = RARITIES.indexOf(rarity)
  if (e < 0 || r < 0 || level < 1 || level > 24) return -1
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
