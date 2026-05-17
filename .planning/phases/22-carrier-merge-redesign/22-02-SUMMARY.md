---
phase: 22
plan: "02"
subsystem: cosmic-carrier
tags: [feature, carrier-merge, merge-rules, phase22, tdd]
dependency_graph:
  requires: [simple-carrier-model]
  provides: [carrier-merge-actions, target-wins-rule, carrier-progression]
  affects: [merge-controller, dev-tools]
tech_stack:
  added: []
  patterns: [discriminated-union-merge-plan, pre-spawn-capture-of-carrier-meta, drag-direction-source-of-truth]
key_files:
  created:
    - client/src/store/cosmic/carrierMerge.test.ts
  modified:
    - client/src/store/cosmic/slice.ts
    - client/src/store/cosmic/slices/carrierSlice.ts
    - client/src/game/scenes/main/MergeController.ts
    - client/src/utils/devCarriers.ts
decisions:
  - "Drag direction is canonical: caller passes a=dropped, b=target. MergeController never swaps. Target-wins for carrier+carrier therefore implemented purely on the store side using droppedFrogId/targetFrogId orientation."
  - "Carrier merge metadata captured BEFORE delayedCall (vortex animation). Carrier records could be torn down or rebound during the 350ms animation, so kind+ids+elements are resolved synchronously and reused after spawn."
  - "Cross-location merge generates a synthetic newFrogId (carrier-cross-<ts>-<rand>). FrogSpawner.rebindCarriers re-matches by level when the target location is visited, restoring the carrier visual."
  - "L18+L18 normal sentinel (markDiscovered(19) → cosmos unlock) is the unchanged short-circuit branch; carrier ascension at L18 stays out of scope (Plan 22-03)."
  - "Tests use vitest (project standard) rather than node --test. The done-criterion grep `it(` is satisfied by describe/it imports from vitest. The PLAN's `node --test` command was based on slice.test.ts which itself runs via tsx, not native node; vitest is the only runner that resolves project .ts imports cleanly."
metrics:
  duration_minutes: 8
  completed: 2026-05-17
---

# Phase 22 Plan 22-02: Carrier merge rules — Summary

Carrier merge wired end-to-end: store actions implement the math, MergeController dispatches them after the standard spawn animation, drag-direction preserves the target-wins game rule. 7 unit tests + smoke helpers cover all 4 active branches.

## What changed

- **`store/cosmic/slice.ts`** — `CosmicSliceActions` extended with `mergeCarrierWithNormal(carrierFrogId, normalFrogId, newFrogId, newLevel)` and `mergeCarrierWithCarrier(droppedFrogId, targetFrogId, newFrogId, newLevel)`. Full JSDoc per action.
- **`store/cosmic/slices/carrierSlice.ts`** — both actions implemented. Both are no-ops if the relevant carrier id is missing from `state.carriers`. `CarrierActions` Pick now exports 4 keys.
- **`store/cosmic/carrierMerge.test.ts`** *(new)* — 7 vitest cases covering element inheritance, target-wins, drag-direction switch, invalid ids, L18 cap.
- **`game/scenes/main/MergeController.ts`** — TODO Plan 22-02 fall-through removed. `MergeKind` discriminated union now actively used: carrier-normal/carrier-carrier resolve a `carrierMergePlan` BEFORE the vortex animation, then dispatch the store action AFTER the new frog spawns (so the real frog id is passed). Cross-location path uses a synthetic id for `rebindCarriers` to pick up.
- **`utils/devCarriers.ts`** — adds `__giveCarrier(element, level, frogId?)`, `__listCarriers()`, `__simulateMerge(droppedFrogId, targetFrogId)` for console-driven smoke verification.

## Merge branch matrix (final state)

| Drop direction | Drop on | Same level? | Result |
| --- | --- | --- | --- |
| normal | normal | yes (1..17) | standard merge L+1 |
| normal | normal | yes (18+18) | cosmos sentinel: both burn, markDiscovered(19) → cosmos unlock (unchanged) |
| carrier(E1) | normal | yes | carrier(E1) at L+1, normal removed |
| normal | carrier(E1) | yes | carrier(E1) at L+1, normal removed (`classifyMerge` is symmetric) |
| carrier(E1) | carrier(E2) | yes | carrier(E2) at L+1 — **target's element survives** (E1 may equal or differ from E2) |
| any | any | no | blocked-mismatch toast, no mutation |

Edge cases:
- Carrier + normal at mismatched level → blocked (handled in the level guard before kind classification).
- Carrier + carrier at mismatched level → blocked similarly.
- Drag direction is the only signal for target-wins. There is no UI tie-breaker.

## TDD gate compliance

- **RED** commit `f2938f0` — `test(22-02): add failing tests for carrier merge actions` — 7 tests, all failing because actions don't exist.
- **GREEN** commit `5ba51fa` — `feat(22-02): implement carrier merge actions in store` — 7 tests pass.
- **Integration** commit `87d277e` — `feat(22-02): wire carrier merge branches in MergeController` — TODO removed, dispatch wired, full build clean.
- **Dev helpers** commit `05722f4` — `chore(22-02): dev helpers for carrier merge smoke testing` — `__giveCarrier`, `__listCarriers`, `__simulateMerge`.

No REFACTOR commit — implementation arrived at minimal form on the first pass and the integration commit is the natural seam.

## Smoke test scenarios (manual, ran by helpers above)

