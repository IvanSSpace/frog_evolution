// Phase 28 Plan 28-01: quest type surface + skeleton config record.
//
// Pure config (no runtime side-effects). Source of truth для quest data,
// state shape (ActiveQuest / CompletedQuest) и runtime constants
// (ACTIVE_QUEST_CAP / COMPLETED_QUEST_HISTORY_CAP).
//
// Pattern mirrors Phase 27 Plan 27-01 raceChains.ts foundation:
//   - discriminated unions (QuestTarget / QuestReward) — каждый variant
//     явно теgget'нут через `kind` literal; downstream switch'и получают
//     exhaustive narrowing.
//   - skeleton-then-fill split — Plan 28-02 fills 40 quest configurations
//     for raceChains quest_hook items; THIS plan ships empty record чтобы
//     foundation, state и persistence могли land без conflict с data PR.
//   - cap constants live в этом config файле (single import surface для
//     engine в Plan 28-03 и UI в Plan 28-04), не магические числа.
//
// Consumers:
//   - Plan 28-02: fills QUESTS record (40 entries one per quest_id stub).
//   - Plan 28-03: engine reads QUESTS[questId] при activation, использует
//     ACTIVE_QUEST_CAP для cap-check, генерит ActiveQuest через
//     generateActiveQuestId.
//   - Plan 28-04: QuestsTab UI читает activeQuests + QUESTS lookup для
//     description_key / short_key resolution + reward preview.
//   - Plan 28-05: reward popup reads CompletedQuest.rewardClaimed.

import type { RaceId } from './races'
import type { Element } from '../../store/cosmic/types'

/**
 * Phase 28 Plan 28-01: quest identifier alias.
 *
 * String alias (NOT a union of literals) — Plan 28-02 fills 40 entries via
 * `Record<QuestId, QuestConfig>` keyed on the same `quest_id` strings that
 * raceChains.ts quest_hook items reference. Using `string` here keeps the
 * foundation independent of chain content: the engine in Plan 28-03 will
 * defensively handle unknown ids (QUESTS[id] === undefined) instead of
 * relying on a compile-time exhaustive literal check.
 */
export type QuestId = string

/**
 * Phase 28 Plan 28-01: four quest categories (per 28-CONTEXT D-Quest types).
 *
 *   - 'delivery'    : 📦 deliver/accumulate resource (serum_count, gold_amount).
 *   - 'exploration' : 🔍 visit planets / complete ship missions.
 *   - 'merge'       : ⚡ reach merge milestone (level or count).
 *   - 'diplomacy'   : 🤝 raise relationship with a race to target tier.
 */
export type QuestType = 'delivery' | 'exploration' | 'merge' | 'diplomacy'

/**
 * Phase 28 Plan 28-01: discriminated union of 7 progress-target shapes.
 *
 * Each variant carries only the data the engine needs to evaluate progress
 * against the relevant eventBus event stream (Plan 28-03 wiring). Adding a
 * new target shape requires:
 *   1. extend this union with new `{ kind: '...'; ... }` literal,
 *   2. extend `knownTargets` table in persistence.loadCosmicSlice defensive
 *      load (kind allow-list),
 *   3. add engine handler in Plan 28-03 questEngine progress switch.
 */
export type QuestTarget =
  | { kind: 'serum_count'; element: Element; value: number }
  | { kind: 'gold_amount'; value: number }
  | { kind: 'planets_visited'; value: number }
  | { kind: 'missions_complete'; value: number }
  | { kind: 'merge_to_level'; level: number }
  | { kind: 'merge_count'; value: number }
  | { kind: 'raise_relationship'; raceId: RaceId; tier: number }

/**
 * Phase 28 Plan 28-01: four reward shapes (per 28-CONTEXT D-Reward magnitudes).
 *
 * 'serum' with `element: 'random'` resolves to a random Element при apply
 * time (engine in Plan 28-03 picks via RNG). 'relationship_and_bonus'
 * carries opaque `bonus_id` for Plan 28-05 lookup table (bonus catalogue
 * defined in a future plan, not here).
 */
export type QuestReward =
  | { kind: 'essence'; value: number }
  | { kind: 'serum'; element: Element | 'random'; count: number }
  | { kind: 'gold'; value: number }
  | { kind: 'relationship_and_bonus'; raceId: RaceId; bonus_id: string }

/**
 * Phase 28 Plan 28-01: static quest configuration entry.
 *
 * Stored in QUESTS record (filled in Plan 28-02). Resolved at quest
 * activation: engine reads QUESTS[questId] from the quest_hook item's
 * `quest_id` field, then constructs an ActiveQuest using QuestConfig.target.
 */
