// Cosmic Frogs System — Zustand slice factory.
// Phase 11: каркас + actions stubs. Реальная логика наполняется в Phase 14-19.
// Refactor: actions разбиты по доменам в ./slices/* (serum / box / carrier / ship).
// Этот файл — orchestrator: содержит public API (interface CosmicSliceActions),
// типы (CosmicState, SetFn, GetFn) и composition через spread.
// Phase 22: Rarity, feedCarrier, mergeCarriers, disposeCarrier удалены.

import {
  type CosmicSlice,
  type CosmicTab,
  type Element,
  type BoxData,
  type CarrierData,
  type TutorialStepId,
  ELEMENTS,
  makeInitialCosmicSlice,
} from './types'
import { eventBus } from '../eventBus'
import type { MissionResult } from '../../game/data/missionConfig'
import {
  bestiaryIndex,
  setBit,
  isBitSet,
  countUnlocked,
  milestonesCrossed,
} from './bestiary'
import { createSerumSlice } from './slices/serumSlice'
import { createBoxSlice } from './slices/boxSlice'
import { createCarrierSlice } from './slices/carrierSlice'
import { createShipSlice } from './slices/shipSlice'
import { createAscensionSlice } from './slices/ascensionSlice'
import { createShopSlice, type PurchaseShopItemOpts } from './slices/shopSlice'
import type { ShopItemId } from '../../config/cosmicShop'

// Phase 22: Rarity type removed from serum/carrier system.
// LegacyRarity kept only for bestiary bitset dimension (Plan 22-07 will shrink).
type LegacyRarity = 'common' | 'rare' | 'epic' | 'legendary'

// Actions — то, что наполняется в Phase 14-19. Здесь — placeholder stubs.
export interface CosmicSliceActions {
  // Serum actions (Phase 14)
  // Phase 22: addSerum/removeSerum без rarity param
  addSerum: (element: Element, count?: number) => void
  removeSerum: (element: Element, count?: number) => void

  // Phase 14: tap-to-select / drag selection mode (transient UI state).
  // Phase 22: payload без rarity
  setSerumDragActive: (
    active: boolean,
    payload?: { element: Element } | null,
  ) => void

  // Phase 22: applySerum без rarity (любая frog принимает серум)
  applySerum: (frogId: string, element: Element, level: number) => Promise<void>

  // Box actions (Phase 15)
  addBox: (params: {
    planetId: string
    planetName: string
    archetype: string
    element: Element
    bonusRarity?: 'rare' | 'epic' | 'legendary'
  }) => BoxData
  rollBoxRarity: (id: string) => { element: Element } | null
  commitOpenedBox: (id: string) => void
  removeBox: (id: string) => void

  /**
   * Phase 19-01 (BALANCE-01..07): unified box-open action.
   * Phase 22: awards +1 to serums[box.element] (no rarity dimension).
   *   1. find box; idempotent guard (opened/missing → no-op)
   *   2. award serums[box.element] += 1
   *   3. mark box opened, set hasOpenedAnyBox sentinel (REQ UX-09 / tutorial first-box)
   *   4. eventBus.emit('cosmic:box-opened', { boxId, element })
   */
  openBox: (id: string) => void

  // Carrier actions (Phase 17 / Phase 22 simplified)
  addCarrier: (carrier: CarrierData) => void
  removeCarrier: (frogId: string) => void

  /**
   * Phase 22 Plan 22-02: carrier + normal merge.
   * Removes carrier with carrierFrogId, creates new carrier at newFrogId
   * inheriting the old carrier's element and bumped to newLevel.
   * The normal frog (normalFrogId) is the caller's responsibility to remove
   * from the visual scene — carrierSlice only mutates carrier list.
   * No-op if carrierFrogId not found in state.carriers.
   */
  mergeCarrierWithNormal: (
    carrierFrogId: string,
    normalFrogId: string,
    newFrogId: string,
    newLevel: number,
  ) => void

