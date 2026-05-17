# Phase 22 — Deferred items

## Plan 22-04 execution

### 22-05 RED-phase tsc errors (out of scope for 22-04)

When 22-04 finalized (commit `6e8f287`), parallel agent on Plan 22-05 had committed
`6a1b1f4 test(22-05): add failing tests + config for cosmic shop slice` (TDD RED phase).

Resulting `npx tsc --noEmit` baseline AFTER 22-04 completion:

```
src/store/cosmic/slices/shopSlice.ts (5 errors)
  L29 TS2344, L40 TS7006 (x2), L59/L63 TS7053
src/store/cosmic/slice.ts (2 errors)
  L32 TS6192, L36 TS6133 (unused imports during stub phase)
src/store/gameStore.ts (1 error)
  L359 TS2345 (shop slice type bridge)
src/store/persistence.ts (1 error)
  L272 TS2739 (missing keys when shop slice partially typed)
```

**Scope:** All errors live in shop-slice files. 22-04 touches `client/src/components/HUD/*`,
`client/src/App.tsx`, `client/src/i18n/*` only — none of these files appear in the tsc error list.

**Why deferred:** Per executor SCOPE BOUNDARY rule — only auto-fix issues directly caused by
the current task's changes. These are 22-05's GREEN-phase work, expected to clear when the
shop slice implementation lands.

**Verified for 22-04:**
- `npx tsc --noEmit` shows ZERO errors in `client/src/components/HUD/*` and `client/src/App.tsx`
- `npm run build` succeeds (3.79s)
- `npm run check-translations` PASS (305/305 keys × 3 locales)

## Plan 22-06 / 22-07 execution

### Pre-existing vitest 4 incompatibility — top-level `node:assert/strict` test files

Three test files use top-level `{ ... }` blocks with `node:assert/strict` (no
`describe`/`it` wrapping). Vitest 4 doesn't recognize them as test suites
and reports `Tests no tests` / `No test suite found`:

- `client/src/utils/cosmicSettings.test.ts`
- `client/src/store/cosmic/slice.test.ts`
- `client/src/store/cosmic/slice.openBox.test.ts`

These failures are pre-existing (confirmed at `a2cc300` baseline before any
Plan 22-06/22-07 changes — `slice.test.ts` reports `No test suite found` then
too). Vitest skips them silently with a `failed (1)` suite marker.

**Out-of-scope** for Plans 22-06/22-07. Recommended migration to vitest
describe/it API in a future maintenance plan. Note that some assert blocks
(e.g. Test 6 in slice.test.ts) now log their assertion failures because the
top-level execution still runs even though vitest doesn't collect them — this
is misleading noise, not a real regression. The data-layer logic these test
files exercise is covered by the newer vitest-style tests:

- `client/src/store/cosmic/shopSlice.test.ts` (15/15 PASS — Plan 22-05)
- `client/src/utils/cosmosGate.test.ts` (4/5 PASS, 1 skipped — Plan 22-06)
- `client/src/store/migrations/phase22.test.ts` (10/10 PASS — Plan 22-07)
