---
phase: 28-quests
plan: 03
subsystem: quest-engine
tags: [quests, zustand, eventBus, react, dev-helpers, vitest, tdd]

# Dependency graph
requires:
  - phase: 28-quests
    plan: 01
    provides: QUESTS skeleton + QuestId/QuestConfig/ActiveQuest/CompletedQuest types + ACTIVE_QUEST_CAP=5 + COMPLETED_QUEST_HISTORY_CAP=100 + generateActiveQuestId helper + CosmicSlice.activeQuests/completedQuests fields + persistence/server-sync
  - phase: 27-contacts-messages-relationships
    plan: 03
    provides: applyDeltaClamp helper + pendingEngine pattern + 'contacts:relationship-delta' eventBus event + resolveAccept hook for quest_hook ChainItem + devContacts.ts DEV helper template
  - phase: 22-cosmos-redesign
    provides: gold income via root.addGold (Phase 1 l18 multiplier path) + essence as cosmic-slice field
provides:
  - questEngine.ts pure module — activateQuestFromHook + checkActiveQuestsProgress + applyQuestReward + isQuestComplete + generateActiveQuestUuid
  - 4 new typed eventBus events — 'quests:activated' / 'quests:cap-reached' / 'quests:completed' / 'quests:cancelled'
  - 4 new cosmic slice actions — activateQuestFromHook / cancelQuest / markQuestProgress / reconcileQuestProgress
  - resolveAccept extension — wires quest_hook accept to activateQuestFromHook
  - QuestController React.FC — subscribes 5 progress eventBus events + boot-time reconcile
  - devQuests.ts — 5 DEV helpers symmetric install/uninstall (tree-shaken from prod)
  - App.tsx wiring — QuestController mounted, installQuestDevHelpers in DEV useEffect
  - 24 vitest unit tests on the engine (≥10 required)
