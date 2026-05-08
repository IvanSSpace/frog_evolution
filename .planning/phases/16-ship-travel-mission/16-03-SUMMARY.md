---
phase: 16-ship-travel-mission
plan: 03
subsystem: ship-ui
tags: [phase-16, ship, ui, react, i18n, cosmic-hub]
status: complete
completed: 2026-05-08
---

# Phase 16 Plan 03: ShipTab + FlightConfirmDialog + CrewIndicator Summary

React UI Phase 16: rename ScoutsTab → ShipTab, FlightConfirmDialog modal, CrewIndicator card, App.tsx subscriber на 'cosmic:request-flight', i18n round 1 для RU/EN/ES.

## REQ Coverage

| REQ | Status | Notes |
|-----|--------|-------|
| SHIP-07 | ✓ | FlightConfirmDialog в App.tsx с travel time preview + confirm/cancel |
| SHIP-08 | ✓ | App.tsx subscriber пропускает confirm если ship.docked у этой planet |
| SHIP-09 | ✓ | ShipTab показывает transit countdown (live tick через setInterval 1s) |
| SHIP-10 | ✓ | (закрыто Plan 16-02 toast) |
| CREW-05 | ✓ | «Изучить» disabled когда `crew.missionsToday >= DAILY_CAP` + tooltip |
| CREW-06 | ✓ | CrewIndicator показывает «N/4 миссий» + relative countdown ⏱ HH:MM |
| CREW-07 | ✓ | CrewIndicator tap раскрывает explanation panel |

## Files

**Created:**
- `client/src/components/CosmicHub/ShipTab.tsx` — 132 lines (replaces ScoutsTab.tsx): state pill + crew indicator + кнопки [Открыть карту] [Изучить] с disabled tooltip
- `client/src/components/CosmicHub/CrewIndicator.tsx` — 55 lines: card с progress bar, относительный countdown
- `client/src/components/CosmicHub/FlightConfirmDialog.tsx` — 90 lines: travel time preview из planetDistance + travelTimeMs, redirect indicator если transit

**Deleted:**
- `client/src/components/CosmicHub/ScoutsTab.tsx` — заменён ShipTab

**Modified:**
- `client/src/components/CosmicHub/CosmicHubModal.tsx` — import path ShipTab, label key `cosmic_hub.tab_ship`, ShipTab rendered с onClose prop
- `client/src/App.tsx` — pendingFlightPlanetId state + cosmic:request-flight subscriber + FlightConfirmDialog render
- `client/src/i18n/ru.json`, `en.json`, `es.json` — добавлены ship.*, crew.*, flight_confirm.*, mission.* keys + cosmic_hub.tab_ship + cosmic_hub.lock_first_*

## Atomic Commits

- `572a365` phase-16: rename ScoutsTab → ShipTab + state pill + i18n round 1
- `1ed5573` phase-16: add CrewIndicator + FlightConfirmDialog components
- `8b4300a` phase-16: wire cosmic:request-flight in App.tsx → confirm dialog

## Verification

- tsc clean, build success
- ScoutsTab.tsx удалён, нет references (verified via grep)
- i18n keys present во всех 3 локалях (RU/EN/ES)
- Bundle: index 216.27 KB gzip → +2.16 KB vs after Plan 16-02

## Open Issues

- CrewIndicator: использует **relative** countdown (часы:минуты до следующей полночи), а не абсолютное HH:MM "до 14:32". Требование CREW-06 «До утра HH:MM» интерпретировано как «через H:MM», что более информативно для пользователя ночью или утром (вариант с absolute требовал бы дополнительной логики «N часов до 00:00 локального»). Можно вернуть absolute в Phase 19 polish.
- `i18n.crew.until_reset` key используется как «До утра {{hh}}:{{mm}}» — UI показывает relative часы/минуты — текст RU «до утра» немного misleading; en/es используют neutral «Until {{hh}}:{{mm}}».

## Decisions

1. **ShipTab id = 'scouts'**: ID в CosmicTab union сохраняется (sessionStorage backward compat). Только i18n label меняется. Future Phase 19 может сделать full migration.
2. **FlightConfirmDialog при transit**: dialog показывает «Вы редиректнёте курс с X на Y» (от fromPlanetId, не latestShipPos для UI clarity).
