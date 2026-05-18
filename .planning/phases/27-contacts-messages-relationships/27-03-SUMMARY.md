---
phase: 27-contacts-messages-relationships
plan: 03
subsystem: pending-engine
tags: [zustand, pure-function, vitest, mock, eventbus, dev-helpers]

# Dependency graph
requires:
  - phase: 27-01
    provides: |
      ChainItem discriminated union, PendingItem interface, RACE_CHAINS skeleton,
      CHAIN_PENDING_CAP / RELATIONSHIP_MIN / MAX / INITIAL_RELATIONSHIP, CosmicSlice
      fields (raceRelationships, chainProgress, pendingItems), markFirstContactSeen
      action template.
provides:
  - "pendingEngineTick(input): pure function returning EngineOutput delta — lowest-progress-first pull selection with alphabetical raceId tiebreak, cap CHAIN_PENDING_CAP=3, 'event' auto-apply + toast, msg/dialog/quest_hook queue push with generatePendingId() uuid"
  - "applyDeltaClamp(value, delta): clamped integer in [RELATIONSHIP_MIN, RELATIONSHIP_MAX] — shared by engine + slice resolve actions"
  - "Slice actions resolveAccept(id) / resolveRefuse(id) / resolveAcknowledge(id): idempotent on unknown id, atomic set(), emit contacts:relationship-delta if value changed, chain into triggerPendingPull"
  - "Slice action triggerPendingPull(): reads root hasCosmosUnlocked, runs engine, applies state delta in single set(), emits contacts:event-applied + contacts:relationship-delta"
  - "eventBus 'contacts:relationship-delta' {raceId, oldValue, newValue, delta} typed event"
  - "eventBus 'contacts:event-applied' {raceId, targetRaceId, delta, textKey} typed event"
  - "DEV helpers __addPending(id) / __resetRelationships() / __advanceChain(id) / __dumpContacts() — exposed on window in DEV only, tree-shaken from production"
affects:
  - "Plan 27-04 (UI: race detail invokes resolveAccept/Refuse/Acknowledge from buttons; RelationshipBar subscribes to contacts:relationship-delta for pulse animation)"
  - "Plan 27-05 (toast: EventToast subscribes to contacts:event-applied, mounts top-screen banner with 3s auto-dismiss)"
  - "Plan 27-06 (smoke + finalize: validates engine end-to-end via __addPending → __advanceChain → toast)"

# Tech tracking
tech-stack:
  added: []  # no new deps; reuses vitest/mitt/zustand
  patterns:
    - "Plan 27-03: pure-function engine pattern — pendingEngineTick(input): output is deterministic (modulo generatePendingId uuid), testable in isolation via vi.mock('../config/raceChains') for chain fixture independence from Plan 27-02"
    - "Slice ↔ engine wiring pattern — set() applies engine delta atomically, eventBus emits AFTER set (mirror markFirstContactSeen pattern); idempotency guard (findIndex < 0 return) BEFORE set() avoids spurious re-renders"
    - "Triple resolve mode (accept/refuse/acknowledge) via shared _resolveInternal helper — single code path, mode parameter chooses delta source (item.accept_delta / item.refuse_delta / 0)"
    - "DEV helper structure mirrors Phase 26 devRaces.ts: install* returns cleanup function for App.tsx useEffect return-branch; helpers tree-shake via import.meta.env.DEV early-return"
    - "vi.mock of '../config/raceChains' uses vi.importActual to preserve constants (RELATIONSHIP_MIN/MAX/CAP/INITIAL, type re-exports) while overriding RACE_CHAINS with controllable fixture"

