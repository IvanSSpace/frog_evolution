---
kind: tech-debt
date: 2026-05-18
scope: React Testing Library coverage for Phase 27 Contacts UI
files:
  - client/package.json
  - client/package-lock.json
  - client/src/components/CosmicHub/contacts/RelationshipBar.test.tsx
  - client/src/components/CosmicHub/ContactsTab.test.tsx
  - client/src/components/CosmicHub/contacts/RaceDetailView.test.tsx
  - client/src/components/Contacts/EventToast.test.tsx
commits:
  - e30a9f2 RelationshipBar tests + install @testing-library/react
  - 1249a12 ContactsTab tests
  - f55ea78 RaceDetailView tests
  - 9f91a5f EventToast + Controller tests
tests-before: 142 PASS, 0 FAIL
tests-after:  172 PASS, 0 FAIL (30 new cases)
---

# Tech-debt: React Testing Library coverage for Phase 27 Contacts UI

## One-liner

Add 30 RTL test cases across the four Phase 27 Contacts components
(ContactsTab, RaceDetailView, RelationshipBar, EventToast + Controller),
covering tier mapping, navigation, pending resolution, queue cap, and
cliclability regression guards.

## Problem statement

Phase 27 shipped four DOM-rendered components with non-trivial logic
(tier color/label derivation, in-tab navigation, pending resolution
wiring, eventBus-driven toast queue) but zero React Testing Library
coverage. Existing test suite was 142 PASS with no UI-component coverage
at all for the Cosmic Hub modal contents — only Zustand slices and
pure helpers (`pendingEngine`, `getRelationshipTier`, etc.).

This left several contract-level invariants unverified:

- Does the relationship bar fill match the score / RELATIONSHIP_MAX ratio?
- Are all 10 races rendered on the Contacts tab?
- Does the unread dot appear strictly when a pendingItem exists for the race?
- Do reply buttons in `RaceDetailView` actually call the matching
  `resolveAccept` / `resolveRefuse` / `resolveAcknowledge` with the correct id?
- Does the event toast auto-dismiss after 3 seconds, and does the controller
  cap visible toasts at 3 when a flurry of events arrives?

All of these were assumed to work because manual smoke-tests during Phase
27 passed, but a regression in any of them would slip silently into main.

## Approach

Per `client/CLAUDE.md` + project_constraints (React 19, vitest 4, happy-dom
20, no Lottie, no snapshot testing):

1. **Install `@testing-library/react@^16` + `jest-dom` + `user-event`** —
   not previously installed; React 19 compatible peers.
2. **Four test files**, each ≈3-6 test cases, focused on contract
   (props in → DOM out / callback fired), not exhaustive snapshots.
3. **i18n mocked with passthrough** — `useTranslation().t(key) => key`
   (template-aware variant for EventToast embeds `key{a=…|b=…}` to assert
   interpolated vars). No real i18n init required.
4. **Store seeded via `useGameStore.setState(...)`** — same pattern as
   `cosmosGate.test.ts` Test 5. For RaceDetailView the resolver actions
   are injected as `vi.fn()` so call-args can be asserted.
5. **Dynamic imports + localStorage polyfill** for store-touching tests
   to mirror `cosmosGate.test.ts` setup (Node 25 + happy-dom break the
   default localStorage methods on module init; static imports get
   hoisted ABOVE polyfill calls).
6. **Cliclability regression guard** — explicit `expect(btn.type).toBe('button')`
   assertions on every clickable element (per memory feedback_clickability).
7. **Fake timers only where strictly needed** (EventToast auto-dismiss
   boundary at 2999 vs 3000 ms).

## What was added

### File 1 — `RelationshipBar.test.tsx` (5 named cases, 14 with `.each` rows)

| # | Case | Assertion |
|---|---|---|
| 1 | Numeric label format | `"{round(value)} / RELATIONSHIP_MAX"` rendered for value=1 |
| 2 | Tier label resolution | passthrough mock surfaces `TIER_I18N_KEYS.hostile` for value=1 |
| 3 | Tier mapping for all 10 scores | 1-2 hostile, 3-4 cool, 5-6 neutral, 7-8 friendly, 9-10 ally (10 `.each` rows) |
| 4 | Fill bar width % | `(value / RELATIONSHIP_MAX) * 100` — `"50%"` for value=5 |
| 5 | Out-of-range clamping | value=12 → ally + 100% fill; value=0 → hostile + 0% fill |

Commit: `e30a9f2`

### File 2 — `ContactsTab.test.tsx` (5 cases)

| # | Case | Assertion |
|---|---|---|
| 1 | List renders 10 race rows | `screen.getAllByRole('button').length === RACES.length` (10) |
| 2 | Cliclability guard | every row is `button[type="button"]` |
| 3 | Unread dot scoping | `getAllByLabelText('unread').length === 1` when one race has a pendingItem |
| 4 | In-tab navigation | clicking a row swaps view → `getByLabelText('Back')` from RaceDetailView |
| 5 | Mount effect | `triggerPendingPull` injected as `vi.fn` is called exactly once |

Commit: `1249a12`

### File 3 — `RaceDetailView.test.tsx` (6 cases)

| # | Case | Assertion |
|---|---|---|
| 1 | Back arrow callback | `aria-label="Back"` button click → `onBack()` invoked once |
| 2 | Lore card content | `home_planet_name`, `personality`, `lore_short` i18n keys visible |
| 3 | RelationshipBar mounts | tier label for INITIAL_RELATIONSHIP=2 (hostile, `tier.1`) visible |
| 4 | EmptyPending | `empty_state` i18n key shown when no pending |
| 5 | msg → Acknowledge wiring | click → `resolveAcknowledge` called with `pending.id` |
| 6 | dialog → Refuse + Support wiring | each button calls correct resolver with `pending.id`; type="button" |