  /**
   * Phase 22 Plan 22-02: carrier + carrier merge.
   * Removes both droppedFrogId and targetFrogId carriers, creates new carrier
   * at newFrogId. Per D-Carrier+carrier rule the TARGET (drop-on) element
   * survives — droppedFrogId's element is discarded. Drag direction is the
   * game-design source of truth for element selection.
   * No-op if either carrier id missing from state.carriers.
   */
  mergeCarrierWithCarrier: (
    droppedFrogId: string,
    targetFrogId: string,
    newFrogId: string,
    newLevel: number,
  ) => void

  /**
   * Phase 22 Plan 22-03: ascend a carrier that reached L18.
   * - Removes carrier with frogId from state.carriers (frees field slot).
   * - Appends AscendedCarrier {id, element, ascendedAt} to state.ascendedCarriers
   *   (permanent, persisted в localStorage).
   * - +1 essence (placeholder reward; balance — Plan 22-07).
   * - Emits eventBus 'cosmic:carrier-ascended' after store mutation.
   * No-op if frogId not found in state.carriers (idempotent).
   */
  ascendCarrier: (frogId: string) => void

  /**
   * Phase 17 (CARRIER-12) + Phase 18 (BESTIARY-07): set bestiary bit для (element, rarity, level).
   * Phase 22: rarity param kept as LegacyRarity — bestiary bitset still 16×4×18 layout
   * until Plan 22-07 decides shrink.
   * Idempotent: re-set unlocked bit → no state change → no event.
   * Phase 18: проверяет milestonesCrossed (10/24/96/576) и эмитит
   * 'cosmic:bestiary-milestone' event + grants reward (coins/serum/flag).
   */
  setBestiaryBit: (
    element: Element,
    rarity: LegacyRarity,
    level: number,
  ) => void

  /** Phase 18 (REQ BESTIARY-07): toggle 576-cells milestone visual flag. */
  setFrogExclusiveUnlocked: (v: boolean) => void

  // Tab persistence (COSMIC-HUB-07) — UI хранит в sessionStorage; здесь mirror в store.
  setLastActiveTab: (tab: CosmicTab) => void

  // Phase 16: Ship navigation (REQ SHIP-01..06)
  ensureShipExists: () => void
  sendShipTo: (toPlanetId: string) => void
  arriveShipAt: (planetId: string) => void
  setShipPosition: (x: number, y: number) => void

  // Phase 16: Sentinel flags toggles (REQ UX-09; used by Phase 17/19 + dev panel)
  setHasFirstFeed: (v: boolean) => void
  setHasFirstMission: (v: boolean) => void
  setHasOpenedAnyBox: (v: boolean) => void

  // Phase 16-04: atomic investigate transaction
  // returns true если успешно, false если guard не прошёл
  investigatePlanet: (planetId: string, result: MissionResult) => boolean

  /**
   * Phase 19-05 (UX-08): mark tutorial step seen.
   * Idempotent: re-call с already-seen step → no harm.
   * Persisted via existing cosmic auto-persist (gameStore subscribe).
   */
  markTutorialSeen: (step: TutorialStepId) => void

  /**
   * Phase 22 Plan 22-05: cosmic shop purchase.
   * Atomically: cost guard → currency decrement → shopPurchaseCounts++ → apply effect.
   * Returns true on success, false on guard failure (insufficient currency / invalid opts).
   * Idempotent — повторный успешный call увеличивает counter (scaling cost).
   */
  purchaseShopItem: (itemId: ShopItemId, opts?: PurchaseShopItemOpts) => boolean

}

export type CosmicState = CosmicSlice & CosmicSliceActions

// Минимальный set/get типизированный против CosmicState.
// gameStore оборачивает createCosmicSlice; spread выдаёт партиал, совместимый с GameState.
// Экспортируются для использования в sub-slice фабриках (./slices/*).
export type SetFn = (partial: Partial<CosmicState>) => void
export type GetFn = () => CosmicState