export interface QuestConfig {
  /** Matches quest_id stub from raceChains.ts quest_hook item. */
  id: QuestId
  /** Race owning the quest (relationship penalty target on cancel). */
  raceId: RaceId
  type: QuestType
  target: QuestTarget
  reward: QuestReward
  /** i18n key for full description, e.g. 'quests.crystalloids_silent_scout.description'. */
  description_key: string
  /** i18n key for short card label. */
  short_key: string
  /** Difficulty tier — informational; maps to suffix (base=easy, _b=medium, _c=hard). */
  difficulty: 'easy' | 'medium' | 'hard'
}

/**
 * Phase 28 Plan 28-01: live quest entry stored in cosmic state.
 *
 * `id` — unique runtime id (uuid via generateActiveQuestId). Used as React key
 * + persistence anchor. Uniqueness scope = activeQuests array (max 5 entries).
 *
 * `questId` is the foreign key into QUESTS — engine treats activeQuest as
 * a snapshot of (type/target) at activation time so that future QuestConfig
 * edits don't retroactively change a player's in-flight quest.
 *
 * `progress` is a non-negative integer (engine increments, defensive load
 * floors fractional / clamps to ≥ 0). `startedAt` — unix ms.
 */
export interface ActiveQuest {
  id: string
  questId: QuestId
  raceId: RaceId
  type: QuestType
  target: QuestTarget
  progress: number
  startedAt: number
}

/**
 * Phase 28 Plan 28-01: history entry for a completed quest.
 *
 * `rewardClaimed` is the actual QuestReward that was applied (engine resolves
 * `serum.element === 'random'` at completion time and stores the concrete
 * Element here — so UI in Plan 28-04 can show "you received +2 fire serum"
 * not "you received +2 random serum").
 */
export interface CompletedQuest {
  id: string
  questId: QuestId
  raceId: RaceId
  completedAt: number
  rewardClaimed: QuestReward
}

// ─── Runtime caps ────────────────────────────────────────────────────────────

/**
 * Phase 28 Plan 28-01: global cap on activeQuests array length.
 *
 * Enforced engine-side в Plan 28-03 activateQuestFromHook (NOT enforced by
 * type shape — mirrors CHAIN_PENDING_CAP=3 pattern in raceChains.ts so cap
 * can be raised in a future plan without a defensive-load migration).
 *
 * At cap: new quest_hook items resolve as plain dialog (+1 relationship,
 * no quest pushed); UI shows toast "Лимит активных квестов".
 */
export const ACTIVE_QUEST_CAP = 5 as const

/**
 * Phase 28 Plan 28-01: cap on completedQuests history (FIFO trim).
 *
 * Defensive load в persistence.loadCosmicSlice sorts completedQuests by
 * completedAt desc and keeps the 100 newest entries. UI in Plan 28-04
 * shows the full list (collapsed by default), no separate pagination.
 */
export const COMPLETED_QUEST_HISTORY_CAP = 100 as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Phase 28 Plan 28-01: collision-safe runtime id generator for ActiveQuest.id.
 *
 * Mirrors `generatePendingId` pattern in Phase 27 pendingEngine.ts:
 *   - monotonic module-scope counter (resilient against same-millisecond
 *     activations within one process),
 *   - `now` timestamp prefix for human-readable ordering when inspecting
 *     persisted state,
 *   - random suffix for cross-instance collision (unlikely but cheap).
 *
 * Uniqueness scope is single-device, single-process — activeQuests has cap 5
 * so true UUID overhead would be wasted. Format: `aq-<now>-<counter>-<rnd>`.
 */
let __activeQuestIdCounter = 0
export function generateActiveQuestId(now: number): string {
  __activeQuestIdCounter = (__activeQuestIdCounter + 1) | 0
  const rnd = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')
  return `aq-${now}-${__activeQuestIdCounter}-${rnd}`
}

// ─── Quest catalogue (skeleton) ──────────────────────────────────────────────

/**
 * Phase 28 Plan 28-01: empty quest skeleton record.
 *
 * Plan 28-02 fills 40 entries — one per quest_id stub mined from raceChains.ts
 * quest_hook items (4 quest_hooks per race × 10 races). Runtime lookup via
 * QUESTS[questId] returns `undefined` for unknown ids; the engine in Plan
 * 28-03 must defensively handle this case (no-op activation + `devWarn` log
 * in dev builds; in prod silently skip the activation step but still resolve
 * the quest_hook as a plain dialog +1 relationship).
 *
 * Empty record is intentional — keeps Plan 28-01 foundation atomic so Plan
 * 28-02 (data) and Plan 28-03 (engine) can land in parallel waves without
 * touching the same TS file.
 */
export const QUESTS: Record<QuestId, QuestConfig> = {}
