---
phase: 23-onboarding-flow
plan: 01
subsystem: onboarding-foundation
tags: [onboarding, zustand, persistence, i18n, dev-helpers]
completed: 2026-05-18
duration_min: 7
requirements: [PHASE23-STATE, PHASE23-CONTROLLER]
provides:
  - useOnboardingStore (Zustand + subscribeWithSelector) — isolated slice, per-device
  - loadOnboarding / saveOnboarding in persistence.ts under frog_evolution_onboarding key
  - OnboardingController.tsx shell mounted in App.tsx (Wave 1 — returns null)
  - installOnboardingDevHelpers() — window.__resetOnboarding + window.__skipOnboarding
  - i18n namespace onboarding.{welcome,tapHint,mergeHint,location} in RU/EN/ES (skeleton keys)
  - 11-spec vitest suite covering defaults, mark actions, persistence round-trip, corruption
key-files:
  created:
    - client/src/store/onboarding/types.ts
    - client/src/store/onboarding/onboardingSlice.ts
    - client/src/store/onboarding/onboardingSlice.test.ts
    - client/src/components/Onboarding/OnboardingController.tsx
    - client/src/utils/onboardingDevHelpers.ts
  modified:
    - client/src/store/persistence.ts
    - client/src/App.tsx
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json
key-decisions:
  - "Standalone Zustand store (NOT gameStore slice) — per-device only, no server sync, isolation from Phase 22 carrier migration"
  - "subscribeWithSelector middleware enabled now so Plan 23-02..05 can subscribe to individual flags without re-render storms"
  - "OnboardingController mounted unconditionally; Wave 1 returns null but reads flags so the React reactivity wiring is in place for later plans"
  - "Mark actions persist synchronously inside the slice (no debounce) — these are infrequent one-shot events"
  - "Defensive per-field validation in loadOnboarding (mirrors persistence.ts T-11-01 pattern) — partial corruption preserves valid fields"
  - "Dev helpers __resetOnboarding does window.location.reload() so Welcome modal (Plan 23-02) re-triggers immediately; __skipOnboarding fast-forwards all flags without reload for QA flow"
patterns-established:
  - "Onboarding state lives in its own store/onboarding/ module — separate persistence key, separate dev helpers, separate i18n namespace"
  - "Beat-by-beat coordinator pattern: OnboardingController owns the state machine, individual beats (Plan 23-02..05) add conditional JSX branches but don't manage state themselves"
  - "All future beat overlays MUST follow cliclability + frog-alpha constraints — documented inline in OnboardingController.tsx for next planners"
metrics:
  bundle_delta_gzip: "-1.32 KB"
  vitest_tests_added: 11
  vitest_total: "97 passed / 0 failed"
  i18n_keys_added: "5 keys × 3 locales = 15 strings"
  tsc_status: clean
---

# Phase 23 Plan 23-01: Onboarding Foundation Summary

**Per-device Zustand onboarding store + persisted state + mounted controller shell + dev helpers + RU/EN/ES i18n skeleton — foundation that Plan 23-02..05 will fill with Welcome / TapHint / MergeDemo / LocationCelebration beats.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-17T20:58:49Z
- **Completed:** 2026-05-17T21:05:37Z
- **Tasks:** 3 / 3
- **Files created:** 5
- **Files modified:** 5

## Accomplishments

- Isolated `useOnboardingStore` (`store/onboarding/`) with 4 flags (welcomeSeen, firstBoxTapSeen, firstMergeSeen, locationsCelebrated) + mark/__reset actions, synchronously persisted to `frog_evolution_onboarding` localStorage key.
- `loadOnboarding`/`saveOnboarding` in `persistence.ts` with defensive per-field validation — corrupt JSON / partial corruption falls back to defaults without throwing.
- `OnboardingController.tsx` mounted in App.tsx right after `<TutorialOverlay />`; reads onboarding flags so React reactivity is wired; Wave 1 render is `null`, ready for Plan 23-02..05 to add beat overlays.
- `window.__resetOnboarding()` (reset + reload) and `window.__skipOnboarding()` (mark all flags + celebrate locations 2/3/6) wired through `installOnboardingDevHelpers()` in App.tsx DEV bootstrap.
- `onboarding.*` i18n namespace in RU/EN/ES with skeleton strings (RU final from CONTEXT.md, EN/ES translated per plan); `check-translations` reports 333/333 parity across 3 locales.
- 11-spec vitest suite covers defaults, each mark action, locationsCelebrated map merge/idempotence, `__reset`, persistence round-trip via `vi.resetModules()`, corrupt JSON, and partial corruption sanitisation.