export function createCosmicSlice(set: SetFn, get: GetFn): CosmicState {
  const initial = makeInitialCosmicSlice()

  return {
    ...initial,
    ...createSerumSlice(set, get),
    ...createBoxSlice(set, get),
    ...createCarrierSlice(set, get),
    ...createShipSlice(set, get),
    ...createAscensionSlice(set, get),
    ...createShopSlice(set, get),

    // Phase 17 (CARRIER-12) + Phase 18 (BESTIARY-07): set bestiary bit + milestone trigger.
    // Phase 22: rarity param kept as LegacyRarity (bestiary shape unchanged until Plan 22-07).
    // Idempotent: re-setting an already unlocked bit → no state change → no event.
    // Atomic: один set() per call; eventBus.emit вне set() в том же tick.
    setBestiaryBit: (element, rarity, level) => {
      const s = get()
      const idx = bestiaryIndex(element, rarity, level)
      if (idx < 0) return
      // Bail early если bit уже установлен.
      if (isBitSet(s.bestiaryBitset, idx)) return

      const nextBitset = setBit(s.bestiaryBitset, idx)
      const prevCount = countUnlocked(s.bestiaryBitset)
      const nextCount = countUnlocked(nextBitset)
      const crossed = milestonesCrossed(prevCount, nextCount)

      // Apply rewards inline — все в одну атомарную транзакцию.
      let nextSerums = s.serums
      let coinsToAdd = 0
      let nextFrogExclusive = s.frogExclusiveUnlocked

      for (const m of crossed) {
        const reward = m.reward
        if (reward.type === 'coins') {
          coinsToAdd += reward.amount
        } else if (reward.type === 'serum') {
          // Phase 22: serum reward — +1 to a random element (no rarity).
          const randElem = ELEMENTS[
            Math.floor(Math.random() * ELEMENTS.length)
          ] as Element
          const cur = nextSerums[randElem]
          nextSerums = {
            ...nextSerums,
            [randElem]: cur + 1,
          }
        } else if (reward.type === 'frog-exclusive') {
          nextFrogExclusive = true
        }
      }

      set({
        bestiaryBitset: nextBitset,
        serums: nextSerums,
        frogExclusiveUnlocked: nextFrogExclusive,
      })

      // Coins grant via root slice (gameStore composit).
      if (coinsToAdd > 0) {
        const root = get() as unknown as {
          addGold?: (n: number) => void
          addCoins?: (n: number) => void
        }
        // gameStore использует addGold (Phase 1.0) — fallback на addCoins для совместимости.
        if (typeof root.addGold === 'function') {
          root.addGold(coinsToAdd)
        } else if (typeof root.addCoins === 'function') {
          root.addCoins(coinsToAdd)
        }
      }

      // Emit milestone events (UI показывает toast).
      for (const m of crossed) {
        eventBus.emit('cosmic:bestiary-milestone', {
          threshold: m.threshold as 10 | 24 | 96 | 576,
          reward: m.reward,
        })
      }
    },

    setFrogExclusiveUnlocked: (v) => set({ frogExclusiveUnlocked: v }),

    setLastActiveTab: (tab) => {
      set({ lastActiveTab: tab })
    },

    setHasFirstFeed: (v) => set({ hasFirstFeed: v }),
    setHasFirstMission: (v) => set({ hasFirstMission: v }),
    setHasOpenedAnyBox: (v) => set({ hasOpenedAnyBox: v }),

    // Phase 19-05 (UX-08): tutorial overlay seen-flags.
    markTutorialSeen: (step) => {
      const s = get()
      const ts = s.tutorialState
      const next = { ...ts }
      if (step === 'first-box') next.seenFirstBox = true
      else if (step === 'first-serum') next.seenFirstSerum = true
      else if (step === 'first-feed') next.seenFirstFeed = true
      else if (step === 'first-stabilize') next.seenFirstStabilize = true
      set({ tutorialState: next })
    },

  }
}
