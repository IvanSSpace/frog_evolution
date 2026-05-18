---
phase: 28-quests
plan: 02
subsystem: data
tags: [quests, data, i18n, ru, en, es, race-personality, discriminated-union]

# Dependency graph
requires:
  - phase: 28-quests
    plan: 01
    provides: QuestId/QuestType/QuestTarget/QuestReward/QuestConfig discriminated unions; QUESTS empty record skeleton; description_key/short_key field shape
  - phase: 27-contacts-messages-relationships
    plan: 01
    provides: raceChains.ts 40 quest_id stubs (4 hooks per race × 10 races)
  - phase: 26-races-foundation
    plan: 01
    provides: RaceId union; race affinity → Element mapping
provides:
  - QUESTS record filled with 40 QuestConfig entries (one per quest_id stub)
  - 80 i18n leaves per locale under top-level "quests" namespace (description + short × 40)
  - 240 new strings total across RU/EN/ES (553 → 633 keys per locale, parity intact)
  - Race-personality tone baseline для quest description strings (10 distinct voices)
  - Reward magnitude placeholder scaling (essence 1/3/5, serum 1/2/3, gold 10M/100M/500M)
affects: [28-03-quest-engine, 28-04-quests-tab-ui, 28-05-reward-popup, 28-06-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mechanical assignment table (per-quest_id deterministic type+target+reward triple) — keeps data review tractable, no judgement calls in the diff"
    - "i18n personality bleed — race tone is encoded ONLY in description strings, NOT in QuestConfig types; runtime engine treats all 40 quests identically"
    - "Alphabetical quest_id ordering inside i18n quests namespace — diff-reviewable across all 3 locales"
    - "JSON canonical reformatting via json.dump(indent=2) — accidental side-effect (all existing keys reflowed to multi-line) but prettier --check still passes and content is byte-for-byte preserved per leaf"

key-files:
  created: []
  modified:
    - client/src/game/config/quests.ts
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json

key-decisions:
  - "Difficulty assignment mechanical per quest_id suffix (no suffix = easy, _b = medium, _c = hard) — yields 20/10/10 across the 40 quests"
  - "Reward magnitude placeholders match Plan 28-02 action table (essence 1/3/5, serum 1/2/3, gold 10M/100M/500M, diplomacy = relationship_and_bonus with bonus_id placeholder string). Final balancing deferred (CONTEXT lines 219-225 explicitly tag these as placeholder)"
  - "Type distribution intentionally skewed toward exploration (14) and merge (11) over delivery (8) and diplomacy (7) — reflects per-race personality fit (Plasmaspirits/Cometfolk are explorers; Fireworms/Timeweavers favour merge ritual). All 4 types still ≥5, per acceptance criteria"
  - "Reward distribution: essence 13 / gold 11 / serum 10 / relationship_and_bonus 6 — all ≥3 per acceptance criteria. Skewed toward essence/gold because they are mechanically simpler — Plan 28-03 can wire them first; relationship_and_bonus rewards depend on a bonus catalogue lookup table deferred to Plan 28-05"
  - "i18n namespace placement: top-level `quests.*` (not nested under `cosmic_hub.quests.*`). The existing `cosmic_hub.quests.*` block from Plan 28-01 holds UI labels (header, empty_state, cancel_confirm, etc.) — the new top-level `quests.*` block holds per-quest description + short labels. Two namespaces co-exist by design; description_key strings in QuestConfig point at the top-level one"
  - "PHASE28-QUEST-DATA-60-MAPPINGS REQ-ID retains the '60' label from the original Phase 28 outline, but factually = 40 mappings (one per quest_id stub in raceChains.ts). The original 60 estimate counted 20 base × 3 variants = 60; actual raceChains.ts shipped 20 base × 2 variants (_b + _c) per race × 10 races / 5 base-without-variant pattern = 40 unique quest_ids"
  - "Bonus_id placeholder strings (gold_income_1pct, ship_speed_1pct, serum_drop_1pct, shop_discount_1pct) — opaque tokens; the actual bonus catalogue (mapping bonus_id → in-game effect) lands in Plan 28-05 reward popup or a later balancing plan"

requirements-completed:
  - PHASE28-QUEST-DATA-60-MAPPINGS
  - PHASE28-QUEST-CONFIG
  - PHASE28-REWARD-ESSENCE
  - PHASE28-REWARD-SERUM
  - PHASE28-REWARD-GOLD
  - PHASE28-REWARD-DIPLOMACY
  - PHASE28-I18N-RU
  - PHASE28-I18N-EN
  - PHASE28-I18N-ES
  - PHASE28-I18N-PARITY

# Metrics
duration: 9min
completed: 2026-05-19
---

# Phase 28 Plan 28-02: Quest Data + i18n Summary

**40 QuestConfig entries filled into QUESTS record (one per raceChains.ts quest_id stub, 4 hooks per race × 10 races) + 240 new i18n leaves (40 quests × 2 keys × 3 locales) under a new top-level `quests` namespace, with per-race personality tone bleeding through description strings.**

## Performance

- **Duration:** ~9 minutes (commits 9592f9e → 640e3ee)
- **Started:** 2026-05-18T18:30:41Z
- **Completed:** 2026-05-18T18:40:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 config + 3 locale JSON)
- **Files created:** 0

