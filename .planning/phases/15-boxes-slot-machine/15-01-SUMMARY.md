---
phase: 15-boxes-slot-machine
plan: 01
status: complete
date: 2026-05-08
---

# Plan 15-01 — Foundation Summary

## Implemented

- **`client/src/utils/rarityRoll.ts`** — locked weights 50/35/12/3 + pity guarantees (rare 3 / epic 10 / legendary hard 25 + soft boost 15→+3% / 20→+7%) + bonusRarity floor.
- **`client/src/utils/rarityRoll.test.ts`** — 11 unit tests, distribution within ±5% of weights.
- **`client/src/store/cosmic/types.ts`** — BoxData extended (8 fields: id/planetId/planetName/archetype/element/opened/createdAt/bonusRarity?). Legacy `sourceArchetype` kept для backward compat parsing only.
- **`client/src/store/cosmic/slice.ts`** — replaced Phase 11 stubs (addBox/openBox) с 4 actions:
  - `addBox(params)` → BoxData (auto crypto.randomUUID id, opened=false, createdAt=Date.now)
  - `rollBoxRarity(id)` → pure read (RNG roll без commit)
  - `commitOpenedBox(id, rarity)` → atomic addSerum + remove box + updatePity + hasOpenedAnyBox=true
  - `removeBox(id)` → filter
- **`client/src/store/cosmic/slice.test.ts`** — 11 unit tests passing.
- **`client/src/store/gameStore.ts`** — STORAGE_VERSION 17 → 18 (Phase 15 BoxData shape change wipes Phase 16 number-based bonusRarity entries). Added load-time BoxData validation + soft migration.
- **`client/src/utils/devBoxes.ts`** — DEV-only window helpers `__addBox / __listBoxes / __clearBoxes`. Tree-shaken в prod (verified `grep __addBox dist/assets/*.js` returns 0).
- **`client/src/main.tsx`** — side-effect import of devBoxes.
- **`client/tsconfig.json`** — exclude `*.test.ts` (deviation: tests run via global tsx, not bundled).

## Deviations

- **Rule 3 (blocking):** Phase 16 уже использовал `bonusRarity: number` (0/0.05/0.15) в BoxData; Phase 15 plan требует `'rare'|'epic'|'legendary'`. **Fix:** mapped в `investigatePlanet` — perfect→'epic', good→'rare', fail→undefined. STORAGE_VERSION bump 17→18 wipes старые number-based entries.
- **Rule 3 (blocking):** `tsx` not в package.json devDeps. **Fix:** используем globally-installed tsx (`/usr/local/bin/tsx v4.19.3`) для тестов; tsconfig.json excludes `*.test.ts` чтобы tsc не падал на `node:assert/strict`.

## Verification

- `tsx src/utils/rarityRoll.test.ts` → "All rarityRoll tests passed."
- `tsx src/store/cosmic/slice.test.ts` → "All slice tests passed."
- `npx tsc --noEmit` → clean.
- `npm run build` → success, no __addBox in prod chunks.

## Phase 14 baseline (post-Phase 16, pre-Phase 15)

`dist/assets/index-*.js` gzip = **219.43 KB** (this is post-Phase 16 baseline; Phase 15 cap +35 KB → ≤ 254 KB).

## Pending (next plans)

- Plan 15-02: BoxesTab UI rewrite (uses BoxData shape + addBox/rollBoxRarity actions).
- Plan 15-03: CascadeRevealModal (consumes rollBoxRarity + commitOpenedBox).
- Plan 15-04: SerumSlotMachine (separate chunk).
- Plan 15-05: BulkOpenSummary + Settings + i18n + verify.