affects: [28-04-quests-tab-ui, 28-05-reward-popup, 28-06-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure engine + slice action wrapper — engine is side-effect-free, slice atomically applies delta via single set() then emits eventBus events outside set (mirror Phase 27 pendingEngine + 27-03 slice pattern)"
    - "vi.mock + vi.importActual fixture override — engine tests stay independent of Plan 28-02 data fill by overriding only QUESTS while preserving ACTIVE_QUEST_CAP / generateActiveQuestId / types via spread"
    - "Hybrid event-driven + polling progress evaluation — per-target-kind rules in computeProgressForQuest; event-only kinds (serum/merge/planets/missions) use +1 increment on matching event, poll-only kinds (gold_amount, raise_relationship, merge_to_level via discoveredLevels) use snapshot poll, mixed kinds combine both paths"
    - "QuestReward → RewardApplicationDelta routing — engine returns slice-applicable delta payload (serumDelta/goldDelta/essenceDelta/relationshipDelta/bonusId); slice applies via atomic set() + root.addGold dispatch for gold (Phase 1 multiplier path)"
    - "React.FC controller (vs imperative installer) — QuestController uses useEffect lifecycle for automatic HMR-safe subscribe/unsubscribe; null-render keeps component cost zero after mount"
    - "eventBus typing via `import('...')` type — 'quests:completed' carries QuestReward type without value-import cycle (eventBus stays decoupled from quests config)"

key-files:
  created:
    - client/src/game/quests/questEngine.ts
    - client/src/game/quests/questEngine.test.ts
    - client/src/game/quests/questController.tsx
    - client/src/utils/devQuests.ts
  modified:
    - client/src/store/eventBus.ts
    - client/src/store/cosmic/slice.ts
    - client/src/App.tsx

key-decisions:
  - "Engine treats unknown questId as data drift, NOT a programming error — defensive no-op with DEV-only console.warn. Activation cap path emits 'quests:cap-reached' so UI can toast; quest_hook relationship +1 still applies per CONTEXT D-Quest activation cap."
  - "Progress evaluation kept SEPARATE per target.kind in computeProgressForQuest with explicit switch — no shared 'increment-on-matching-event' table. Trade-off: more code per branch but each branch is a 3-line rule that's easy to audit. Phase 29 polish may extract patterns once they stabilize."
  - "Polling-only progress kinds (gold_amount, raise_relationship via raceRelationships, merge_to_level via discoveredLevels) still consulted on event ticks AND on event:null reconcile — guarantees no progress is lost when cross-device sync lands relevant state without a follow-up event."
  - "raceId on new eventBus events typed as `string`, not RaceId — mirrors Phase 27 'contacts:relationship-delta' pattern to avoid the eventBus → slice → races/quests → types → eventBus cycle. Subscribers (QuestController) narrow-cast at consumption."
  - "QuestReward.reward type carried on 'quests:completed' eventBus payload via `import('../game/config/quests').QuestReward` — type-only import keeps eventBus.ts free of value-imports from quests config (no top-level cycle risk; type erases at compile time)."
  - "engineActivate alias on slice import disambiguates from the slice action of the same name (`activateQuestFromHook`). Keeps the action interface signature clean (no `engine.` prefix in CosmicSliceActions) while preserving call-site clarity."
  - "Boot-time reconcileQuestProgress() invoked from QuestController mount useEffect — picks up polling-only progress lost during offline (gold accumulated by ghost-frogs, relationships changed by Phase 27 chain events while game was closed). Reconcile is cheap (linear in activeQuests, cap 5)."

patterns-established:
  - "Pure engine + slice action wrapper template extended from Phase 27 pendingEngine — Phase 28 questEngine reuses identical patterns (input/output shapes, applyDeltaClamp dependency, defensive idempotency on unknown id) with quest-specific progress evaluation"
  - "React.FC controller for eventBus → slice action wiring (cleanup via useEffect return) — companion pattern to imperative installer (captainBirthController). Choice rule: imperative when production-critical AND idempotency must survive double-invoke; React when test-friendly + HMR-safe matters more"
  - "Token-free reward routing via RewardApplicationDelta — engine resolves QuestReward into typed payload, slice routes per field to (addSerum / addGold root action / set+essence / applyDeltaClamp+raceRelationships). Phase 29 reward bonuses extend via `bonusId` opaque tag stored on completedQuest.rewardClaimed"

requirements-completed:
  - PHASE28-AUTO-ACTIVATE-FROM-HOOK
  - PHASE28-AUTO-COMPLETE-PROGRESS
  - PHASE28-MANUAL-CANCEL-PENALTY
  - PHASE28-PROGRESS-HOOKS-EVENTBUS
  - PHASE28-REWARD-ESSENCE
  - PHASE28-REWARD-SERUM
  - PHASE28-REWARD-GOLD
  - PHASE28-REWARD-DIPLOMACY
  - PHASE28-CAP-5
  - PHASE28-DEV-HELPERS

# Metrics
duration: ~10min
completed: 2026-05-19
---

# Phase 28 Plan 28-03: Quest Engine + Slice Actions + EventBus Events Summary

**Pure questEngine module (activateQuestFromHook + checkActiveQuestsProgress + applyQuestReward + isQuestComplete + generateActiveQuestUuid), 4 new cosmic slice actions wiring engine into Phase 27 quest_hook accept path, 4 new typed eventBus events for quest lifecycle, QuestController React.FC subscribing 5 progress event streams + boot reconcile, 5 DEV helpers symmetric install/uninstall (tree-shaken from prod). 24 vitest tests (≥10 required) cover all 4 QuestType × 7 QuestTarget shapes, cap enforcement, defensive no-ops, reward routing, RNG injection for serum/random.**

## Performance

- **Duration:** ~10 min (commit `d48813e` → commit `57963e4`)
- **Started:** 2026-05-19T00:33Z
- **Completed:** 2026-05-19T00:43Z
- **Tasks:** 3
- **Files created:** 4 (`questEngine.ts`, `questEngine.test.ts`, `questController.tsx`, `devQuests.ts`)
- **Files modified:** 3 (`eventBus.ts`, `slice.ts`, `App.tsx`)
- **Lines added:** ~1170 across the 4 new files plus modifications

## Accomplishments

- Pure quest engine ready for Plan 28-04 UI consumption — activateQuestFromHook returns ActivationOutput discriminated by capReached, slice action wrappers emit precise eventBus events for each path
- 4 lifecycle eventBus events typed end-to-end — Plan 28-04 QuestsTab can subscribe to 'quests:activated' / 'cap-reached' / 'cancelled' for re-render triggers; Plan 28-05 reward popup consumes 'quests:completed' with full QuestReward payload
- resolveAccept extended to wire Phase 27 quest_hook accept → Phase 28 quest activation in a single line: `if (mode === 'accept' && item.type === 'quest_hook') { get().activateQuestFromHook(item.quest_id, pending.raceId) }`. Cap-hit and unknown-questId paths handled defensively (engine returns null + capReached flag, slice routes to correct emit/no-op)
- QuestController subscribes to 5 existing eventBus events (`merge:happened`, `cosmic:box-opened`, `starmap:planet-select`, `cosmic:ship-arrived`, `contacts:relationship-delta`) with HMR-safe cleanup, plus boot-time reconcile picks up polling-only progress (gold/relationship/discoveredLevels) hydrated from cross-device sync
- 5 DEV helpers (`__activateQuest`, `__progressQuest`, `__completeQuest`, `__resetQuests`, `__dumpQuests`) provide full smoke-test surface for Plan 28-06; tree-shaken from production (verified: 0 hits in `dist/assets/index-*.js`)
- 24 vitest tests pass (>2× the ≥10 requirement) — `vi.mock` + `vi.importActual` fixture pattern keeps the engine tests isolated from Plan 28-02 data fill, so 28-02 can land in parallel without test churn

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure questEngine + 24 vitest tests** — `d48813e` (feat)
2. **Task 2: 4 slice actions + 4 eventBus events + resolveAccept extension** — `32db584` (feat)
3. **Task 3: QuestController + DEV helpers + App.tsx wiring** — `57963e4` (feat)

## Files Created/Modified

### Created

- `client/src/game/quests/questEngine.ts` — 410 lines. Public API: `activateQuestFromHook`, `checkActiveQuestsProgress`, `applyQuestReward`, `isQuestComplete`, `generateActiveQuestUuid` (re-export). Internal helpers: `extractTargetValue`, `computeProgressForQuest`. Defensive: cap check before lookup; unknown questId logs DEV warn + returns null; exhaustive `never` checks on QuestTarget/QuestReward unions; maxIter=100 safety bound on progress loop.
- `client/src/game/quests/questEngine.test.ts` — 555 lines. 24 tests across 5 `describe` blocks. `vi.mock('../config/quests')` with 7-entry FIXTURE_QUESTS covering all 4 QuestType × 7 QuestTarget shapes. Tests: cap enforcement (1), unknown questId (1), activation success shape (1), progress per target kind (10 covering serum_count match/mismatch, planets_visited, missions_complete, merge_count, merge_to_level via event + polling, raise_relationship completion, gold_amount polling + completion), applyQuestReward shapes (5: essence/gold/relationship_and_bonus/serum random rng/serum explicit), isQuestComplete predicate (4), generateActiveQuestUuid (1), empty activeQuests fast-path (1).
- `client/src/game/quests/questController.tsx` — 72 lines. React.FC `QuestController` returning null. `useEffect` subscribes to 5 progress events, calls `markQuestProgress({kind, ...})` per event, calls `reconcileQuestProgress()` once on mount for boot-time polling. Cleanup symmetric.
- `client/src/utils/devQuests.ts` — 133 lines. `installQuestDevHelpers(): () => void` mirroring `devContacts.ts`. Early-returns on `!import.meta.env.DEV` (tree-shake). Exposes 5 helpers on `window` typed via `declare global { interface Window { ... } }`. Cleanup deletes all 5 keys.

### Modified

- `client/src/store/eventBus.ts` — +50 lines. 4 new entries in `Events` type: `'quests:activated'`, `'quests:cap-reached'`, `'quests:completed'`, `'quests:cancelled'`. `quests:completed.reward` uses `import('../game/config/quests').QuestReward` type-only import to avoid value cycle.
- `client/src/store/cosmic/slice.ts` — +274 lines. New imports: `engineActivate` (aliased from `activateQuestFromHook`), `checkActiveQuestsProgress`, `applyQuestReward`, `QUESTS`, `COMPLETED_QUEST_HISTORY_CAP`, `ActiveQuest`, `CompletedQuest`, `QuestId`, `QuestReward`. 4 new declarations on `CosmicSliceActions` interface. 4 new action implementations in the return object: `activateQuestFromHook` (cap-check + push + emit), `cancelQuest` (find + remove + applyDeltaClamp(-1) + emit 2 events), `markQuestProgress` (engine call + atomic set with rewards aggregated across all newly-completed quests + emit), `reconcileQuestProgress` (calls `markQuestProgress(null)`). `_resolveInternal` extended with 4-line block calling `get().activateQuestFromHook` on `mode === 'accept' && item.type === 'quest_hook'`.
- `client/src/App.tsx` — +12 lines. Imports for `QuestController` and `installQuestDevHelpers`. Mount of `<QuestController />` in render tree after `<EventToastController />`. `installQuestDevHelpers()` call in DEV bootstrap useEffect; cleanup in return-branch.

## Decisions Made

- **Engine treats unknown questId as data drift, NOT a programming error.** `activateQuestFromHook` returns `{newActiveQuest: null, capReached: false}` and logs a DEV-only `console.warn`. Slice silently no-ops; production stays quiet. Rationale: Plan 28-02 fills 40 quest configs but raceChains.ts has ~60 stub `quest_id` references; the engine MUST tolerate a quest_id in the chain that has no corresponding QUESTS entry without crashing or aborting the chain progression. The Phase 27 relationship +1 still applies even on unknown questId.
- **Cap-hit path retains relationship +1 from quest_hook accept.** When `activeQuests.length >= 5` at quest_hook accept, the engine returns `{newActiveQuest: null, capReached: true}`. Slice emits `'quests:cap-reached'` (UI toasts «Лимит активных квестов»), but the relationship +1 from `_resolveInternal` runs BEFORE the activation call, so the player still gains social credit for the accept. Matches CONTEXT D-Quest activation cap path exactly.
- **Progress evaluation kept per-target-kind switch (no generic table).** `computeProgressForQuest` is a 7-case switch on `target.kind`. Each case is 3-7 lines. Trade-off: more code than a table-driven approach, but each rule is auditable on its own line. Phase 29 polish may extract patterns once the 4 quest types stabilize through Plan 28-06 smoke testing.
- **Polling-only kinds also consulted on event ticks.** `gold_amount` always polls `goldAmount`; `raise_relationship` always polls `raceRelationships[target.raceId]`; `merge_to_level` always checks `discoveredLevels.includes(target.level)`. Means cross-device sync that lands progress-relevant state without a follow-up event still propagates on the next progress tick (or boot reconcile).
- **Reward via RewardApplicationDelta routing instead of direct slice mutation.** Engine returns a typed delta payload; slice routes per field. Trade-off: one extra type indirection but engine stays pure (no slice imports), and slice has a single atomic `set()` aggregating all newly-completed quest rewards. Gold goes via root.addGold (Phase 1 l18 multiplier path).
- **QuestController as React.FC instead of imperative installer.** Phase 27 chose installer for captainBirthController (production-critical, idempotent guard). Phase 28 chose React.FC because automatic cleanup via useEffect return is HMR-safe + test-friendly, and the component renders null so there's zero ongoing cost after mount.
- **eventBus payloads use `raceId: string` (not RaceId).** Mirror Phase 27 'contacts:relationship-delta' decision to avoid eventBus → slice → races/quests → types → eventBus cycle. Subscribers (QuestController) narrow-cast at consumption: `e.raceId as RaceId`. `quests:completed.reward` uses `import('...')` type-only import — keeps eventBus.ts decoupled from the quests config module while still providing compile-time type for subscribers.
- **engineActivate alias on slice import.** The engine exports `activateQuestFromHook`; the slice action of the same name. Imported as `activateQuestFromHook as engineActivate` so the call site reads `engineActivate({...})` (clear: engine call) and the action implementation matches the interface declaration exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] TypeScript `never` exhaustiveness pattern**

- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** `tsc --noEmit` failed with TS6133 `'_exhaustive' is declared but its value is never read` on the default-case `never` exhaustiveness checks in `computeProgressForQuest` and `applyQuestReward`. The repo's TS config has `noUnusedLocals: true`.
- **Fix:** Replaced `const _exhaustive: never = target` with `void (target satisfies never)` — TypeScript 4.9+ `satisfies` operator gives the same exhaustive-check guarantee without introducing an unused local variable.
- **Files modified:** `client/src/game/quests/questEngine.ts` (both default branches)
- **Commit:** included in Task 1 (`d48813e`)

**2. [Rule 1 — Style/Build] Prettier formatting on engine + tests**

- **Found during:** Task 1 eslint gate
- **Issue:** Initial file formatting didn't match the repo prettier config (long imports, inline object literals, multi-arg signature wrapping).
- **Fix:** `./node_modules/.bin/eslint --fix` applied prettier auto-fixes on both engine + test files. No semantic changes.
- **Commit:** included in Task 1 (`d48813e`)

**3. [Rule 1 — Style] Prettier on slice import block**

- **Found during:** Task 2 eslint gate
- **Issue:** Multi-line import block for `QUESTS, COMPLETED_QUEST_HISTORY_CAP` should have been single-line per prettier print-width rule.
- **Fix:** `eslint --fix` collapsed the import.
- **Commit:** included in Task 2 (`32db584`)

