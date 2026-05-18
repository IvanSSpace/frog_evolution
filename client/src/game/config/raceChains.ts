// Phase 27 Plan 27-02: RACE_CHAINS data filled (10 races × 20 items each).
// Tech-debt 2026-05-18: expanded items 10-14 per race (50 new entries) — deeper narrative arc.
// Tech-debt 2026-05-18 (second pass): expanded items 15-19 per race (50 new entries) — far-arc continuation.
// Hybrid scripted (items 0-4: intro/lore) + templated (items 5-9: quest_hook/event/dialog mix)
// + late-arc deepening (items 10-14: continuation, mix of dialog/quest_hook/event/msg)
// + far-arc tail (items 15-19: persistence/relapse/reaffirmation, dialog/quest_hook/event/msg).
// Item 6 of every race = inline 'event' ChainItem (target='self', delta=-1) — auto-applied at
// pull time by Plan 27-03 engine (toast fired, NOT pushed to inbox).
// Items 10-14 and 15-19 reuse existing cosmos.event.* keys for 'event' variants to avoid i18n bloat.
// text_key fields reference races.<id>.chain.<N>.text|description i18n keys (Task 1 of this plan).
// shared event descriptions reference cosmos.event.<key> i18n keys (5 reusable strings).
//
// ChainItem discriminated union models per-race linear message progression. RACE_CHAINS is
// Record<RaceId, readonly ChainItem[]>. Data lives explicitly (no skeleton loop) since 27-02.
//
// Relationship system: 1-10 integer scale, 5 tiers, initial value INITIAL_RELATIONSHIP=2
// (low threshold per CONTEXT — все стартуют с подозрения). getRelationshipTier() clamps
// input to [1, 10] before tier mapping.
//
// No runtime side-effects. Pure config + helpers. Consumed by:
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

// ─── RACE_CHAINS data ────────────────────────────────────────────────────────