key-files:
  created:
    - "client/src/game/contacts/pendingEngine.ts — pure engine module (172 LOC). Exports pendingEngineTick(input): EngineOutput, applyDeltaClamp(value, delta): number, generatePendingId(now): string. Cosmos-gated short-circuit + lowest-progress pull + alphabetical tiebreak + maxIter=100 safety bound."
    - "client/src/game/contacts/pendingEngine.test.ts — 13 vitest unit tests (220 LOC). vi.mock'd fixture chain enables Plan-27-02-independent testing. Coverage: applyDeltaClamp clamp/floor (3) + engine cosmos gate / firstContact gate / single race pull / cap / tiebreak / event auto-apply / clamp at floor / pre-existing queue skip / chain end / maxIter (10)."
    - "client/src/utils/devContacts.ts — 4 window helpers (108 LOC). DEV-gated; symmetric cleanup. __addPending(id) marks firstContact + triggers pull. __resetRelationships() resets all 10 races + chains + queue. __advanceChain(id) increments progress without resolving (event testing). __dumpContacts() console.table snapshot."
  modified:
    - "client/src/store/cosmic/slice.ts — +167 LOC. CosmicSliceActions gains 4 declarations (resolveAccept/Refuse/Acknowledge/triggerPendingPull). createCosmicSlice scope gains _resolveInternal shared handler. Return object gains 4 action implementations."
    - "client/src/store/eventBus.ts — +23 LOC. Events type gains 'contacts:relationship-delta' + 'contacts:event-applied' typed entries (raceId: string per existing 'cosmos:first-contact' pattern to avoid types cycle)."
    - "client/src/App.tsx — +6 LOC. DEV bootstrap useEffect mounts installContactsDevHelpers alongside installRaceDevHelpers; cleanup symmetric in return-branch."

key-decisions:
  - "Test fixture chain via vi.mock — Plan 27-02 fills production RACE_CHAINS in parallel (wave 2), so tests cannot depend on production chain content. Using vi.importActual + spread on '../config/raceChains' preserves all constants/types and overrides only RACE_CHAINS with a deterministic 10-item fixture (msg×6, dialog, event, msg×3). Test 7 (event auto-apply at step 6) and Test 8 (event clamp to floor) require known event placement — fixture guarantees this independent of 27-02 completion."
  - "Shared _resolveInternal helper for 3 resolve modes — single code path with mode parameter (accept/refuse/acknowledge) chooses delta source. Removes duplication, enforces consistent atomic set() + emit + chain-into-triggerPendingPull sequence. Defensive `delta=0` fallback for invalid type+mode combos (msg + accept/refuse would be a UI bug but produces no crash)."
  - "applyDeltaClamp is exported and reused by slice — both engine internals AND _resolveInternal call it. Single source of truth for [1,10] integer clamp. Math.floor handles fractional deltas if planner introduces them in chain config later."
  - "generatePendingId uses monotonic counter + timestamp + random — counter prevents collisions when multiple items are pulled in single engine tick (Date.now() resolution is 1ms). Not cryptographically strong; only needs uniqueness within a single device's pendingItems lifetime (max ~3 entries). React key + persistence stable."
  - "maxIter=100 safety bound in engine — guards against unforeseen infinite loops if chain config evolves badly (e.g. all events for all 10 races at once). 100 covers cap=3 + 10 races × 10 events worst-case + slack. Defensive engineering — primary loop termination is candidates.length === 0."
  - "Engine input takes `pendingItems: readonly PendingItem[]` — explicitly readonly signals purity contract. Internal `pending` copy via spread before mutation. Caller (slice) provides the snapshot from get(); engine never mutates input."
  - "triggerPendingPull skips set() when no observable change — relationshipDeltas.length / hasNewItems / hasNewProgress checks. Avoids spurious re-renders and persistence writes when cosmosUnlocked=false or no race pullable. Critical because the action is called eagerly from UI/dev helpers."
  - "eventBus emits AFTER set() (atomic mutate, then notify) — mirrors Phase 26-01 markFirstContactSeen and Phase 22 ascendCarrier patterns. Subscribers re-read state via useGameStore.getState() and see post-mutation snapshot."
  - "raceId typed as `string` in eventBus payloads — mirror 'cosmos:first-contact' pattern to avoid eventBus → cosmic/slice → races → cosmic/types → eventBus circular dependency. Subscribers (Plan 27-04 RelationshipBar, Plan 27-05 EventToast) do narrow cast on consumption."