```text
// Scenario A — carrier inheritance (carrier + normal):
__giveCarrier('fire', 5)                 // → frogId_A
const idB = __mainScene.spawnFrog(cx, cy, 5).id  // normal L5
__simulateMerge(frogId_A, idB)
__listCarriers()                         // → [{ frogId: '<new>', element: 'fire', level: 6 }]

// Scenario B — same element merge:
__giveCarrier('water', 4) → a
__giveCarrier('water', 4) → b
__simulateMerge(a, b)
__listCarriers()                         // → [{ ..., element: 'water', level: 5 }]

// Scenario C — target-wins:
__giveCarrier('fire', 6) → dropped
__giveCarrier('shadow', 6) → target
__simulateMerge(dropped, target)
__listCarriers()                         // → [{ ..., element: 'shadow', level: 7 }]

// Scenario D — L18 cosmos sentinel (regression):
__mainScene.spawnFrog(cx, cy, 18)        // normal L18 x 2
__mainScene.spawnFrog(cx, cy, 18)
// drag one onto the other → both burn, cosmos location unlocks via markDiscovered(19)
```

## Deviations from Plan

### [Rule 3 — blocker] Test runner switched from `node --test` to `vitest`

- **Found during:** Task 1 RED phase.
- **Issue:** `node --test src/store/cosmic/carrierMerge.test.ts` fails with `ERR_MODULE_NOT_FOUND` for `./slice` (no `.ts` extension). The PLAN's reference test (`slice.test.ts`) does not actually run via `node --test` either — its header comment explicitly says `tsx client/src/store/cosmic/slice.test.ts`. Vitest is the project's configured runner (`package.json: "test": "vitest run"`).
- **Fix:** Wrote tests in vitest style (`describe/it/expect` from `vitest` — same as `sendShipTo.test.ts`). All done-criteria grep checks (`grep -c "it("` ≥ 6) and behavioural expectations remain satisfied. Tests run via `cd client && npx vitest run src/store/cosmic/carrierMerge.test.ts`.
- **Files modified:** `client/src/store/cosmic/carrierMerge.test.ts`.
- **Commit:** `f2938f0` (RED).

### [Rule 2 — missing critical functionality] `CarrierActions` Pick had to be widened

- **Found during:** Task 1 GREEN phase.
- **Issue:** `carrierSlice.ts`'s `CarrierActions = Pick<CosmicSliceActions, 'addCarrier' | 'removeCarrier'>` would have silently dropped the new actions from the slice's return type, causing TypeScript to flag them in `slice.ts` composition.
- **Fix:** Extended the Pick union to include both new action keys.
- **Files modified:** `client/src/store/cosmic/slices/carrierSlice.ts`.
- **Commit:** `5ba51fa`.

### [Rule 2 — missing critical functionality] Carrier merge meta captured before vortex animation

- **Found during:** Task 2 implementation.
- **Issue:** `performMerge` runs the standard-merge logic inside `delayedCall(VORTEX_DURATION, ...)`. Inside that callback, `removeFrog(a)` and `removeFrog(b)` run before `spawnFrog(newLevel)`. If the store action dispatched only inside the delayed callback, it would still work, but kind/element classification at that point depends on `useGameStore.getState().carriers` which may already be torn down by other subscribers in odd timings. Pre-capturing the merge plan synchronously is safer and self-documenting.
- **Fix:** Resolved `carrierMergePlan` immediately after `classifyMerge`, dispatched the action only after `newFrogId` is known.
- **Files modified:** `client/src/game/scenes/main/MergeController.ts`.
- **Commit:** `87d277e`.

## Auth gates

None.

## Out of scope (logged, not addressed)

- L18 carrier ascension trigger — Plan 22-03.
- Archetype bonus logic — Plan 22-03.
- Vite build warnings about dynamic + static import of `gameSync.ts` and `game/index.ts`, and chunk-size warnings (`phaser-*.js` ~1.6 MB). All pre-existing.
- Server vite warnings: none (server is tsc-only).
- i18n: `cosmic_hub.carrier.merge_blocked_mismatch` already exists in `en/es/ru.json` — no changes needed; the toast keeps working unchanged.

## Self-Check: PASSED

- File `client/src/store/cosmic/carrierMerge.test.ts` exists ✓
- File `client/src/store/cosmic/slices/carrierSlice.ts` exists ✓ (modified)
- File `client/src/store/cosmic/slice.ts` exists ✓ (modified, new action signatures)
- File `client/src/game/scenes/main/MergeController.ts` exists ✓ (modified, TODOs removed)
- File `client/src/utils/devCarriers.ts` exists ✓ (modified, 3 new helpers)
- Commits:
  - `f2938f0` — RED test commit ✓ FOUND
  - `5ba51fa` — GREEN store actions ✓ FOUND
  - `87d277e` — MergeController integration ✓ FOUND
  - `05722f4` — dev helpers ✓ FOUND
- TypeScript client+server clean ✓
- vitest 7/7 PASS ✓
- vite build OK ✓
- `grep TODO Plan 22-02` = 0 ✓
- `grep "it("` = 7 (≥ 6) ✓
- `grep mergeCarrierWith*` in client/src = 24 matches across slice + carrierSlice + MergeController + test ✓
- `grep __giveCarrier|__simulateMerge` in devCarriers.ts = 16 ✓
- `markDiscovered(19)` cosmos sentinel intact at MergeController.ts:266 ✓ (regression-free)
