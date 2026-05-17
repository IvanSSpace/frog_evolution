// Phase 12: types для FrogElementOverlay subsystem.
// Pure types — без runtime зависимости от Phaser/store.
// Phase 13: расширили ElementTier до 5-tier union (dormant + 4 awakened).

// Phase 22: Rarity removed from cosmic/types; export removed from here.
import type { Element } from '../../../store/cosmic/types'
export type { Element }
export { ELEMENTS } from '../../../store/cosmic/types'

// Phase 13: 5-tier ElementTier — dormant (Phase 12) + 4 awakened (this phase).
export type ElementTier = 'dormant' | 'common' | 'rare' | 'epic' | 'legendary'

// Полный список tiers (для итерации в pool/manager).
export const ELEMENT_TIERS: readonly ElementTier[] = [
  'dormant',
  'common',
  'rare',
  'epic',
  'legendary',
]

// Только awakened tiers — Rarity ⊂ awakened.
export const AWAKENED_TIERS: readonly Exclude<ElementTier, 'dormant'>[] = [
  'common',
  'rare',
  'epic',
  'legendary',
]

export interface OverlayPresetParams {
  element: Element
  tier: ElementTier
  rng: () => number
  // ELEMENT-08 stub: throttle factor 0..1 (Phase 20 INFRA-05 wires real adaptive value).
  throttle?: number
}

export interface OverlayLifecycle {
  dispose: () => void
}

// Stable cross-session id для FrogData — match с CarrierData.frogId.
export type FrogIdRef = string