**4. [Rule 1 — Style] Prettier on devQuests action call**

- **Found during:** Task 3 eslint gate
- **Issue:** `useGameStore.getState().activateQuestFromHook(...)` was inline; prettier wrapped to multi-line.
- **Fix:** `eslint --fix`.
- **Commit:** included in Task 3 (`57963e4`)

No Rule 4 architectural decisions were needed. No auth gates. No skipped fixes.

## Authentication Gates

None — no external service auth needed for this plan.

## Issues Encountered

None blocking. All 4 deviations above were auto-fixable on first pass.

## Known Stubs

None introduced by Plan 28-03. The engine and slice actions are production-ready. Two pre-existing stubs from Plan 28-01 remain unchanged and are scheduled for resolution:

| File | Stub | Resolving Plan |
|------|------|----------------|
| `client/src/game/config/quests.ts:210` | `QUESTS = {}` empty record | 28-02 (data fill) |
| `client/src/components/CosmicHub/CosmicHubModal.tsx` | `case 'quests': <div>placeholder</div>` | 28-04 (Quests tab UI) |

The empty `QUESTS` record does NOT block this plan's goal — the engine is defensive (DEV warn + no-op on unknown questId) and the 24 tests use a `vi.mock` fixture that's independent of production QUESTS data.

## Validation Results

