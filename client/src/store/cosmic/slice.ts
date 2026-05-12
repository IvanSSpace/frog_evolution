// Cosmic Frogs System — Zustand slice factory.
// Phase 11: каркас + actions stubs. Реальная логика наполняется в Phase 14-19.
// Refactor: actions разбиты по доменам в ./slices/* (serum / box / carrier / ship).
// Этот файл — orchestrator: содержит public API (interface CosmicSliceActions),
// типы (CosmicState, SetFn, GetFn) и composition через spread.

import {
  type CosmicSlice,
  type CosmicTab,
  type Element,
  type Rarity,
  type BoxData,
  type CarrierData,
  type TutorialStepId,
  ELEMENTS,
  makeInitialCosmicSlice,
} from './types'
import { eventBus } from '../eventBus'
import type { FeedOutcome } from '../../utils/carrierEvolution'
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

// Actions — то, что наполняется в Phase 14-19. Здесь — placeholder stubs.
export interface CosmicSliceActions {
  // Serum actions (Phase 14)
  addSerum: (element: Element, rarity: Rarity, count?: number) => void
  removeSerum: (element: Element, rarity: Rarity, count?: number) => void

  // Phase 14: tap-to-select / drag selection mode (transient UI state).
  setSerumDragActive: (
    active: boolean,
    payload?: { element: Element; rarity: Rarity } | null,
  ) => void

  // Phase 14 / Phase 22: server-validated apply. Optimistic UI + rollback при сбое.
  // Decrement serum + addCarrier + clear selection — атомарно локально, затем
  // POST /game/cosmic/apply-serum для валидации (level matches rarity, serum в инвентаре, не carrier).
  applySerum: (
    frogId: string,
    element: Element,
    rarity: Rarity,
    level: number,
  ) => Promise<void>

  // Box actions (Phase 15)
  addBox: (params: {
    planetId: string
    planetName: string
    archetype: string
    element: Element
    bonusRarity?: 'rare' | 'epic' | 'legendary'
  }) => BoxData
  rollBoxRarity: (id: string) => { rarity: Rarity; element: Element } | null
  commitOpenedBox: (id: string, rarity: Rarity) => void
  removeBox: (id: string) => void

  /**
   * Phase 19-01 (BALANCE-01..07): unified box-open action.
   * Atomic transaction:
   *   1. find box; idempotent guard (opened/missing → no-op)
   *   2. rollRarity(pityCounters, bonusRarity) → rolled rarity
   *   3. updatePity(pityCounters, rolled) → newPity
   *   4. award serums[box.element][rolled] += 1
   *   5. mark box opened, set hasOpenedAnyBox sentinel (REQ UX-09 / tutorial first-box)
   *   6. eventBus.emit('cosmic:box-opened', { boxId, rarity, element })
   *
   * Используется для quick-open / debug. Cascade reveal flow (Phase 15)
   * по-прежнему использует rollBoxRarity → SerumSlotMachine → commitOpenedBox.
   * NOTE: openBox() *removes* box opened-flag pattern (sets opened=true, retains
   * box record), unlike commitOpenedBox() which removes box from inventory.
   */
  openBox: (id: string) => void

  // Carrier actions (Phase 17)
  addCarrier: (carrier: CarrierData) => void
  removeCarrier: (frogId: string) => void

  /**
   * Phase 17 (CARRIER-03/04, BALANCE-09): feed carrier — атомарно мутирует state и
   * returns FeedOutcome.
   * Pre-determines ceiling в первый feed (когда feedCount === 0 до increment).
   * Updates rollHistory, level, stabilized, feedCount; пишет bestiary bit
   * на success / stabilize.
   *
   * Returns null если carrier не найден.
   *
   * NOTE: НЕ удаляет sacrifice frog — caller (MainScene) сам removes.
   * NOTE: НЕ инициирует UI modal — MainScene слушает `cosmic:carrier-stabilized`
   * через eventBus и показывает Plan 17-04 modal.
   */
  feedCarrier: (carrierFrogId: string) => FeedOutcome | null

  /**
   * Phase 17 (CARRIER-10): merge two stabilized same-element same-level carriers
   * → 1 new carrier на level+1 с S-bucket guaranteed ceiling.
   * Caller (MainScene.performCarrierMerge) передаёт newFrogId — id уже-spawned
   * upgraded frog.
   *
   * Returns null если validation failed (any carrier missing, not stabilized,
   * different element/rarity, different level, same id).
   *
   * Side effects:
   *   - removeCarrier(a), removeCarrier(b)
   *   - addCarrier(new) с feedCount=0, stabilized=false, ceiling=S-bucket
   *   - setBestiaryBit(element, rarity, newLevel)
   */
  mergeCarriers: (
    aFrogId: string,
    bFrogId: string,
    newFrogId: string,
  ) => CarrierData | null

  /**
   * Phase 17 (CARRIER-11, UX-11): dispose carrier — 30% chance return 1 серум
   * того же (element, rarity). Carrier удаляется (frog stays as regular frog —
   * caller MainScene самостоятельно очищает overlay через subscribe).
   *
   * Returns { recovered: boolean } для UI feedback.
   */
  disposeCarrier: (carrierFrogId: string) => { recovered: boolean }

  /**
   * Phase 17 (CARRIER-12) + Phase 18 (BESTIARY-07): set bestiary bit для (element, rarity, level).
   * Idempotent: re-set unlocked bit → no state change → no event.
   * Phase 18: проверяет milestonesCrossed (10/24/96/576) и эмитит
   * 'cosmic:bestiary-milestone' event + grants reward (coins/serum/flag).
   */
  setBestiaryBit: (element: Element, rarity: Rarity, level: number) => void

  /** Phase 18 (REQ BESTIARY-07): toggle 576-cells milestone visual flag. */
  setFrogExclusiveUnlocked: (v: boolean) => void

  // Tab persistence (COSMIC-HUB-07) — UI хранит в sessionStorage; здесь mirror в store.
  setLastActiveTab: (tab: CosmicTab) => void

  // Crew (Phase 16)
  consumeMissionCredit: () => boolean // false если cap достигнут
  resetCrewIfNewDay: () => void

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

    // Phase 17 (CARRIER-12) + Phase 18 (BESTIARY-07): set bestiary bit + milestone trigger.
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
          // Random element для milestone-granted serum (REQ BESTIARY-07).
          const randElem = ELEMENTS[
            Math.floor(Math.random() * ELEMENTS.length)
          ] as Element
          const cur = nextSerums[randElem][reward.rarity]
          nextSerums = {
            ...nextSerums,
            [randElem]: { ...nextSerums[randElem], [reward.rarity]: cur + 1 },
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
