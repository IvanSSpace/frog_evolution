// Phase 28 Plan 28-03: pure quest engine.
//
// Side-effect-free helpers (modulo generateActiveQuestUuid's counter + Math.random)
// consumed by the cosmic slice + tested in isolation via vi.mock'd QUESTS fixture.
//
// Public API:
//   - activateQuestFromHook(input)      — cap-check + QUESTS lookup → ActiveQuest.
//   - checkActiveQuestsProgress(input)  — event-driven + polling progress evaluator.
//   - applyQuestReward(reward, rng?)    — reward → RewardApplicationDelta payload.
//   - isQuestComplete(quest, ctx)       — single-quest completion predicate.
//   - generateActiveQuestUuid(now)      — re-export of generateActiveQuestId.
//
// Pattern mirrors Phase 27 pendingEngine.ts:
//   - inputs are read-only snapshots,
//   - outputs are delta payloads (slice applies via atomic set()),
//   - DEV warnings via import.meta.env.DEV gate (tree-shaken from prod),
//   - defensive on unknown questId / activeQuestId (no-op rather than throw).
//
// Progress evaluation per QuestTarget.kind:
//   - serum_count       → +1 on box-opened with matching element; polled serumCounts.
//   - gold_amount       → polled goldAmount (clamped to target.value once complete).
//   - planets_visited   → +1 on planet-select (no dedup — same planet twice counts twice).
//   - missions_complete → +1 on ship-arrived.
//   - merge_to_level    → target.level on merge event reaching level OR discoveredLevels poll.
//   - merge_count       → +1 on merge:happened.
//   - raise_relationship→ event.newValue OR polled raceRelationships[target.raceId].
//
// Reward magnitudes are decided by Plan 28-02 quest config; engine just routes them.

import {
  QUESTS,
  ACTIVE_QUEST_CAP,
  generateActiveQuestId,
} from '../config/quests'
import type {
  ActiveQuest,
  QuestId,
  QuestReward,
  QuestTarget,
} from '../config/quests'
import type { RaceId } from '../config/races'
import type { Element } from '../../store/cosmic/types'
import { ELEMENTS } from '../../store/cosmic/types'

// ─── activateQuestFromHook ───────────────────────────────────────────────────

/**
 * Phase 28 Plan 28-03: activation input snapshot.
 *
 * `now` is injected (Date.now() in slice; fixed value in tests for determinism).
 * `currentActiveQuests` allows cap-check without re-reading store inside engine.
 */
export interface ActivationInput {
  questId: QuestId
  raceId: RaceId
  currentActiveQuests: readonly ActiveQuest[]
  now: number
}

/**
 * Phase 28 Plan 28-03: activation output.
 *
 *   - newActiveQuest === null + capReached === true  : cap is full;
 *     slice emits 'quests:cap-reached', does NOT push to activeQuests.
 *   - newActiveQuest === null + capReached === false : questId unknown
 *     (engine logged DEV warn); slice silently no-ops.
 *   - newActiveQuest != null + capReached === false  : success; slice pushes
 *     to activeQuests and emits 'quests:activated'.
 */
export interface ActivationOutput {
  newActiveQuest: ActiveQuest | null
  capReached: boolean
}

/**
 * Phase 28 Plan 28-03: build an ActiveQuest from a quest_hook accept.
 *
 * Cap check FIRST (no QUESTS read if we already know we'd reject), then lookup.
 * On unknown questId: log warn ONLY in DEV (production stays silent — engine treats
 * unknown ids as data drift, not a programming error). Mirror Phase 27 pattern of
 * defensive idempotency.
 */
export function activateQuestFromHook(
  input: ActivationInput,
): ActivationOutput {
  if (input.currentActiveQuests.length >= ACTIVE_QUEST_CAP) {
    return { newActiveQuest: null, capReached: true }
  }
  const cfg = QUESTS[input.questId]
  if (!cfg) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        `[questEngine] activateQuestFromHook: unknown questId="${input.questId}" (raceId="${input.raceId}")`,
      )
    }
    return { newActiveQuest: null, capReached: false }
  }
  const newActiveQuest: ActiveQuest = {
    id: generateActiveQuestId(input.now),
    questId: cfg.id,
    raceId: cfg.raceId,
    type: cfg.type,
    target: cfg.target,
    progress: 0,
    startedAt: input.now,
  }
  return { newActiveQuest, capReached: false }
}

// ─── checkActiveQuestsProgress ───────────────────────────────────────────────

/**
 * Phase 28 Plan 28-03: progress evaluation input.
 *
 * `event` is the event-bus signal that triggered this tick — null for polling
 * reconcile (boot / Quests tab mount / DEV helper). Polled fields (goldAmount,
 * discoveredLevels, raceRelationships, serumCounts) are checked regardless of
 * event — so cross-device sync that lands progress-relevant state without an
 * event still propagates to active quests on the next tick.
 */
