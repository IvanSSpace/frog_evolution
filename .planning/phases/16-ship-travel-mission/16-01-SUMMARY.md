---
phase: 16-ship-travel-mission
plan: 01
subsystem: ship-foundation
tags: [phase-16, ship, crew, mission, types, slice, eventbus]
status: complete
completed: 2026-05-08
---

# Phase 16 Plan 01: Foundation Summary

Foundation для Phase 16 Ship+Travel+Mission механики: ShipState discriminated union, travel utils, CosmicSlice расширение с ship navigation actions, eventBus новые события, fix CREW-03 (локальная дата вместо UTC), STORAGE_VERSION bump → 17.

## REQ Coverage

| REQ | Status | Notes |
|-----|--------|-------|
| SHIP-01 | ✓ | ShipState discriminated union (`ShipStateDocked` / `ShipStateTransit`) в cosmic/types.ts |
| SHIP-03 | ✓ | `travelTimeMs(distance)` clamp [1500..120000] ms в missionConfig.ts |
| SHIP-06 | ✓ | `sendShipTo` poддерживает redirect: kill+restart от latestShipPos |
| CREW-01 | ✓ | `crew: { missionsToday, lastResetDay }` уже был, расширено |
| CREW-02 | ✓ | `DAILY_CAP = 4` константа в missionConfig.ts |
| CREW-03 | ✓ | `getLocalDateString()` fix — раньше использовал UTC через `toISOString().slice(0,10)` |

## Files

**Created:**
- `client/src/game/data/missionConfig.ts` — 118 lines: WORLD_DIAGONAL, travelTimeMs, planetDistance, DAILY_CAP, MISSION_TYPES, scoreToResult, bonusRarityForResult, getLocalDateString, msUntilLocalMidnight, findPlanetById, planetElementInputs

**Modified:**
- `client/src/store/cosmic/types.ts` — ShipStateDocked + ShipStateTransit + bonusRarity? in BoxData + sentinel флаги (hasFirstFeed/hasFirstMission/hasOpenedAnyBox) + latestShipPos
- `client/src/store/cosmic/slice.ts` — ensureShipExists, sendShipTo, arriveShipAt, setShipPosition, setHasFirstFeed/setHasFirstMission/setHasOpenedAnyBox + fix resetCrewIfNewDay (local date) + DAILY_CAP в consumeMissionCredit
- `client/src/store/eventBus.ts` — `cosmic:request-flight`, `cosmic:flight-confirm`, `cosmic:flight-cancel`, `cosmic:ship-arrived`, `cosmic:start-mission`, `cosmic:mission-complete`, `cosmic:mission-cancel`
- `client/src/store/gameStore.ts` — STORAGE_VERSION 16→17 + ship shape validation в loadCosmicSlice + sentinel flags persist + auto-persist subscriber updated

## Atomic Commits

- `c2d6b6a` phase-16: add missionConfig (travel formula + DAILY_CAP + planet lookup)
- `fc89123` phase-16: ShipState discriminated union + sentinel flags in cosmic types
- `7d7380e` phase-16: ship navigation actions + crew local-date fix in cosmic slice

## Verification

- `tsc --noEmit` → 0 errors
- All 11 exports в missionConfig.ts (плюс types) присутствуют
- Storage migration: на load старого Phase 11 ShipState shape (с dockedAt/from/to) → ship = null (re-init на следующий feed)

## Open Issues

- Нет blocker'ов для Plan 16-02. Storage migration наslot готов; backward compat с Phase 11 saves: STORAGE_VERSION bump до 17 сбросит старые saves чисто.

## Decisions

1. **DPR convention**: missionConfig использует **DPR=1 base** (как planetMap.json). Scene-side multiplier остаётся в StarMapScene. Slice-side math в DPR=1.
2. **Redirect snapshot**: REDIRECT использует `latestShipPos` (cached в store) вместо tracking фактической позиции tween внутри slice. ShipSprite.update throttled @ 6 frames пишет в store.
3. **Backward compat sessionStorage**: tab id остаётся `'scouts'` (Phase 11). Только UI label меняется на `cosmic_hub.tab_ship`.
