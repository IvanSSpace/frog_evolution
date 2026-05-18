---
phase: tech-debt
plan: 2026-05-18-expand-race-chains-15
subsystem: cosmos-races-contacts
tags: [phase-27, race-chains, i18n, narrative, content-expansion]
requires:
  - phase-27-02 (RACE_CHAINS structure, ChainItem discriminated union)
  - phase-26-01 (RaceId union, 10-race lore baseline)
  - phase-27-01 (cosmos.event.* shared event keys, 5 reusable strings)
provides:
  - 50 additional ChainItem entries (10 races × 5 items each)
  - 40 new i18n keys per locale × 3 locales = 120 new translation entries
  - Phase 28 wiring stubs: 10 new quest_id strings (suffix _b)
affects:
  - client/src/game/config/raceChains.ts (data extension only)
  - client/src/i18n/{ru,en,es}.json (text additions only)
tech-stack-added: []
tech-stack-patterns:
  - reuse existing cosmos.event.* keys for late-arc 'event' items (no i18n bloat)
  - per-race tone preserved across new items (Crystalloids cold/geometric, Gasouls poetic,
    Mechanidons technical/numeric, Fireworms aggressive/short, Liquidoids deal-flow,
    Tenebrians mystical/half-prophecies, Plasmaspirits impulsive/exclamatory,
    Forestcores slow/life-cycle, Timeweavers paradoxical/non-commanding,
    Cometfolk enthusiastic/story-sharing)
key-files-created: []
key-files-modified:
  - client/src/game/config/raceChains.ts
  - client/src/i18n/ru.json
  - client/src/i18n/en.json
  - client/src/i18n/es.json
decisions:
  - reuse-existing-events: item 13 (event) per race reuses one of 5 existing cosmos.event.*
    keys (ritual_disrupted, crystal_resonance, failed_pact, solar_flare, lost_envoy)
    instead of creating new strings — avoids 30 new i18n entries with minimal narrative cost
  - quest_id-suffix-_b: new quest_id at item 12 uses _b suffix variant (e.g.
    `crystalloids_lattice_survey_b`, `fireworms_blood_oath_b`) — leaves room for _c…_f
    if Phase 28 wires multiple quests per race; suffix avoids collision with items 5/8 IDs
  - dialog-deltas-default: all new dialog/quest_hook entries use +1/-1 — no magnitude tuning
    in this expansion; balance pass deferred until Phase 28 quest payoffs land
  - skip-item-13-i18n: item 13 is 'event' (uses cosmos.event.<key>), no new chain.13.text
    needed — i18n entries created only for chain.10/11/12/14 (4 per race × 10 = 40 per locale)
metrics:
  duration_minutes: ~25
  completed_date: 2026-05-18
  tasks_completed: 3
  files_modified: 4
---

# Tech-debt 2026-05-18: Expand Race Chains 10 → 15 Items Summary

Per-race ChainItem chains expanded from 10 to 15 entries each, growing late-arc narrative depth across all 10 alien races by adding 50 new items (5 per race) — items 10/11 (dialog), 12 (quest_hook), 13 (event reusing cosmos.event.*), 14 (msg closing cadence) — with full RU/EN/ES i18n parity preserved.

## Objective

Expand Phase 27 race chain content to give every race a longer, deeper narrative arc continuation past the existing item 9 (which previously functioned as the chain tail), so the contacts inbox does not exhaust race content mid-progression.

Goal per CONTEXT: more narrative arc depth, NOT repetition. Mix `dialog`, `quest_hook`, `event`, `msg` types as continuation of the existing arc, preserving per-race personality.

## Implementation Summary

### Data extension (commit e6976dc)

`client/src/game/config/raceChains.ts` — added 5 entries to each of the 10 race chains:

| Item | Type | Notes |
|------|------|-------|
| 10 | dialog | Late-arc recommit, +1/-1 deltas |
| 11 | dialog | Second late-arc dialog, +1/-1 deltas |
| 12 | quest_hook | New quest_id (suffix _b), +1/-1 deltas, Phase 28 stub |
| 13 | event | target='self', delta=-1, reuses cosmos.event.* (no new i18n) |
| 14 | msg | Closing narrative cadence |

Updated header comment block to reflect 15-item structure and new totals.

### i18n expansion (commit 6473dd5)

40 new translation keys per locale × 3 locales = 120 new entries.

Item 13 (event) reuses existing `cosmos.event.*` keys — no new i18n needed for those.

Items 10/11/12/14 wrote tone-matched text per race, e.g.:
- crystalloids.chain.10 (RU): «Стой в нашей решётке одну долю. Так мы прочтём твой ответ точнее.»
- fireworms.chain.10 (RU): «Дай клятву на пламени. Слова — пепел, клятва — шрам.»
- cometfolk.chain.14 (EN): "The route already marks you. Until the next crest!"
- timeweavers.chain.12 (ES): "Deshaz el bucle que se forma en tu puesto avanzado. No te soltará."

