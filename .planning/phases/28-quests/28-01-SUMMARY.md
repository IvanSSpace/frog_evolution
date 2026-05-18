---
phase: 28-quests
plan: 01
subsystem: foundation
tags: [quests, typescript, zustand, persistence, i18n, react, cosmic-hub]

# Dependency graph
requires:
  - phase: 27-contacts-messages-relationships
    provides: raceChains.ts quest_hook stub (40 unique quest_ids); CosmicSlice extension pattern; defensive-load template (pendingItems); CosmicTab union extension pattern; cosmic blob gameSync template
  - phase: 26-races-foundation
    provides: RaceId union (10 races); race relationship persistence
  - phase: 22-cosmos-gate
    provides: modal-level cosmos lock — inherited gate для 8th tab visibility
provides:
  - QuestType + QuestTarget (7 variants) + QuestReward (4 variants) discriminated unions
  - QuestConfig + ActiveQuest + CompletedQuest interfaces
  - QUESTS skeleton record (empty — Plan 28-02 fills 40 entries)
  - ACTIVE_QUEST_CAP=5 + COMPLETED_QUEST_HISTORY_CAP=100 constants
  - generateActiveQuestId helper
  - CosmicSlice.activeQuests + completedQuests fields
  - CosmicTab 'quests' literal (8th tab)
  - Defensive load — strip unknown questId / clamp progress / FIFO trim history
  - Server sync (snapshotForSave + loadGameState hydrate) — cross-device quest state
  - i18n RU/EN/ES skeleton (14 leaves per locale, parity preserved)
  - 8th tab «Квесты» 📜 in CosmicHubModal with placeholder content