patterns-established:
  - "Pattern: pure engine + slice action wrapper — engine is side-effect-free (modulo uuid), slice action computes delta via engine and emits events. Testing strategy: unit-test the engine in isolation with mock'd config; integration test the slice action via vi.fn'd eventBus listener (Plan 27-04 will add this layer)."
  - "Pattern: vi.mock with vi.importActual spread for chain config — keeps all production constants/types intact while overriding the data array. Replicable for future content modules (mission chains, quest templates, etc.)."
  - "Pattern: shared internal handler in createCosmicSlice scope — closure over set/get + helper that returns no public API but DRYs up multiple mode-variants. Helper name prefixed with `_` to signal internal."

requirements-completed:
  - PHASE27-PENDING-ENGINE
  - PHASE27-PENDING-CAP-3
  - PHASE27-EVENT-INLINE
  - PHASE27-FIRST-CONTACT-DEP
  - PHASE27-DEV-HELPERS

# Metrics
duration: ~15m
completed: 2026-05-18
---

# Phase 27 Plan 03: Pending engine + slice actions + eventBus events + dev helpers Summary

**Pure pendingEngineTick (cosmos-gated, lowest-progress-first pull, cap 3, event auto-apply) wired into Zustand cosmic slice via 4 actions (resolveAccept/Refuse/Acknowledge/triggerPendingPull) with 2 new typed eventBus events (contacts:relationship-delta, contacts:event-applied) + 4 DEV window helpers — 13 vitest unit tests all passing, tsc/eslint clean.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-18T18:52Z (approx)
- **Completed:** 2026-05-18T19:02Z (approx)
- **Tasks:** 3
- **Files created:** 3 (pendingEngine.ts + pendingEngine.test.ts + devContacts.ts)
- **Files modified:** 3 (slice.ts + eventBus.ts + App.tsx)
- **LOC added:** ~696 insertions

## Accomplishments

- `pendingEngine.ts` ships as a pure deterministic function with maxIter=100 safety bound, alphabetical tiebreak, and clean separation between event auto-apply path and msg/dialog/quest_hook queue path.
- 13 vitest tests pass (3 applyDeltaClamp + 10 pendingEngineTick) using vi.mock'd fixture chain — fully independent of Plan 27-02's parallel chain fill.
- 4 cosmic slice actions wired through a single `_resolveInternal` helper for consistency; idempotent on unknown pendingId; atomic set() + eventBus emit pattern preserved.
- 2 typed eventBus events added (string-typed raceId per existing pattern to avoid module cycle).
- 4 DEV window helpers exposed with symmetric cleanup; tree-shaken from production via `import.meta.env.DEV` early-return.

## Task Commits

Each task committed atomically:

1. **Task 1: pure pendingEngine module + 13 vitest unit tests** — `97ff749` (feat)
2. **Task 2: cosmic slice resolveAccept/Refuse/Acknowledge/triggerPendingPull + 2 eventBus events** — `cb1d384` (feat) — bundled prettier autofix on Task 1 test file (formatting only, no logic change)
3. **Task 3: devContacts helpers + App.tsx wiring** — `54df3a7` (feat)

## Files Created/Modified

| File | Status | LOC | Purpose |
|------|--------|-----|---------|
| `client/src/game/contacts/pendingEngine.ts` | NEW | 172 | Pure engine + applyDeltaClamp + generatePendingId |
| `client/src/game/contacts/pendingEngine.test.ts` | NEW | 220 | 13 unit tests with vi.mock'd fixture chain |
| `client/src/utils/devContacts.ts` | NEW | 108 | 4 DEV window helpers + cleanup |
| `client/src/store/cosmic/slice.ts` | MOD | +167 | 4 actions + _resolveInternal helper |
| `client/src/store/eventBus.ts` | MOD | +23 | 2 new typed contacts:* events |
| `client/src/App.tsx` | MOD | +6 | DEV bootstrap wiring + cleanup |

