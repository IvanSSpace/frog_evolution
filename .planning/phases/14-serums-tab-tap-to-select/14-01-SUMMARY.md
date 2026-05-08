---
phase: 14-serums-tab-tap-to-select
plan: 01
subsystem: cosmic-frogs / store-foundation
tags: [serums, eligibility, store, foundation]
requires:
  - cosmicSlice (Phase 11)
  - CarrierData type (Phase 11)
provides:
  - serumDragActive flag
  - selectedSerum payload
  - setSerumDragActive action
  - applySerum atomic action
  - isEligible / RARITY_TO_STARTING_LEVEL / getEligibilityHint
affects:
  - client/src/store/cosmic/types.ts
  - client/src/store/cosmic/slice.ts
  - client/src/utils/serumEligibility.ts
key-files:
  created:
    - client/src/utils/serumEligibility.ts
  modified:
    - client/src/store/cosmic/types.ts
    - client/src/store/cosmic/slice.ts
decisions:
  - Single-set() для applySerum (atomic, FrogOverlayManager subscribe срабатывает один раз)
  - serumDragActive + selectedSerum НЕ persisted (transient UI state)
  - element не используется в isEligible — только rarity gates level (под Phase 17 evolution оставлен в сигнатуре)
metrics:
  tasks: 2 commits (Task 1+2 объединены в один phase-14 коммит для applySerum, Task 3 отдельный)
  duration: ~30 min (ранее)
  completed: 2026-05-07
requirements: [SERUM-06, SERUM-08, SERUM-09]
---

# Phase 14 Plan 01: Foundation (store + eligibility) Summary

**One-liner:** Расширили cosmicSlice полями `serumDragActive` + `selectedSerum`, добавили `setSerumDragActive` + atomic `applySerum`, создали pure utility `serumEligibility` с locked SERUM-08 таблицей.

## What Was Built

| Artifact | Provides |
|----------|----------|
| `cosmic/types.ts` | `serumDragActive: boolean` + `selectedSerum: { element, rarity } \| null` + `CosmicToastPayload.duration?` |
| `cosmic/slice.ts` | `setSerumDragActive(active, payload?)` + `applySerum(frogId, element, rarity, level)` (single-set atomic) |
| `utils/serumEligibility.ts` | `isEligible()` + `RARITY_TO_STARTING_LEVEL` (common→1, rare→7, epic→13, legendary→19) + `getEligibilityHint(rarity)` |

## REQ Coverage

- **SERUM-06** ◑ — флаг готов, MainScene integration в 14-03
- **SERUM-08** ✓ — locked eligibility table в utility
- **SERUM-09** ◑ — atomic action готов, animation в 14-03

## Commits

- `01f2d73 phase-14: add serumDragActive + selectedSerum + applySerum to CosmicSlice`
- `9a055da phase-14: add serumEligibility utility (locked SERUM-08 table)`

## Verification

- tsc clean
- vite build clean
- Bundle delta: pure data layer ⇒ ~+0.3 KB gzip (cumulative)

## Self-Check: PASSED

- `client/src/utils/serumEligibility.ts` ✓
- Commit `01f2d73` ✓
- Commit `9a055da` ✓
