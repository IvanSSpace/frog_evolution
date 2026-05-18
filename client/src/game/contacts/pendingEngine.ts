// Phase 27 Plan 27-03: pure pending engine.
//
// pendingEngineTick is a deterministic, side-effect-free function (modulo uuid). Given
// the current cosmic-relevant state, returns the next state delta after pulling items:
//   - For each pullable race (firstContactsSeen + cosmosUnlocked + has remaining chain
//     items + not already in queue): pull RACE_CHAINS[raceId][chainProgress[raceId]].
//   - 'event' items auto-apply (delta to target relationship, chainProgress++,
//     push to eventToasts). NOT added to pendingItems.
//   - msg/dialog/quest_hook items: add to pendingItems with uuid. chainProgress NOT
//     advanced (slice resolveAccept/Refuse/Acknowledge actions advance after user input).
//   - Repeat until pendingItems.length === CHAIN_PENDING_CAP or no race is pullable.
//
// Pull selection: lowest chainProgress[raceId] first; tie-break alphabetical raceId.
//
// Pure helpers exported for slice + tests:
//   - applyDeltaClamp(value, delta) → integer in [RELATIONSHIP_MIN, RELATIONSHIP_MAX]
//   - generatePendingId(now) → uuid-like string (timestamp + counter + random;
//     persisted but never used as cross-machine identity)

import type { RaceId } from '../config/races'
import {
  RACE_CHAINS,
  CHAIN_PENDING_CAP,
  RELATIONSHIP_MIN,
  RELATIONSHIP_MAX,
  type ChainItem,
  type PendingItem,
} from '../config/raceChains'

/**
 * Phase 27 Plan 27-03: input snapshot for engine tick.
 * `now` is injected (Date.now() in slice; fixed value in tests for determinism).
 */
export interface EngineInput {
  raceRelationships: Record<RaceId, number>
  chainProgress: Record<RaceId, number>
  pendingItems: readonly PendingItem[]
  firstContactsSeen: Record<RaceId, boolean>
  cosmosUnlocked: boolean
  now: number
}

/**
 * Phase 27 Plan 27-03: payload emitted to subscribers when an 'event' ChainItem
 * auto-applies during a tick. Slice maps this to eventBus 'contacts:event-applied'.
 */
export interface EventToast {
  raceId: RaceId
  targetRaceId: RaceId
  delta: number
  textKey: string
}

/**
 * Phase 27 Plan 27-03: output of a single engine tick.
 * Caller (slice triggerPendingPull) diffs against current state and applies via set().
 */
export interface EngineOutput {
  nextRelationships: Record<RaceId, number>
  nextChainProgress: Record<RaceId, number>
  nextPendingItems: PendingItem[]
  eventToasts: EventToast[]
}

/**
 * Phase 27 Plan 27-03: clamp a relationship score after applying delta.
 * - Floors fractional intermediates (delta might be fractional, mvp guards against drift).
 * - Enforces [RELATIONSHIP_MIN, RELATIONSHIP_MAX] integer bounds.
 */
export function applyDeltaClamp(value: number, delta: number): number {
  return Math.max(
    RELATIONSHIP_MIN,
    Math.min(RELATIONSHIP_MAX, Math.floor(value + delta)),
  )
}

let _idCounter = 0
/**
 * Phase 27 Plan 27-03: stable-ish pending id generator.
 * Combines monotonic counter (avoids burst collisions in single tick) + timestamp +
 * random component. NOT cryptographically strong — only needs uniqueness within a
 * single device's pendingItems lifetime (max ~3 entries).
 */
export function generatePendingId(now: number): string {
  _idCounter = (_idCounter + 1) % 1_000_000
  return `pend-${now.toString(36)}-${_idCounter.toString(36)}-${Math.floor(
    Math.random() * 1e6,
  ).toString(36)}`
}

/**
 * Phase 27 Plan 27-03: main engine entry.
 * Pure (modulo generatePendingId's counter + Math.random). Repeats pull selection
 * until queue full or no pullable race remains.
 */
export function pendingEngineTick(input: EngineInput): EngineOutput {
  if (!input.cosmosUnlocked) {
    return {
      nextRelationships: input.raceRelationships,
      nextChainProgress: input.chainProgress,
      nextPendingItems: [...input.pendingItems],
      eventToasts: [],
    }
  }

  const relationships = { ...input.raceRelationships }
  const progress = { ...input.chainProgress }
  const pending: PendingItem[] = [...input.pendingItems]
  const toasts: EventToast[] = []
  const racesInQueue = new Set<RaceId>(pending.map((p) => p.raceId))

  // Safety bound: max iterations guards against unforeseen infinite loops if chain
  // data contains only events for many races (each iteration consumes one chain step
  // OR queues one pending item OR breaks). 100 covers cap=3 + 10 races × 10 events
  // worst-case + slack.
  const maxIter = 100
  let iter = 0

  while (pending.length < CHAIN_PENDING_CAP && iter < maxIter) {
    iter++
    const candidates: RaceId[] = []
    for (const raceId of Object.keys(progress) as RaceId[]) {
      if (!input.firstContactsSeen[raceId]) continue
      if (racesInQueue.has(raceId)) continue
      const chain = RACE_CHAINS[raceId]
      if (!chain || progress[raceId] >= chain.length) continue
      candidates.push(raceId)
    }
    if (candidates.length === 0) break

    candidates.sort((a, b) => {
      const diff = progress[a] - progress[b]
      if (diff !== 0) return diff
      return a < b ? -1 : a > b ? 1 : 0
    })
    const pickedRaceId = candidates[0]
    const step = progress[pickedRaceId]
    const item: ChainItem = RACE_CHAINS[pickedRaceId][step]

    if (item.type === 'event') {
      const targetRaceId: RaceId =
        item.target === 'self' ? pickedRaceId : item.target
      relationships[targetRaceId] = applyDeltaClamp(
        relationships[targetRaceId] ?? RELATIONSHIP_MIN,
        item.delta,
      )
      progress[pickedRaceId] = step + 1
      toasts.push({
        raceId: pickedRaceId,
        targetRaceId,
        delta: item.delta,
        textKey: item.text_key,
      })
    } else {
      pending.push({
        id: generatePendingId(input.now),
        raceId: pickedRaceId,
        chainStep: step,
        item,
        createdAt: input.now,
      })
      racesInQueue.add(pickedRaceId)
    }
  }

  return {
    nextRelationships: relationships,
    nextChainProgress: progress,
    nextPendingItems: pending,
    eventToasts: toasts,
  }
}
