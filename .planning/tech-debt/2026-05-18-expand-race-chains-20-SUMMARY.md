---
phase: tech-debt
plan: 2026-05-18-expand-race-chains-20
subsystem: cosmos-races-contacts
tags: [phase-27, race-chains, i18n, narrative, content-expansion]
requires:
  - phase-27-02 (RACE_CHAINS structure, ChainItem discriminated union)
  - phase-26-01 (RaceId union, 10-race lore baseline)
  - phase-27-01 (cosmos.event.* shared event keys, 5 reusable strings)
  - tech-debt-2026-05-18-expand-race-chains-15 (previous 10→15 expansion baseline)
provides:
  - 50 additional ChainItem entries (10 races × 5 items each: indices 15-19)
  - 40 new i18n keys per locale × 3 locales = 120 new translation entries
  - Phase 28 wiring stubs: 10 new quest_id strings (suffix _c)
affects:
  - client/src/game/config/raceChains.ts (data extension only)
  - client/src/i18n/{ru,en,es}.json (text additions only)
tech-stack-added: []
tech-stack-patterns:
  - reuse existing cosmos.event.* keys for far-arc 'event' items (no i18n bloat)
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
  - reuse-existing-events: item 17 (event) per race reuses one of 5 existing cosmos.event.*
    keys (ritual_disrupted, crystal_resonance, failed_pact, solar_flare, lost_envoy)
    instead of creating new strings — avoids 30 new i18n entries with minimal narrative cost
  - quest_id-suffix-_c: new quest_id at item 16 uses _c suffix variant (e.g.
    `crystalloids_lattice_survey_c`, `fireworms_blood_oath_c`) — leaves room for _d…_f
    if future Phase 28 wires multiple quests per race; follows the _a/_b/_c progression
    documented in the previous 10→15 SUMMARY
  - dialog-deltas-default: all new dialog/quest_hook entries use +1/-1 — no magnitude tuning
    in this expansion; balance pass still deferred until Phase 28 quest payoffs land
  - skip-item-17-i18n: item 17 is 'event' (uses cosmos.event.<key>), no new chain.17.text
    needed — i18n entries created only for chain.15/16/18/19 (4 per race × 10 = 40 per locale)
  - same-shape-as-prior-expansion: kept identical structural pattern as the 10→15 expansion
    (dialog/quest_hook/event/dialog/msg) to keep cognitive load on future expansions low
metrics:
  duration_minutes: ~30
  completed_date: 2026-05-18
  tasks_completed: 3
  files_modified: 4
---

# Tech-debt 2026-05-18: Expand Race Chains 15 → 20 Items Summary

Per-race ChainItem chains expanded from 15 to 20 entries each, growing far-arc narrative depth across all 10 alien races by adding 50 new items (5 per race) — items 15/18 (dialog), 16 (quest_hook), 17 (event reusing cosmos.event.*), 19 (msg final closing cadence) — with full RU/EN/ES i18n parity preserved (602 keys per locale, all consistent).

## Objective

Continue the Phase 27 race chain content expansion. The previous 10→15 pass added late-arc deepening (items 10-14); this pass adds far-arc continuation (items 15-19) so the contacts inbox can support longer player sessions before exhausting per-race content. The arc continues: late-arc was "recommit"; far-arc is "persistence/relapse/reaffirmation".

Goal per CONTEXT: narrative arc depth, NOT repetition. Mix `dialog`, `quest_hook`, `event`, `msg` types as continuation of the existing arc, preserving per-race personality.

## Implementation Summary

### Data extension (commit 3ddb70c)

`client/src/game/config/raceChains.ts` — appended 5 entries to each of the 10 race chains:

| Item | Type | Notes |
|------|------|-------|
| 15 | dialog | Far-arc reaffirmation, +1/-1 deltas |
| 16 | quest_hook | New quest_id (suffix _c), +1/-1 deltas, Phase 28 stub |
| 17 | event | target='self', delta=-1, reuses cosmos.event.* (no new i18n) |
| 18 | dialog | Far-arc closing dialog, +1/-1 deltas |
| 19 | msg | Final closing narrative cadence |

Updated header comment block to reflect 20-item structure and new totals (60 msg + 70 dialog + 40 quest_hook + 30 event = 200).

### i18n expansion (commit 0a4ba0d)

40 new translation keys per locale × 3 locales = 120 new entries.

Item 17 (event) reuses existing `cosmos.event.*` keys — no new i18n needed for those.

Items 15/16/18/19 wrote tone-matched text per race, e.g.:
- crystalloids.chain.15 (RU): «Согласуй свой ритм с нашей решёткой ещё на одну долю. Мы выкристаллизуем разницу.»
- fireworms.chain.15 (EN): "Temper our blade on your flame. A dull blade returned is a shame."
- plasmaspirits.chain.15 (ES): "¡Atrapa la chispa! ¡Ahora mismo — te lanzamos una carga!"
- cometfolk.chain.19 (RU): «Гребень готов. До следующей встречи в небе!»
- timeweavers.chain.19 (EN): "The stitch lies even. The fabric remembers your hand."

### Counts & verification

| Metric | Before | After |
|--------|--------|-------|
| chain.length per race | 15 | 20 |
| Total ChainItem entries | 150 | 200 |
| msg items | 50 | 60 |
| dialog items | 50 | 70 |
| quest_hook items | 30 | 40 |
| event items | 20 | 30 |
| Unique i18n keys (per locale) | 562 | 602 |