**Build chain (run after all 3 tasks landed):**

| Gate | Command | Result |
|------|---------|--------|
| tsc | `cd client && ./node_modules/.bin/tsc --noEmit` | PASS (0 errors) |
| eslint | `./node_modules/.bin/eslint <7 touched files>` | PASS (no output) |
| vitest (full suite) | `./node_modules/.bin/vitest run` | PASS — 22 files, 198 tests, 1 skipped, 0 failed |
| vitest (engine only) | `./node_modules/.bin/vitest run src/game/quests/questEngine.test.ts` | PASS — 24/24 |
| vitest (pendingEngine regression) | `./node_modules/.bin/vitest run src/game/contacts/pendingEngine.test.ts` | PASS — 13/13 (Phase 27 unaffected) |
| check-translations | `node scripts/check-translations.cjs` | PASS — 553 keys per locale, 0 missing / 0 extra |
| vite build | `./node_modules/.bin/vite build` | PASS — 4.11s, only phaser chunk warning (pre-existing) |
| **DEV helper tree-shake** | `grep -cE "__activateQuest\|__progressQuest\|__completeQuest\|__resetQuests\|__dumpQuests" dist/assets/index-*.js` | **PASS — 0 hits** |

**Acceptance grep criteria (per-task):**

Task 1 (12 criteria): all ≥ expected.
- `export function activateQuestFromHook` = 1
- `export function checkActiveQuestsProgress` = 1
- `export function applyQuestReward` = 1
- `export function isQuestComplete` = 1
- `ACTIVE_QUEST_CAP` = 3 (≥ 2)
- `QUESTS[` = 1 (≥ 1)
- `^  it(` = 24 (≥ 10)
- `vi.mock` = 3 (≥ 1)
- `vi.importActual` = 2 (≥ 1)