## Accomplishments

- 40-entry QUESTS catalogue: every raceChains.ts `quest_id` stub now has a runtime-resolvable QuestConfig. Coverage check (every raceChains.ts quest_id maps to a QUESTS entry) passes 40/40 with zero MISSING.
- Type distribution mathematically valid: exploration 14, merge 11, delivery 8, diplomacy 7 — all 4 QuestType variants ≥5, satisfying acceptance criteria.
- Reward distribution mathematically valid: essence 13, gold 11, serum 10, relationship_and_bonus 6 — all 4 QuestReward kinds ≥3.
- Difficulty assignment follows suffix convention deterministically: 20 easy (no suffix) + 10 medium (_b) + 10 hard (_c) = 40.
- 240 new i18n leaves landed under top-level `"quests"` namespace in all 3 locales. Each of 40 quest_ids has a `description` (12-25 word narrative in race-voice) + `short` (2-5 word card label). PARITY intact: 553 → 633 keys per locale; check-translations reports 0 missing / 0 extra.
- 10 race personality voices realised in description text:
  - **Crystalloids** patient measured geometric, **Gasouls** ethereal whisper, **Mechanidons** protocol-formal, **Fireworms** aggressive ritual imperatives, **Liquidoids** trade-pragmatic, **Tenebrians** conspiratorial hushed, **Plasmaspirits** kinetic urgent, **Forestcores** slow organic, **Timeweavers** cryptic philosophical, **Cometfolk** cheerful enthusiastic.
- tsc + eslint + check-translations + vitest gates all green (174 tests pass, 1 skipped — same baseline as 28-01).
- Bundle delta: +~459 LOC in quests.ts (40 entries × ~11 lines each) + ~80 leaves × 3 locales added to i18n JSON. Existing JSON reformatted to prettier-canonical multiline form (no content change; see Deviations).

## Task Commits

Each task was committed atomically:

1. **Task 1: Fill QUESTS record with 40 quest configurations** — `9592f9e` (feat)
2. **Task 2: 240 i18n leaves for quest descriptions (RU/EN/ES)** — `640e3ee` (feat)

## Files Created/Modified

### Created
None — Plan 28-02 is a data fill, not a structural extension.

### Modified
- `client/src/game/config/quests.ts` — QUESTS record replaced (was empty `{}`, now 40 QuestConfig entries). +459 LOC. Sections divided by `// ─── raceId ───` comments; 4 entries per race × 10 races; ordering by race then by suffix (easy → _b → _c).
- `client/src/i18n/ru.json` — top-level `"quests"` namespace appended (40 sub-objects × {description, short}); existing keys preserved verbatim but reflowed to prettier-canonical multiline JSON.
- `client/src/i18n/en.json` — mirror parity (RU sibling).
- `client/src/i18n/es.json` — mirror parity (RU sibling).

## Decisions Made