export interface ProgressInput {
  activeQuests: readonly ActiveQuest[]
  serumCounts: Record<Element, number>
  goldAmount: number
  discoveredLevels: readonly number[]
  raceRelationships: Record<RaceId, number>
  event:
    | { kind: 'merge'; level: number }
    | { kind: 'box-opened'; element: Element }
    | { kind: 'planet-select'; planetId: string }
    | { kind: 'ship-arrived'; planetId: string }
    | { kind: 'relationship-delta'; raceId: RaceId; newValue: number }
    | null
}

/**
 * Phase 28 Plan 28-03: per-active-quest progress update.
 *
 * Emitted only for quests whose progress changed this tick. Slice keeps quests
 * NOT mentioned in progressDeltas at their previous progress value.
 */
export interface ProgressDelta {
  activeQuestId: string
  newProgress: number
}

/**
 * Phase 28 Plan 28-03: aggregate output of a progress check.
 *
 * `progressDeltas` carries updates the slice atomically maps onto activeQuests.
 * `completedQuestIds` lists quests that reached their target this tick — slice
 * applies their reward, moves them to completedQuests, and emits 'quests:completed'.
 *
 * NB: a quest may appear in BOTH lists (progressDelta + completedQuestId). Slice
 * treats completed as the dominant status; the progressDelta value is still useful
 * for telemetry / DEV inspection but the active row is removed from activeQuests.
 */
export interface ProgressOutput {
  progressDeltas: readonly ProgressDelta[]
  completedQuestIds: readonly string[]
}

/**
 * Phase 28 Plan 28-03: extract the numeric target value from a QuestTarget union.
 *
 *   - merge_to_level      → target.level
 *   - raise_relationship  → target.tier
 *   - all others          → target.value
 */
function extractTargetValue(target: QuestTarget): number {
  switch (target.kind) {
    case 'merge_to_level':
      return target.level
    case 'raise_relationship':
      return target.tier
    default:
      return target.value
  }
}

/**
 * Phase 28 Plan 28-03: compute the new progress for ONE active quest given a
 * progress input snapshot. Returns the new progress value (possibly equal to
 * the existing one — caller filters no-change deltas).
 *
 * Per-target-kind rules:
 *   - serum_count: +1 on matching box-opened event; otherwise carry existing.
 *     (Polling serumCounts intentionally NOT used here — that would let the
 *      engine retroactively bump progress for boxes opened before activation,
 *      which would surprise the player. The store snapshot is only consulted
 *      indirectly via the event stream.)
 *   - gold_amount: always min(goldAmount, target.value) — pure polling.
 *   - planets_visited: +1 on planet-select event.
 *   - missions_complete: +1 on ship-arrived event.
 *   - merge_to_level: if event.kind === 'merge' && event.level >= target.level
 *     OR discoveredLevels includes target.level → progress := target.level.
 *   - merge_count: +1 on merge event.
 *   - raise_relationship: event.newValue (if same raceId) OR polled
 *     raceRelationships[target.raceId].
 */
function computeProgressForQuest(
  quest: ActiveQuest,
  input: ProgressInput,
): number {
  const target = quest.target
  const event = input.event
  switch (target.kind) {
    case 'serum_count': {
      if (
        event &&
        event.kind === 'box-opened' &&
        event.element === target.element
      ) {
        return quest.progress + 1
      }
      return quest.progress
    }
    case 'gold_amount': {
      const polled = Math.max(0, Math.min(input.goldAmount, target.value))
      return polled > quest.progress ? polled : quest.progress
    }
    case 'planets_visited': {
      if (event && event.kind === 'planet-select') {
        return quest.progress + 1
      }
      return quest.progress
    }
    case 'missions_complete': {
      if (event && event.kind === 'ship-arrived') {
        return quest.progress + 1
      }
      return quest.progress
    }
    case 'merge_to_level': {
      if (event && event.kind === 'merge' && event.level >= target.level) {
        return target.level
      }
      if (input.discoveredLevels.includes(target.level)) {
        return target.level
      }
      return quest.progress
    }
    case 'merge_count': {
      if (event && event.kind === 'merge') {
        return quest.progress + 1
      }
      return quest.progress
    }
    case 'raise_relationship': {
      if (
        event &&
        event.kind === 'relationship-delta' &&
        event.raceId === target.raceId
      ) {
        return event.newValue
      }
      const polled = input.raceRelationships[target.raceId] ?? 0
      return polled > quest.progress ? polled : quest.progress
    }
    default: {
      // Exhaustive — TS narrows target above; this branch is unreachable.
      // Defensive in case a future variant is added without engine support.
      // Void-assignment satisfies `never` exhaustiveness without TS6133.
      void (target satisfies never)
      return quest.progress
    }
  }
}

