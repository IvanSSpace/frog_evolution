---
phase: 13-element-awakened-tiers
plan: 03
subsystem: effects/elements + scenes
tags: [merge, burst, mainscene, element-anim]
requires:
  - 13-01 (burstEffect, awakenedPresets, scheduleAwakenedIdle)
provides:
  - mergeEffect (composite ELEMENT-11 anim)
  - MainScene.onFrogTapped → burstEffect for carriers (ELEMENT-10)
  - MainScene.performMerge → mergeEffect for same-element pairs (ELEMENT-11)
key-files:
  created:
    - client/src/game/effects/elements/mergeEffect.ts
  modified:
    - client/src/game/scenes/MainScene.ts
decisions:
  - Pre-capture carrier info ДО delayedCall в performMerge — иначе removeFrog успевает очистить store
  - mergeEffect.ts использует scene.add.container в scene root + 4 delayedCall — самостоятельный cleanup через 900ms
  - depth 99998 (выше merge vortex 99997)
metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  completed_at: "2026-05-08"
---

# Phase 13 Plan 03: MergeEffect + MainScene Hooks Summary

mergeEffect композитная anim (ring → sparkle → ripple → flash, 600-800ms) для same-element merge; MainScene получил два хука — burstEffect при тапе на carrier и mergeEffect при same-element merge.

## What was built

- **mergeEffect.ts**: 4-phase composite anim (t=0 ring → t=100 sparkle → t=300 ripple → t=500 flash → t=900 cleanup). depth=99998 чтобы рисоваться поверх merge vortex (99997). Self-cleanup через scene.time.delayedCall(900, destroy).
- **MainScene.ts hook 1 (ELEMENT-10)**: после addGold(1) в onFrogTapped — `useGameStore.getState().carriers.find(c => c.frogId === frog.id)` → burstEffect(this, frog.container, carrier.element).
- **MainScene.ts hook 2 (ELEMENT-11)**: pre-capture carriers ДО delayedCall(VORTEX_DURATION) — sameElementMerge resolved до того как removeFrog уберёт записи; в callback после flashAt → mergeEffect(this, cx, cy, sameElementMerge).

## Tasks

| Task | Status | Commit | Notes |
|------|--------|--------|-------|
| 1. mergeEffect.ts (4-phase composite) | ✓ | ad875bf | self-cleanup tmp container 900ms |
| 2. Wire burstEffect + mergeEffect in MainScene | ✓ | ee9d8f7 | pre-capture pattern для performMerge |

## Verification

- `npx tsc --noEmit` → 0 errors после каждой задачи
- `npm run build` → passed (gzip main: 209.45 KB; Phase 12 baseline 207.87 KB → +1.58 KB cumulative для всех Phase 13 пока что)
- 2 import + 2 call sites в MainScene (4 grep hits) — verified

## Deviations from Plan

**[Note]** В Plan 13-03 описано "вставить ПОСЛЕ flashAt", и одновременно "проверить порядок: pre-capture лучше". Я выбрал pre-capture pattern (рекомендованный планом подход) — carriers находятся ДО delayedCall, чтобы независимо от того какие removeFrog/store операции исполняются внутри callback'а, sameElementMerge был известен. Никаких других deviations.

## Threat mitigations

- **T-13-07 (tampered carrier.element в hook'ах)**: уже валидируется FrogOverlayManager (T-12-01); burstEffect/mergeEffect только создают Phaser objects — no state/network mutation. Worst case — неизвестный element → tint=0 (чёрный), не крашится.
- **T-13-08 (mergeEffect tmp container не destroy'd при scene shutdown)**: scene.time.delayedCall автоматически отменяется при scene destroy (Phaser); tmp container уйдёт через 900ms или вместе со scene — whichever first.
- **T-13-09 (burst spam)**: rate ограничен физическим тапом пользователя (~10/с); burst создаёт 3-4 game objects per call → 40 objects/s в worst case — внутри budget.

## Self-Check: PASSED

- mergeEffect.ts exports mergeEffect — FOUND
- MainScene.ts has burstEffect + mergeEffect imports + 2 calls — FOUND (4 grep hits)
- Both commits exist: ad875bf, ee9d8f7 — FOUND
- npm run build passed
