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
import type { RaceId } from '../../game/config/races'
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
// Phase 27 Plan 27-03: pending engine + clamp helper.
import {
  pendingEngineTick,
  applyDeltaClamp,
} from '../../game/contacts/pendingEngine'
// Phase 28 Plan 28-03: quest engine helpers + quest config (cap + reward lookup).
import {
  activateQuestFromHook as engineActivate,
  checkActiveQuestsProgress,
  applyQuestReward,
} from '../../game/quests/questEngine'
import { QUESTS, COMPLETED_QUEST_HISTORY_CAP } from '../../game/config/quests'
import type {
  ActiveQuest,
  CompletedQuest,
  QuestId,
  QuestReward,
} from '../../game/config/quests'

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

  /**
   * Phase 22 Plan 22-05: cosmic shop purchase.
   * Atomically: cost guard → currency decrement → shopPurchaseCounts++ → apply effect.
   * Returns true on success, false on guard failure (insufficient currency / invalid opts).
   * Idempotent — повторный успешный call увеличивает counter (scaling cost).
   */
  purchaseShopItem: (itemId: ShopItemId, opts?: PurchaseShopItemOpts) => boolean

  /**
   * Phase 26 Plan 26-01: mark per-race first contact seen.
   * - Idempotent: re-call с already-seen race → no state change, no event.
   * - Persisted automatically через cosmic blob (subscribe → saveCosmicSlice).
   * - Subscriber pattern (Plan 26-05 FirstContactController): эмитит cinematic
   *   через eventBus 'cosmos:first-contact' ДО mark, чтобы race-name'ы успели
   *   resolve'нуться в UI до того как state-change ре-рендерит.
   */
  markFirstContactSeen: (raceId: RaceId) => void

  /**
   * Phase 27 Plan 27-03: resolve a pending dialog/quest_hook with «Поддержать» (accept).
   * Looks up pendingItems[i] by pendingId. No-op (idempotent) if not found.
   * Applies item.accept_delta to raceRelationships[raceId] (clamped [1,10]).
   * Advances chainProgress[raceId]++. Pops the item from pendingItems.
   * Emits 'contacts:relationship-delta' if relationship value changed.
   * Calls triggerPendingPull internally to refill queue + apply any pending events.
   */
  resolveAccept: (pendingId: string) => void

  /** Phase 27 Plan 27-03: mirror of resolveAccept with item.refuse_delta. */
  resolveRefuse: (pendingId: string) => void

  /**
   * Phase 27 Plan 27-03: resolve a pending msg ChainItem with «Понятно».
   * No delta change — pops item, advances chainProgress, triggers next pull.
   * No-op if pendingId not found.
   */
  resolveAcknowledge: (pendingId: string) => void

  /**
   * Phase 27 Plan 27-03: trigger an engine tick — pulls next ChainItems until queue full
   * OR no pullable race. Auto-applies any 'event' items encountered. Called automatically
   * by resolve actions; can be invoked externally after firstContactsSeen / cosmosUnlocked
   * transitions (UI components subscribe to those flags and call this).
   */
  triggerPendingPull: () => void

  /**
   * Phase 28 Plan 28-03: activate a quest from accepted quest_hook ChainItem.
   * Calls engine.activateQuestFromHook(currentActiveQuests, questId, raceId).
   *   - cap reached  → no push, emit 'quests:cap-reached', return.
   *   - unknown id   → engine logs DEV warn, no push, no event, return.
   *   - otherwise    → push to activeQuests + emit 'quests:activated'.
   * Idempotent on unknown id (engine handles defensively).
   */
  activateQuestFromHook: (questId: QuestId, raceId: RaceId) => void

  /**
   * Phase 28 Plan 28-03: cancel an active quest by id.
   * Idempotent on unknown activeQuestId. Applies -1 relationship penalty to
   * quest.raceId (clamped [1,10] via applyDeltaClamp). Emits
   * 'contacts:relationship-delta' if value changed + 'quests:cancelled'.
   */
  cancelQuest: (activeQuestId: string) => void

  /**
   * Phase 28 Plan 28-03: event-driven progress check.
   * Called by Plan 28-03 questController eventBus subscriptions. Engine returns
   * deltas + completed ids; slice atomically applies (progress updates + reward
   * deltas + move to completedQuests) and emits 'quests:completed' per quest.
   * event === null means polling reconcile (used by reconcileQuestProgress).
   */
  markQuestProgress: (
    event:
      | { kind: 'merge'; level: number }
      | { kind: 'box-opened'; element: Element }
      | { kind: 'planet-select'; planetId: string }
      | { kind: 'ship-arrived'; planetId: string }
      | { kind: 'relationship-delta'; raceId: RaceId; newValue: number }
      | null,
  ) => void

  /**
   * Phase 28 Plan 28-03: full polling reconcile (no event).
   * Used at boot + Quests tab mount + DEV __progressQuest helper. Engine receives
   * event:null and snapshots current state for polled targets (gold_amount,
   * raise_relationship, merge_to_level via discoveredLevels).
   */
  reconcileQuestProgress: () => void
}