/**
 * Phase 28 Plan 28-03: predicate for completion.
 *
 * Reads quest.progress against extractTargetValue(target). Single source of truth
 * for "is this quest done?" — used both by the engine and by external callers
 * (Plan 28-04 UI cap-counter, DEV __completeQuest helper).
 *
 * NB: progress is set TO the target value (not beyond) for level/tier kinds, so
 * `>= ` is the correct comparator.
 */
export function isQuestComplete(
  quest: ActiveQuest,
  // ctx kept for future quests that need cross-state — currently unused but exported
  // for symmetry with computeProgressForQuest signature. Tests pass a base ctx.
  _ctx: ProgressInput,
): boolean {
  const targetValue = extractTargetValue(quest.target)
  return quest.progress >= targetValue
}

/**
 * Phase 28 Plan 28-03: main progress entry — iterate activeQuests, compute new
 * progress per quest, partition into (changed-but-active, just-completed).
 *
 * Safety: linear in activeQuests (bounded by ACTIVE_QUEST_CAP=5). No iteration
 * over QUESTS catalogue; no recursion. Pure modulo no Math.random / no Date.
 */
export function checkActiveQuestsProgress(
  input: ProgressInput,
): ProgressOutput {
  if (input.activeQuests.length === 0) {
    return { progressDeltas: [], completedQuestIds: [] }
  }
  // Safety bound — analogous to pendingEngine.maxIter. Not strictly needed
  // (loop is O(activeQuests) ≤ 5), но guards against accidental recursive
  // changes to the loop body in future patches.
  const maxIter = 100
  if (input.activeQuests.length > maxIter) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        `[questEngine] activeQuests.length=${input.activeQuests.length} > maxIter=${maxIter} — truncating evaluation`,
      )
    }
  }

  const progressDeltas: ProgressDelta[] = []
  const completedQuestIds: string[] = []
  const slice = input.activeQuests.slice(0, maxIter)
  for (const q of slice) {
    const newProgress = computeProgressForQuest(q, input)
    if (newProgress !== q.progress) {
      progressDeltas.push({ activeQuestId: q.id, newProgress })
    }
    // Completion check uses the freshly-computed progress (not q.progress).
    const effective: ActiveQuest = { ...q, progress: newProgress }
    if (isQuestComplete(effective, input)) {
      completedQuestIds.push(q.id)
    }
  }
  return { progressDeltas, completedQuestIds }
}

// ─── applyQuestReward ────────────────────────────────────────────────────────

/**
 * Phase 28 Plan 28-03: reward payload for slice to apply atomically.
 *
 * Exactly ONE non-undefined main field per call (bonusId may co-exist with
 * relationshipDelta for relationship_and_bonus rewards). Slice routes:
 *   - serumDelta         → addSerum(element, count) per non-zero entry.
 *   - goldDelta          → root.addGold(value).
 *   - essenceDelta       → set({ essence: essence + delta }).
 *   - relationshipDelta  → applyDeltaClamp via raceRelationships set().
 *   - bonusId            → stored on completedQuest.rewardClaimed (Phase 29 wires
 *                          the actual bonus catalogue; here it's an opaque tag).
 */
export interface RewardApplicationDelta {
  serumDelta?: Partial<Record<Element, number>>
  goldDelta?: number
  essenceDelta?: number
  relationshipDelta?: { raceId: RaceId; delta: number }
  bonusId?: string
}

/**
 * Phase 28 Plan 28-03: resolve a QuestReward to a slice-applicable delta.
 *
 * `rng` defaults to Math.random — tests inject a deterministic generator for
 * 'serum'/'random' resolution. ELEMENTS array order is the canonical mapping
 * for rng(0..1) → element index.
 */
export function applyQuestReward(
  reward: QuestReward,
  rng: () => number = Math.random,
): RewardApplicationDelta {
  switch (reward.kind) {
    case 'essence':
      return { essenceDelta: reward.value }
    case 'gold':
      return { goldDelta: reward.value }
    case 'serum': {
      const element: Element =
        reward.element === 'random'
          ? ELEMENTS[
              Math.max(
                0,
                Math.min(
                  ELEMENTS.length - 1,
                  Math.floor(rng() * ELEMENTS.length),
                ),
              )
            ]
          : reward.element
      return { serumDelta: { [element]: reward.count } }
    }
    case 'relationship_and_bonus':
      return {
        relationshipDelta: { raceId: reward.raceId, delta: 1 },
        bonusId: reward.bonus_id,
      }
    default: {
      // Exhaustive — defensive in case a future variant is added.
      // Void-assignment satisfies `never` exhaustiveness without TS6133.
      void (reward satisfies never)
      return {}
    }
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Phase 28 Plan 28-03: re-export of generateActiveQuestId from config/quests.
 *
 * Re-exporting under the engine namespace lets the slice import a single module
 * (questEngine) for all activation needs — no direct config/quests imports
 * for id generation.
 */
export const generateActiveQuestUuid = generateActiveQuestId