Task 2 (16 criteria): all ≥ expected.
- 4 new eventBus literals = 1 each
- 4 new slice action declarations = 2 each (interface + impl)
- `engineActivate` = 2 (≥ 1), `checkActiveQuestsProgress` = 2 (≥ 1), `applyQuestReward` = 3 (≥ 1)
- `quest_hook` = 6 (≥ 1)

Task 3 (12 criteria): all ≥ expected.
- `export function QuestController` = 1
- `eventBus.on(` = 5, `eventBus.off(` = 5
- `reconcileQuestProgress` = 4 (≥ 1)
- `installQuestDevHelpers` = 1 in devQuests.ts, 2 in App.tsx (≥ 2)
- `import.meta.env.DEV` = 2 in devQuests.ts (≥ 1)
- helper names (5 × assign + delete = 22 hits in devQuests.ts; ≥ 10)
- `delete window.__activateQuest` = 1
- `QuestController` = 2 in App.tsx (import + render)
- DEV-helper-tree-shake = 0 hits in `dist/`

## Self-Check

Verifying claimed outputs exist on disk:

- FOUND: `client/src/game/quests/questEngine.ts`
- FOUND: `client/src/game/quests/questEngine.test.ts`
- FOUND: `client/src/game/quests/questController.tsx`
- FOUND: `client/src/utils/devQuests.ts`
- FOUND in git log: commit `d48813e` (Task 1)
- FOUND in git log: commit `32db584` (Task 2)
- FOUND in git log: commit `57963e4` (Task 3)

## Self-Check: PASSED

## Next Plan Readiness

**Plan 28-04 (Quests tab UI) — ready.**
- `'quests:activated'` / `'quests:cap-reached'` / `'quests:completed'` / `'quests:cancelled'` available for QuestsTab re-render triggers.
- `cancelQuest(activeQuestId)` action ready for «Отказаться» button (Plan 28-04 confirm-modal can call it directly).
- ACTIVE_QUEST_CAP=5 consumed via existing Plan 28-01 import surface.
- QUESTS lookup pattern documented (engine treats unknown id defensively; UI can mirror by guarding `QUESTS[q.questId]` for i18n key resolution).

**Plan 28-05 (reward popup) — ready.**
- `'quests:completed'` event carries full `reward: QuestReward` payload — popup can mount on subscribe + read reward.kind for icon/value display without re-reading state.
- CompletedQuest.rewardClaimed stored on history; popup can also drive from history if subscribe-race occurs.

**Plan 28-06 (smoke test) — partially unblocked.**
- 5 DEV helpers (`__activateQuest`, `__progressQuest`, `__completeQuest`, `__resetQuests`, `__dumpQuests`) on `window` give the smoke-test script the full activation/progress/completion/cancel surface to script through.
- Awaits Plan 28-04 (UI) + Plan 28-05 (popup) to land for visual verification steps.

No blockers identified. Engine, slice, eventBus, and DEV helpers are consistent across the runtime brain.

---
*Phase: 28-quests*
*Completed: 2026-05-19*
