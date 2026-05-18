---
phase: tech-debt
plan: typescript-strict-audit
subsystem: tooling
tags: [typescript, strict, tsconfig, type-safety]
key-files:
  modified:
    - client/tsconfig.json
    - client/tsconfig.node.json
    - client/src/game/scenes/MainScene.ts
metrics:
  duration: ~25min
  completed: 2026-05-18
  any_usages_found: 0
  flags_enabled: 5
  flags_documented_skip: 3
  vitest_baseline_pass: 174
  vitest_final_pass: 174
---

# TypeScript Strict Mode Audit + `any` Cleanup Summary

One-liner: Codebase already had zero `any` annotations/casts; enabled 5 additional strict-adjacent tsconfig flags (1 needed a 1-line fix), documented 3 high-impact flags as deferred with file/error counts.

## Audit Scope

- `client/src/**/*.ts` and `*.tsx` (production code, audit target)
- `client/src/**/*.test.ts` and `*.test.tsx` (excluded from main tsconfig but searched anyway)
- `client/e2e/*.ts` (out-of-tree e2e)
- `client/src/vite-env.d.ts` (ambient declarations)
- `client/tsconfig.json` + `client/tsconfig.node.json`

Server code (`server/src/**`) NOT in scope.

## `any` Inventory — Result: 0 production usages

Searched patterns:
- `: any`
- `as any`
- `<any>` / `<any,`
- `Array<any>` / `any[]`

Result across `client/src/**` (production + tests + d.ts):

| Pattern | Count | Notes |
|---------|-------|-------|
| `: any` annotation | 0 | – |
| `as any` cast | 0 | – |
| `<any>` generic | 0 | – |
| `any[]` / `Array<any>` | 0 | – |
| Word "any" in comments | 16 | Natural-language usage, all in `// ...` |

The only file with `any` as a token is `client/src/game/scenes/main/FrogSpawner.ts:103` — a comment ("Debug carriers: any free frog"). No real usage.

Codebase already follows conservative pattern of using `unknown` (39 occurrences) for Phaser plugin gaps and event payloads — e.g. `popovers.ts` event handler signatures, `starmap/types.ts` index signatures. This is the proper conservative replacement; no further work required.

**Conclusion: no `any` cleanup pass was needed.** Audit focus shifted entirely to strict tsconfig flag ramp.

## Baseline tsconfig State (before audit)