- **Mechanical type/target/reward assignment table.** Plan 28-02 action block specified an exact 40-row table; followed verbatim so the diff is purely data, not judgment. Future balancing (different reward magnitudes, different target counts) is a separate concern from "is the data structurally correct".
- **i18n namespace placement: top-level `quests.*`, not nested under `cosmic_hub.quests.*`.** The existing `cosmic_hub.quests.*` from Plan 28-01 holds 10 UI labels (header_active, empty_state, cap_reached, etc.). The new top-level `quests.*` holds per-quest description + short. They co-exist by design — `description_key` strings in QuestConfig point at the top-level namespace.
- **Alphabetical ordering of quest_ids inside i18n namespace.** Plan 28-02 explicitly recommends alphabetical for diff reviewability across 3 locales. Implemented via generator script using a sorted EXPECTED_IDS list.
- **Reward magnitudes from CONTEXT placeholder scaling, not refined.** CONTEXT lines 219-225 mark them "placeholder, балансировка later". Used as-is. Final balancing will land in a future plan or Phase 30+ pacing pass.
- **Race personality tone realised ONLY in i18n description strings, not in QuestConfig types.** The engine (Plan 28-03) treats all 40 quests identically. Personality lives in text alone.
- **Bonus_id placeholder strings.** Used 4 opaque tokens (`gold_income_1pct`, `ship_speed_1pct`, `serum_drop_1pct`, `shop_discount_1pct`) for `relationship_and_bonus` rewards. The actual bonus catalogue (token → in-game effect) is deferred to Plan 28-05 (reward popup).
- **PHASE28-QUEST-DATA-60-MAPPINGS REQ-ID label vs reality.** Original Phase 28 outline estimated ~60 mappings; actual count is 40 (verified via grep on raceChains.ts quest_id literals). Documented in REQ-ID name for traceability; functionally satisfied as "fill every quest_id stub".

## Deviations from Plan

### Rule 1 (auto-fix style): JSON canonical reformatting

**Trigger:** Task 2's Python generator (`json.dump(indent=2)`) reformatted ALL existing keys in each locale JSON file to prettier-canonical multiline form, not just the new `quests` block.

**Impact:** Diff is ~882 lines per JSON file (vs ~160 lines of pure additions). Existing key content is byte-for-byte preserved per leaf — verified by re-parsing JSON and inspecting selected pre-existing keys (`captain.birth`, `cosmic_hub.tab_quests`, etc.).

**Why kept:** `prettier --check` validates the reformatted output as canonical. The compact one-liner format used previously (e.g., `"0": { "text": "..." }`) was not prettier-canonical, just manually compact. Reverting the reflow would require manual splicing of just the `quests` block into the original files, which risks more error than benefit.

**Files:** `client/src/i18n/{ru,en,es}.json`
**Commit:** `640e3ee`

### Acceptance criterion text mismatch (informational, not a deviation)

`grep -c '"quests":' client/src/i18n/ru.json` returns **2**, not 1 as the acceptance criterion text said. This is because:
- 1 occurrence is the new top-level `"quests": { ... }` namespace (40 quest sub-objects).
- 1 occurrence is the pre-existing nested `"cosmic_hub": { ..., "quests": { ... } }` namespace (10 UI labels from Plan 28-01).

Both are legitimate and were both planned. The Plan 28-02 action block correctly placed the new namespace at top-level. The acceptance text just didn't anticipate the pre-existing nested `cosmic_hub.quests`. Same applies to en.json and es.json (each returns 2).

## Issues Encountered

### Worktree path resolution accident

**What happened:** First Task 1 Edit was applied to the main repo (`/Users/shar/.../frog_evolution_code/client/src/game/config/quests.ts`) instead of the worktree path (`/Users/shar/.../frog_evolution_code/.claude/worktrees/agent-a8183fd1c4525e343/client/src/game/config/quests.ts`). The Bash tool resets `cwd` between calls and the `cd` was reverting to the agent's launched cwd.

**Recovery:** Copied the edited file to `/tmp/quests-task1.ts`, ran `git checkout` to restore main repo's original quests.ts, then copied the saved content to the correct worktree path. Re-ran tsc/eslint/coverage in the worktree, all green. Task 1 was then committed cleanly in the worktree branch.

**Net effect:** Zero impact on the deliverable — main repo's quests.ts is back to its pre-edit state; worktree has the correct 40-entry record committed. Process lesson logged for future plan executions in worktrees.

## Known Stubs

The only intentional placeholder is the `bonus_id` token strings in `relationship_and_bonus` rewards (4 quests use them):

