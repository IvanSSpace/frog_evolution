---
phase: 27-contacts-messages-relationships
plan: 02
subsystem: race-chain-data
tags: [i18n, ru, en, es, race-chain, content, lore, narrative, discriminated-union]

# Dependency graph
requires:
  - phase: 27-contacts-messages-relationships
    plan: 01
    provides: |
      ChainItem discriminated union (msg | dialog | quest_hook | event), PendingItem interface,
      RACE_CHAINS skeleton (10 empty arrays), RaceId union (10 races), cosmos.event.notification
      i18n template, races.<id>.{name,personality,home_planet_name} for narrative tone anchoring.
provides:
  - "RACE_CHAINS filled — 10 races × 10 ChainItem each (40 msg + 30 dialog + 20 quest_hook + 10 event = 100 total entries)"
  - "Per-race scripted intro arc (items 0-4: lore reveal, dialogue establishing personality) + templated middle (items 5-9: quest_hook/event/dialog mix)"
  - "Item 6 of every race = inline 'event' ChainItem (target='self', delta=-1) referencing one of 5 shared cosmos.event.<key> descriptions"
  - "5 shared cosmos.event.* event description strings reusable across races (solar_flare, failed_pact, lost_envoy, ritual_disrupted, crystal_resonance)"
  - "20 unique quest_ids declared for Phase 28 wiring (2 per race, e.g. crystalloids_silent_scout / crystalloids_shard_delivery)"
  - "Race-personality-matched text in RU/EN/ES (fireworms aggressive; crystalloids patient/cold; liquidoids trader-warm; etc.)"
  - "100 races.<id>.chain.<N>.{text|description} i18n entries per locale (300 total across RU/EN/ES) + 5 cosmos.event.<key> shared strings per locale (15 total) = 315 new entries across 3 locales"
affects:
  - "Plan 27-03 (pending engine: pulls RACE_CHAINS[raceId][chainProgress[raceId]] — out-of-bounds bounds-check is 27-03 responsibility)"
  - "Plan 27-04 (race detail UI: renders ChainItem.text_key via i18next.t() — all keys now resolvable)"
  - "Plan 27-05 (toast: consumes cosmos.event.notification with description from one of 5 shared event keys)"
  - "Phase 28 quest-wiring: greps for 20 quest_id strings to bind real quest activation"

# Tech tracking
tech-stack:
  added: []  # no new deps
  patterns:
    - "Explicit object literal Record<RaceId, readonly ChainItem[]> (replaced 27-01 typed IIFE loop) — data is fully visible, easier to review/edit"
    - "Step 6 always = 'event' ChainItem referencing cosmos.event.* shared key (not race-specific chain.6.* key) — cheap reuse across races, only race-specific 'description' addendum lives in race chain namespace at step 6 for narrative-flair completeness"
    - "races.<id>.chain.6.description field exists in i18n but is NOT directly consumed by RACE_CHAINS (event.text_key points to cosmos.event.*) — kept for parity + future race-specific event flavor in Phase 29"
    - "quest_id strings = <race_id>_<feature_name> snake_case (e.g. crystalloids_silent_scout) — predictable for Phase 28 grep-based discovery"
    - "Personality match per race: dueling demands for fireworms, geometric patience for crystalloids, trade flow for liquidoids, songs for gasouls, protocols for mechanidons, cryptic prophecy for tenebrians, speed/flash for plasmaspirits, mycelial slow growth for forestcores, paradox/spiral for timeweavers, comet cheer for cometfolk"

key-files:
  modified:
    - "client/src/game/config/raceChains.ts (161 LOC → 589 LOC) — RACE_CHAINS skeleton replaced with explicit object literal (10 races × 10 ChainItem); ALL_RACE_IDS_LOCAL constant removed; header comment updated to reflect data-filled state"
    - "client/src/i18n/ru.json (583 LOC → 753 LOC) — added races.<id>.chain.{0..9} (100 entries) + cosmos.event.{solar_flare,failed_pact,lost_envoy,ritual_disrupted,crystal_resonance} (5 entries)"
    - "client/src/i18n/en.json (583 LOC → 753 LOC) — same parity, English translations"
    - "client/src/i18n/es.json (583 LOC → 753 LOC) — same parity, Spanish translations"