// Phase 27 Plan 27-02: explicit per-race arrays. Each race ships 20 ChainItem entries:
//   item 0,1,3 — 'msg' (lore reveal / status updates)
//   item 2,4   — 'dialog' (small/medium social ask, +1/-1 deltas)
//   item 5,8   — 'quest_hook' (Phase 28 will wire quest_id → real quest)
//   item 6     — 'event' (self-targeted, delta=-1, references cosmos.event.<key>)
//   item 7     — 'dialog'
//   item 9     — 'msg' (mid-arc narrative tail)
//   item 10,11 — 'dialog' (late-arc deepening, recommitting voice)
//   item 12    — 'quest_hook' (Phase 28 will wire quest_id → real quest; suffix _b variants)
//   item 13    — 'event' (self-targeted, delta=-1, references cosmos.event.<key>) — second beat
//   item 14    — 'msg' (mid-arc closing cadence)
//   item 15    — 'dialog' (far-arc reaffirmation)
//   item 16    — 'quest_hook' (Phase 28 stub; suffix _c variant)
//   item 17    — 'event' (self-targeted, delta=-1, references cosmos.event.<key>) — third beat
//   item 18    — 'dialog' (far-arc closing dialog)
//   item 19    — 'msg' (final closing narrative cadence)
// Totals across 10 races (tech-debt 2026-05-18 second-pass expansion):
//   60 msg + 70 dialog + 40 quest_hook + 30 event = 200 items.
export const RACE_CHAINS: Record<RaceId, readonly ChainItem[]> = {
  crystalloids: [
    { type: 'msg', text_key: 'races.crystalloids.chain.0.text' },
    { type: 'msg', text_key: 'races.crystalloids.chain.1.text' },
    {
      type: 'dialog',
      text_key: 'races.crystalloids.chain.2.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.crystalloids.chain.3.text' },
    {
      type: 'dialog',
      text_key: 'races.crystalloids.chain.4.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.crystalloids.chain.5.text',
      quest_id: 'crystalloids_silent_scout',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.ritual_disrupted',
    },
    {
      type: 'dialog',
      text_key: 'races.crystalloids.chain.7.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.crystalloids.chain.8.text',
      quest_id: 'crystalloids_shard_delivery',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.crystalloids.chain.9.text' },
    {
      type: 'dialog',
      text_key: 'races.crystalloids.chain.10.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'dialog',
      text_key: 'races.crystalloids.chain.11.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.crystalloids.chain.12.text',
      quest_id: 'crystalloids_lattice_survey_b',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.crystal_resonance',
    },
    { type: 'msg', text_key: 'races.crystalloids.chain.14.text' },
    {
      type: 'dialog',
      text_key: 'races.crystalloids.chain.15.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.crystalloids.chain.16.text',
      quest_id: 'crystalloids_lattice_survey_c',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.ritual_disrupted',
    },
    {
      type: 'dialog',
      text_key: 'races.crystalloids.chain.18.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.crystalloids.chain.19.text' },
  ],
  gasouls: [
    { type: 'msg', text_key: 'races.gasouls.chain.0.text' },
    { type: 'msg', text_key: 'races.gasouls.chain.1.text' },
    {
      type: 'dialog',
      text_key: 'races.gasouls.chain.2.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.gasouls.chain.3.text' },
    {
      type: 'dialog',
      text_key: 'races.gasouls.chain.4.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.gasouls.chain.5.text',
      quest_id: 'gasouls_lost_note',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.crystal_resonance',
    },
    {
      type: 'dialog',
      text_key: 'races.gasouls.chain.7.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.gasouls.chain.8.text',
      quest_id: 'gasouls_sunken_resonator',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.gasouls.chain.9.text' },
    {
      type: 'dialog',
      text_key: 'races.gasouls.chain.10.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'dialog',
      text_key: 'races.gasouls.chain.11.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.gasouls.chain.12.text',
      quest_id: 'gasouls_silent_chorus_b',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.lost_envoy',
    },
    { type: 'msg', text_key: 'races.gasouls.chain.14.text' },
    {
      type: 'dialog',
      text_key: 'races.gasouls.chain.15.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.gasouls.chain.16.text',
      quest_id: 'gasouls_silent_chorus_c',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.crystal_resonance',
    },
    {
      type: 'dialog',
      text_key: 'races.gasouls.chain.18.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.gasouls.chain.19.text' },
  ],
  mechanidons: [
    { type: 'msg', text_key: 'races.mechanidons.chain.0.text' },
    { type: 'msg', text_key: 'races.mechanidons.chain.1.text' },
    {
      type: 'dialog',
      text_key: 'races.mechanidons.chain.2.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.mechanidons.chain.3.text' },
    {
      type: 'dialog',
      text_key: 'races.mechanidons.chain.4.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.mechanidons.chain.5.text',
      quest_id: 'mechanidons_module_delivery',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.failed_pact',
    },
    {
      type: 'dialog',
      text_key: 'races.mechanidons.chain.7.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.mechanidons.chain.8.text',
      quest_id: 'mechanidons_diagnostics',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.mechanidons.chain.9.text' },
    {
      type: 'dialog',
      text_key: 'races.mechanidons.chain.10.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'dialog',
      text_key: 'races.mechanidons.chain.11.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.mechanidons.chain.12.text',
      quest_id: 'mechanidons_audit_route_b',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.failed_pact',
    },
    { type: 'msg', text_key: 'races.mechanidons.chain.14.text' },
    {
      type: 'dialog',
      text_key: 'races.mechanidons.chain.15.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.mechanidons.chain.16.text',
      quest_id: 'mechanidons_audit_route_c',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.solar_flare',
    },
    {
      type: 'dialog',
      text_key: 'races.mechanidons.chain.18.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.mechanidons.chain.19.text' },
  ],
  fireworms: [
    { type: 'msg', text_key: 'races.fireworms.chain.0.text' },
    { type: 'msg', text_key: 'races.fireworms.chain.1.text' },
    {
      type: 'dialog',
      text_key: 'races.fireworms.chain.2.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.fireworms.chain.3.text' },
    {
      type: 'dialog',
      text_key: 'races.fireworms.chain.4.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.fireworms.chain.5.text',
      quest_id: 'fireworms_runaway_acolyte',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.solar_flare',
    },
    {
      type: 'dialog',
      text_key: 'races.fireworms.chain.7.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.fireworms.chain.8.text',
      quest_id: 'fireworms_shard_to_tenebrians',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.fireworms.chain.9.text' },
    {
      type: 'dialog',
      text_key: 'races.fireworms.chain.10.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'dialog',
      text_key: 'races.fireworms.chain.11.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.fireworms.chain.12.text',
      quest_id: 'fireworms_blood_oath_b',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.solar_flare',
    },
    { type: 'msg', text_key: 'races.fireworms.chain.14.text' },
    {
      type: 'dialog',
      text_key: 'races.fireworms.chain.15.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.fireworms.chain.16.text',
      quest_id: 'fireworms_blood_oath_c',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.failed_pact',
    },
    {
      type: 'dialog',
      text_key: 'races.fireworms.chain.18.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.fireworms.chain.19.text' },
  ],
  liquidoids: [
    { type: 'msg', text_key: 'races.liquidoids.chain.0.text' },
    { type: 'msg', text_key: 'races.liquidoids.chain.1.text' },
    {
      type: 'dialog',
      text_key: 'races.liquidoids.chain.2.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.liquidoids.chain.3.text' },
    {
      type: 'dialog',
      text_key: 'races.liquidoids.chain.4.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.liquidoids.chain.5.text',
      quest_id: 'liquidoids_caravan',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.lost_envoy',
    },
    {
      type: 'dialog',
      text_key: 'races.liquidoids.chain.7.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.liquidoids.chain.8.text',
      quest_id: 'liquidoids_stolen_cargo',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.liquidoids.chain.9.text' },
    {
      type: 'dialog',
      text_key: 'races.liquidoids.chain.10.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'dialog',
      text_key: 'races.liquidoids.chain.11.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.liquidoids.chain.12.text',
      quest_id: 'liquidoids_market_truce_b',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.failed_pact',
    },
    { type: 'msg', text_key: 'races.liquidoids.chain.14.text' },
    {
      type: 'dialog',
      text_key: 'races.liquidoids.chain.15.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.liquidoids.chain.16.text',
      quest_id: 'liquidoids_market_truce_c',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.lost_envoy',
    },
    {
      type: 'dialog',
      text_key: 'races.liquidoids.chain.18.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.liquidoids.chain.19.text' },
  ],
  tenebrians: [
    { type: 'msg', text_key: 'races.tenebrians.chain.0.text' },
    { type: 'msg', text_key: 'races.tenebrians.chain.1.text' },
    {
      type: 'dialog',
      text_key: 'races.tenebrians.chain.2.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.tenebrians.chain.3.text' },
    {
      type: 'dialog',
      text_key: 'races.tenebrians.chain.4.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.tenebrians.chain.5.text',
      quest_id: 'tenebrians_hidden_gate',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.ritual_disrupted',
    },
    {
      type: 'dialog',
      text_key: 'races.tenebrians.chain.7.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.tenebrians.chain.8.text',
      quest_id: 'tenebrians_last_shard',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.tenebrians.chain.9.text' },
    {
      type: 'dialog',
      text_key: 'races.tenebrians.chain.10.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'dialog',
      text_key: 'races.tenebrians.chain.11.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.tenebrians.chain.12.text',
      quest_id: 'tenebrians_veil_walk_b',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.crystal_resonance',
    },
    { type: 'msg', text_key: 'races.tenebrians.chain.14.text' },
    {
      type: 'dialog',
      text_key: 'races.tenebrians.chain.15.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.tenebrians.chain.16.text',
      quest_id: 'tenebrians_veil_walk_c',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.failed_pact',
    },
    {
      type: 'dialog',
      text_key: 'races.tenebrians.chain.18.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.tenebrians.chain.19.text' },
  ],
  plasmaspirits: [
    { type: 'msg', text_key: 'races.plasmaspirits.chain.0.text' },
    { type: 'msg', text_key: 'races.plasmaspirits.chain.1.text' },
    {
      type: 'dialog',
      text_key: 'races.plasmaspirits.chain.2.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.plasmaspirits.chain.3.text' },
    {
      type: 'dialog',
      text_key: 'races.plasmaspirits.chain.4.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.plasmaspirits.chain.5.text',
      quest_id: 'plasmaspirits_outrun',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.solar_flare',
    },
    {
      type: 'dialog',
      text_key: 'races.plasmaspirits.chain.7.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.plasmaspirits.chain.8.text',
      quest_id: 'plasmaspirits_lost_flock',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.plasmaspirits.chain.9.text' },
    {
      type: 'dialog',
      text_key: 'races.plasmaspirits.chain.10.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'dialog',
      text_key: 'races.plasmaspirits.chain.11.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.plasmaspirits.chain.12.text',
      quest_id: 'plasmaspirits_storm_race_b',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.lost_envoy',
    },
    { type: 'msg', text_key: 'races.plasmaspirits.chain.14.text' },
    {
      type: 'dialog',
      text_key: 'races.plasmaspirits.chain.15.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.plasmaspirits.chain.16.text',
      quest_id: 'plasmaspirits_storm_race_c',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.solar_flare',
    },
    {
      type: 'dialog',
      text_key: 'races.plasmaspirits.chain.18.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.plasmaspirits.chain.19.text' },
  ],
  forestcores: [
    { type: 'msg', text_key: 'races.forestcores.chain.0.text' },
    { type: 'msg', text_key: 'races.forestcores.chain.1.text' },
    {
      type: 'dialog',
      text_key: 'races.forestcores.chain.2.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.forestcores.chain.3.text' },
    {
      type: 'dialog',
      text_key: 'races.forestcores.chain.4.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.forestcores.chain.5.text',
      quest_id: 'forestcores_young_forest',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.failed_pact',
    },
    {
      type: 'dialog',
      text_key: 'races.forestcores.chain.7.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.forestcores.chain.8.text',
      quest_id: 'forestcores_spore_migration',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.forestcores.chain.9.text' },
    {
      type: 'dialog',
      text_key: 'races.forestcores.chain.10.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'dialog',
      text_key: 'races.forestcores.chain.11.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.forestcores.chain.12.text',
      quest_id: 'forestcores_root_bridge_b',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.ritual_disrupted',
    },
    { type: 'msg', text_key: 'races.forestcores.chain.14.text' },
    {
      type: 'dialog',
      text_key: 'races.forestcores.chain.15.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.forestcores.chain.16.text',
      quest_id: 'forestcores_root_bridge_c',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.lost_envoy',
    },
    {
      type: 'dialog',
      text_key: 'races.forestcores.chain.18.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.forestcores.chain.19.text' },
  ],
  timeweavers: [
    { type: 'msg', text_key: 'races.timeweavers.chain.0.text' },
    { type: 'msg', text_key: 'races.timeweavers.chain.1.text' },
    {
      type: 'dialog',
      text_key: 'races.timeweavers.chain.2.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.timeweavers.chain.3.text' },
    {
      type: 'dialog',
      text_key: 'races.timeweavers.chain.4.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.timeweavers.chain.5.text',
      quest_id: 'timeweavers_temporal_knot',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.ritual_disrupted',
    },
    {
      type: 'dialog',
      text_key: 'races.timeweavers.chain.7.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.timeweavers.chain.8.text',
      quest_id: 'timeweavers_spiral_link',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.timeweavers.chain.9.text' },
    {
      type: 'dialog',
      text_key: 'races.timeweavers.chain.10.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'dialog',
      text_key: 'races.timeweavers.chain.11.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.timeweavers.chain.12.text',
      quest_id: 'timeweavers_unspun_thread_b',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.failed_pact',
    },
    { type: 'msg', text_key: 'races.timeweavers.chain.14.text' },
    {
      type: 'dialog',
      text_key: 'races.timeweavers.chain.15.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.timeweavers.chain.16.text',
      quest_id: 'timeweavers_unspun_thread_c',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.crystal_resonance',
    },
    {
      type: 'dialog',
      text_key: 'races.timeweavers.chain.18.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.timeweavers.chain.19.text' },
  ],
  cometfolk: [
    { type: 'msg', text_key: 'races.cometfolk.chain.0.text' },
    { type: 'msg', text_key: 'races.cometfolk.chain.1.text' },
    {
      type: 'dialog',
      text_key: 'races.cometfolk.chain.2.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.cometfolk.chain.3.text' },
    {
      type: 'dialog',
      text_key: 'races.cometfolk.chain.4.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.cometfolk.chain.5.text',
      quest_id: 'cometfolk_young_comet',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.lost_envoy',
    },
    {
      type: 'dialog',
      text_key: 'races.cometfolk.chain.7.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.cometfolk.chain.8.text',
      quest_id: 'cometfolk_lost_crest',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.cometfolk.chain.9.text' },
    {
      type: 'dialog',
      text_key: 'races.cometfolk.chain.10.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'dialog',
      text_key: 'races.cometfolk.chain.11.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.cometfolk.chain.12.text',
      quest_id: 'cometfolk_long_orbit_b',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.solar_flare',
    },
    { type: 'msg', text_key: 'races.cometfolk.chain.14.text' },
    {
      type: 'dialog',
      text_key: 'races.cometfolk.chain.15.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'quest_hook',
      text_key: 'races.cometfolk.chain.16.text',
      quest_id: 'cometfolk_long_orbit_c',
      accept_delta: 1,
      refuse_delta: -1,
    },
    {
      type: 'event',
      target: 'self',
      delta: -1,
      text_key: 'cosmos.event.ritual_disrupted',
    },
    {
      type: 'dialog',
      text_key: 'races.cometfolk.chain.18.text',
      accept_delta: 1,
      refuse_delta: -1,
    },
    { type: 'msg', text_key: 'races.cometfolk.chain.19.text' },
  ],
}