`client/tsconfig.json` (production):
- `strict: true` (enables noImplicitAny, strictNullChecks, strictFunctionTypes, strictBindCallApply, strictPropertyInitialization, alwaysStrict, noImplicitThis, useUnknownInCatchVariables)
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`

`client/tsconfig.node.json` (vite.config.ts only):
- `strict: true` (everything in the strict bundle)

Baseline: `tsc --noEmit` → EXIT 0. `vitest run` → 174 PASS, 0 FAIL.

## Strict Flag Ramp — Per-flag Results

Each non-strict-bundle flag tested in isolation via `tsc --noEmit --<flag>`.

| Flag | Errors | Files | Decision | Notes |
|------|-------:|------:|----------|-------|
| `noImplicitReturns` | 0 | 0 | _(not added — see "Skipped 0-error" below)_ | Already implied by `strict`+control flow. |
| `noImplicitOverride` | 1 | 1 | **ENABLED** (commit 1e85c3d) | Fixed `MainScene.update` to add `override` modifier. |
| `noUncheckedSideEffectImports` | 0 | 0 | **ENABLED** (commit e4b2135) | Future-proofing: catches typos in side-effect-only imports. |
| `forceConsistentCasingInFileNames` | 0 | 0 | **ENABLED** (commit e4b2135) | Cross-platform safety: macOS/Windows are case-insensitive, Linux CI is not. |
| `allowUnreachableCode: false` | 0 | 0 | **ENABLED** (commit e4b2135) | Errors on dead code after return/throw. |
| `allowUnusedLabels: false` | 0 | 0 | **ENABLED** (commit e4b2135) | Errors on unused labels. |
| `noPropertyAccessFromIndexSignature` | 191 | 9 | **DEFERRED** | See "Deferred flags" below. |
| `noUncheckedIndexedAccess` | 295 | 49 | **DEFERRED** | See "Deferred flags" below. |
| `exactOptionalPropertyTypes` | 18 | 7 | **DEFERRED** | See "Deferred flags" below. |

### Note on `noImplicitReturns`

Tested at 0 errors. Not added because the audit's purpose is to **harden** the compiler against future regressions; `noImplicitReturns` overlaps significantly with TypeScript's existing flow analysis under `strict: true` and arrow-function return-type inference. Keeping the tsconfig footprint minimal. Can be added in a follow-up if desired — it's safe.

## Flags Enabled

Both `client/tsconfig.json` and `client/tsconfig.node.json` updated with:

```jsonc
{
  "noImplicitOverride": true,
  "noUncheckedSideEffectImports": true,
  "forceConsistentCasingInFileNames": true,
  "allowUnreachableCode": false,
  "allowUnusedLabels": false
}
```

Code change: `client/src/game/scenes/MainScene.ts:605` — added `override` modifier to `update(_time, delta)`. (This is the only method in any project scene that overrides `Phaser.Scene` base class; `preload`/`create`/`shutdown`/`destroy` are NOT base-class members — they're invoked reflectively by Scene Manager.)

## Deferred Flags (over the conservative threshold)

### `noPropertyAccessFromIndexSignature` — 191 errors in 9 files

Forces bracket access for any property that comes from an index signature. Most errors come from:
- i18n message lookups (`t('key.path')`)
- `process.env` / `import.meta.env` access
- Generic JSON record types (e.g. `gameSync.ts` payload merging)

**Reason deferred:** 9 unique files is borderline but the 191 mechanical changes (`obj.foo` → `obj['foo']`) cross the conservative threshold. Active development on Phase 27 + 28 would generate constant merge conflicts. Recommend revisiting after a major release.

**Files affected (full list):**
- `src/api/client.ts`
- `src/api/gameSync.ts`
- `src/App.tsx`
- `src/components/HUD/ActiveBonusesBar.tsx`
- `src/game/config/upgrades.ts`
- `src/game/scenes/starmap/tapEffectController.ts`
- `src/game/scenes/StarMapScene.ts`
- `src/store/migrations/phase22.ts`
- `src/store/persistence.ts`

### `noUncheckedIndexedAccess` — 295 errors in 49 files

Makes every `arr[i]` / `obj[key]` access return `T | undefined`. This is the single biggest strict flag in real codebases and would require:
- explicit nullish coalescing everywhere arrays/maps are indexed
- audit of every `for (let i = 0; ...)` loop body
- new defensive code in Phaser pools (sprite arrays accessed by index)

**Reason deferred:** Way over threshold (49 files = ~25% of all source files). Practically a multi-week refactor. NOT appropriate for active-development codebase. Document only.

### `exactOptionalPropertyTypes` — 18 errors in 7 files

Treats `{x?: T}` and `{x?: T | undefined}` as different. Most errors come from:
- `BoxData` carrying `bonusRarity: ... | undefined` when type declares `bonusRarity?: ...`
- Phaser handle types in `MainScene`/`StarMapScene` (`Container`, `TimerEvent`, etc.) initialized to `undefined`
- `OverlayGroup` / `TileProps` with `?: T` props receiving `T | undefined`

**Reason deferred:** Requires schema decisions — either change all `?: T` declarations to `?: T | undefined`, or filter `undefined` out at construction sites. 7 files / 18 errors is just over threshold; the right fix depends on team convention. Document and revisit.

**Files affected:**
- `src/game/scenes/starmap/effects/raceGlow.ts`
- `src/game/scenes/starmap/popovers.ts`
- `src/game/scenes/starmap/rendering/planetRenderer.ts`
- `src/game/scenes/StarMapScene.ts`
- `src/store/cosmic/slices/boxSlice.ts`
- `src/ui/components/BottomBar.tsx`
- `src/utils/devBoxes.ts`

## Verification

- `tsc --noEmit` on `tsconfig.json`: EXIT 0 (clean)
- `tsc --noEmit -p tsconfig.node.json`: EXIT 0 (clean)
- `vitest run`: 174 passed | 1 skipped | 0 failed (same as baseline)
- No production code logic touched. Only the `override` keyword added to one method signature.

## Commits

| Hash | Message |
|------|---------|
| `1e85c3d` | chore(tsconfig): enable noImplicitOverride + add override to MainScene.update |
| `e4b2135` | chore(tsconfig): enable zero-impact strict hardening flags |
| `ea776cc` | chore(tsconfig.node): mirror strict hardening flags from main tsconfig |

## Deviations from Plan

None. Plan executed as written. Audit found `any` count was already 0, so the "Safe `any` removals applied (atomic commits per cluster)" success criterion was vacuously satisfied; documented this finding rather than fabricating cleanup work.

## Recommendations for Future Audits

1. **Lock in current state.** The codebase is in unusually good type-safety shape (zero `any` outside comments, conservative use of `unknown`). Worth documenting in a CONTRIBUTING.md or CLAUDE.md note that `any` is banned and `unknown` is the escape hatch.

2. **`exactOptionalPropertyTypes` is the next conservative win.** 18 errors / 7 files is within plausible reach. Recommend a focused 2-3 hour cleanup session: decide on `?: T | undefined` vs filter-at-construction convention, apply uniformly. Would lock in optional property safety for free.

3. **`noPropertyAccessFromIndexSignature`** is mostly a stylistic nuisance for i18n keys. Consider a typed `t()` wrapper instead of enabling the flag, which would address the underlying type-safety hole (typo'd i18n keys) without the bracket-access ceremony.

4. **`noUncheckedIndexedAccess`** — not recommended until codebase reaches maintenance mode. Active Phaser-heavy code with pools and arrays is exactly where this flag generates the most friction without proportional safety gain (most array indices are loop-bounded).

## Self-Check: PASSED

Verified post-audit:
- All 3 commits exist in git log
- `client/tsconfig.json` contains all 5 new flags
- `client/tsconfig.node.json` contains all 5 new flags
- `client/src/game/scenes/MainScene.ts:605` has `override` modifier
- `tsc --noEmit` passes
- `vitest run` shows 174 passed
- No edits to `.planning/STATE.md` or `.planning/ROADMAP.md`
- No edits to any file outside the tsconfigs and `MainScene.ts`