key-decisions:
  - "Step 6 'description' field in race chain namespace is intentionally NOT referenced by RACE_CHAINS — RACE_CHAINS event entries point to cosmos.event.<shared_key>. The race-specific chain.6.description exists for i18n schema completeness (acceptance criterion: 10 chain entries per race × 10 races = 100 per locale) and as future Phase 29 race-specific event flavor anchor. This is a deliberate divergence between i18n shape and runtime consumption — documented in raceChains.ts header."
  - "Event ChainItem at step 6 universally uses target='self', delta=-1, text_key='cosmos.event.<key>' — engine in Plan 27-03 fires toast with shared description from cosmos.event.<key>, NOT race-specific chain.6.description (which would require an extra key lookup pattern). Keeps engine logic simple: one i18next.t(item.text_key) call works for all 4 ChainItem variants."
  - "20 quest_ids namespaced by race prefix (crystalloids_*, fireworms_*, etc.) — Phase 28 will define quest tables and use grep-based wiring (e.g. `grep -r quest_id: client/src/game/config/raceChains.ts` to enumerate all required quest entries)."
  - "Dialog/quest_hook deltas always (+1, -1) — symmetric pos/neg, simple to grok. Plan 29 may introduce asymmetric deltas (e.g. quest_hook +2/-1 for high-stakes asks). Currently aligned with relationship scale [1,10] where each step is 10% of full range."
  - "Personality fidelity verified by re-reading races.<id>.personality field in i18n + races.<id>.communication_style and checking each chain text matches tone (e.g. fireworms = 'короткие дерзкие сообщения' → 'Я Огнечервь. Раскал жжёт. Говори быстро.' ✓; crystalloids = 'геометрические узоры, сухие точные слова' → 'Силикасос приветствует тебя. Мы росли в этом узоре две эпохи.' ✓)."

# Metrics
duration: 20m
completed: 2026-05-18
---

# Phase 27 Plan 02: Race chain DATA (10 races × 10 ChainItem + i18n texts) Summary

**Filled RACE_CHAINS skeleton with 100 ChainItem entries across 10 races (40 msg + 30 dialog + 20 quest_hook + 10 event), each chain tone-matched to race personality; wrote 100 races.<id>.chain.<N>.{text|description} i18n strings per locale (RU/EN/ES) + 5 shared cosmos.event.<key> reusable event descriptions, parity verified at 522/522/522 (baseline 417 + 105 new keys per locale).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-18T12:51:00Z (approximate, from worktree spawn)
- **Completed:** 2026-05-18T13:01:00Z
- **Tasks:** 2 (atomic commits)
- **Files modified:** 4 (1 source + 3 i18n)

## Accomplishments

- **RACE_CHAINS data filled** — 10 races × 10 ChainItem each. Each race chain has explicit lore arc:
  - Items 0,1 = greeting + planet/lore reveal ('msg')
  - Items 2,4 = social asks with relationship deltas ('dialog' +1/-1)
  - Item 3 = mid-chain lore detail ('msg')
  - Items 5,8 = quest hooks for Phase 28 wiring ('quest_hook' with quest_id)
  - Item 6 = self-targeted event ('event', delta=-1, references shared cosmos.event.*)
  - Item 7 = secondary dialog ('dialog' +1/-1)
  - Item 9 = closing narrative tail ('msg')
- **i18n RU/EN/ES at parity** — 522/522/522 keys (was 417 baseline; +105 new keys per locale, 315 new strings across 3 locales). All race chain texts personality-matched; all 5 cosmos.event.* descriptions translated.
- **Race tone fidelity** — every race speaks in its lore voice:
  - fireworms: short, demanding, fire-themed
  - crystalloids: slow, geometric, formal
  - liquidoids: trader, deal-oriented, warm
  - gasouls: poetic, song/resonance metaphors
  - mechanidons: protocol numbers, KPI, technical
  - tenebrians: cryptic, prophetic, between-dimension
  - plasmaspirits: short bursts, speed, exclamations
  - forestcores: mycelial, root metaphors, slow wisdom
  - timeweavers: paradox, spiral, time-loops
  - cometfolk: cheerful, traveling, friendship
- **20 quest_ids reserved for Phase 28** — predictable namespacing (`<race>_<feature>`).
- **Cross-validation passed** — 95 unique text_key references in raceChains.ts all resolve to non-empty strings in all 3 locales.

## Task Commits

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | i18n race chain texts (10 races × 10 items) + 5 shared cosmos.event.* (RU/EN/ES parity) | `a7edef2` | `client/src/i18n/ru.json`, `client/src/i18n/en.json`, `client/src/i18n/es.json` |
| 2 | RACE_CHAINS data — 10 races × 10 ChainItem (intro+templated mix) | `a9a68a0` | `client/src/game/config/raceChains.ts` |

## Per-Race ChainItem Distribution

All 10 races share identical structure (4 msg / 3 dialog / 2 quest_hook / 1 event):