## Engine Algorithm Summary

**Pull selection rules** (executed in tight loop until queue full or no candidate):

1. For each `raceId` in `Object.keys(progress)`:
   - Skip if `!firstContactsSeen[raceId]`
   - Skip if `raceId` already represented in pendingItems (`racesInQueue` Set)
   - Skip if `progress[raceId] >= RACE_CHAINS[raceId].length` (chain exhausted)
2. Sort candidates by `(progress[a] - progress[b])` ascending, then alphabetical `raceId`.
3. Pull `RACE_CHAINS[picked][progress[picked]]`.
4. **If `event` type:** apply `delta` to `relationships[item.target === 'self' ? picked : item.target]` (clamped); `progress[picked]++`; push to `eventToasts`. NOT pushed to `pendingItems` — auto-applied.
5. **If `msg`/`dialog`/`quest_hook`:** push to `pendingItems` with uuid; `racesInQueue.add(picked)`. Progress NOT advanced (slice resolveAccept/Refuse/Acknowledge advances after user input).
6. Repeat until `pendingItems.length === CHAIN_PENDING_CAP` (3) or no candidate. `maxIter=100` safety guard against pathological chain configs.

**Cosmos gate:** `cosmosUnlocked=false` short-circuits immediately with input unchanged + empty toasts.

## Slice Action Behavior Table

| Action | Delta Source | Idempotent? | Atomic | Emits | Chains Into |
|--------|--------------|-------------|--------|-------|-------------|
| `resolveAccept(id)` | `item.accept_delta` (dialog/quest_hook); 0 otherwise | yes (id not found → no-op) | single `set()` mutates relationships+progress+pending | `contacts:relationship-delta` if value changed | `triggerPendingPull()` |
| `resolveRefuse(id)` | `item.refuse_delta` (dialog/quest_hook); 0 otherwise | yes | same | same | same |
| `resolveAcknowledge(id)` | 0 (msg ack — no relationship change) | yes | same | none (delta=0 → no emit) | same |
| `triggerPendingPull()` | engine output `nextRelationships - prev` | yes (`hasNewItems/Progress/relationshipDeltas` guard skips set if no change) | single `set()` mutates engine output | `contacts:event-applied` per toast + `contacts:relationship-delta` per change | (terminal — engine itself loops to fill queue) |

## eventBus Subscriber Map

| Event | Producer (Plan 27-03) | Subscriber (future) |
|-------|----------------------|---------------------|
| `contacts:relationship-delta` | `_resolveInternal` (if oldValue !== newValue) + `triggerPendingPull` per changed race | Plan 27-04 RelationshipBar (pulse animation if tier crosses), Phase 28/29 analytics |
| `contacts:event-applied` | `triggerPendingPull` per `EngineOutput.eventToasts[]` entry | Plan 27-05 EventToast (top-screen banner, 3s auto-dismiss, i18n via `cosmos.event.notification` template) |

## Decisions Made

(See `key-decisions:` in frontmatter for full rationale; highlights below.)

