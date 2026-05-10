// Cosmic Frogs — Carrier sub-slice.
// Извлечено из cosmic/slice.ts при рефакторе разделения по доменам.
// Public API не меняется: composed обратно в createCosmicSlice через spread.

import type { CarrierData, RollResult } from '../types'
import type { CosmicSliceActions, GetFn, SetFn } from '../slice'
import { eventBus } from '../../eventBus'
import {
  rollCeilingForCarrier,
  rollFeedOutcome,
  ceilingForBucket,
  bucketOfCeiling,
  type Bucket,
} from '../../../utils/carrierEvolution'
import { bestiaryIndex, setBit } from '../bestiary'
import { MAX_LEVEL } from '../../../game/config/frogs'
import { devWarn } from '../../../utils/devLog'

export type CarrierActions = Pick<
  CosmicSliceActions,
  | 'addCarrier'
  | 'removeCarrier'
  | 'feedCarrier'
  | 'mergeCarriers'
  | 'disposeCarrier'
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

    // Phase 17 (CARRIER-03/04): atomic feed action.
    feedCarrier: (carrierFrogId) => {
      const s = get()
      const idx = s.carriers.findIndex((c) => c.frogId === carrierFrogId)
      if (idx === -1) return null
      const carrier = s.carriers[idx]

      // Pre-determine ceiling at first feed.
      let ceiling = carrier.ceiling
      let bucket: Bucket | undefined
      if (carrier.feedCount === 0 && ceiling === undefined) {
        const rolled = rollCeilingForCarrier(carrier.rarity, s.carriers)
        ceiling = rolled.ceiling
        bucket = rolled.bucket
      } else if (ceiling !== undefined) {
        bucket = bucketOfCeiling(carrier.rarity, ceiling)
      }

      // Defensive: если ceiling всё ещё undefined (corrupted state), abort.
      if (ceiling === undefined) {
        devWarn(
          '[feedCarrier] carrier missing ceiling after feedCount > 0',
          carrier,
        )
        return null
      }

      const currentLevel = carrier.level ?? 1
      const outcome = rollFeedOutcome({
        level: currentLevel,
        ceiling,
        stabilized: carrier.stabilized,
      })

      const now = Date.now()
      const roll: RollResult = { type: outcome.result, timestamp: now }
      const nextHistory = (carrier.rollHistory ?? []).slice(-23).concat(roll) // T-17-03: clamp 24

      const updatedCarrier: CarrierData = {
        ...carrier,
        feedCount: carrier.feedCount + 1,
        level: outcome.newLevel,
        stabilized: outcome.newStabilized,
        ceiling,
        rollHistory: nextHistory,
      }

      const carriers = s.carriers.slice()
      carriers[idx] = updatedCarrier

      // Bestiary write-through на success / stabilize (новый combo unlocked).
      let nextBitset = s.bestiaryBitset
      if (outcome.result === 'success' || outcome.result === 'stabilize') {
        const bIdx = bestiaryIndex(
          carrier.element,
          carrier.rarity,
          outcome.newLevel,
        )
        if (bIdx >= 0) nextBitset = setBit(s.bestiaryBitset, bIdx)
      }

      // Phase 16 sentinel: первый feed → unlock Корабль tab (REQ UX-09).
      const hasFirstFeed = s.hasFirstFeed || true

      set({ carriers, bestiaryBitset: nextBitset, hasFirstFeed })

      // CARRIER-08 trigger: stabilization event для StabilizationModal (Plan 17-04).
      if (outcome.result === 'stabilize') {
        eventBus.emit('cosmic:carrier-stabilized', {
          frogId: carrierFrogId,
          element: carrier.element,
          rarity: carrier.rarity,
          ceiling,
          bucket: bucket ?? bucketOfCeiling(carrier.rarity, ceiling),
        })
      }

      return outcome
    },

    // Phase 17 (CARRIER-10): merge two stabilized same-element same-level carriers.
    mergeCarriers: (aFrogId, bFrogId, newFrogId) => {
      const s = get()
      if (aFrogId === bFrogId) return null
      const a = s.carriers.find((c) => c.frogId === aFrogId)
      const b = s.carriers.find((c) => c.frogId === bFrogId)
      if (!a || !b) return null
      if (!a.stabilized || !b.stabilized) return null
      if (a.element !== b.element || a.rarity !== b.rarity) return null
      const aLevel = a.level ?? 1
      const bLevel = b.level ?? 1
      if (aLevel !== bLevel) return null

      const newLevel = Math.min(aLevel + 1, MAX_LEVEL) // T-17-07 clamp
      const newCeiling = ceilingForBucket(a.rarity, 'S')

      const remaining = s.carriers.filter(
        (c) => c.frogId !== aFrogId && c.frogId !== bFrogId,
      )
      const newCarrier: CarrierData = {
        frogId: newFrogId,
        element: a.element,
        rarity: a.rarity,
        level: newLevel,
        feedCount: 0,
        stabilized: false,
        ceiling: newCeiling,
        rollHistory: [],
      }

      const idx = bestiaryIndex(a.element, a.rarity, newLevel)
      const nextBitset =
        idx >= 0 ? setBit(s.bestiaryBitset, idx) : s.bestiaryBitset

      set({
        carriers: [...remaining, newCarrier],
        bestiaryBitset: nextBitset,
      })

      return newCarrier
    },

    // Phase 17 (CARRIER-11): dispose carrier — 30% chance recover serum.
    disposeCarrier: (carrierFrogId) => {
      const s = get()
      const carrier = s.carriers.find((c) => c.frogId === carrierFrogId)
      if (!carrier) return { recovered: false }

      const recovered = Math.random() < 0.3
      const carriers = s.carriers.filter((c) => c.frogId !== carrierFrogId)

      let nextSerums = s.serums
      if (recovered) {
        nextSerums = {
          ...s.serums,
          [carrier.element]: {
            ...s.serums[carrier.element],
            [carrier.rarity]:
              (s.serums[carrier.element][carrier.rarity] ?? 0) + 1,
          },
        }
      }

      set({ carriers, serums: nextSerums })
      return { recovered }
    },
  }
}
