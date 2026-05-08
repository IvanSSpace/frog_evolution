---
phase: 16-ship-travel-mission
plan: 04
subsystem: mission-overlay
tags: [phase-16, mission, mini-clicker, overlay, box-generation]
status: complete
completed: 2026-05-08
---

# Phase 16 Plan 04: MissionOverlay + 3 Mini-Clickers + investigatePlanet Summary

Mission overlay fullscreen с 3 типами challenges (rhythm/defend/hotspot), score → bonusRarity, atomic credit+box transaction в slice, App.tsx wiring.

## REQ Coverage

| REQ | Status | Notes |
|-----|--------|-------|
| MISSION-01 | ✓ | MissionOverlay fullscreen mount при 'cosmic:start-mission' |
| MISSION-02 | ✓ | 3 типа random per session (или forceType из dev/localStorage) |
| MISSION-03 | ✓ | scoreToResult (1.0=perfect, 0.6+=good, else=fail) → bonusRarity 0.15/0.05/0 |
| MISSION-04 | ✓ | Skip button visible через 1s; Skip → result='fail', addBox без bonus |
| MISSION-05 | ✓ | mission complete → investigatePlanet → addBox + cosmic:toast «Получен ящик NAME» |
| MISSION-06 | ✓ | element = elementFromPlanet(archetype, mainRaceType) ?? 'fire' |
| MISSION-07 | ✓ | investigatePlanet атомарно consume 1 credit |
| MISSION-08 | ✓ | Fullscreen overlay с ship🚀 → planet name backdrop |
| CREW-04 | ✓ | consume 1 credit при investigate (атомарно) |
| CREW-08 | ✓ | pity counter (Phase 19) commented — растёт ТОЛЬКО при consume не при flight |

## Files

**Created:**
- `client/src/components/MissionOverlay/MissionOverlay.tsx` — 96 lines: dispatcher + lifecycle (intro→active→done) + skip button + forceType support
- `client/src/components/MissionOverlay/RhythmTapMission.tsx` — 56 lines: 15-30 taps за 30s, score = clamp(taps/target, 0, 1)
- `client/src/components/MissionOverlay/DefendMission.tsx` — 95 lines: 3 вспышки (t=2s/7s/12s), 1s window each, score = hits/3, finish at 15s
- `client/src/components/MissionOverlay/HotSpotMission.tsx` — 121 lines: 5 spots, 4s/spot, finish at 20s, hit radius 8% площади

**Modified:**
- `client/src/store/cosmic/slice.ts` — investigatePlanet action (atomic guard ship.docked + consume credit + addBox + hasFirstMission=true + emit toast)
- `client/src/App.tsx` — activeMissionPlanetId state + 'cosmic:start-mission' subscriber + 'cosmic:mission-complete' subscriber + MissionOverlay render

## Atomic Commits

- `4a33fd4` phase-16: add investigatePlanet atomic transaction in cosmic slice
- `d72f913` phase-16: add 3 mission variant components (rhythm/defend/hotspot)
- `093934e` phase-16: add MissionOverlay dispatcher + App.tsx wiring

## Verification

- tsc clean, build success
- investigatePlanet returns boolean: false если ship.state !== 'docked' OR planetId mismatch OR cap reached
- Всё в одном set() — atomic transaction (T-16-05 mitigation)
- Bundle: index 218.70 KB gzip → +2.43 KB vs after Plan 16-03

## Open Issues

- Toast message «Получен ящик» hardcoded RU в slice. Phase 19 polish может перенести в App-side i18n layer (slice → emit с typed payload, App-side render с t()).
- Phase 15 dependency: cascade reveal box opening не реализован (Plan 16-04 только кладёт box в inventory). Toast action.onClick → setLastActiveTab('boxes') готов; но BoxesTab пустой stub.
- Score → result: `1.0 perfect` означает буквально score === 1.0; в RhythmTap target hit = score=1.0 (fast path вызывает onComplete(1.0)). При 99% (например 14/15) score === 0.93 → 'good'. Это match'ит spec.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DefendMission/RhythmTap: stale closure для hits count**
- **Found during:** Code review при написании
- **Issue:** Original spec captured `hits` в `setTimeout` closure; final timer would see hits=0
- **Fix:** Добавлен `hitsRef`/`tapsRef` (useRef) — finalTimer читает ref.current
- **Files modified:** DefendMission.tsx, RhythmTapMission.tsx, HotSpotMission.tsx
- **Commit:** d72f913

**2. [Rule 1 - Bug] HotSpotMission: stale activeIdx capture в interval**
- **Found during:** Same review
- **Issue:** setInterval callback читал stale activeIdx (capture in deps array would re-create interval каждый advance → glitchy timer)
- **Fix:** Использован `activeIdxRef` + sync useEffect; stable interval
- **Files modified:** HotSpotMission.tsx
- **Commit:** d72f913

## Decisions

1. **Mission type forcing**: сохранение в `localStorage('__force_mission_type')` чтобы переживать reload + работать как dev helper.
2. **Random target в RhythmTap**: target = 15 + Math.floor(Math.random() * 16) → 15..30 диапазон (spec говорит «15+random*15», что = 15..30 при random < 1.0; используется floor 0..15).
