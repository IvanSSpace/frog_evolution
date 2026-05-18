// Phase 27 Plan 27-01: race chain config + pending engine types + relationship constants.
//
// ChainItem discriminated union models per-race linear message progression. RACE_CHAINS is
// built as Record<RaceId, readonly ChainItem[]>; this file ships SKELETON (empty arrays).
// Plan 27-02 fills each race's array with ~10 hybrid scripted+templated items.
//
// Relationship system: 1-10 integer scale, 5 tiers, initial value INITIAL_RELATIONSHIP=2
// (low threshold per CONTEXT — все стартуют с подозрения). getRelationshipTier() clamps
// input to [1, 10] before tier mapping.
//
// No runtime side-effects. Pure config + helpers. Consumed by:
//   - 27-02 (chain data fill)
//   - 27-03 (pending engine pulls from RACE_CHAINS[raceId][chainProgress])
//   - 27-04 (UI reads tier label + tier color via getRelationshipTier + TIER_COLORS)

import type { RaceId } from './races'

/**
 * Phase 27 Plan 27-01: discriminated union для одного звена цепочки расы.
 *
 * Variants:
 *   - 'msg'       : read-only текст, кнопка «Понятно» (без delta).
 *   - 'dialog'    : 2 кнопки «Поддержать» / «Отказать», каждая с delta.
 *   - 'quest_hook': 2 кнопки (как dialog) + quest_id stub для Phase 28 wiring.
 *   - 'event'     : auto-applied при queue pull (toast notification, не показывается в inbox).
 *
 * `text_key` — i18n key. `target: RaceId | 'self'` для event'ов: 'self' = same race as chain owner.
 */
export type ChainItem =
  | { type: 'msg'; text_key: string }
  | {
      type: 'dialog'
      text_key: string
      accept_delta: number
      refuse_delta: number
    }
  | {
      type: 'quest_hook'
      text_key: string
      quest_id: string
      accept_delta: number
      refuse_delta: number
    }
  | { type: 'event'; target: RaceId | 'self'; delta: number; text_key: string }

/**
 * Phase 27 Plan 27-01: один pending элемент в глобальной очереди.
 *
 * Cap CHAIN_PENDING_CAP=3 enforced engine'ом (Plan 27-03), не структурой типа.
 * `id` — uuid для React key + persistence. `createdAt` — unix ms для ordering.
 */
export interface PendingItem {
  id: string
  raceId: RaceId
  chainStep: number
  item: ChainItem
  createdAt: number
}

// ─── Relationship constants ──────────────────────────────────────────────────

/**
 * Phase 27 Plan 27-01: per-race relationship score границы.
 * Integer scale [1, 10]. Initial = 2 (низкий порог по CONTEXT D-Relationship system).
 */
export const RELATIONSHIP_MIN = 1 as const
export const RELATIONSHIP_MAX = 10 as const
export const INITIAL_RELATIONSHIP = 2 as const

/**
 * Phase 27 Plan 27-01: глобальный cap на pending очередь (см. D-Pending engine).
 * Enforced engine'ом в Plan 27-03 (pull-rule: while pendingItems.length < CAP).
 */
export const CHAIN_PENDING_CAP = 3 as const

// ─── Tier mapping ────────────────────────────────────────────────────────────

/**
 * Phase 27 Plan 27-01: 5 tiers (от враждебности до союзничества).
 * Маппинг score → tier:
 *   1-2  → hostile
 *   3-4  → cool
 *   5-6  → neutral
 *   7-8  → friendly
 *   9-10 → ally
 */
export type RelationshipTier =
  | 'hostile'
  | 'cool'
  | 'neutral'
  | 'friendly'
  | 'ally'

/**
 * Phase 27 Plan 27-01: маппинг integer score → tier.
 * Clamps input to [RELATIONSHIP_MIN, RELATIONSHIP_MAX] и Math.floor'ит дробные.
 */
export function getRelationshipTier(value: number): RelationshipTier {
  const v = Math.max(
    RELATIONSHIP_MIN,
    Math.min(RELATIONSHIP_MAX, Math.floor(value)),
  )
  if (v <= 2) return 'hostile'
  if (v <= 4) return 'cool'
  if (v <= 6) return 'neutral'
  if (v <= 8) return 'friendly'
  return 'ally'
}

/**
 * Phase 27 Plan 27-01: CSS hex per tier (consumed by RelationshipBar в Plan 27-04).
 * NOT Phaser hex — DOM-only. Цвета подобраны под colorblind-safe палитру:
 *   red → orange → yellow → green → cyan.
 */
export const TIER_COLORS: Record<RelationshipTier, string> = {
  hostile: '#ef4444',
  cool: '#f97316',
  neutral: '#eab308',
  friendly: '#22c55e',
  ally: '#06b6d4',
}

/**
 * Phase 27 Plan 27-01: i18n key per tier.
 * Plan 27-01 пишет лейблы в cosmic_hub.contacts.tier.1..5 (RU/EN/ES parity).
 */
export const TIER_I18N_KEYS: Record<RelationshipTier, string> = {
  hostile: 'cosmic_hub.contacts.tier.1',
  cool: 'cosmic_hub.contacts.tier.2',
  neutral: 'cosmic_hub.contacts.tier.3',
  friendly: 'cosmic_hub.contacts.tier.4',
  ally: 'cosmic_hub.contacts.tier.5',
}

// ─── RACE_CHAINS skeleton ────────────────────────────────────────────────────

// Imported RaceId list — hardcoded ALL_RACE_IDS pattern из Phase 26-01 чтобы избежать
// циклической deps через cosmic/types.ts. Plan 27-02 fills each array with ~10 items.
const ALL_RACE_IDS_LOCAL: readonly RaceId[] = [
  'crystalloids',
  'gasouls',
  'mechanidons',
  'fireworms',
  'liquidoids',
  'tenebrians',
  'plasmaspirits',
  'forestcores',
  'timeweavers',
  'cometfolk',
] as const

// Skeleton. Plan 27-02 replaces with race-specific arrays in same file.
// Built через explicit typed `for` loop (mirror RACES_BY_ID pattern в races.ts) —
// Object.fromEntries теряет literal-key TS typing.
export const RACE_CHAINS: Record<RaceId, readonly ChainItem[]> = (() => {
  const out = {} as Record<RaceId, readonly ChainItem[]>
  for (const id of ALL_RACE_IDS_LOCAL) {
    out[id] = []
  }
  return out
})()
