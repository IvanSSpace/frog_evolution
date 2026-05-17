// Cosmic Frogs — Carrier sub-slice.
// Phase 22 Plan 22-01: упрощён до addCarrier + removeCarrier
// (mergeCarriers, feedCarrier, disposeCarrier удалены — feed-stabilize / merge-rarity
// механика выпилена).
// Phase 22 Plan 22-02: добавлены mergeCarrierWithNormal и mergeCarrierWithCarrier —
// carrier развивается через стандартный merge от L1 до L17. L18 ascension — Plan 22-03.

import type { CosmicSliceActions, GetFn, SetFn } from '../slice'

export type CarrierActions = Pick<
  CosmicSliceActions,
  | 'addCarrier'
  | 'removeCarrier'
  | 'mergeCarrierWithNormal'
  | 'mergeCarrierWithCarrier'
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

    // Plan 22-02: carrier + normal — carrier поднимается на +1 level,
    // element наследуется. Normal frog (normalFrogId) удаляется caller'ом
    // на стороне MainScene; здесь — только мутация carrier list.
    mergeCarrierWithNormal: (
      carrierFrogId,
      _normalFrogId,
      newFrogId,
      newLevel,
    ) => {
      const s = get()
      const carrier = s.carriers.find((c) => c.frogId === carrierFrogId)
      if (!carrier) return
      const nextCarriers = s.carriers
        .filter((c) => c.frogId !== carrierFrogId)
        .concat({
          frogId: newFrogId,
          element: carrier.element,
          level: newLevel,
        })
      set({ carriers: nextCarriers })
    },

    // Plan 22-02: carrier + carrier — оба удаляются, новый carrier создаётся
    // с element TARGET (drop-on per D-Carrier+carrier rule).
    // Drag direction — game-design source of truth.
    mergeCarrierWithCarrier: (
      droppedFrogId,
      targetFrogId,
      newFrogId,
      newLevel,
    ) => {
      const s = get()
      const target = s.carriers.find((c) => c.frogId === targetFrogId)
      const dropped = s.carriers.find((c) => c.frogId === droppedFrogId)
      if (!target || !dropped) return
      const nextCarriers = s.carriers
        .filter(
          (c) => c.frogId !== droppedFrogId && c.frogId !== targetFrogId,
        )
        .concat({
          frogId: newFrogId,
          element: target.element,
          level: newLevel,
        })
      set({ carriers: nextCarriers })
    },
  }
}
