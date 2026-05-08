// Phase 17 (CARRIER-03/10): pure classification of drag-drop pair (a, b) → action type.
// Used by MainScene.performMerge до vortex anim чтобы выбрать ветку.

import type { CarrierData } from '../store/cosmic/types'

export type DropClassification =
  | 'standard-merge'
  | 'feed'
  | 'carrier-merge'
  | 'blocked-unstabilized'
  | 'blocked-mismatch'
  | 'no-match'

export interface FrogPair {
  aId: string
  aLevel: number
  bId: string
  bLevel: number
}

export interface DropClassificationResult {
  kind: DropClassification
  carrierFrogId?: string
  sacrificeFrogId?: string
}

/**
 * Determine action type from frog pair + current carriers.
 *  - both NON-carrier & level match → 'standard-merge'
 *  - exactly 1 carrier & level match → 'feed' (carrier first, sacrifice second)
 *  - both carrier:
 *      - same element & same level & both stabilized → 'carrier-merge'
 *      - both carrier but ≥1 unstabilized → 'blocked-unstabilized'
 *      - other → 'blocked-mismatch'
 *  - level mismatch → 'no-match'
 */
export function classifyDropTarget(
  pair: FrogPair,
  carriers: ReadonlyArray<CarrierData>,
): DropClassificationResult {
  if (pair.aLevel !== pair.bLevel) return { kind: 'no-match' }

  const ca = carriers.find((c) => c.frogId === pair.aId)
  const cb = carriers.find((c) => c.frogId === pair.bId)

  if (!ca && !cb) return { kind: 'standard-merge' }

  if (ca && cb) {
    // Both carriers
    if (!ca.stabilized || !cb.stabilized) {
      return { kind: 'blocked-unstabilized' }
    }
    if (ca.element !== cb.element || ca.rarity !== cb.rarity) {
      return { kind: 'blocked-mismatch' }
    }
    return { kind: 'carrier-merge' }
  }

  // Exactly one carrier
  const carrierFrogId = ca ? pair.aId : pair.bId
  const sacrificeFrogId = ca ? pair.bId : pair.aId
  return { kind: 'feed', carrierFrogId, sacrificeFrogId }
}