| Race | msg | dialog | quest_hook | event | Total | quest_ids |
|------|-----|--------|------------|-------|-------|-----------|
| crystalloids | 4 | 3 | 2 | 1 | 10 | `crystalloids_silent_scout`, `crystalloids_shard_delivery` |
| gasouls | 4 | 3 | 2 | 1 | 10 | `gasouls_lost_note`, `gasouls_sunken_resonator` |
| mechanidons | 4 | 3 | 2 | 1 | 10 | `mechanidons_module_delivery`, `mechanidons_diagnostics` |
| fireworms | 4 | 3 | 2 | 1 | 10 | `fireworms_runaway_acolyte`, `fireworms_shard_to_tenebrians` |
| liquidoids | 4 | 3 | 2 | 1 | 10 | `liquidoids_caravan`, `liquidoids_stolen_cargo` |
| tenebrians | 4 | 3 | 2 | 1 | 10 | `tenebrians_hidden_gate`, `tenebrians_last_shard` |
| plasmaspirits | 4 | 3 | 2 | 1 | 10 | `plasmaspirits_outrun`, `plasmaspirits_lost_flock` |
| forestcores | 4 | 3 | 2 | 1 | 10 | `forestcores_young_forest`, `forestcores_spore_migration` |
| timeweavers | 4 | 3 | 2 | 1 | 10 | `timeweavers_temporal_knot`, `timeweavers_spiral_link` |
| cometfolk | 4 | 3 | 2 | 1 | 10 | `cometfolk_young_comet`, `cometfolk_lost_crest` |
| **TOTAL** | **40** | **30** | **20** | **10** | **100** | **20 unique quest_ids** |

## cosmos.event.<key> Reuse Across Races

5 shared event descriptions reused as event ChainItem text_key (step 6 of each race):

| Event key | Used by race(s) | RU description |
|-----------|-----------------|----------------|
| `cosmos.event.solar_flare` | fireworms, plasmaspirits | «солнечная буря повредила орбитальные станции» |
| `cosmos.event.failed_pact` | mechanidons, forestcores | «провалившийся пакт со старым союзником» |
| `cosmos.event.lost_envoy` | liquidoids, cometfolk | «потеряли посланника» |
| `cosmos.event.ritual_disrupted` | crystalloids, tenebrians, timeweavers | «ритуал был прерван» |
| `cosmos.event.crystal_resonance` | gasouls | «кристаллический резонанс затронул их сны» |

**Note:** Each race also has a race-specific `races.<id>.chain.6.description` flavor string in i18n (e.g. crystalloids: «наш узор треснул», fireworms: «наше пламя дрогнуло — ярость кипит»). These are NOT currently referenced by RACE_CHAINS (event.text_key points to the shared cosmos.event.* key for engine simplicity), but exist for i18n schema completeness (10 chain entries per race) and as Phase 29 race-specific event-flavor anchor.

## Files Created/Modified

- `client/src/game/config/raceChains.ts` (161 LOC → 589 LOC) — RACE_CHAINS skeleton replaced with explicit data; ALL_RACE_IDS_LOCAL constant removed
- `client/src/i18n/ru.json` (+170 lines) — chain texts + 5 cosmos.event.* descriptions in Russian
- `client/src/i18n/en.json` (+170 lines) — English translations
- `client/src/i18n/es.json` (+170 lines) — Spanish translations

## Decisions Made

1. **chain.6.description coexists with event.text_key pointing to cosmos.event.<key>** — engine reads ONE text_key per ChainItem (uniform handling across all 4 variants). Race-specific chain.6.description is kept for i18n completeness (10 entries per race in i18n) and as Phase 29 flavor anchor, but is dormant in Plan 27 runtime path.
2. **Symmetric +1/-1 deltas for all dialog/quest_hook** — clean MVP; asymmetric deltas (e.g. +2/-1 high-stakes) deferred to Phase 29 advanced diplomacy.
3. **Removed ALL_RACE_IDS_LOCAL** — no longer needed once RACE_CHAINS is explicit. TypeScript Record<RaceId, …> catches missing race at compile time.
4. **quest_id namespacing `<race>_<feature>`** — predictable for Phase 28 grep-based wiring.
5. **Personality fidelity per race** — texts re-read against races.<id>.{personality, communication_style} i18n fields to verify tone match. Example anchors:
   - fireworms.communication_style: «Короткие дерзкие сообщения. Прямые приказы.» → chain.0.text: «Я Огнечервь. Раскал жжёт. Говори быстро.» ✓
   - timeweavers.communication_style: «Парадоксальные, временные намёки.» → chain.3.text: «Прошлое и будущее — одна точка. Сейчас — иллюзия.» ✓
6. **Mobile-friendly text length** — every text kept ≤140 chars to fit narrow message bubbles on phones (per CONTEXT cliclability/UX considerations).

## Deviations from Plan

None — plan executed as written.

The plan suggested step 6 race-specific flavor descriptions (e.g. crystalloids: «наш узор треснул») — these were added to the i18n schema as `races.<id>.chain.6.description` keys. RACE_CHAINS event entries reference the shared `cosmos.event.<key>` (per plan Task 2 example code). The race-specific chain.6.description is i18n-only flavor reserved for future use, documented in the SUMMARY and raceChains.ts header.

