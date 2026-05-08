// Phase 14: pure eligibility check для Serum-02 → Carrier flow.
// Locked decisions (REQ SERUM-08):
//   common → L1 (Болото), rare → L7 (Лес),
//   epic → L13 (Континент), legendary → L19 (Планета).
//   Серум не применим, если frog уже carrier (idempotency).

import type { Element, Rarity, CarrierData } from '../store/cosmic/types'

/** Required frog level per serum rarity (REQ SERUM-08, locked). */
export const RARITY_TO_STARTING_LEVEL: Record<Rarity, number> = {
  common: 1,
  rare: 7,
  epic: 13,
  legendary: 19,
}

/** Minimal frog shape — accepts MainScene FrogData без import cycle. */
export interface FrogLike {
  id: string
  level: number
}

/**
 * Pure check: можно ли применить серум данной rarity на этого frog'а?
 * - level должен совпадать с RARITY_TO_STARTING_LEVEL[rarity]
 * - frog не должен уже быть carrier
 * Element не используется в проверке eligibility (любой element подходит
 * eligible frog'у) — только rarity gates level.
 */
export function isEligible(
  frog: FrogLike,
  _element: Element,
  rarity: Rarity,
  carriers: ReadonlyArray<CarrierData>,
): boolean {
  if (carriers.some((c) => c.frogId === frog.id)) return false
  return frog.level === RARITY_TO_STARTING_LEVEL[rarity]
}

/** Helper для UI / mis-tap toast: required level + locationId for hint. */
export function getEligibilityHint(rarity: Rarity): { level: number; locationId: number } {
  const level = RARITY_TO_STARTING_LEVEL[rarity]
  // Локация определяется по level: 1-6 → Болото, 7-12 → Лес, 13-18 → Континент, 19-24 → Планета.
  const locationId =
    level <= 6 ? 1 :
    level <= 12 ? 2 :
    level <= 18 ? 3 : 4
  return { level, locationId }
}
