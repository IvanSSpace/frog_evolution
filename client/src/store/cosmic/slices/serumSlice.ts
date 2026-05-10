// Cosmic Frogs — Serum sub-slice.
// Извлечено из cosmic/slice.ts при рефакторе разделения по доменам.
// Public API не меняется: composed обратно в createCosmicSlice через spread.

import type { CarrierData } from '../types'
import type { CosmicSliceActions, GetFn, SetFn } from '../slice'

export type SerumActions = Pick<
  CosmicSliceActions,
  'addSerum' | 'removeSerum' | 'setSerumDragActive' | 'applySerum'
>

export function createSerumSlice(set: SetFn, get: GetFn): SerumActions {
  return {
    addSerum: (element, rarity, count = 1) => {
      const s = get()
      const cur = s.serums[element][rarity]
      const next = Math.max(0, cur + count)
      const serums = {
        ...s.serums,
        [element]: { ...s.serums[element], [rarity]: next },
      }
      set({ serums })
    },

    removeSerum: (element, rarity, count = 1) => {
      const s = get()
      const cur = s.serums[element][rarity]
      const next = Math.max(0, cur - count)
      const serums = {
        ...s.serums,
        [element]: { ...s.serums[element], [rarity]: next },
      }
      set({ serums })
    },

    // Phase 14: tap-to-select / drag mode flag.
    // active=true → переключает MainScene в selection mode (halos + auto-pause magnet/merge).
    // active=false → clears selectedSerum независимо от второго аргумента.
    setSerumDragActive: (active, payload) => {
      if (active) {
        set({ serumDragActive: true, selectedSerum: payload ?? null })
      } else {
        set({ serumDragActive: false, selectedSerum: null })
      }
    },

    // Phase 14: atomic apply transaction.
    //  - guard: serum availability (>= 1) и frog не должен уже быть carrier
    //  - single set() для минимизации subscribe-flapping в FrogOverlayManager
    applySerum: (frogId, element, rarity, level) => {
      const s = get()

      // Guard: serum доступен?
      const cur = s.serums[element][rarity]
      if (cur < 1) return

      // Guard: idempotency — frog уже carrier?
      if (s.carriers.some((c) => c.frogId === frogId)) return

      const nextSerums = {
        ...s.serums,
        [element]: { ...s.serums[element], [rarity]: cur - 1 },
      }
      const nextCarrier: CarrierData = {
        frogId,
        element,
        rarity,
        feedCount: 0,
        stabilized: false,
        level,
      }
      set({
        serums: nextSerums,
        carriers: [...s.carriers, nextCarrier],
        serumDragActive: false,
        selectedSerum: null,
      })
    },
  }
}