### Counts & verification

| Metric | Before | After |
|--------|--------|-------|
| chain.length per race | 10 | 15 |
| Total ChainItem entries | 100 | 150 |
| msg items | 40 | 50 |
| dialog items | 30 | 50 |
| quest_hook items | 20 | 30 |
| event items | 10 | 20 |
| Unique i18n keys (per locale) | 522 | 562 |

Programmatic verification (post-commit):
- All 10 chains: `chain.length === 15` ✓
- All 150 `text_key` references resolve in RU, EN, ES (0 missing) ✓
- `node client/scripts/check-translations.cjs`: 562 keys in all 3 locales, parity OK ✓
- `npx tsc --noEmit`: 0 errors ✓
- `npx vitest run`: 117 PASS, 0 FAIL (no regression) ✓

## Quest_id stubs created (Phase 28 wiring)

| Race | New quest_id (item 12) |
|------|------------------------|
| crystalloids | `crystalloids_lattice_survey_b` |
| gasouls | `gasouls_silent_chorus_b` |
| mechanidons | `mechanidons_audit_route_b` |
| fireworms | `fireworms_blood_oath_b` |
| liquidoids | `liquidoids_market_truce_b` |
| tenebrians | `tenebrians_veil_walk_b` |
| plasmaspirits | `plasmaspirits_storm_race_b` |
| forestcores | `forestcores_root_bridge_b` |
| timeweavers | `timeweavers_unspun_thread_b` |
| cometfolk | `cometfolk_long_orbit_b` |

All 10 IDs use `_b` suffix to differentiate from item 5/8 quest_ids and to leave `_c…_f`
variants open if Phase 28 wires multiple quests per race.

## Event reuse map (item 13)

Each race's item 13 reuses one of the 5 existing `cosmos.event.*` strings to avoid bloating i18n:

| Race | item 13 event key |
|------|-------------------|
| crystalloids | `cosmos.event.crystal_resonance` |
| gasouls | `cosmos.event.lost_envoy` |
| mechanidons | `cosmos.event.failed_pact` |
| fireworms | `cosmos.event.solar_flare` |
| liquidoids | `cosmos.event.failed_pact` |
| tenebrians | `cosmos.event.crystal_resonance` |
| plasmaspirits | `cosmos.event.lost_envoy` |
| forestcores | `cosmos.event.ritual_disrupted` |
| timeweavers | `cosmos.event.failed_pact` |
| cometfolk | `cosmos.event.solar_flare` |

Choice was made by tone fit (e.g. crystalloids → resonance, plasmaspirits → lost envoy
since envoy-loss matches their volatile flock dynamic, forestcores → ritual_disrupted
since their old pact already implies ritual context).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrong totals in header comment**
- **Found during:** Post-commit sanity check
- **Issue:** Comment claimed "60 msg + 50 dialog + 30 quest_hook + 20 event = 150" but
  actual breakdown is 50 msg (5 per race × 10 races: items 0,1,3,9,14), not 60.
- **Fix:** Updated comment to `50 msg + 50 dialog + 30 quest_hook + 20 event = 150`.
- **Files modified:** `client/src/game/config/raceChains.ts`
- **Commit:** d07049f

### Environment adjustment (not a deviation, but worth noting)

Worktree did not have `node_modules/` symlinked at session start; created a symlink to
`<main-repo>/client/node_modules` so `npx tsc` and `npx vitest` could resolve dependencies.
The symlink is gitignored and was not committed. Standard worktree onboarding gap.

## Out of scope (deferred)

- Phase 28 quest wiring (consume the new `_b` quest_ids and replace stubs with real quest objects)
- Balance pass on accept_delta/refuse_delta magnitudes (currently all +1/-1; may want
  +2/-1 or -2/+1 asymmetric for high-stakes items like timeweavers.12 unravel-loop)
- Per-race chain length re-evaluation (15 may be enough; 20 is the next natural breakpoint
  if Phase 28 lands and players hit the new tail)

## Self-Check: PASSED

- File exists: `client/src/game/config/raceChains.ts` ✓
- File exists: `client/src/i18n/ru.json`, `en.json`, `es.json` ✓
- Commit e6976dc exists in `git log` ✓
- Commit 6473dd5 exists in `git log` ✓
- Doc-fix commit exists in `git log` ✓
- tsc clean ✓
- 117 vitest pass ✓
- 562 i18n keys × 3 locales parity ✓
- 150 ChainItem total (50 msg + 50 dialog + 30 quest_hook + 20 event) ✓
- All chain.length === 15 ✓
- 0 missing text_key references across RU/EN/ES ✓