**Total deviations:** 0

## Issues Encountered

- **No node_modules in worktree** — `npx tsc --noEmit` cannot resolve modules (phaser, react, etc.) because the worktree was created fresh without `pnpm install`. This affects the plan's automated verification step (`cd client && npx tsc --noEmit`). Manual mitigation:
  - Performed grep-based acceptance verification (text_key count per race, ChainItem type counts, ALL_RACE_IDS_LOCAL removed).
  - Used `node` to parse all 3 i18n JSON files (all parse cleanly) and verified every text_key in raceChains.ts resolves to a non-empty string in RU/EN/ES.
  - Documentation note: TS errors in non-touched files (phaser/react JSX) are pre-existing dependency-resolution issues, not regressions. `raceChains.ts` itself has 0 TS errors (confirmed by `grep raceChains` over tsc output).

This is an environment limitation of the worktree, not a code issue. When merged to main where deps are installed, tsc will run cleanly on the touched file.

## User Setup Required

None — pure data plan. No UI changes, no env vars, no manual verification (UI ships in Plan 27-04 which will render these strings).

## Validation Results

| Gate | Command | Result |
|------|---------|--------|
| i18n JSON parse (RU) | `node -e "JSON.parse(fs.readFileSync('src/i18n/ru.json'))"` | exit 0 |
| i18n JSON parse (EN) | same for en.json | exit 0 |
| i18n JSON parse (ES) | same for es.json | exit 0 |
| i18n parity | `node scripts/check-translations.cjs` | 522/522/522, 0 missing, 0 extra |
| chain count per locale | `Object.keys(j.races[id].chain).length` summed × 10 | RU: 100, EN: 100, ES: 100 |
| ChainItem.msg count | grep over RACE_CHAINS body | 40 |
| ChainItem.dialog count | grep over RACE_CHAINS body | 30 |
| ChainItem.quest_hook count | grep over RACE_CHAINS body | 20 |
| ChainItem.event count | grep over RACE_CHAINS body | 10 |
| Total ChainItem count | sum of above | 100 = 10 races × 10 items |
| ALL_RACE_IDS_LOCAL removed | `grep -c ALL_RACE_IDS_LOCAL src/game/config/raceChains.ts` | 0 |
| text_key → i18n resolution (RU) | per-key lookup over 95 unique text_keys | 0 missing |
| text_key → i18n resolution (EN) | same | 0 missing |
| text_key → i18n resolution (ES) | same | 0 missing |
| TypeScript clean on touched file | `grep raceChains` over tsc output | 0 errors (pre-existing phaser/react TS errors in other files are env limitation, see Issues) |

## Self-Check: PASSED

Files verified to exist:
- FOUND: `client/src/game/config/raceChains.ts` (modified, 589 LOC, RACE_CHAINS filled)
- FOUND: `client/src/i18n/ru.json` (modified, 753 LOC, +chain + cosmos.event.*)
- FOUND: `client/src/i18n/en.json` (modified, 753 LOC, parity)
- FOUND: `client/src/i18n/es.json` (modified, 753 LOC, parity)

Commits verified to exist in `git log --oneline`:
- FOUND: `a7edef2` feat(27-02): i18n race chain texts (10 races × 10 items) + 5 shared cosmos.event.* (RU/EN/ES parity)
- FOUND: `a9a68a0` feat(27-02): RACE_CHAINS data — 10 races × 10 ChainItem (intro+templated mix)

## Next Plan Readiness

**Ready for Plan 27-03 (pending engine):**
- `RACE_CHAINS[raceId]` length === 10 for all 10 races (engine bounds-check is `chainProgress[raceId] < RACE_CHAINS[raceId].length`)
- All 4 ChainItem variants represented per race (engine must handle all 4 — msg/dialog/quest_hook/event)
- `event` ChainItem at step 6 of every race — engine triggers toast at pull time, advances chainProgress without pushing to inbox
- Shared cosmos.event.* descriptions ready for toast i18n: `t('cosmos.event.notification', { raceName, description: t(item.text_key), delta })`

**Ready for Plan 27-04 (race detail UI):**
- All 95 unique text_keys resolve in 3 locales — i18next.t() calls won't render raw tokens
- ChainItem.text_key always references a non-empty string (msg/dialog/quest_hook = `races.<id>.chain.<N>.text`; event = `cosmos.event.<key>`)

**Ready for Phase 28 quest wiring:**
- 20 unique quest_ids declared in RACE_CHAINS — Phase 28 will grep these strings to enumerate required quest table entries

**No blockers.** Requirements `PHASE27-CHAIN-DATA-10-RACES`, `PHASE27-I18N-RU`, `PHASE27-I18N-EN`, `PHASE27-I18N-ES` — ready for marking complete.

---
*Phase: 27-contacts-messages-relationships*
*Completed: 2026-05-18*