Programmatic verification (post-commit):
- All 10 chains: `chain.length === 20` ✓
- All 200 `text_key` references resolve in RU, EN, ES (0 missing) ✓
- `node client/scripts/check-translations.cjs`: 602 keys in all 3 locales, parity OK ✓
- `npx tsc --noEmit`: 0 errors ✓
- `npx vitest run`: 142 PASS, 0 FAIL (no regression) ✓

## Quest_id stubs created (Phase 28 wiring)

| Race | New quest_id (item 16) |
|------|------------------------|
| crystalloids | `crystalloids_lattice_survey_c` |
| gasouls | `gasouls_silent_chorus_c` |
| mechanidons | `mechanidons_audit_route_c` |
| fireworms | `fireworms_blood_oath_c` |
| liquidoids | `liquidoids_market_truce_c` |
| tenebrians | `tenebrians_veil_walk_c` |
| plasmaspirits | `plasmaspirits_storm_race_c` |
| forestcores | `forestcores_root_bridge_c` |
| timeweavers | `timeweavers_unspun_thread_c` |
| cometfolk | `cometfolk_long_orbit_c` |

All 10 IDs use `_c` suffix to differentiate from items 5/8 (base IDs) and items 12 (`_b` suffix) — three generations of quest_id stubs now exist per race, ready for Phase 28 to wire as separate quest objects or a single quest with state transitions.

## Event reuse map (item 17)

Each race's item 17 reuses one of the 5 existing `cosmos.event.*` strings — choices vary from the item-13 picks to spread coverage across the 5 events without repeating the same string twice consecutively for any race:

| Race | item 13 event (prior) | item 17 event (new) |
|------|-----------------------|---------------------|
| crystalloids | `cosmos.event.crystal_resonance` | `cosmos.event.ritual_disrupted` |
| gasouls | `cosmos.event.lost_envoy` | `cosmos.event.crystal_resonance` |
| mechanidons | `cosmos.event.failed_pact` | `cosmos.event.solar_flare` |
| fireworms | `cosmos.event.solar_flare` | `cosmos.event.failed_pact` |
| liquidoids | `cosmos.event.failed_pact` | `cosmos.event.lost_envoy` |
| tenebrians | `cosmos.event.crystal_resonance` | `cosmos.event.failed_pact` |
| plasmaspirits | `cosmos.event.lost_envoy` | `cosmos.event.solar_flare` |
| forestcores | `cosmos.event.ritual_disrupted` | `cosmos.event.lost_envoy` |
| timeweavers | `cosmos.event.failed_pact` | `cosmos.event.crystal_resonance` |
| cometfolk | `cosmos.event.solar_flare` | `cosmos.event.ritual_disrupted` |

No race uses the same event key twice in items 13 and 17; usage is balanced (~6 of each of the 5 keys across the 30 event slots).

## Per-race tone examples (items 15-19)

To verify tone preservation, here are RU samples per race for item 15 (far-arc reaffirmation, the first new dialog):

- **Crystalloids:** «Согласуй свой ритм с нашей решёткой ещё на одну долю.» — geometric, asks for rhythmic alignment
- **Gasouls:** «Возьми наш долгий вдох в свою грудь. Один — и мы споём в унисон.» — breath/song metaphor
- **Mechanidons:** «Подтверди расширенный SLA. Время реакции — 0.8 цикла, штраф — 7%.» — contract numbers
- **Fireworms:** «Опали наш клинок на своём пламени. Тупой возвращать — позор.» — duel imagery, blunt
- **Liquidoids:** «Подпиши новый протокол. Двойная маржа на твоей стороне.» — deal-flow
- **Tenebrians:** «Молчи о том, что увидишь в нашем отражении. Имя его — не для речи.» — half-prophecy
- **Plasmaspirits:** «Лови искру! Прямо сейчас!» — impulsive/exclamatory
- **Forestcores:** «Постой над нашим спящим корнем один сезон.» — slow/life-cycle
- **Timeweavers:** «Согласись помнить день, который не наступит.» — paradoxical
- **Cometfolk:** «Поделись с нами одной историей про твою лягушку!» — story-sharing

## Deviations from Plan

None — plan executed exactly as written. Pre-existing tooling state (worktree node_modules
symlink pointed at an obsolete relative path) was repaired in-session but not committed (the
symlink is gitignored). Worktree base branch was also brought forward from the snapshot-time
HEAD (`b67c31e`) to current main (`1cd7c31`) via `git merge --ff-only`, since the previous
10→15 expansion landed on main between worktree creation and this session.

## Out of scope (deferred)

- Phase 28 quest wiring (consume the new `_c` quest_ids and resolve them into real quest objects)
- Balance pass on accept_delta/refuse_delta magnitudes (all still +1/-1; high-stakes items
  like timeweavers.18 "agree not to ask the question" may want asymmetric deltas)
- Per-race chain length re-evaluation (20 may finally be enough; next breakpoint is probably
  not pure expansion but branching — Phase 28 may want player-state-aware variants instead)

## Self-Check: PASSED

- File exists: `client/src/game/config/raceChains.ts` ✓
- File exists: `client/src/i18n/ru.json`, `en.json`, `es.json` ✓
- Commit 3ddb70c exists in `git log` ✓
- Commit 0a4ba0d exists in `git log` ✓
- tsc clean ✓
- 142 vitest pass, 0 fail ✓
- 602 i18n keys × 3 locales parity ✓
- 200 ChainItem total (60 msg + 70 dialog + 40 quest_hook + 30 event) ✓
- All chain.length === 20 ✓
- 0 missing text_key references across RU/EN/ES ✓
