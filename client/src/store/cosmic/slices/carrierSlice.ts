// Cosmic Frogs — Carrier sub-slice.
// Phase 22: упрощён до addCarrier + removeCarrier.
// mergeCarriers, feedCarrier, disposeCarrier удалены (вся feed-stabilize / merge-rarity
// механика выпилена). Carrier merge через стандартный MergeController (Plan 22-02).
// Ascension при достижении L18 — Plan 22-03 (addCarrier/removeCarrier reused).

import type { CosmicSliceActions, GetFn, SetFn } from '../slice'

export type CarrierActions = Pick<
  CosmicSliceActions,
  'addCarrier' | 'removeCarrier'
>

export function createCarrierSlice(set: SetFn, get: GetFn): CarrierActions {
  return {
    addCarrier: (carrier) => {
      const s = get()
      set({ carriers: [...s.carriers, carrier] })
    },

    removeCarrier: (frogId) => {
      const s = get()
      set({ carriers: s.carriers.filter((c) => c.frogId !== frogId) })
    },
  }
}
