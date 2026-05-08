---
phase: 13-element-awakened-tiers
plan: 02
subsystem: effects/elements
tags: [overlay, pool, manager, tier]
requires:
  - 13-01 (ElementTier 5-tier + scheduleAwakenedIdle)
  - phase-12 (FrogOverlayManager + pool baseline)
provides:
  - tier-aware FrogElementOverlay.attach + setTier
  - tier-keyed elementOverlayPool (Map<element:tier, FrogElementOverlay[]>)
  - syncCarriers передаёт carrier.rarity → ElementTier
key-files:
  modified:
    - client/src/game/effects/FrogElementOverlay.ts
    - client/src/game/effects/elementOverlayPool.ts
    - client/src/game/effects/FrogOverlayManager.ts
decisions:
  - При смене rarity на live carrier — release+re-acquire через pool вместо setTier in-place (упрощает инвариант "active overlay в правильном bucket")
  - tierFromCarrier helper с VALID_RARITIES — fallback к dormant при tampered store (T-13-04)
metrics:
  duration_minutes: 5
  tasks_completed: 3
  files_modified: 3
  completed_at: "2026-05-08"
---

# Phase 13 Plan 02: Tier-aware Overlay + Pool Summary

FrogElementOverlay принимает tier параметр в attach() и поддерживает setTier(); pool теперь разбит по составному ключу (element, tier); FrogOverlayManager.syncCarriers автоматически рендерит carrier.rarity как соответствующий visual tier.

## What changed

- **FrogElementOverlay.ts**:
  - `attach(host, body, frogId, element, tier='dormant')` — новый параметр.
  - `setTier(newTier)` — публичный метод для in-place переключения idle.
  - `startIdleForTier()` — приватный helper, выбирает scheduleDormantIdle vs scheduleAwakenedIdle.
  - Orb radius growth: 4→5→6→7→8 px по tier; alpha 0.85 (dormant) vs 1.0 (awakened).
  - import { scheduleAwakenedIdle } from './elements/awakenedPresets'.

- **elementOverlayPool.ts**:
  - `pool: Map<string, FrogElementOverlay[]>` (key = `${element}:${tier}`).
  - `acquire(scene, element, tier='dormant')` — pop из правильного bucket.
  - `release(overlay)` — push в bucket по `${overlay.element}:${overlay.tier}` (читается ДО detach).
  - `drainAll()` — итерирует Map.values() + active.
  - `totalPooled` getter — суммирует bucket lengths.

- **FrogOverlayManager.ts**:
  - Импорт ElementTier + RARITIES.
  - `tierFromCarrier(carrier)` helper — валидирует rarity ∈ RARITIES, fallback к 'dormant'.
  - syncCarriers: при существующем overlay сравниваем И element, И tier; mismatch → release+re-acquire.
  - acquire/attach передают tier.

## Tasks

| Task | Status | Commit | Notes |
|------|--------|--------|-------|
| 1. tier-aware attach + setTier | ✓ | aff665a | + orbRadiusForTier helper |
| 2. tier-keyed pool (Map) | ✓ | 3d5b193 | totalPooled теперь suma all buckets |
| 3. syncCarriers passes carrier.rarity → tier | ✓ | 9374e1e | + VALID_RARITIES guard |

## Verification

- `npx tsc --noEmit` → 0 errors после каждой задачи
- `npm run build` → passed (gzip main: 209.00 KB; Phase 12 baseline 207.87 KB → +1.13 KB cumulative)
- Manual code-walk: setTier on live overlay не дёргает detach (sprites, tint лягушки сохранены)

## Deviations from Plan

**[Rule 3 - blocking issue]** В FrogOverlayManager на смене tier план предлагал ИЛИ setTier in-place, ИЛИ release+re-acquire — выбран второй вариант (release+re-acquire) потому что он сохраняет инвариант "active overlay лежит в bucket по своему текущему (element, tier)". Если бы делали in-place setTier, pool key в bucket был бы старым → release вернул бы overlay в неверный bucket и acquire в новом tier создал бы лишний overlay. Это выбор архитектуры; setTier остаётся публичным API для dev helper'а в Plan 04.

## Threat mitigations

- **T-13-04 (tampered carrier.rarity)**: tierFromCarrier валидирует против VALID_RARITIES; fallback к 'dormant' + console.warn.
- **T-13-05 (pool unbounded growth)**: hard cap 4 active в Phase 12 manager; pool ≤ 4 даже в worst case.
- **T-13-06 (setTier external abuse)**: setTier публичный для Phase 17/dev — внешнего untrusted API нет.

## Self-Check: PASSED

- FrogElementOverlay.ts has setTier — FOUND
- elementOverlayPool.ts has Map<string — FOUND
- FrogOverlayManager.ts has carrier.rarity — FOUND (через tierFromCarrier)
- Все три commits exist: aff665a, 3d5b193, 9374e1e — FOUND
- npm run build passed
