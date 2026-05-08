---
phase: 14-serums-tab-tap-to-select
plan: 03
subsystem: cosmic-frogs / mainscene-integration
tags: [serums, phaser, mainscene, selection-mode, halo, pulse]
requires:
  - applySerum (Plan 14-01)
  - isEligible / getEligibilityHint (Plan 14-01)
  - cosmic:select-serum (Plan 14-02)
  - burstEffect (Phase 13)
provides:
  - SerumSelectionLayer (halo + flashRed + dispose)
  - MainScene selection mode subscriber
  - handleSerumTap / applySerumToFrog (2-сек pulse + burst + atomic store mutation + toast)
  - magnet/merge pause guard
  - background tap → cancel selection
affects:
  - client/src/game/scenes/MainScene.ts
  - client/src/game/effects/SerumSelectionLayer.ts
key-files:
  created:
    - client/src/game/effects/SerumSelectionLayer.ts
  modified:
    - client/src/game/scenes/MainScene.ts
decisions:
  - Standalone Phaser.Graphics (НЕ compHaloFlash) — нужен repeat:-1 pulse, а compHaloFlash one-shot
  - Re-use isMerging флаг для tap-lock во время 2-сек pulse (existing блоки respect его)
  - applySerum mutation atomic — single-set гарантирует FrogOverlayManager subscribe только один раз
  - currentlyOver.length===0 как cancel-detection (тап в пустое место)
  - spawnFrog re-show eligible halos если selection active (race-mitigation T-14-03-01)
  - clearField сбрасывает selection при location change (новая локация не наследует halos)
metrics:
  tasks: 1 commit (Tasks 1+2 + checkpoint объединены)
  duration: ~70 min (ранее)
  completed: 2026-05-07
requirements: [SERUM-03, SERUM-05, SERUM-06, SERUM-07, SERUM-09, UX-07]
---

# Phase 14 Plan 03: MainScene Selection Mode Summary

**One-liner:** Реактивная selection mode в Phaser: subscribe на serumDragActive → halo на eligible → tap eligible → 2-сек pulse + burstEffect + atomic applySerum + success toast; mis-tap → red flash + error toast; magnet/merge замораживаются.

## What Was Built

| Artifact | Provides |
|----------|----------|
| `SerumSelectionLayer.ts` | `show(eligibleFrogs)` + `hide()` + `flashRed(frog)` + `dispose()` — clean visual API |
| MainScene `subscribeSerumState` | `useGameStore.subscribe` → halo show/hide реактивно |
| MainScene `handleSerumTap` / `applySerumToFrog` | Apply path: 2-сек pulse + burst at midpoint + atomic store mutation + success toast с undo callback |
| MainScene `emitMisTapToast` | i18n mis-tap message с {{level}} + {{location}} interpolation |
| Guards | magnet `if (!serumPaused)`; drop-merge `if (!serumActive)`; onFrogTapped → handleSerumTap; background tap → cancel |
| Cleanup | `clearField` + `destroy` + location transition — dispose layer + unsub + reset state |
| Race mitigations | `spawnFrog` re-show halos; `clearField` reset selection; `lastHaptiHover` rate-limit |

## REQ Coverage

- **SERUM-03** ✓ — tap-to-select primary apply работает
- **SERUM-05** ✓ — green halo (pulse repeat:-1) + red flashRed (220ms one-shot)
- **SERUM-06** ✓ — magnet `serumPaused` guard + drop-merge guard + onFrogTapped guard
- **SERUM-07** ✓ — flashRed + error toast «работает только на L{N} лягушку ({location})»
- **SERUM-09** ✓ — 2-сек tween (1000ms × yoyo, ease Sine.easeInOut) + burst at midpoint
- **UX-07** ✓ — `hapticNotification('error')` на mis-tap + `hapticNotification('success')` на apply

## Commits

- `2717933 phase-14: SerumSelectionLayer + MainScene selection mode integration`

## Verification

- tsc clean, vite build clean
- Bundle delta cumulative ~+1.5 KB gzip (cumulative от Phase 13 baseline)
- Manual smoke (выполнялось ранее): 6 пунктов чек-листа Plan 14-03 ✓

## Open Items

- SERUM-10 (full undo через 4с window + onAction integration в App.tsx ToastBanner) → 14-04
- SERUM-11 (desktop Pointer Events DnD secondary) → 14-04
- Final i18n parity polish + bundle final verify → 14-04

## Self-Check: PASSED

- `client/src/game/effects/SerumSelectionLayer.ts` ✓
- `client/src/game/scenes/MainScene.ts` (Phase 14 markers + handleSerumTap + applySerumToFrog) ✓
- Commit `2717933` ✓
