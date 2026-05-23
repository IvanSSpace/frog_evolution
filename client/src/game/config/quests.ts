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

// ─── Quest catalogue (filled — Plan 28-02) ───────────────────────────────────

/**
 * Phase 28 Plan 28-02: full quest catalogue (40 entries — one per quest_id
 * stub mined from raceChains.ts quest_hook items, 4 hooks per race × 10 races).
 *
 * Runtime lookup via QUESTS[questId] returns `undefined` for unknown ids; the
 * engine in Plan 28-03 must defensively handle this case (no-op activation +
 * `devWarn` log in dev builds; in prod silently skip the activation step but
 * still resolve the quest_hook as a plain dialog +1 relationship).
 *
 * Type/target/reward assignment table is from Plan 28-02 action block —
 * deterministic per quest_id (no judgment calls so the file stays reviewable).
 * Difficulty follows the suffix convention: no suffix = easy, _b = medium,
 * _c = hard. Reward magnitudes per Plan 28-02 placeholder scaling
 * (essence 1/3/5, serum 1/2/3, gold 10M/100M/500M).
 */
export const QUESTS: Record<QuestId, QuestConfig> = {
  // ─── crystalloids ──────────────────────────────────────────────────────────
  crystalloids_silent_scout: {
    id: 'crystalloids_silent_scout',
    raceId: 'crystalloids',
    type: 'exploration',
    target: { kind: 'planets_visited', value: 5 },
    reward: { kind: 'essence', value: 1 },
    description_key: 'quests.crystalloids_silent_scout.description',
    short_key: 'quests.crystalloids_silent_scout.short',
    difficulty: 'easy',
  },
  crystalloids_shard_delivery: {
    id: 'crystalloids_shard_delivery',
    raceId: 'crystalloids',
    type: 'delivery',
    target: { kind: 'serum_count', element: 'crystal', value: 5 },
    reward: { kind: 'gold', value: 10_000_000 },
    description_key: 'quests.crystalloids_shard_delivery.description',
    short_key: 'quests.crystalloids_shard_delivery.short',
    difficulty: 'easy',
  },
  crystalloids_lattice_survey_b: {
    id: 'crystalloids_lattice_survey_b',
    raceId: 'crystalloids',
    type: 'diplomacy',
    target: { kind: 'raise_relationship', raceId: 'crystalloids', tier: 6 },
    reward: {
      kind: 'relationship_and_bonus',
      raceId: 'crystalloids',
      bonus_id: 'gold_income_1pct',
    },
    description_key: 'quests.crystalloids_lattice_survey_b.description',
    short_key: 'quests.crystalloids_lattice_survey_b.short',
    difficulty: 'medium',
  },
  crystalloids_lattice_survey_c: {
    id: 'crystalloids_lattice_survey_c',
    raceId: 'crystalloids',
    type: 'merge',
    target: { kind: 'merge_to_level', level: 17 },
    reward: { kind: 'essence', value: 5 },
    description_key: 'quests.crystalloids_lattice_survey_c.description',
    short_key: 'quests.crystalloids_lattice_survey_c.short',
    difficulty: 'hard',
  },

  // ─── gasouls ───────────────────────────────────────────────────────────────
  gasouls_lost_note: {
    id: 'gasouls_lost_note',
    raceId: 'gasouls',
    type: 'delivery',
    target: { kind: 'serum_count', element: 'gas', value: 5 },
    reward: { kind: 'essence', value: 1 },
    description_key: 'quests.gasouls_lost_note.description',
    short_key: 'quests.gasouls_lost_note.short',
    difficulty: 'easy',
  },
  gasouls_sunken_resonator: {
    id: 'gasouls_sunken_resonator',
    raceId: 'gasouls',
    type: 'exploration',
    target: { kind: 'missions_complete', value: 3 },
    reward: { kind: 'serum', element: 'gas', count: 1 },
    description_key: 'quests.gasouls_sunken_resonator.description',
    short_key: 'quests.gasouls_sunken_resonator.short',
    difficulty: 'easy',
  },
  gasouls_silent_chorus_b: {
    id: 'gasouls_silent_chorus_b',
    raceId: 'gasouls',
    type: 'diplomacy',
    target: { kind: 'raise_relationship', raceId: 'gasouls', tier: 6 },
    reward: { kind: 'gold', value: 100_000_000 },
    description_key: 'quests.gasouls_silent_chorus_b.description',
    short_key: 'quests.gasouls_silent_chorus_b.short',
    difficulty: 'medium',
  },
  gasouls_silent_chorus_c: {
    id: 'gasouls_silent_chorus_c',
    raceId: 'gasouls',
    type: 'merge',
    target: { kind: 'merge_count', value: 200 },
    reward: { kind: 'essence', value: 5 },
    description_key: 'quests.gasouls_silent_chorus_c.description',
    short_key: 'quests.gasouls_silent_chorus_c.short',
    difficulty: 'hard',
  },

  // ─── mechanidons ───────────────────────────────────────────────────────────
  mechanidons_module_delivery: {
    id: 'mechanidons_module_delivery',
    raceId: 'mechanidons',
    type: 'delivery',
    target: { kind: 'serum_count', element: 'crystal', value: 5 },
    reward: { kind: 'essence', value: 1 },
    description_key: 'quests.mechanidons_module_delivery.description',
    short_key: 'quests.mechanidons_module_delivery.short',
    difficulty: 'easy',
  },
  mechanidons_diagnostics: {
    id: 'mechanidons_diagnostics',
    raceId: 'mechanidons',
    type: 'exploration',
    target: { kind: 'missions_complete', value: 3 },
    reward: { kind: 'gold', value: 10_000_000 },
    description_key: 'quests.mechanidons_diagnostics.description',
    short_key: 'quests.mechanidons_diagnostics.short',
    difficulty: 'easy',
  },
  mechanidons_audit_route_b: {
    id: 'mechanidons_audit_route_b',
    raceId: 'mechanidons',
    type: 'diplomacy',
    target: { kind: 'raise_relationship', raceId: 'mechanidons', tier: 6 },
    reward: {
      kind: 'relationship_and_bonus',
      raceId: 'mechanidons',
      bonus_id: 'ship_speed_1pct',
    },
    description_key: 'quests.mechanidons_audit_route_b.description',
    short_key: 'quests.mechanidons_audit_route_b.short',
    difficulty: 'medium',
  },
  mechanidons_audit_route_c: {
    id: 'mechanidons_audit_route_c',
    raceId: 'mechanidons',
    type: 'merge',
    target: { kind: 'merge_to_level', level: 17 },
    reward: { kind: 'gold', value: 500_000_000 },
    description_key: 'quests.mechanidons_audit_route_c.description',
    short_key: 'quests.mechanidons_audit_route_c.short',
    difficulty: 'hard',
  },

  // ─── fireworms ─────────────────────────────────────────────────────────────
  fireworms_runaway_acolyte: {
    id: 'fireworms_runaway_acolyte',
    raceId: 'fireworms',
    type: 'exploration',
    target: { kind: 'planets_visited', value: 5 },
    reward: { kind: 'serum', element: 'fire', count: 1 },
    description_key: 'quests.fireworms_runaway_acolyte.description',
    short_key: 'quests.fireworms_runaway_acolyte.short',
    difficulty: 'easy',
  },
  fireworms_shard_to_tenebrians: {
    id: 'fireworms_shard_to_tenebrians',
    raceId: 'fireworms',
    type: 'delivery',
    target: { kind: 'serum_count', element: 'fire', value: 5 },
    reward: { kind: 'gold', value: 10_000_000 },
    description_key: 'quests.fireworms_shard_to_tenebrians.description',
    short_key: 'quests.fireworms_shard_to_tenebrians.short',
    difficulty: 'easy',
  },
  fireworms_blood_oath_b: {
    id: 'fireworms_blood_oath_b',
    raceId: 'fireworms',
    type: 'merge',
    target: { kind: 'merge_count', value: 50 },
    reward: { kind: 'essence', value: 3 },
    description_key: 'quests.fireworms_blood_oath_b.description',
    short_key: 'quests.fireworms_blood_oath_b.short',
    difficulty: 'medium',
  },
  fireworms_blood_oath_c: {
    id: 'fireworms_blood_oath_c',
    raceId: 'fireworms',
    type: 'merge',
    target: { kind: 'merge_to_level', level: 17 },
    reward: {
      kind: 'relationship_and_bonus',
      raceId: 'fireworms',
      bonus_id: 'serum_drop_1pct',
    },
    description_key: 'quests.fireworms_blood_oath_c.description',
    short_key: 'quests.fireworms_blood_oath_c.short',
    difficulty: 'hard',
  },

  // ─── liquidoids ────────────────────────────────────────────────────────────
  liquidoids_caravan: {
    id: 'liquidoids_caravan',
    raceId: 'liquidoids',
    type: 'delivery',
    target: { kind: 'serum_count', element: 'water', value: 5 },
    reward: { kind: 'gold', value: 10_000_000 },
    description_key: 'quests.liquidoids_caravan.description',
    short_key: 'quests.liquidoids_caravan.short',
    difficulty: 'easy',
  },
  liquidoids_stolen_cargo: {
    id: 'liquidoids_stolen_cargo',
    raceId: 'liquidoids',
    type: 'delivery',
    target: { kind: 'gold_amount', value: 50_000_000 },
    reward: { kind: 'serum', element: 'water', count: 1 },
    description_key: 'quests.liquidoids_stolen_cargo.description',
    short_key: 'quests.liquidoids_stolen_cargo.short',
    difficulty: 'easy',
  },
  liquidoids_market_truce_b: {
    id: 'liquidoids_market_truce_b',
    raceId: 'liquidoids',
    type: 'diplomacy',
    target: { kind: 'raise_relationship', raceId: 'liquidoids', tier: 6 },
    reward: { kind: 'gold', value: 100_000_000 },
    description_key: 'quests.liquidoids_market_truce_b.description',
    short_key: 'quests.liquidoids_market_truce_b.short',
    difficulty: 'medium',
  },
  liquidoids_market_truce_c: {
    id: 'liquidoids_market_truce_c',
    raceId: 'liquidoids',
    type: 'diplomacy',
    target: { kind: 'raise_relationship', raceId: 'liquidoids', tier: 8 },
    reward: {
      kind: 'relationship_and_bonus',
      raceId: 'liquidoids',
      bonus_id: 'shop_discount_1pct',
    },
    description_key: 'quests.liquidoids_market_truce_c.description',
    short_key: 'quests.liquidoids_market_truce_c.short',
    difficulty: 'hard',
  },

  // ─── tenebrians ────────────────────────────────────────────────────────────
  tenebrians_hidden_gate: {
    id: 'tenebrians_hidden_gate',
    raceId: 'tenebrians',
    type: 'exploration',
    target: { kind: 'planets_visited', value: 5 },
    reward: { kind: 'essence', value: 1 },
    description_key: 'quests.tenebrians_hidden_gate.description',
    short_key: 'quests.tenebrians_hidden_gate.short',
    difficulty: 'easy',
  },
  tenebrians_last_shard: {
    id: 'tenebrians_last_shard',
    raceId: 'tenebrians',
    type: 'delivery',
    target: { kind: 'serum_count', element: 'toxic', value: 5 },
    reward: { kind: 'gold', value: 10_000_000 },
    description_key: 'quests.tenebrians_last_shard.description',
    short_key: 'quests.tenebrians_last_shard.short',
    difficulty: 'easy',
  },
  tenebrians_veil_walk_b: {
    id: 'tenebrians_veil_walk_b',
    raceId: 'tenebrians',
    type: 'exploration',
    target: { kind: 'planets_visited', value: 15 },
    reward: { kind: 'serum', element: 'toxic', count: 2 },
    description_key: 'quests.tenebrians_veil_walk_b.description',
    short_key: 'quests.tenebrians_veil_walk_b.short',
    difficulty: 'medium',
  },
  tenebrians_veil_walk_c: {
    id: 'tenebrians_veil_walk_c',
    raceId: 'tenebrians',
    type: 'exploration',
    target: { kind: 'planets_visited', value: 50 },
    reward: { kind: 'essence', value: 5 },
    description_key: 'quests.tenebrians_veil_walk_c.description',
    short_key: 'quests.tenebrians_veil_walk_c.short',
    difficulty: 'hard',
  },

  // ─── plasmaspirits ─────────────────────────────────────────────────────────
  plasmaspirits_lost_flock: {
    id: 'plasmaspirits_lost_flock',
    raceId: 'plasmaspirits',
    type: 'exploration',
    target: { kind: 'planets_visited', value: 5 },
    reward: { kind: 'serum', element: 'plasma', count: 1 },
    description_key: 'quests.plasmaspirits_lost_flock.description',
    short_key: 'quests.plasmaspirits_lost_flock.short',
    difficulty: 'easy',
  },
  plasmaspirits_outrun: {
    id: 'plasmaspirits_outrun',
    raceId: 'plasmaspirits',
    type: 'exploration',
    target: { kind: 'missions_complete', value: 3 },
    reward: { kind: 'gold', value: 10_000_000 },
    description_key: 'quests.plasmaspirits_outrun.description',
    short_key: 'quests.plasmaspirits_outrun.short',
    difficulty: 'easy',
  },
  plasmaspirits_storm_race_b: {
    id: 'plasmaspirits_storm_race_b',
    raceId: 'plasmaspirits',
    type: 'merge',
    target: { kind: 'merge_count', value: 50 },
    reward: { kind: 'serum', element: 'plasma', count: 2 },
    description_key: 'quests.plasmaspirits_storm_race_b.description',
    short_key: 'quests.plasmaspirits_storm_race_b.short',
    difficulty: 'medium',
  },
  plasmaspirits_storm_race_c: {
    id: 'plasmaspirits_storm_race_c',
    raceId: 'plasmaspirits',
    type: 'exploration',
    target: { kind: 'missions_complete', value: 30 },
    reward: { kind: 'essence', value: 5 },
    description_key: 'quests.plasmaspirits_storm_race_c.description',
    short_key: 'quests.plasmaspirits_storm_race_c.short',
    difficulty: 'hard',
  },

  // ─── forestcores ───────────────────────────────────────────────────────────
  forestcores_young_forest: {
    id: 'forestcores_young_forest',
    raceId: 'forestcores',
    type: 'merge',
    target: { kind: 'merge_count', value: 10 },
    reward: { kind: 'essence', value: 1 },
    description_key: 'quests.forestcores_young_forest.description',
    short_key: 'quests.forestcores_young_forest.short',
    difficulty: 'easy',
  },
  forestcores_spore_migration: {
    id: 'forestcores_spore_migration',
    raceId: 'forestcores',
    type: 'delivery',
    target: { kind: 'serum_count', element: 'forest', value: 5 },
    reward: { kind: 'serum', element: 'forest', count: 1 },
    description_key: 'quests.forestcores_spore_migration.description',
    short_key: 'quests.forestcores_spore_migration.short',
    difficulty: 'easy',
  },
  forestcores_root_bridge_b: {
    id: 'forestcores_root_bridge_b',
    raceId: 'forestcores',
    type: 'merge',
    target: { kind: 'merge_to_level', level: 13 },
    reward: { kind: 'essence', value: 3 },
    description_key: 'quests.forestcores_root_bridge_b.description',
    short_key: 'quests.forestcores_root_bridge_b.short',
    difficulty: 'medium',
  },
  forestcores_root_bridge_c: {
    id: 'forestcores_root_bridge_c',
    raceId: 'forestcores',
    type: 'diplomacy',
    target: { kind: 'raise_relationship', raceId: 'forestcores', tier: 8 },
    reward: {
      kind: 'relationship_and_bonus',
      raceId: 'forestcores',
      bonus_id: 'gold_income_1pct',
    },
    description_key: 'quests.forestcores_root_bridge_c.description',
    short_key: 'quests.forestcores_root_bridge_c.short',
    difficulty: 'hard',
  },

  // ─── timeweavers ───────────────────────────────────────────────────────────
  timeweavers_spiral_link: {
    id: 'timeweavers_spiral_link',
    raceId: 'timeweavers',
    type: 'merge',
    target: { kind: 'merge_to_level', level: 8 },
    reward: { kind: 'essence', value: 1 },
    description_key: 'quests.timeweavers_spiral_link.description',
    short_key: 'quests.timeweavers_spiral_link.short',
    difficulty: 'easy',
  },
  timeweavers_temporal_knot: {
    id: 'timeweavers_temporal_knot',
    raceId: 'timeweavers',
    type: 'merge',
    target: { kind: 'merge_count', value: 10 },
    reward: { kind: 'gold', value: 10_000_000 },
    description_key: 'quests.timeweavers_temporal_knot.description',
    short_key: 'quests.timeweavers_temporal_knot.short',
    difficulty: 'easy',
  },
  timeweavers_unspun_thread_b: {
    id: 'timeweavers_unspun_thread_b',
    raceId: 'timeweavers',
    type: 'merge',
    target: { kind: 'merge_to_level', level: 13 },
    reward: { kind: 'serum', element: 'binary', count: 2 },
    description_key: 'quests.timeweavers_unspun_thread_b.description',
    short_key: 'quests.timeweavers_unspun_thread_b.short',
    difficulty: 'medium',
  },
  timeweavers_unspun_thread_c: {
    id: 'timeweavers_unspun_thread_c',
    raceId: 'timeweavers',
    type: 'diplomacy',
    target: { kind: 'raise_relationship', raceId: 'timeweavers', tier: 8 },
    reward: { kind: 'essence', value: 5 },
    description_key: 'quests.timeweavers_unspun_thread_c.description',
    short_key: 'quests.timeweavers_unspun_thread_c.short',
    difficulty: 'hard',
  },

  // ─── cometfolk ─────────────────────────────────────────────────────────────
  cometfolk_young_comet: {
    id: 'cometfolk_young_comet',
    raceId: 'cometfolk',
    type: 'exploration',
    target: { kind: 'planets_visited', value: 5 },
    reward: { kind: 'serum', element: 'binary', count: 1 },
    description_key: 'quests.cometfolk_young_comet.description',
    short_key: 'quests.cometfolk_young_comet.short',
    difficulty: 'easy',
  },
  cometfolk_lost_crest: {
    id: 'cometfolk_lost_crest',
    raceId: 'cometfolk',
    type: 'exploration',
    target: { kind: 'missions_complete', value: 3 },
    reward: { kind: 'gold', value: 10_000_000 },
    description_key: 'quests.cometfolk_lost_crest.description',
    short_key: 'quests.cometfolk_lost_crest.short',
    difficulty: 'easy',
  },
  cometfolk_long_orbit_b: {
    id: 'cometfolk_long_orbit_b',
    raceId: 'cometfolk',
    type: 'exploration',
    target: { kind: 'planets_visited', value: 15 },
    reward: { kind: 'serum', element: 'binary', count: 2 },
    description_key: 'quests.cometfolk_long_orbit_b.description',
    short_key: 'quests.cometfolk_long_orbit_b.short',
    difficulty: 'medium',
  },
  cometfolk_long_orbit_c: {
    id: 'cometfolk_long_orbit_c',
    raceId: 'cometfolk',
    type: 'exploration',
    target: { kind: 'planets_visited', value: 50 },
    reward: {
      kind: 'relationship_and_bonus',
      raceId: 'cometfolk',
      bonus_id: 'ship_speed_1pct',
    },
    description_key: 'quests.cometfolk_long_orbit_c.description',
    short_key: 'quests.cometfolk_long_orbit_c.short',
    difficulty: 'hard',
  },
}
