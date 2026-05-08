---
phase: 13-element-awakened-tiers
plan: 04
subsystem: utils + build
tags: [dev-helpers, bundle, smoke-tests]
requires:
  - 13-02 (FrogElementOverlay setTier, pool tier-keyed)
  - 13-03 (burstEffect/mergeEffect доступны)
provides:
  - __setCarrierTier dev helper
  - __testBurstEffect dev helper
  - __testMergeEffect dev helper
  - Bundle delta verification +1.58 KB gzip (cap +20 KB ✓)
key-files:
  modified:
    - client/src/utils/devCarriers.ts
decisions:
  - DevMainScene extends Phaser.Scene → используем существующее window.__mainScene без добавления window.game expose
  - __setCarrierTier патчит store через setState (rarity field) → reference change → manager subscribes пересинкнет
  - Dev block обёрнут в import.meta.env.DEV — tree-shaken в prod (verified: 0 grep hits в dist/assets/index-*.js)
metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_modified: 1
  completed_at: "2026-05-08"
---

# Phase 13 Plan 04: Dev Helpers + Bundle Verification Summary

3 новых dev helpers (__setCarrierTier, __testBurstEffect, __testMergeEffect) для smoke-testing всех 5 tiers + interactive effects. Bundle delta Phase 13 = **+1.58 KB gzip** относительно Phase 12 baseline (207.87 → 209.45 KB) — внутри cap +20 KB.

## What was built

- **devCarriers.ts**:
  - DevMainScene теперь extends Phaser.Scene + DevFrogLike с container — позволяет dev helper'ам обращаться к scene API (cameras, time, add) и к frog containers напрямую.
  - `__setCarrierTier(frogId, tier)` — patch carrier rarity через useGameStore.setState + overlayManager.markDirty().
  - `__testBurstEffect(frogId?, element?)` — burst на лягушке если frogId дан и она имеет container, иначе fallback к tmp container в центре.
  - `__testMergeEffect(element?, x?, y?)` — merge anim в указанной точке или в центре камеры.
  - Help text обновлён: console.log при загрузке перечисляет все Phase 12+13 helpers.

## Tasks

| Task | Status | Commit | Notes |
|------|--------|--------|-------|
| 1. Extend devCarriers.ts с smoke helpers | ✓ | 47df261 | + DevMainScene расширен |
| 2. Build + bundle delta verification | ✓ | (no commit — verify only) | gzip 209.45 KB; delta +1.58 KB cumulative for Phase 13 |

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm run build` → passed (gzip main: 209.45 KB)
- **Bundle delta Phase 13 = +1.58 KB gzip** (Phase 12 baseline 207.87 KB → 209.45 KB final)
- Cap check: +20 KB ✓ (+30 KB user override ✓ — used 5% of budget)
- Tree-shake check: `grep "__setCarrierTier\|__testBurstEffect\|__testMergeEffect" dist/assets/index-*.js` → 0 matches ✓

## Deviations from Plan

**[Rule 3 - blocking issue]** План предлагал в крайнем случае expose window.game в main.tsx. Я не делал этого — `__mainScene` уже существует с Phase 12 и является Phaser.Scene, чего достаточно для всех нужных API (cameras, time, add). Сохранили surface area минимальной.

**[Optimization]** План разрешал task 2 как "verify only — записать результат в SUMMARY". Я не создавал отдельный commit для verify (нечего коммитить — все изменения в task 1). Это соответствует плану: "Atomic commits: ... `verify build + bundle delta`" — но в плане скобка указывает что это "результат записать в SUMMARY", без отдельного diff.

## REQ coverage

- **ELEMENT-09**: ✓ — 64 awakened presets (tier-gated complexity ladder соответствует plan ELEMENT-09 budget).
- **ELEMENT-10**: ✓ — burstEffect.ts создан + MainScene.onFrogTapped hook.
- **ELEMENT-11**: ✓ — mergeEffect.ts + MainScene.performMerge hook (same-element check, pre-capture pattern).

## Threat mitigations

- **T-13-10 (setState abuse)**: DEV-only block; tree-shaken в prod (verified).
- **T-13-11 (window.game expose)**: не делалось — обошлись существующим __mainScene.

## Self-Check: PASSED

- devCarriers.ts contains __setCarrierTier, __testBurstEffect, __testMergeEffect — FOUND
- Build passed, bundle delta +1.58 KB gzip (within cap)
- Tree-shake verified: prod bundle has 0 hits for new helpers
- Commit 47df261 — FOUND