Commit: `f55ea78`

### File 4 — `EventToast.test.tsx` (5 cases, covers both EventToast + Controller)

| # | Case | Assertion |
|---|---|---|
| 1 | EventToast renders race / desc / signed delta | message contains `raceName=races.crystalloids.name`, `description=cosmos.event.ritual_disrupted`, `delta=+2`; standalone "+2" badge present |
| 2 | Unknown raceId fallback | renders ❓ emoji and raw id as raceName var |
| 3 | Auto-dismiss after AUTO_DISMISS_MS (fake timers) | at t=2999 `onDismiss` not called; at t=3000 called once with id |
| 4 | Controller subscribes to eventBus | emitting `contacts:event-applied` → matching toast body in DOM |
| 5 | MAX_VISIBLE=3 cap | emitting 5 events leaves only the last 3 descriptions in DOM |

Commit: `9f91a5f`

## Test results

```
before: PASS (142) FAIL (0)
after:  PASS (172) FAIL (0)
delta:  +30 tests (14 + 5 + 6 + 5)
```

`tsc --noEmit` clean after every commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fix worktree node_modules symlink**

- **Found during:** Task 1 (RelationshipBar test run)
- **Issue:** The auto-created symlink `client/node_modules ->
  ../../../client/node_modules` had three `..` levels, which from
  `worktrees/agent-…/client/` resolves to
  `worktrees/.claude/client/node_modules` — a non-existent path. Result:
  `ERR_MODULE_NOT_FOUND` when invoking `npx vitest` from the worktree.
- **Fix:** `rm node_modules && ln -s ../../../../client/node_modules
  node_modules` — 4 `..` levels from `worktrees/agent-…/client/` resolves
  to `frog_evolution_code/client/node_modules`.
- **Files modified:** `client/node_modules` (symlink only, not committed)
- **Commit:** N/A — runtime fix, no diff

**2. [Rule 3 - Blocking] Polyfill localStorage + dynamic-import gameStore
in store-touching component tests**

- **Found during:** Task 2 (ContactsTab first run)
- **Issue:** Static `import` of `ContactsTab` transitively pulls in
  `gameStore.ts` which calls `loadBoxOpenCount()` → `localStorage.getItem(…)`
  at module init. Vite hoists static imports ABOVE the top-level
  `installLocalStoragePolyfill()` call → TypeError "getItem is not a
  function". Same issue documented in `cosmosGate.test.ts` and
  `cosmicSettings.test.ts`.
- **Fix:** Move runtime imports into a `beforeAll` block using dynamic
  `await import(...)`; polyfill stays at top-level so it runs BEFORE the
  dynamic resolution. Pattern matches `cosmosGate.test.ts` exactly.
- **Files modified:** `ContactsTab.test.tsx`, `RaceDetailView.test.tsx`
- **Commits:** `1249a12`, `f55ea78`

### Setup Operations

**Auth gates / installs:**

- `npm install --save-dev @testing-library/react@^16 @testing-library/jest-dom@^6
  @testing-library/user-event@^14` — devDependencies for the new test
  files; 19 packages added. Peer compatibility verified against
  `react@^19.1.0` already in package.json.

## Known Stubs

None. All four components have at least one positive test path; reply
button wiring is verified end-to-end via `vi.fn()` spies on the resolver
actions injected into the store.

## Files NOT changed

- No production source files were modified.
- `.planning/STATE.md`, `.planning/ROADMAP.md` — left untouched per
  project_constraints ("DO NOT modify").
- `i18n/*.json` — left untouched; mocks provide deterministic key
  passthrough so we don't depend on real translations.

## Operational note — worktree branch routing accident

Task 1 was initially committed (3 files) onto `refs/heads/main` instead
of the worktree branch (`worktree-agent-…`) due to bash commands using
absolute paths to `/Users/shar/.../frog_evolution_code/client` (the
main repo's client) rather than the worktree path. The commit was
cherry-picked onto the worktree branch (preserving the identical diff)
and continued work proceeded inside the worktree.

Per `destructive_git_prohibition`, `refs/heads/main` was **NOT
force-rewound**. The premature commit `3bc6d65` remains on main as an
identical-content duplicate of the worktree branch's `e30a9f2`. When the
worktree branch is merged back, git will detect the duplicate content
and either fast-forward through it or produce a no-op merge. **The user
may choose to `git revert 3bc6d65` on main if they want it cleaner**, or
to leave it — both are safe (the commit's diff is well-formed and tests
pass on main: 158 PASS).

The remaining three commits (`1249a12`, `f55ea78`, `9f91a5f`) landed
correctly on the worktree branch; the pre-commit branch assertion was
added inline for each.

## Self-Check: PASSED

- `client/src/components/CosmicHub/contacts/RelationshipBar.test.tsx` FOUND
- `client/src/components/CosmicHub/ContactsTab.test.tsx` FOUND
- `client/src/components/CosmicHub/contacts/RaceDetailView.test.tsx` FOUND
- `client/src/components/Contacts/EventToast.test.tsx` FOUND
- Commit `e30a9f2` FOUND on worktree branch (cherry-pick of main's `3bc6d65`)
- Commit `1249a12` FOUND on worktree branch
- Commit `f55ea78` FOUND on worktree branch
- Commit `9f91a5f` FOUND on worktree branch
- `npx vitest run`: 172 PASS, 0 FAIL
- `npx tsc --noEmit`: clean
