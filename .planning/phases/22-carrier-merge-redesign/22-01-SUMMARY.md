---
phase: 22
plan: "01"
subsystem: cosmic-carrier
tags: [refactor, rarity-removal, carrier-simplification, phase22]
dependency_graph:
  requires: []
  provides: [flat-serum-model, simple-carrier-model, rarity-free-codebase]
  affects: [carrier-ui, serum-ui, bestiary, gallery, game-engine, server-routes]
tech_stack:
  added: []
  patterns: [LegacyRarity-from-bestiary, inline-isEligible, flat-Record-Element-number]
key_files:
  created: []
  modified:
    - client/src/store/cosmic/bestiary.ts
    - client/src/store/cosmic/slice.ts
    - client/src/store/cosmic/slices/boxSlice.ts
    - client/src/store/cosmic/slices/shipSlice.ts
    - client/src/store/eventBus.ts
    - client/src/api/cosmic.ts
    - server/src/routes/cosmic.ts
    - client/src/game/effects/ElementAuraOverlay.ts
    - client/src/game/effects/elementAuraSpecs.ts
    - client/src/game/effects/FrogOverlayManager.ts
    - client/src/game/effects/FrogElementOverlay.ts
    - client/src/game/scenes/main/FrogInteraction.ts
    - client/src/game/scenes/main/FrogSpawner.ts
    - client/src/game/scenes/main/MergeController.ts
    - client/src/components/CosmicHub/* (multiple)
    - client/src/components/Gallery/* (multiple)
    - client/src/components/Tutorial/TutorialOverlay.tsx
  deleted:
    - client/src/components/CosmicHub/StabilizationModal.tsx
    - client/src/components/CosmicHub/CeilingDisplay.tsx
    - client/src/utils/serumEligibility.ts
    - client/src/utils/carrierFeed.ts
    - client/src/utils/carrierEvolution.ts
decisions:
  - "LegacyRarity type inlined in bestiary.ts and exported — preserves bitset layout without depending on deleted Rarity from types.ts"
  - "elementAuraSpecs.ts all carriers render at common/dormant path — rarity-conditional particle layers removed"
  - "MergeController carrier+carrier and carrier+normal cases stubbed as TODO Plan 22-02"
  - "FrogInteraction.isEligible inlined as not-already-carrier check"
metrics:
  duration: "~90 minutes (this session) + ~90 minutes (previous session)"
  completed: "2026-05-17"
  tasks_completed: 3
  files_modified: 55
---

# Phase 22 Plan 01: Carrier Merge Redesign — Rarity System Removal Summary

Removed 4-tier Rarity system from entire codebase. Carrier simplification: `CarrierData = {frogId, element, level}`. Flat serum inventory: `Record<Element, number>`.

## What Was Built

### Store Layer
- `types.ts`: `Rarity` type removed, `CarrierData` simplified to `{frogId, element, level}`
- `bestiary.ts`: `LegacyRarity` exported from here (preserves 1152-bit bitset layout for Plan 22-07)
- `carrierSlice.ts`: only `addCarrier` + `removeCarrier`
- `serumSlice.ts`: flat `addSerum(element, count)`, `removeSerum(element, count)`, `applySerum(frogId, element, level)`
- `boxSlice.ts`: `rollBoxRarity` returns `{element}` only, `commitOpenedBox(id)` does flat `serums[element]++`
- `shipSlice.ts`: no more `bonusRarityForResult` dependency
- `slice.ts`: removed `feedCarrier`, `mergeCarriers`, `disposeCarrier` actions

### Deleted Files
- `StabilizationModal.tsx` — feed-stabilize awakening UI removed
- `CeilingDisplay.tsx` — ceiling progress display removed
- `carrierFeed.ts`, `carrierEvolution.ts`, `serumEligibility.ts` — all logic deleted

### Server
- `server/routes/cosmic.ts`: `ApplySerumBody` flat (no rarity), carrier created as `{frogId, element, level}`

### API
- `api/cosmic.ts`: `ApplySerumResponse.serums: Record<Element, number>` flat

### UI Components
- All serum UI (SerumBar, SerumsTab, SerumInventoryTab, ElementGrid) — rarity arg removed
- Carrier UI (CarriersTab, CarrierInfoCard, DisposeConfirmModal) — simplified to element+level
- CascadeRevealModal, SerumSlotMachine, BoxesTab, BulkOpenSummary — rarity removed
- BestiaryTab + bestiary/* — import LegacyRarity from bestiary.ts
- Gallery/* — import LegacyRarity from bestiary.ts

### Game Engine
- `FrogInteraction`, `FrogSpawner`: inline `isEligible` = not-already-carrier
- `MergeController`: carrier merge cases stubbed as TODO Plan 22-02
- `ElementAuraOverlay`/`elementAuraSpecs`: `createAura(scene)` — no rarity param; all auras render dormant/common path
- `FrogOverlayManager`: all carriers `CARRIER_TIER = 'dormant'`
- `FrogElementOverlay`: `readonly locked = false`, `setLocked()` removed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Cascade] 50+ files imported Rarity from types.ts**
- Found during: Task 2B/3
- Issue: Removing `Rarity` from types.ts broke all importers
- Fix: All bestiary/gallery UI files now import `LegacyRarity` from `bestiary.ts`; game effects files updated
- Files: All bestiary/*, Gallery/*, elementAuraSpecs.ts, rarityStyles.ts, useBestiaryView.ts

**2. [Rule 1 - Bug] elementAuraSpecs.ts had rarity-conditional particle layers referencing deleted param**
- Found during: Task 3
- Issue: Python cleanup left orphaned ternary expressions, syntax errors
- Fix: Replaced orphaned ternaries with constant values; gearPositions inline array

**3. [Rule 2 - Missing] FrogSpawner.ts still imported deleted serumEligibility.ts**
- Found during: Task 3
- Fix: Inlined simple carrier-check (not in FrogInteraction summary — FrogSpawner had its own copy)

**4. [Rule 2 - Missing] SettingsModal.tsx called addSerum(el, rarity, count) with 3 args**
- Found during: Task 3
- Fix: `addSerum(el, 1)` loop over ELEMENTS only

**5. [Rule 2 - Missing] slice.openBox.test.ts tested old nested serums structure**
- Found during: Task 3
- Fix: Rewritten for flat serums model

## Known Stubs

- `DisposeConfirmModal.tsx`: No serum recovery logic (comment: TBD Plan 22-03)
- `MergeController.performMerge()`: carrier+normal and carrier+carrier paths fall through to standard merge with TODO Plan 22-02 comment

## Self-Check: PASSED

Verified:
- `tsc --noEmit` client: 0 errors
- `tsc --noEmit` server: 0 errors  
- `npm run build`: success (4.04s)
- Grep `\bRarity\b|mergeCarriers|feedCarrier|stabilized|RARITY_TO_STARTING_LEVEL` in code (not comments): 0 actual usages
- Commits exist: d93034d (2b), 5556f55 (3)