| Quest | bonus_id | Resolving Plan |
|-------|----------|----------------|
| crystalloids_lattice_survey_b | gold_income_1pct | 28-05 (reward popup) or later balancing plan |
| mechanidons_audit_route_b | ship_speed_1pct | 28-05 |
| fireworms_blood_oath_c | serum_drop_1pct | 28-05 |
| liquidoids_market_truce_c | shop_discount_1pct | 28-05 |
| forestcores_root_bridge_c | gold_income_1pct | 28-05 |
| cometfolk_long_orbit_c | ship_speed_1pct | 28-05 |

These are opaque tokens at this stage — the engine does not yet resolve them to actual in-game bonuses. Plan 28-05 (reward popup) is expected to introduce the catalogue mapping (or to defer it again with a stub renderer).

## User Setup Required

None — pure data + i18n changes. No new dependencies, no env config, no migrations.

## Validation Results

**Build chain (run after both tasks landed in worktree):**

| Gate | Command | Result |
|------|---------|--------|
| tsc | `cd client && ./node_modules/.bin/tsc --noEmit` | PASS (0 errors) |
| eslint | `./node_modules/.bin/eslint src/game/config/quests.ts` | PASS (clean) |
| prettier | `./node_modules/.bin/prettier --check src/i18n/{ru,en,es}.json` | PASS |
| check-translations | `node scripts/check-translations.cjs` | PASS — 633 keys per locale, 0 missing / 0 extra |
| vitest (full suite) | `./node_modules/.bin/vitest run` | PASS — 21 test files, 174 tests, 1 skipped, 0 failed |
| Coverage | `for id in $(grep ... raceChains.ts); do grep -q "$id" quests.ts; done` | 40/40 — zero MISSING |
| Per-locale id presence | each of 40 quest_ids has `"<id>":` in ru.json/en.json/es.json | PASS |

**Acceptance grep criteria (per-task):**
- Task 1 — 40 entries in QUESTS, 40 `description_key:` / `short_key:` literals, 20 easy / 10 medium / 10 hard, all 4 types ≥5, all 4 reward kinds ≥3. PASS.
- Task 2 — top-level `quests` namespace present in all 3 locales, 40 description + 40 short leaves per locale, JSON valid, parity intact. PASS.

## Self-Check

Verifying claimed outputs exist on disk:

- `client/src/game/config/quests.ts` — FOUND (worktree, 655 lines, 40 QUESTS entries verified via grep)
- `client/src/i18n/ru.json` — FOUND (1261 lines, 633 leaves, top-level `quests` namespace verified)
- `client/src/i18n/en.json` — FOUND (1261 lines, 633 leaves)
- `client/src/i18n/es.json` — FOUND (1261 lines, 633 leaves)
- commit `9592f9e` — FOUND in git log
- commit `640e3ee` — FOUND in git log

## Self-Check: PASSED

## Next Plan Readiness

**Plan 28-03 (quest engine) — ready.**
- QUESTS[questId] now returns a real QuestConfig (not undefined) for every quest_id in raceChains.ts. Defensive `if (!QUESTS[id]) devWarn(...)` paths from Plan 28-01 stay live but should not trigger in practice.
- All 7 QuestTarget shapes are exercised across the 40 entries — engine's progress switch will encounter every variant during smoke testing.
- All 4 QuestReward shapes are exercised — engine's reward applier needs to handle every variant.

**Plan 28-04 (Quests tab UI) — ready.**
- `description_key` / `short_key` strings on every QuestConfig point at real i18n leaves (verified per-quest across 3 locales). Plan 28-04 UI can render quest cards with `t(quest.description_key)` and `t(quest.short_key)` without missing-key fallback.
- Race personality tones in description text give the UI varied texture without needing further per-race UI logic.

**Plan 28-05 (reward popup) — partially ready.**
- 4 reward shapes are wired and renderable. The `relationship_and_bonus.bonus_id` token catalogue is still a stub — Plan 28-05 either ships the catalogue or surfaces tokens as opaque strings.

**Plan 28-06 (smoke test) — unblocked once 28-03..05 land.**

No blockers identified. The data layer is consistent across all 3 layers (config, i18n, raceChains foreign keys).

---
*Phase: 28-quests*
*Completed: 2026-05-19*
