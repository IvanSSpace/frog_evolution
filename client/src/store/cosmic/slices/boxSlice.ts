// Cosmic Frogs — Box sub-slice.
// Извлечено из cosmic/slice.ts при рефакторе разделения по доменам.
// Public API не меняется: composed обратно в createCosmicSlice через spread.

import type { BoxData } from '../types'
import type { CosmicSliceActions, GetFn, SetFn } from '../slice'
import { eventBus } from '../../eventBus'
import {
  rollRarity,
  updatePity,
  type PityState,
} from '../../../utils/rarityRoll'

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
        bonusRarity: params.bonusRarity,
      }
      const s = get()
      set({ boxes: [...s.boxes, box] })
      return box
    },

    // Phase 15: pure read — RNG roll БЕЗ commit. CascadeRevealModal вызывает на mount,
    // SerumSlotMachine использует rolled rarity для duration. commitOpenedBox финализирует.
    rollBoxRarity: (id) => {
      const s = get()
      const box = s.boxes.find((b) => b.id === id)
      if (!box || box.opened) return null
      const pity: PityState = {
        rare: s.pityCounters.rare,
        epic: s.pityCounters.epic,
        legendary: s.pityCounters.legendary,
      }
      const rarity = rollRarity(pity, box.bonusRarity)
      return { rarity, element: box.element }
    },

    // Phase 15: atomic commit — addSerum + remove box + updatePity в одном set().
    commitOpenedBox: (id, rarity) => {
      const s = get()
      const box = s.boxes.find((b) => b.id === id)
      if (!box) return
      const cur = s.serums[box.element][rarity]
      const nextSerums = {
        ...s.serums,
        [box.element]: { ...s.serums[box.element], [rarity]: cur + 1 },
      }
      const nextBoxes = s.boxes.filter((b) => b.id !== id)
      const nextPity = updatePity(
        {
          rare: s.pityCounters.rare,
          epic: s.pityCounters.epic,
          legendary: s.pityCounters.legendary,
        },
        rarity,
      )
      set({
        serums: nextSerums,
        boxes: nextBoxes,
        pityCounters: {
          common: s.pityCounters.common, // unchanged placeholder
          rare: nextPity.rare,
          epic: nextPity.epic,
          legendary: nextPity.legendary,
        },
        // Phase 16 sentinel: первое opened box → unlock Bestiary visual elements (REQ UX-09).
        hasOpenedAnyBox: true,
      })
    },

    // Phase 15: removeBox для cleanup tests + bulk-open edge cases.
    removeBox: (id) => {
      const s = get()
      set({ boxes: s.boxes.filter((b) => b.id !== id) })
    },

    // Phase 19-01 (BALANCE-01..07): unified atomic box-open.
    // Wires Phase 15 utility (rollRarity+updatePity) в реальный flow.
    // Cascade reveal по-прежнему использует rollBoxRarity → commitOpenedBox.
    openBox: (id) => {
      const s = get()
      const box = s.boxes.find((b) => b.id === id)
      if (!box || box.opened) return // idempotent guard

      const pity: PityState = {
        rare: s.pityCounters.rare,
        epic: s.pityCounters.epic,
        legendary: s.pityCounters.legendary,
      }
      const rolled = rollRarity(pity, box.bonusRarity)
      const newPity = updatePity(pity, rolled)

      const nextSerums = {
        ...s.serums,
        [box.element]: {
          ...s.serums[box.element],
          [rolled]: s.serums[box.element][rolled] + 1,
        },
      }

      set({
        boxes: s.boxes.map((b) => (b.id === id ? { ...b, opened: true } : b)),
        serums: nextSerums,
        pityCounters: {
          common: 0, // placeholder (always 0)
          rare: newPity.rare,
          epic: newPity.epic,
          legendary: newPity.legendary,
        },
        hasOpenedAnyBox: true, // REQ UX-09 + tutorial first-box trigger
      })

      eventBus.emit('cosmic:box-opened', {
        boxId: id,
        rarity: rolled,
        element: box.element,
      })
    },
  }
}