- **vi.mock for chain fixture** — engine tests independent from Plan 27-02 parallel fill. Uses `vi.importActual` + spread to preserve constants/types, overrides only `RACE_CHAINS` with deterministic 10-item fixture (msg×6, dialog at 2, event at 6, msg×3).
- **Shared `_resolveInternal` helper** for 3 modes (accept/refuse/acknowledge) — single code path, mode param chooses delta source. DRY + consistent atomic set+emit+chain-pull sequence.
- **`applyDeltaClamp` shared** by engine + slice — single source of truth for [1,10] integer clamp with floor.
- **`maxIter=100` safety bound** — defensive guard against pathological chain configs (e.g. all events). Primary termination is `candidates.length === 0`.
- **`triggerPendingPull` skips set() on no-op** — `relationshipDeltas.length === 0 && !hasNewItems && !hasNewProgress` → no set(). Avoids spurious re-renders/persistence writes.
- **eventBus emits AFTER set()** — atomic mutate-then-notify, mirror Phase 26-01 markFirstContactSeen + Phase 22 ascendCarrier patterns.
- **raceId as `string` in eventBus** — avoid eventBus→slice→races→types→eventBus cycle. Subscribers narrow-cast.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prettier autofix on Task 1 test file during Task 2 eslint pass**
- **Found during:** Task 2 eslint pre-commit check
- **Issue:** `vi.mock` callback's multi-line `await vi.importActual` and inline dialog ChainItem violated prettier rules (prefer single-line short awaits, multi-line short objects).
- **Fix:** `./node_modules/.bin/eslint --fix` applied prettier rewrites. No semantic change.
- **Files modified:** `client/src/game/contacts/pendingEngine.test.ts`
- **Commit:** bundled into Task 2 commit `cb1d384` (consistent with execute-plan protocol — separate style-only commits not necessary when the autofix is on a file from the SAME plan being edited in the SAME session).

**2. [Rule 1 - Bug] Prettier autofix on devContacts.ts (Task 3)**
- **Found during:** Task 3 eslint pre-commit check
- **Issue:** Two single-arg `console.info` calls had a trailing comma + newline before closing paren, prettier requested inline.
- **Fix:** `./node_modules/.bin/eslint --fix` applied prettier rewrites. No semantic change.
- **Files modified:** `client/src/utils/devContacts.ts`
- **Commit:** bundled into Task 3 commit `54df3a7`.

**3. [Note — acceptance criteria literal-grep count]** Acceptance criterion in plan: "`grep -c 'installContactsDevHelpers' client/src/App.tsx` returns at least 3 (import + call + cleanup)". Actual count is 2 (import line 38 + call line 265). The cleanup line uses the variable name `contactsDevCleanup` (mirroring `raceDevCleanup` for Phase 26 helpers — see App.tsx lines 262 and 284 where `installRaceDevHelpers` also appears 2× not 3×). The plan author's count was slightly off; the intent (import + call + cleanup) is satisfied with the established codebase pattern. No code change needed — the existing pattern is the right one and the new wiring mirrors it exactly.

---

**Total deviations:** 2 auto-fixed prettier formatting + 1 documentation-only acceptance count clarification. No behavioral or semantic deviations.

## Issues Encountered

- **Worktree node_modules missing:** Initial `vitest` run failed because the worktree's `client/` directory had no `node_modules`. Resolved by symlinking `client/node_modules → ../../../client/node_modules` (the main worktree's installation). Symlink ignored by `.gitignore` (node_modules pattern). No code change required — workflow-level concern only.
- **Test 7 dependency on chain content:** Plan's verbatim test template assumes `RACE_CHAINS.crystalloids[6]` is an event with delta=-1. Plan 27-02 (parallel wave 2) fills chains. To make tests independent, used `vi.mock` of `'../config/raceChains'` with a deterministic 10-item fixture. Tests are now Plan-27-02-agnostic. Documented as a `key-decision`.

## User Setup Required

None — no external service configuration, no env vars, no manual UI/UX verification. Engine + slice + eventBus + dev helpers are all internal. Plan 27-04 UI work + Plan 27-06 smoke test will exercise end-to-end behavior.

