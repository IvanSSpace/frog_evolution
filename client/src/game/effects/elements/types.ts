// Phase 12: types для FrogElementOverlay subsystem.
// Pure types — без runtime зависимости от Phaser/store. Phase 13 расширит
// ElementTier до 'common'|'rare'|'epic'|'legendary' (awakened tiers).

import type { Element, Rarity } from '../../../store/cosmic/types'
export type { Element, Rarity }
export { ELEMENTS } from '../../../store/cosmic/types'

// Phase 12 покрывает только dormant. Phase 13 расширит:
//   export type ElementTier = 'dormant' | 'common' | 'rare' | 'epic' | 'legendary'
export type ElementTier = 'dormant'

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