## Task Commits

1. **Task 1: onboarding store + types + persistence** — `c98ed34` (feat)
2. **Task 2: OnboardingController shell + App.tsx mount** — `e74dffe` (feat)
3. **Task 3: dev helpers + i18n bootstrap + vitest suite** — `578db00` (feat)

Plan-metadata commit will follow (this SUMMARY + STATE updates).

## Files Created/Modified

### Created
- `client/src/store/onboarding/types.ts` — `OnboardingState` + `OnboardingActions` interfaces.
- `client/src/store/onboarding/onboardingSlice.ts` — `useOnboardingStore` (Zustand + `subscribeWithSelector`), mark actions persist synchronously, `__reset` dev-only.
- `client/src/store/onboarding/onboardingSlice.test.ts` — 11 vitest specs with in-memory localStorage polyfill.
- `client/src/components/Onboarding/OnboardingController.tsx` — Wave 1 shell coordinator.
- `client/src/utils/onboardingDevHelpers.ts` — `installOnboardingDevHelpers()` (DEV-only window helpers).

### Modified
- `client/src/store/persistence.ts` — added `ONBOARDING_KEY` + `loadOnboarding`/`saveOnboarding` with per-field validation.
- `client/src/App.tsx` — import + mount `<OnboardingController />` after `<TutorialOverlay />`; wire `installOnboardingDevHelpers()` into DEV bootstrap useEffect with matching cleanup.
- `client/src/i18n/ru.json` — final RU strings under `onboarding.*`.
- `client/src/i18n/en.json` — EN translations under `onboarding.*`.
- `client/src/i18n/es.json` — ES translations under `onboarding.*`.

## Decisions Made

- **Standalone Zustand store, not a gameStore slice.** Onboarding is per-device UX only; it must not leak into the server-synced cosmic slice (which would risk Phase 22 migration regressions and pollute meta state). A separate `useOnboardingStore` keeps blast radius zero.
- **`subscribeWithSelector` middleware enabled now.** Plan 23-02..05 will want to react to single flags (e.g. tap-hint listens only to `firstBoxTapSeen`). Adding the middleware retroactively forces refactors of consumers, so we pay the (trivial) cost upfront.
- **Wave 1 controller is unconditionally mounted and reads flags via a combined selector.** This proves the reactivity wiring without TS "unused locals" complaints, and gives later plans a clear seam to switch to per-flag selectors when they actually render beat overlays.
- **Synchronous persistence per action.** Onboarding writes are infrequent (5-10 over the lifetime of a fresh install), so debouncing would add complexity for zero benefit and risk losing the flag on a hard refresh between two beats.
- **`__resetOnboarding()` reloads the page.** Without reload, the Welcome modal (Plan 23-02) would not re-mount because App.tsx boot-time state hydration only runs once. Reload is the cleanest way to re-trigger the full beat 1 → 4 sequence during QA.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] TS6133 unused-locals on per-flag selectors in OnboardingController**
- **Found during:** Task 2 verification (`tsc --noEmit`).
- **Issue:** Plan-suggested code declared `const welcomeSeen = useOnboardingStore((s) => s.welcomeSeen)` for each of three flags but never read them in Wave 1; TypeScript `noUnusedLocals` rejected the build. ESLint disable comments do not silence TS.
- **Fix:** Combined the three selectors into a single object selector and `void flags` inside the placeholder `useEffect` so the value is "consumed" without changing semantics. Per-flag selectors will be reintroduced by Plan 23-02..05 when each beat actually reads its own flag.
- **Files modified:** `client/src/components/Onboarding/OnboardingController.tsx`
- **Verification:** `tsc --noEmit` clean.
- **Committed in:** `e74dffe` (Task 2 commit).

**2. [Rule 3 — Blocking] vitest localStorage.removeItem TypeError in happy-dom env**
- **Found during:** Task 3 verification (`vitest run`).
- **Issue:** happy-dom + Node 25 (with the RTK proxy active in this dev env) ships a `localStorage` global that lacks `.removeItem`, so the `beforeEach` cleanup threw a `TypeError` and all 11 tests failed. Same root cause as the workaround already documented in `cosmosGate.test.ts`.
- **Fix:** Installed the same in-memory `localStorage` polyfill via `Object.defineProperty(globalThis, 'localStorage', …)` at the top of the test file, before any dynamic import.
- **Files modified:** `client/src/store/onboarding/onboardingSlice.test.ts`
- **Verification:** `11 passed (11)`; full suite `97 passed / 0 failed`.
- **Committed in:** `578db00` (Task 3 commit).