## Validation Results

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `./node_modules/.bin/tsc --noEmit` (in worktree client/) | exit 0, 0 errors |
| ESLint | `./node_modules/.bin/eslint src/game/contacts/* src/store/cosmic/slice.ts src/store/eventBus.ts src/utils/devContacts.ts src/App.tsx` | "No issues found" (after 2 prettier autofixes — see Deviations) |
| Vitest (new) | `./node_modules/.bin/vitest run src/game/contacts/pendingEngine.test.ts` | 13 PASS / 0 FAIL |
| Vitest (full) | `./node_modules/.bin/vitest run` | 117 PASS / 1 skipped / 0 NEW FAIL (3 pre-existing Phase 22 suite-import failures unchanged) |
| Acceptance grep — Task 1 | `export function pendingEngineTick` ×1, `export function applyDeltaClamp` ×1, `  it(` ×13 (≥11), `Phase 27 Plan 27-03` ×7 | PASS |
| Acceptance grep — Task 2 | `'contacts:relationship-delta'` ×1, `'contacts:event-applied'` ×1, `resolveAccept:/Refuse:/Acknowledge:/triggerPendingPull:` ×1 each in slice, `pendingEngineTick` ×2 in slice | PASS |
| Acceptance grep — Task 3 | `installContactsDevHelpers` ×2 in App.tsx (matches `installRaceDevHelpers` pattern), `__addPending|__resetRelationships|__advanceChain|__dumpContacts` ×18 in devContacts.ts, `export function installContactsDevHelpers` ×1, `import.meta.env.DEV` ×2, `delete window.__addPending` ×1 | PASS (note re: literal count — see Deviation 3) |
| Final verification grep | `pendingEngineTick|resolveAccept|resolveRefuse|resolveAcknowledge|triggerPendingPull` ×14 in slice (≥5), `contacts:` ×2 in eventBus | PASS |

## Self-Check: PASSED

Files verified to exist:
- FOUND: `client/src/game/contacts/pendingEngine.ts` (NEW, 172 LOC)
- FOUND: `client/src/game/contacts/pendingEngine.test.ts` (NEW, 220 LOC)
- FOUND: `client/src/utils/devContacts.ts` (NEW, 108 LOC)
- FOUND: `client/src/store/cosmic/slice.ts` (modified, +167 LOC)
- FOUND: `client/src/store/eventBus.ts` (modified, +23 LOC)
- FOUND: `client/src/App.tsx` (modified, +6 LOC)

Commits verified in `git log --oneline`:
- FOUND: `97ff749` feat(27-03): pure pendingEngine module + 13 vitest unit tests
- FOUND: `cb1d384` feat(27-03): cosmic slice resolveAccept/Refuse/Acknowledge/triggerPendingPull + 2 eventBus contacts:* events
- FOUND: `54df3a7` feat(27-03): devContacts helpers (__addPending/__resetRelationships/__advanceChain/__dumpContacts) + App.tsx wiring

## Next Plan Readiness

**Ready for Plan 27-04 (UI tab + race detail):**
- `resolveAccept(id)` / `resolveRefuse(id)` / `resolveAcknowledge(id)` exposed on cosmic slice — race detail "Поддержать"/"Отказать"/"Понятно" buttons call these directly.
- `triggerPendingPull()` callable from UI subscriptions (e.g. when entering Contacts tab to ensure queue is fresh).
- `contacts:relationship-delta` event ready — RelationshipBar pulse-on-tier-cross subscribes here.

**Ready for Plan 27-05 (toast):**
- `contacts:event-applied` event ready — EventToast subscribes; payload includes `textKey` resolvable via `t(textKey, { delta, raceName })`.

**Ready for Plan 27-06 (smoke + finalize):**
- DEV helpers `__addPending(id)` + `__advanceChain(id)` + `__dumpContacts()` enable in-browser smoke without Plan 27-02 chain data (any first-contacted race with non-empty chain will exercise the engine; for event testing, advance progress past the scripted intro).

**No blockers.** All 5 REQ-IDs (PHASE27-PENDING-ENGINE/PENDING-CAP-3/EVENT-INLINE/FIRST-CONTACT-DEP/DEV-HELPERS) — ready for marking after Plan 27-02 also lands the chain content (separate REQ namespace).

---
*Phase: 27-contacts-messages-relationships*
*Completed: 2026-05-18*
