// Cosmic Frogs — Box sub-slice.
// Извлечено из cosmic/slice.ts при рефакторе разделения по доменам.
// Public API не меняется: composed обратно в createCosmicSlice через spread.
// Phase 22: rollRarity / updatePity / bonusRarity removed from commit paths.
// Box open now awards +1 to serums[element] (flat, no rarity dimension).

import type { BoxData } from '../types'
import type { CosmicSliceActions, GetFn, SetFn } from '../slice'
import { eventBus } from '../../eventBus'

export type BoxActions = Pick<
  CosmicSliceActions,
  'addBox' | 'rollBoxRarity' | 'commitOpenedBox' | 'removeBox' | 'openBox'
>

export function createBoxSlice(set: SetFn, get: GetFn): BoxActions {
  return {
    // Phase 15 (REQ BOX-01/02): create box с auto-generated id, push в inventory.
    addBox: (params) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `box-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
      const box: BoxData = {
        id,
        planetId: params.planetId,
        planetName: params.planetName,
        archetype: params.archetype,
        element: params.element,
        opened: false,
        createdAt: Date.now(),
        bonusRarity: params.bonusRarity, // cosmetic-only legacy flag (Phase 22)
      }
      const s = get()
      set({ boxes: [...s.boxes, box] })
      return box
    },

    // Phase 15: pure read — returns element (rarity removed in Phase 22).
    // CascadeRevealModal calls on mount; commitOpenedBox finalizes.
    rollBoxRarity: (id) => {
      const s = get()
      const box = s.boxes.find((b) => b.id === id)
      if (!box || box.opened) return null
      // Phase 22: no rarity rolling; return element only for cascade reveal compat.
      return { element: box.element }
    },

    // Phase 22: atomic commit — +1 serum[element] + remove box in one set().
    // pityCounters kept structurally but not updated (cosmetic-only Phase 22).
    commitOpenedBox: (id) => {
      const s = get()
      const box = s.boxes.find((b) => b.id === id)
      if (!box) return
      // Phase 22: flat serum increment
      const cur = s.serums[box.element]
      const nextSerums = {
        ...s.serums,
        [box.element]: cur + 1,
      }
      const nextBoxes = s.boxes.filter((b) => b.id !== id)
      set({
        serums: nextSerums,
        boxes: nextBoxes,
        // Phase 16 sentinel: первое opened box → unlock Bestiary visual elements (REQ UX-09).
        hasOpenedAnyBox: true,
      })
    },

    // Phase 15: removeBox для cleanup tests + bulk-open edge cases.
    removeBox: (id) => {
      const s = get()
      set({ boxes: s.boxes.filter((b) => b.id !== id) })
    },

    // Phase 19-01 / Phase 22: unified atomic box-open.
    // Phase 22: +1 to serums[element]; no rarity rolling.
    openBox: (id) => {
      const s = get()
      const box = s.boxes.find((b) => b.id === id)
      if (!box || box.opened) return // idempotent guard

      // Phase 22: flat serum increment
      const nextSerums = {
        ...s.serums,
        [box.element]: s.serums[box.element] + 1,
      }

      set({
        boxes: s.boxes.map((b) => (b.id === id ? { ...b, opened: true } : b)),
        serums: nextSerums,
        hasOpenedAnyBox: true, // REQ UX-09 + tutorial first-box trigger
      })

      eventBus.emit('cosmic:box-opened', {
        boxId: id,
        element: box.element,
      })
    },
  }
}