**3. [Rule 2 — Missing Critical] Idempotent guard inside mark actions**
- **Found during:** Task 1 implementation.
- **Issue:** Plan-spec mark actions unconditionally `set + save`. For `markLocationCelebrated(2)` called twice this would emit an unnecessary store update (re-render every subscriber) and re-write localStorage. Subscribers in Plan 23-05 will be sensitive to spurious notifications.
- **Fix:** Added `if (get().welcomeSeen) return` (and equivalents) before mutating. Idempotency is semantically what the plan asks for ("monotonically true once seen") and verified by test "marking the same location twice is idempotent".
- **Files modified:** `client/src/store/onboarding/onboardingSlice.ts`
- **Verification:** Vitest spec passes; behavior matches plan must_have "all mark-actions work and persist on each call" — first call persists, second is a no-op.
- **Committed in:** `c98ed34` (Task 1 commit).

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing-critical).
**Impact on plan:** All deviations either unblocked the build/tests or hardened the contract for downstream plans. No scope creep — every file modified is in the plan's `files_modified` list.

## Issues Encountered

- `npx vite build` fails under the RTK proxy ("npm error Missing script: vite") because RTK rewrites `npx` invocations. Used `npm run build` instead — same outcome, no behavioural change.

## Verification Evidence

- `cd client && npx tsc --noEmit` → `TypeScript compilation completed` (clean).
- `cd client && npx vitest run src/store/onboarding/` → `Test Files 1 passed (1)`, `Tests 11 passed (11)`.
- `cd client && npx vitest run` (full suite) → `PASS (97) FAIL (0)`.
- `cd client && npm run build` → `built in 3.87s`; no errors. main bundle `index-vffWbdF3.js` 659.67 kB / 194.65 kB gzip.
- `cd client && node scripts/check-bundle-delta.cjs` → `Bundle delta -1.32 KB within cap 50 KB`.
- `cd client && node scripts/check-translations.cjs` → `OK: all 333 keys present in RU/EN/ES`.
- `git diff --diff-filter=D --name-only HEAD~3 HEAD` → empty (no file deletions across the 3 task commits).

## Manual Smoke (to be done in browser DEV)

The store + dev helpers are ready to verify in `npm run dev`:
1. Open devtools → `useOnboardingStore.getState()` (via React DevTools or `window.__resetOnboarding` import path) — returns defaults shape on a fresh load.
2. `window.__skipOnboarding()` → `welcomeSeen/firstBoxTapSeen/firstMergeSeen` all true; `locationsCelebrated` = `{ 2: true, 3: true, 6: true }`.
3. `window.__resetOnboarding()` → page reloads, state back to defaults, localStorage `frog_evolution_onboarding` rewritten with reset shape.

These are not blockers for Plan 23-02 — store contract is fully covered by the vitest suite.

## Next Phase Readiness

- **Plan 23-02 (Welcome modal)** can immediately consume `useOnboardingStore((s) => s.welcomeSeen)` + `markWelcomeSeen()` and render its overlay inside `OnboardingController.tsx`. i18n keys `onboarding.welcome.*` are already present in all 3 locales.
- **Plan 23-03 (TapHint)** can subscribe to `firstBoxTapSeen` (waits for `welcomeSeen=true` gate set by 23-02) and read `onboarding.tapHint.label`.
- **Plan 23-05 (Location celebration)** has the `locationsCelebrated: Record<number, boolean>` map and `markLocationCelebrated(id)` ready; `onboarding.location.unlocked` has `{{name}}` interpolation placeholder.
- **Plan 23-04 (Merge demo)** can subscribe to `firstMergeSeen` and use `onboarding.mergeHint.*` keys.
- Wave-2 plans (23-02/03/05) are unblocked and can proceed in parallel; 23-04 still waits on 23-03 per the phase dependency graph.

## Self-Check

- [x] All created files exist on disk.
- [x] All 3 task commits exist in `git log`.
- [x] No unintended deletions in any of the 3 commits.
- [x] No CLAUDE.md rule violated — orchestration constraint does not apply (this is the executor agent, code modification is its sanctioned role).
- [x] No Lottie, no `frog.container.alpha` tweens, no DOM clickability footguns introduced (Wave 1 renders no interactive surface).

---
*Phase: 23-onboarding-flow*
*Completed: 2026-05-18*