affects: [28-02-quest-data, 28-03-quest-engine, 28-04-quests-tab-ui, 28-05-reward-popup, 28-06-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Foundation skeleton split — types+state+sync+UI placeholder land here; data (Plan 28-02), engine (Plan 28-03), UI (Plan 28-04) land in subsequent waves without conflict"
    - "Defensive load via `r.questId in QUESTS` lookup — drops removed/renamed quests on next load (forward-compat for Plan 28-02 fill)"
    - "FIFO history trim on persistence load (sort desc, slice CAP) — completedQuests pattern reusable for future history-style state"
    - "QuestId as `string` alias (NOT literal union) — keeps foundation independent of chain data; engine handles unknown ids defensively"
    - "CosmicTab 8th literal added AFTER 'contacts' — preserves prior ordering; modal-level cosmos gate inherits Phase 22-06 pattern (no per-tab gate)"

key-files:
  created:
    - client/src/game/config/quests.ts
  modified:
    - client/src/store/cosmic/types.ts
    - client/src/store/persistence.ts
    - client/src/store/gameStore.ts
    - client/src/api/gameSync.ts
    - client/src/api/gameSync.test.ts
    - client/src/components/CosmicHub/CosmicHubModal.tsx
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json

key-decisions:
  - "QuestId as `string` alias instead of literal union — keeps Plan 28-01 foundation independent of Plan 28-02 chain content; engine in Plan 28-03 must defensively handle QUESTS[id] === undefined"
  - "ACTIVE_QUEST_CAP and COMPLETED_QUEST_HISTORY_CAP enforced engine/load-side respectively, NOT in TS shape — mirrors Phase 27 CHAIN_PENDING_CAP forward-compat pattern"
  - "Defensive load strips entries where `r.questId not in QUESTS` — acceptable for Plan 28-01 wave (zero production data); on Plan 28-02 fill the lookup becomes meaningful"
  - "8th tab placeholder uses inline `<div>{t(...placeholder)}</div>` instead of importing QuestsTab — keeps tsc clean while Plan 28-04 lands in parallel wave"
  - "i18n skeleton ships 14 leaves per locale (1 tab_quests + 9 quests.* + 4 quests.type.*) — Plan 28-02 will add 80 description_key+short_key leaves on top"

patterns-established:
  - "Foundation-only PR pattern (types + state + sync + i18n skeleton + UI placeholder) for waves that decompose feature into 5+ parallelisable plans"
  - "Defensive-load via lookup-set check (`r.questId in QUESTS`) forward-compatible across data fills"
  - "FIFO history cap on persistence load (sort + slice) — reusable for future `historyOf*` state"

requirements-completed:
  - PHASE28-QUEST-CONFIG
  - PHASE28-QUEST-TYPES-4
  - PHASE28-ACTIVE-QUESTS-STATE
  - PHASE28-COMPLETED-QUESTS-STATE
  - PHASE28-CAP-5
  - PHASE28-PERSISTENCE
  - PHASE28-SERVER-SYNC
  - PHASE28-I18N-RU
  - PHASE28-I18N-EN
  - PHASE28-I18N-ES
  - PHASE28-COSMOS-GATE

# Metrics
duration: 5min
completed: 2026-05-19
---

# Phase 28 Plan 28-01: Foundation Summary

**Quest mechanic foundation — types (4 QuestType × 7 QuestTarget × 4 QuestReward), CosmicSlice activeQuests+completedQuests with defensive load (unknown-id strip + 100-history FIFO trim), cross-device server sync, 8-я Квесты 📜 tab registered с placeholder content, и 14×3 i18n leaves в parity.**

## Performance

- **Duration:** 4m 58s (commit 64d81bf → commit 2654c70)
- **Started:** 2026-05-19T00:21:45Z
- **Completed:** 2026-05-19T00:26:43Z
- **Tasks:** 3
- **Files created:** 1 (`client/src/game/config/quests.ts`)
- **Files modified:** 9

## Accomplishments

- Discriminated-union quest type surface ready for Plan 28-02 data fill (40 quest configs) и Plan 28-03 engine (progress evaluator)
- CosmicSlice extended with two new fields, both persisted + server-synced, with defensive load that drops unknown questIds + caps completedQuests at 100 newest
- CosmicTab union extended; persistence whitelist + sessionStorage whitelist + CosmicHubModal getInitialTab all accept 'quests'
- gameSync.test.ts coverage regression intact (REQUIRED_COSMIC_SYNC_FIELDS extended; 2 tests still PASS) — prevents drift between CosmicSlice / persistence / snapshotForSave
- 8-я «Квесты» tab visible после cosmos unlock (cosmos gate inherited at modal level); tab strip renders 8 entries без runtime error
- i18n parity preserved across all 3 locales (RU/EN/ES = 553 keys each; +14 leaves per locale from Plan 27 baseline 539)

## Task Commits

Each task was committed atomically:

1. **Task 1: Quest types + QUESTS skeleton + constants** — `64d81bf` (feat)
2. **Task 2: Cosmic state extension + persistence + server sync** — `16bc367` (feat)
3. **Task 3: 8-я «Квесты» tab + i18n RU/EN/ES skeleton** — `2654c70` (feat)

## Files Created/Modified

### Created
- `client/src/game/config/quests.ts` — 210 lines. QuestId/QuestType/QuestTarget/QuestReward/QuestConfig/ActiveQuest/CompletedQuest exports. ACTIVE_QUEST_CAP=5 + COMPLETED_QUEST_HISTORY_CAP=100 constants. generateActiveQuestId helper. QUESTS empty record skeleton.

### Modified
- `client/src/store/cosmic/types.ts` — CosmicSlice gains activeQuests + completedQuests; CosmicTab union gets 'quests'; makeInitialCosmicSlice seeds both as [].
- `client/src/store/persistence.ts` — Imports quest types + QUESTS + COMPLETED_QUEST_HISTORY_CAP. lastActiveTab whitelist accepts 'quests'. Defensive load: 2 new IIFE blocks (activeQuests strip unknown questId / clamp progress / validate type+raceId; completedQuests FIFO trim at 100).
- `client/src/store/gameStore.ts` — subscribe change-detection OR clause + saveCosmicSlice payload extended.
- `client/src/api/gameSync.ts` — snapshotForSave cosmic blob gets 2 new fields; loadGameState hydrate path picks them up.
- `client/src/api/gameSync.test.ts` — REQUIRED_COSMIC_SYNC_FIELDS extended with activeQuests + completedQuests.
- `client/src/components/CosmicHub/CosmicHubModal.tsx` — getInitialTab accepts 'quests'; TABS array 8th entry (📜 Квесты, enabled=true) after 'contacts'; renderTab placeholder case.
- `client/src/i18n/ru.json` — `cosmic_hub.tab_quests` + 13-leaf `cosmic_hub.quests.*` block (9 leaves + 4 nested type leaves).
- `client/src/i18n/en.json` — mirror parity.
- `client/src/i18n/es.json` — mirror parity.

## Decisions Made

- **QuestId as `string` alias, not literal union.** Plan 28-02 fills 40 entries via `Record<QuestId, QuestConfig>` без compile-time exhaustive check. Trade-off: engine in Plan 28-03 must `if (!QUESTS[id]) devWarn(...)` defensively instead of relying on TS narrowing. Rationale: keeps foundation Plan independent of data Plan; enables parallel wave landing.
- **Defensive load drops unknown questIds via `r.questId in QUESTS` check.** Forward-compat: if a quest is removed from QUESTS in a future patch, persisted player saves auto-clean it on next load (no migration script needed). Acceptable for Plan 28-01 wave because QUESTS skeleton is empty AND zero production data exists for this feature yet.
- **CAP enforcement out-of-shape.** ACTIVE_QUEST_CAP enforced by engine (Plan 28-03), COMPLETED_QUEST_HISTORY_CAP enforced by defensive load. Neither is in the TS type — mirrors Phase 27 CHAIN_PENDING_CAP pattern so caps can change без migration.
- **Tab placeholder is inline `<div>{t(...placeholder)}</div>`, not a stub component file.** Avoids creating a placeholder file that Plan 28-04 will overwrite; renderTab switch case stays one block. Plan 28-04 import replacement is a one-line change.
- **i18n key naming `cosmic_hub.quests.*`** parallel to `cosmic_hub.contacts.*` Phase 27 namespace — keeps cosmic_hub umbrella consistent for `t('cosmic_hub.…')` consumer patterns in tab content.

## Deviations from Plan

None — plan executed exactly as written.

The plan's `<action>` blocks gave exact edit locations (line numbers + adjacent context). All 3 tasks landed на first attempt, all 12 acceptance grep criteria passed, all 3 verification gates (tsc + eslint + check-translations + vitest) green на first pass. No auto-fixes triggered; no Rule 1-3 deviations needed.

## Issues Encountered

None.

## Known Stubs

These are **intentional skeleton placeholders**, scheduled for replacement in later Plan 28-* waves. Each is documented inline в source с reference to the resolving plan.

| File | Line | Stub | Resolving Plan |
|------|------|------|----------------|
| `client/src/game/config/quests.ts` | 198 (`export const QUESTS = {}`) | Empty quest catalogue — Plan 28-02 fills 40 entries (1 per raceChains.ts quest_hook quest_id) | 28-02 |
| `client/src/components/CosmicHub/CosmicHubModal.tsx` | renderTab `case 'quests'` | Inline `<div>{t('cosmic_hub.quests.placeholder')}</div>` — Plan 28-04 replaces with `<QuestsTab />` | 28-04 |
| `client/src/i18n/{ru,en,es}.json` | `cosmic_hub.quests.placeholder` | Localised "Раздел квестов в разработке" / "Quests panel under construction" / "Panel de misiones en desarrollo" — Plan 28-04 makes this string unreachable once real UI lands | 28-04 (string остаётся в i18n как fallback) |

The empty `QUESTS` record AND the placeholder UI are **not** stubs that block the plan goal — Plan 28-01's goal is "foundation that allows parallel landing of 28-02/28-03/28-04". Both stubs are core to that goal: they preserve cycle-clean tsc/eslint/test gates while NOT pre-committing to data/UI decisions that belong to later plans.

## User Setup Required

None — no external service configuration required.

## Validation Results

**Build chain (run after all 3 tasks landed):**

| Gate | Command | Result |
|------|---------|--------|
| tsc | `cd client && ./node_modules/.bin/tsc --noEmit` | PASS (0 errors) |
| eslint | `./node_modules/.bin/eslint <all 10 touched files>` | PASS ("No issues found") |
| check-translations | `node scripts/check-translations.cjs` | PASS — 553 keys per locale, 0 missing / 0 extra |
| vitest (gameSync coverage) | `./node_modules/.bin/vitest run src/api/gameSync.test.ts` | PASS — 2/2 tests |
| vitest (full suite) | `./node_modules/.bin/vitest run` | PASS — 21 test files, 174 tests, 1 skipped, 0 failed |

**Acceptance grep criteria (per-task):**
- Task 1 — all 22 grep counts ≥ expected (single new file).
- Task 2 — all 14 grep counts ≥ expected.
- Task 3 — all 12 grep counts ≥ expected (3 i18n + 9 modal).

## Self-Check

Verifying claimed outputs exist on disk:

- ✅ `client/src/game/config/quests.ts` — FOUND
- ✅ commit `64d81bf` — FOUND in git log
- ✅ commit `16bc367` — FOUND in git log
- ✅ commit `2654c70` — FOUND in git log

## Self-Check: PASSED

## Next Plan Readiness

**Plan 28-02 (quest data) — ready.**
- QuestConfig interface frozen; can be filled directly into `QUESTS` record.
- 40 quest_id stubs are already in raceChains.ts (4 per race × 10 races); Plan 28-02 walks that list.
- i18n description_key/short_key namespace `quests.<id>.{description,short}` reserved (no collisions with Plan 28-01's `cosmic_hub.quests.*`).

**Plan 28-03 (quest engine) — ready.**
- ActiveQuest shape frozen.
- generateActiveQuestId helper exported.
- ACTIVE_QUEST_CAP constant exported.
- gameStore subscribe + persistence load both already cover activeQuests/completedQuests, so engine slice actions просто `set` через standard Zustand path.

**Plan 28-04 (Quests tab UI) — ready.**
- 'quests' tab is wired в CosmicHubModal switch — Plan 28-04 changes one `case 'quests':` block to import & render `<QuestsTab />`.
- i18n header_active / empty_state / cap_reached / cancel_confirm / cancel_button / reward_popup_* keys ready in all 3 locales.
- Mobile-first tab strip fit-check still pending — Plan 28-04 acceptance criteria should measure rendered width на 320px viewport (current 8 entries × 4-padding flex strip может быть tight).

**Plan 28-05 (reward popup) — ready.**
- CompletedQuest.rewardClaimed field shape frozen.
- reward_popup_title + reward_popup_dismiss i18n keys в parity.

**Plan 28-06 (smoke test) — unblocked once 28-02..05 land.**

No blockers identified. Foundation is consistent across all 7 layers (types / state / persistence / server sync / sync-coverage-test / i18n / UI tab registration).

---
*Phase: 28-quests*
*Completed: 2026-05-19*