export type CosmicState = CosmicSlice & CosmicSliceActions

// Минимальный set/get типизированный против CosmicState.
// gameStore оборачивает createCosmicSlice; spread выдаёт партиал, совместимый с GameState.
// Экспортируются для использования в sub-slice фабриках (./slices/*).
export type SetFn = (partial: Partial<CosmicState>) => void
export type GetFn = () => CosmicState

export function createCosmicSlice(set: SetFn, get: GetFn): CosmicState {
  const initial = makeInitialCosmicSlice()

  // Phase 27 Plan 27-03: shared resolve handler. `mode` chooses delta source.
  // - 'accept' / 'refuse' use item.accept_delta / item.refuse_delta (dialog + quest_hook).
  // - 'acknowledge' is delta=0 (msg). No relationship change → no delta event emitted.
  // Idempotency: unknown pendingId is a no-op (handles double-tap, stale UI snapshots).
  // Atomic: ONE set() call mutates raceRelationships + chainProgress + pendingItems.
  // Trailing triggerPendingPull() refills queue + applies any 'event' items now eligible.
  const _resolveInternal = (
    pendingId: string,
    mode: 'accept' | 'refuse' | 'acknowledge',
  ) => {
    const s = get()
    const idx = s.pendingItems.findIndex((p) => p.id === pendingId)
    if (idx < 0) return // idempotent — unknown id is no-op

    const pending = s.pendingItems[idx]
    const item = pending.item
    let delta = 0
    if (mode === 'acknowledge') {
      delta = 0 // msg ack — no delta
    } else if (item.type === 'dialog' || item.type === 'quest_hook') {
      delta = mode === 'accept' ? item.accept_delta : item.refuse_delta
    } else {
      delta = 0 // defensive: msg/event reached resolve with accept/refuse mode — treat as 0
    }

    const oldValue = s.raceRelationships[pending.raceId] ?? 1
    const newValue = applyDeltaClamp(oldValue, delta)
    const newRelationships = {
      ...s.raceRelationships,
      [pending.raceId]: newValue,
    }
    const newProgress = {
      ...s.chainProgress,
      [pending.raceId]: (s.chainProgress[pending.raceId] ?? 0) + 1,
    }
    const newPending = [
      ...s.pendingItems.slice(0, idx),
      ...s.pendingItems.slice(idx + 1),
    ]

    set({
      raceRelationships: newRelationships,
      chainProgress: newProgress,
      pendingItems: newPending,
    })

    if (oldValue !== newValue) {
      eventBus.emit('contacts:relationship-delta', {
        raceId: pending.raceId,
        oldValue,
        newValue,
        delta,
      })
    }

    // Phase 28 Plan 28-03: wire quest_hook accept → quest activation.
    // Engine handles cap + unknown questId defensively (no-op + DEV warn).
    // Relationship +1 already applied above, so even at-cap quests still gain the
    // social credit (matches CONTEXT D-Quest activation cap path).
    if (mode === 'accept' && item.type === 'quest_hook') {
      get().activateQuestFromHook(item.quest_id, pending.raceId)
    }

    get().triggerPendingPull()
  }

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

    // Phase 26 Plan 26-01: idempotent per-race first contact mark.
    // Idempotency guard ДО set() — no extra render / no extra persist write
    // если флаг уже true (replay-safe, повторные visit'ы no-op).
    markFirstContactSeen: (raceId: RaceId) => {
      const s = get()
      if (s.firstContactsSeen[raceId] === true) return
      set({
        firstContactsSeen: { ...s.firstContactsSeen, [raceId]: true },
      })
      // Persistence: cosmic blob auto-saves через subscribe в gameStore.ts.
      // Server-sync: gameSync.ts pickup'ит изменение в standard cosmic JSON.
      // НЕ эмитим event здесь — cinematic trigger живёт в Plan 26-05 controller'е
      // (там event'ит ДО mark, чтобы UI получил pre-mark snapshot для display).
    },

    // Phase 27 Plan 27-03: pending resolution + engine entry points.
    resolveAccept: (pendingId: string) => _resolveInternal(pendingId, 'accept'),
    resolveRefuse: (pendingId: string) => _resolveInternal(pendingId, 'refuse'),
    resolveAcknowledge: (pendingId: string) =>
      _resolveInternal(pendingId, 'acknowledge'),

    // Engine tick. Reads cosmosUnlocked from the root gameStore (composit slice —
    // narrow cast through get() chain). Computes engine output, applies delta atomically
    // via single set(), then emits contacts:event-applied for any auto-applied events
    // and contacts:relationship-delta for changed relationships.
    triggerPendingPull: () => {
      const s = get()
      // cosmosUnlocked lives top-level on gameStore (composit). Narrow cast.
      const root = get() as unknown as { hasCosmosUnlocked?: boolean }
      const cosmosUnlocked = root.hasCosmosUnlocked === true

      const result = pendingEngineTick({
        raceRelationships: s.raceRelationships,
        chainProgress: s.chainProgress,
        pendingItems: s.pendingItems,
        firstContactsSeen: s.firstContactsSeen,
        cosmosUnlocked,
        now: Date.now(),
      })

      // Compute relationship deltas for event emission (one event per changed race).
      const relationshipDeltas: Array<{
        raceId: string
        oldValue: number
        newValue: number
        delta: number
      }> = []
      for (const raceId of Object.keys(result.nextRelationships) as RaceId[]) {
        const oldV = s.raceRelationships[raceId] ?? 1
        const newV = result.nextRelationships[raceId]
        if (oldV !== newV) {
          relationshipDeltas.push({
            raceId,
            oldValue: oldV,
            newValue: newV,
            delta: newV - oldV,
          })
        }
      }

      const hasNewItems =
        result.nextPendingItems.length !== s.pendingItems.length
      const hasNewProgress = Object.keys(result.nextChainProgress).some(
        (k) =>
          result.nextChainProgress[k as RaceId] !==
          s.chainProgress[k as RaceId],
      )

      // Skip set() if engine produced no observable change (e.g. cosmosUnlocked=false,
      // or no race pullable). Avoid spurious re-renders / persistence writes.
      if (relationshipDeltas.length > 0 || hasNewItems || hasNewProgress) {
        set({
          raceRelationships: result.nextRelationships,
          chainProgress: result.nextChainProgress,
          pendingItems: result.nextPendingItems,
        })
      }

      for (const toast of result.eventToasts) {
        eventBus.emit('contacts:event-applied', {
          raceId: toast.raceId,
          targetRaceId: toast.targetRaceId,
          delta: toast.delta,
          textKey: toast.textKey,
        })
      }
      for (const rd of relationshipDeltas) {
        eventBus.emit('contacts:relationship-delta', rd)
      }
    },

    // ─── Phase 28 Plan 28-03: quest activation / cancel / progress / reconcile ──
    //
    // Quest engine wrappers: each action calls a pure engine helper, then applies
    // the resulting delta atomically via one set() call, then emits eventBus events
    // OUTSIDE set() (mirror Phase 27 pattern — keeps subscribers from racing the
    // store mutation).

    activateQuestFromHook: (questId, raceId) => {
      const s = get()
      const result = engineActivate({
        questId,
        raceId,
        currentActiveQuests: s.activeQuests,
        now: Date.now(),
      })
      if (result.capReached) {
        eventBus.emit('quests:cap-reached', { questId, raceId })
        return
      }
      if (!result.newActiveQuest) return // unknown questId — engine logged in DEV
      const newActive = result.newActiveQuest
      set({ activeQuests: [...s.activeQuests, newActive] })
      eventBus.emit('quests:activated', {
        questId,
        raceId,
        activeQuestId: newActive.id,
      })
    },

    cancelQuest: (activeQuestId) => {
      const s = get()
      const idx = s.activeQuests.findIndex((q) => q.id === activeQuestId)
      if (idx < 0) return // idempotent — unknown id is no-op
      const quest = s.activeQuests[idx]
      const oldValue = s.raceRelationships[quest.raceId] ?? 1
      const newValue = applyDeltaClamp(oldValue, -1)
      const newActive = [
        ...s.activeQuests.slice(0, idx),
        ...s.activeQuests.slice(idx + 1),
      ]
      const newRelationships =
        oldValue !== newValue
          ? { ...s.raceRelationships, [quest.raceId]: newValue }
          : s.raceRelationships
      set({
        activeQuests: newActive,
        raceRelationships: newRelationships,
      })
      if (oldValue !== newValue) {
        eventBus.emit('contacts:relationship-delta', {
          raceId: quest.raceId,
          oldValue,
          newValue,
          delta: -1,
        })
      }
      eventBus.emit('quests:cancelled', {
        questId: quest.questId,
        raceId: quest.raceId,
        activeQuestId,
      })
    },

    markQuestProgress: (event) => {
      const s = get()
      if (s.activeQuests.length === 0) return // fast-path no-op

      // root snapshot for polled targets: gold (from gameStore) +
      // discoveredLevels (also gameStore root) + addGold dispatcher.
      const root = get() as unknown as {
        gold?: number
        discoveredLevels?: readonly number[]
        addGold?: (n: number) => void
      }
      const progressInput = {
        activeQuests: s.activeQuests,
        serumCounts: s.serums,
        goldAmount: typeof root.gold === 'number' ? root.gold : 0,
        discoveredLevels: Array.isArray(root.discoveredLevels)
          ? root.discoveredLevels
          : [],
        raceRelationships: s.raceRelationships,
        event,
      }
      const output = checkActiveQuestsProgress(progressInput)
      if (
        output.progressDeltas.length === 0 &&
        output.completedQuestIds.length === 0
      ) {
        return
      }

      const progressMap = new Map(
        output.progressDeltas.map((d) => [d.activeQuestId, d.newProgress]),
      )
      const completedSet = new Set(output.completedQuestIds)

      // Partition activeQuests into (still-active with possibly-bumped progress)
      // vs (newly-completed → applies reward + moves to completedQuests).
      const stillActive: ActiveQuest[] = []
      const newlyCompleted: Array<{
        quest: ActiveQuest
        reward: QuestReward
        rewardDelta: ReturnType<typeof applyQuestReward>
      }> = []
      for (const q of s.activeQuests) {
        const updatedProgress = progressMap.has(q.id)
          ? (progressMap.get(q.id) as number)
          : q.progress
        const updated = { ...q, progress: updatedProgress }
        if (completedSet.has(q.id)) {
          const cfg = QUESTS[q.questId]
          if (cfg) {
            newlyCompleted.push({
              quest: updated,
              reward: cfg.reward,
              rewardDelta: applyQuestReward(cfg.reward),
            })
          } else {
            // Defensive: QUESTS[questId] vanished between activation and
            // completion (data migration drift). Keep quest active so future
            // ticks may reconcile, rather than silently dropping it.
            stillActive.push(updated)
          }
        } else {
          stillActive.push(updated)
        }
      }

      // Aggregate reward deltas + collect relationship emission payloads.
      let newSerums = s.serums
      let newEssence = s.essence
      let newRelationships = s.raceRelationships
      const relationshipEmits: Array<{
        raceId: string
        oldValue: number
        newValue: number
        delta: number
      }> = []
      let goldToAdd = 0
      for (const c of newlyCompleted) {
        const d = c.rewardDelta
        if (d.serumDelta) {
          // Clone serums on first write to avoid mutating snapshot.
          newSerums = { ...newSerums }
          for (const el of Object.keys(d.serumDelta) as Element[]) {
            newSerums[el] = (newSerums[el] ?? 0) + (d.serumDelta[el] ?? 0)
          }
        }
        if (typeof d.essenceDelta === 'number') {
          newEssence = newEssence + d.essenceDelta
        }
        if (typeof d.goldDelta === 'number') {
          goldToAdd += d.goldDelta
        }
        if (d.relationshipDelta) {
          const rid = d.relationshipDelta.raceId
          const oldV = newRelationships[rid] ?? 1
          const newV = applyDeltaClamp(oldV, d.relationshipDelta.delta)
          if (oldV !== newV) {
            newRelationships = { ...newRelationships, [rid]: newV }
            relationshipEmits.push({
              raceId: rid,
              oldValue: oldV,
              newValue: newV,
              delta: d.relationshipDelta.delta,
            })
          }
        }
      }

      // Append newly-completed to completedQuests history, trim to cap (FIFO).
      const newCompletedEntries: CompletedQuest[] = newlyCompleted.map((c) => ({
        id: c.quest.id,
        questId: c.quest.questId,
        raceId: c.quest.raceId,
        completedAt: Date.now(),
        rewardClaimed: c.reward,
      }))
      const newCompleted = [...newCompletedEntries, ...s.completedQuests].slice(
        0,
        COMPLETED_QUEST_HISTORY_CAP,
      )

      set({
        activeQuests: stillActive,
        completedQuests: newCompleted,
        serums: newSerums,
        essence: newEssence,
        raceRelationships: newRelationships,
      })

      // Gold reward goes via root.addGold (Phase 1 multiplier path).
      if (goldToAdd > 0 && typeof root.addGold === 'function') {
        root.addGold(goldToAdd)
      }

      // Emit relationship + completion events AFTER set() — keeps subscribers
      // reading fresh state.
      for (const rd of relationshipEmits) {
        eventBus.emit('contacts:relationship-delta', rd)
      }
      for (const c of newlyCompleted) {
        eventBus.emit('quests:completed', {
          questId: c.quest.questId,
          raceId: c.quest.raceId,
          activeQuestId: c.quest.id,
          reward: c.reward,
        })
      }
    },

    reconcileQuestProgress: () => {
      get().markQuestProgress(null)
    },
  }
}
