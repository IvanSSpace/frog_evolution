# Deferred items — Phase 26

## Pre-existing test failures (out of scope for Plan 26-01)

Discovered during Plan 26-01 baseline run. Verified failures exist на main BEFORE
my changes (stashed Task 2 changes, ran `npm test --run`, same 3 failed test files,
same 97 passed / 1 skipped). Not caused by Plan 26-01 work.

Failing test files:
- `src/utils/cosmicSettings.test.ts` — "No test suite found in file" (suite import error;
  likely related to `cosmicSettings.ts` window/localStorage shape change).
- `src/store/cosmic/slice.openBox.test.ts` — Test 1 "fire serum +1" — expects
  `serums.fire` to increment by 1 after `commitOpenedBox`, observed 0 vs 1.
  Plan 22 changed `openBox` to award serums via different path; test fixture
  not updated.
- `src/store/cosmic/slice.test.ts` — Test 6 "fire serum incremented" — same
  rootcause (Plan 22 openBox refactor).

**Scope:** These are pre-existing failures from Phase 22 (rarity removal /
openBox unification) and should be addressed in a dedicated test-maintenance plan,
not as part of Plan 26-01.

**Confirmation of zero-impact from Plan 26-01:**
- Same 3 files fail / 97 pass / 1 skip BOTH with and without my Task 2 changes.
- No new failures introduced.
- `tsc --noEmit` clean across all my touched files.
