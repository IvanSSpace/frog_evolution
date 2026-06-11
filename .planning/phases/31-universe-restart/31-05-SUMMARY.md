---
phase: 31-universe-restart
plan: 05
subsystem: evolution-removal + income-multiplier
tags: [evolution, baseTier, prestige, cleanup, dead-code]
dependency_graph:
  requires: [31-02, 31-03, 31-04]
  provides: [evolution-mechanics-removed, baseTier-income-multiplier]
  affects: [gameStore, FrogShopModal, Header, GalleryModal, MainScene, SettingsModal, gameSync, persistence, eventBus, App]
tech_stack:
  added: []
  patterns: [dead-code-removal, prestige-income-multiplier]
key_files:
  modified:
    - client/src/store/gameStore.ts
    - client/src/ui/components/FrogShopModal.tsx
    - client/src/App.tsx
    - client/src/store/eventBus.ts
    - client/src/ui/components/Header.tsx
    - client/src/components/Gallery/GalleryModal.tsx
    - client/src/game/scenes/MainScene.ts
    - client/src/ui/components/SettingsModal.tsx
    - client/src/api/gameSync.ts
    - client/src/store/persistence.ts
  deleted:
    - client/src/game/config/evolution.ts
    - client/src/components/Evolution/EvolutionCeremony.tsx
    - client/src/components/Evolution/evolutionCeremony.css
decisions:
  - "addGold income multiplier now driven by 0.10 * s.baseTier (baseTier 0→+0%, 1→+10%, 2→+20%) replacing getEvolutionBonusFraction"
  - "frogTiers and frogTierCooldowns fields removed from GameState entirely"
  - "GalleryModal evolution section replaced with prestige section showing baseTier bonus"
  - "Header evolutionFraction now 0.10 * baseTier mirroring addGold formula"
  - "Pre-existing vitest failures (cosmicShop, openBox) confirmed unrelated to this plan"
metrics:
  duration: "~18 minutes"
  completed: "2026-06-11"
  tasks: 2
  files_modified: 10
  files_deleted: 3
---

# Phase 31 Plan 05: Evolution Removal + baseTier Income Multiplier Summary

Remove old per-level evolution mechanic (frogTiers system) and replace income multiplier with baseTier prestige bonus (0.10 * baseTier).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace income coupling on baseTier + remove core evolution logic | f42d830 | gameStore.ts, FrogShopModal.tsx, App.tsx, eventBus.ts |
| 2 | Delete evolution UI files + cleanup Header/GalleryModal/MainScene/SettingsModal/gameSync/persistence | 296d58e | 7 modified + 3 deleted |

## What Was Built

- **FIX 1 (critical):** `addGold` in `gameStore.ts` now applies `0.10 * s.baseTier` as income multiplier instead of `getEvolutionBonusFraction(s.frogTiers)`. baseTier 0→+0%, 1→+10%, 2→+20%. Income multiplier preserved — now driven by prestige level.
- **evolution.ts deleted:** All functions (`getEvolutionBonusFraction`, `getEvolutionCost`, `getEvolutionBonusPercent`, `isEvolutionUnlockedForLocation`, `locationGroupForLevel`, `countEvolutionsInLocation`, `EVOLUTION_COOLDOWN_MS`, `LOCATION_GATE_THRESHOLD`) removed.
- **EvolutionCeremony deleted:** Pokemon-style ceremony component and CSS removed.
- **FrogShopModal:** Evolution tab removed. Only 'buy' tab remains. TabId type simplified to 'buy'.
- **App.tsx:** EvolutionCeremony import and JSX mount removed.
- **eventBus.ts:** 'frog:evolution-ceremony' event removed from EventMap.
- **Header.tsx:** `evolutionFraction = 0.10 * baseTier` (mirrors addGold formula).
- **GalleryModal.tsx:** Evolution progress section replaced with prestige section (shows baseTier bonus when baseTier > 0).
- **MainScene.ts:** frogTiers subscription block removed (tier changes only on universe restart via page reload).
- **SettingsModal.tsx:** `devResetFrogTiers` function and "Сбросить эволюцию лягушек" dev button removed.
- **gameSync.ts:** frogTiers/frogTierCooldowns removed from snapshot, hydration, and persistence write paths.
- **persistence.ts:** `FROG_TIERS_KEY`, `FROG_TIER_COOLDOWNS_KEY`, `loadFrogTiers`, `saveFrogTiers`, `loadFrogTierCooldowns`, `saveFrogTierCooldowns` functions removed.
- **gameStore.ts:** `frogTiers`, `frogTierCooldowns`, `upgradeFrogTier` removed from interface and implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Enhancement] Header and GalleryModal updated to use baseTier instead of deleted evolution functions**
- **Found during:** Task 2
- **Issue:** Header.tsx and GalleryModal.tsx used `getEvolutionBonusFraction` for display — after deletion these would show 0 permanently
- **Fix:** Header: `evolutionFraction = 0.10 * baseTier`; GalleryModal: prestige section with `0.10 * baseTier`
- **Files modified:** Header.tsx, GalleryModal.tsx
- **Commit:** 296d58e

**2. [Rule 1 - Bug] Unused components cleaned up in GalleryModal**
- **Found during:** Task 2
- **Issue:** `ProgressBar` and `Hint` components became unused after removing evolution section
- **Fix:** Removed both components to avoid TS6133 warnings and dead code
- **Files modified:** GalleryModal.tsx
- **Commit:** 296d58e

## Verification Results

```
grep -E "0\.10? \* s\.baseTier" client/src/store/gameStore.ts  → FOUND
grep -rn "from.*evolution|import.*evolution" client/src → 0 matches
ls client/src/game/config/evolution.ts → No such file
ls client/src/components/Evolution/ → No such file
npx tsc --noEmit → TypeScript compilation completed (0 errors)
npx vitest run src/store/ src/api/gameSync.test.ts → PASS (79) FAIL (6 pre-existing)
npm run build → built in 4.58s (clean)
```

## Pre-existing Test Failures (not caused by this plan)

6 failing vitest tests in cosmicShop and openBox suites — confirmed pre-existing from Phase 22/23 (documented in deferred-items.md per STATE.md Phase 23 notes).

## Self-Check: PASSED

- f42d830 commit exists: YES
- 296d58e commit exists: YES
- evolution.ts deleted: YES
- EvolutionCeremony.tsx deleted: YES
- evolutionCeremony.css deleted: YES
- 0.10 * s.baseTier in addGold: YES
- zero getEvolutionBonusFraction refs: YES (0 matches)
- tsc clean: YES
- vite build clean: YES
