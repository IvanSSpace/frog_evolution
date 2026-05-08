---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: cosmic-frogs-system
current_phase: 17
status: in-progress
last_updated: "2026-05-08"
progress:
  total_phases: 11
  completed_phases: 6
  total_plans: 18
  completed_plans: 18
  percent: 55
---

# Project State

**Milestone:** Cosmic Frogs System (v2.0)
**Status:** In-progress — Phase 16 complete (Ship+Travel+Mission), next: Phase 17 (Carrier evolution + feed + ceiling + merge). Phase 15 may run in parallel.
**Current Phase:** 17 (next planned); Phase 15 parallelizable
**Last Updated:** 2026-05-08

## Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 1-8 | v1.0 milestone | complete (closed) |
| 9 | Refactor anim primitives (BLOCKING) | **complete** (2026-05-08) — 18 primitives extracted, bundle delta -2 bytes, 1000/984/1000 verifiers green |
| 10 | Performance HUD (mini) | **skipped** — отложено по решению пользователя; добавим ad-hoc если потребуется |
| 11 | CosmicSlice store + Cosmic Hub shell | **complete** (2026-05-08) — 3 waves, bundle delta +3.05 KB gzip, CosmicHubModal отдельный chunk, все 9 REQ-IDs покрыты |
| 12 | FrogElementOverlay (dormant + pool + cap) | **complete** (2026-05-08) — Phaser-native overlay + pool + manager, bundle delta +2.53 KB gzip, 11 ✓ + 3 ◑ partial REQ-IDs (ELEMENT-04 awakened/Phase 13, ELEMENT-08 throttle hook/Phase 20, PERF-09 full bench/Phase 13) |
| 13 | Element awakened tiers | **complete** (2026-05-08) — 4 plans, 3 waves, 8 atomic commits; 64 awakened presets (rule-based assembly), 5-tier ElementTier, tier-keyed pool, burstEffect (ELEMENT-10) + mergeEffect (ELEMENT-11), bundle delta +1.58 KB gzip (cap +20 KB ✓). 3 ✓ REQ-IDs (ELEMENT-09/10/11). |
| 14 | Сыворотки tab + tap-to-select DnD | **complete** (2026-05-08) — 4 plans, 3 waves, 5 atomic commits; SerumsTab 4 секции + ElementGrid + SerumSelectionLayer (halo+flashRed) + MainScene selection mode (auto-pause magnet/merge) + 2-сек pulse apply + burst + undo toast + desktop Pointer Events DnD secondary + i18n RU/EN/ES + dev helpers; bundle delta +2.14 KB gzip (cap +20 KB ✓). 11/11 ✓ REQ-IDs (SERUM-02..11 + UX-07). |
| 15 | Boxes: cascade + slot-machine + skip | pending |
| 16 | Ship + travel + mission (1-ship navigation) | **complete** (2026-05-08) — 5 plans, 5 waves, 14 atomic commits; ShipState discriminated union + travel formula + crew daily limit + ShipSprite Phaser-native + StarMap integration + ShipTab + FlightConfirmDialog + CrewIndicator + MissionOverlay + 3 mini-clickers (rhythm/defend/hotspot) + investigatePlanet atomic + progressive disclosure (UX-09) + dev helpers + i18n RU/EN/ES; bundle delta +8.20 KB gzip (cap +40 KB ✓; index 218.70 KB vs Phase 14 baseline 211.59 KB). 27/27 ✓ REQ-IDs (SHIP-01..10, CREW-01..08, MISSION-01..08, UX-09). |
| 17 | Carrier evolution + feed + ceiling + merge | pending |
| 18 | Бестиарий 2.0 (1536 cells, virtualized) | pending |
| 19 | Balance + tutorial + toggles + i18n polish | pending |

## v1.0 Achievement Summary (closed milestone)
- 8 phases, 26 plans, 100% complete
- 1000/1000/1000 unique anim/texture/sound, 96 animation components
- Полная локализация RU/EN/ES, бестиарий 24-grid, slot-machines, rare boxes

## v2.0 Notes
- Started: 2026-05-08
- Phase numbering continues from v1.0 (9..19, total 11 phases)
- Dev-mode: unlock-логика через L25-командира НЕ реализуется в v2.0
- 16 элементов × 4 редкости × 24 уровня = 1536 ячеек бестиария 2.0 (4 локации × 384)
- Locked decisions: 50/35/12/3 rarity; soft 15→+3% / 20→+7% / hard 25 pity; tap-to-select primary DnD; re-use StarMap для planet pick; bestiary 4 локации × 384; 16 элементов с TINT TABLE; reduced effects toggle default OFF; legendary slot cap 9-10s; 30% dispose recovery; hard cap 4 visible overlay
- ROADMAP coverage: 119/119 REQ-IDs mapped, 0 orphans, 0 duplicates
- Phase 11 решения: содержимое старого 🛍️ — Cosmic Hub занимает его место; флаг storage version bump (15→16) → wipe старых cosmic данных при load mismatch.

## Pending Decisions
- 8 open A/B questions для playtest (rarity weights, ceiling reveal threshold, streak protection, slot duration, pity reveal, scout duration, skip delay, bottom-bar icon)

## Phase 11 (closed) — Performance Metrics

| Wave | Plan | Tasks | Files Modified | Bundle Delta gzip |
|------|------|-------|----------------|-------------------|
| 1 | 11-01 | 3 | 4 (cosmic/types.ts, cosmic/slice.ts, gameStore.ts, eventBus.ts) | +1 KB |
| 2 | 11-02 | 3 | 7 (BottomBar, App.tsx, CosmicHub/* × 5) | +0.17 KB main + 0.98 KB chunk |
| 3 | 11-03 | 2 | 5 (BottomBar, App.tsx, i18n × 3) | +1.10 KB |
| **Total** | — | **8** | **16** | **+3.05 KB gzip** (cap: 15 KB ✓) |

## Phase 12 (closed) — Performance Metrics

| Wave | Plan | Tasks | Files | Bundle Delta gzip |
|------|------|-------|-------|-------------------|
| 1 | 12-01 | 3 (+1 auto-approved checkpoint) | 8 created + 5 modified | +2.53 KB |
| **Total** | — | **3** | **13** | **+2.53 KB gzip** (cap: 20 KB ✓) |

## Phase 13 (closed) — Performance Metrics

| Wave | Plan | Tasks | Files | Bundle Delta gzip |
|------|------|-------|-------|-------------------|
| 1 | 13-01 (foundation) | 3 | 2 created + 1 modified | (cumulative) |
| 2 | 13-02 (overlay/pool/manager) | 3 | 0 created + 3 modified | +1.13 KB after Wave 2 |
| 2 | 13-03 (mergeEffect + MainScene) | 2 | 1 created + 1 modified | +1.58 KB after Wave 2/3 |
| 3 | 13-04 (dev helpers + verify) | 2 | 0 created + 1 modified | +1.58 KB final (no growth) |
| **Total** | — | **10** | **3 created + 6 modified** | **+1.58 KB gzip** (cap: 20 KB ✓) |

## Phase 14 (closed) — Performance Metrics

| Wave | Plan | Tasks/Commits | Files | Bundle Delta gzip |
|------|------|---------------|-------|-------------------|
| 1 | 14-01 (foundation: store + eligibility) | 2 commits | 1 created + 2 modified | (cumulative) |
| 1 | 14-02 (SerumsTab UI) | 1 commit | 1 created + 4 modified | (cumulative) |
| 2 | 14-03 (MainScene selection mode) | 1 commit | 1 created + 1 modified | (cumulative) |
| 3 | 14-04 (toast + DnD + i18n + dev + verify) | 1 commit | 1 created + 6 modified | +2.14 KB final |
| **Total** | — | **5 commits** | **6 created + 10 modified** | **+2.14 KB gzip** (cap: 20 KB ✓; main `index.js` 211.59 KB vs Phase 13 baseline 209.45 KB) |

**Phase 14 REQ coverage:** 11/11 ✓ (SERUM-02, SERUM-03, SERUM-04, SERUM-05, SERUM-06, SERUM-07, SERUM-08, SERUM-09, SERUM-10, SERUM-11, UX-07).

## Phase 16 (closed) — Performance Metrics

| Wave | Plan | Tasks/Commits | Files | Bundle Delta gzip |
|------|------|---------------|-------|-------------------|
| 1 | 16-01 (foundation: types + slice + eventBus + missionConfig) | 3 commits | 1 created + 4 modified | (cumulative) |
| 2 | 16-02 (ShipSprite + StarMap integration + arrival flow) | 3 commits | 1 created + 2 modified | +2.52 KB after Wave 2 |
| 3 | 16-03 (ShipTab rename + CrewIndicator + FlightConfirmDialog + i18n round 1) | 3 commits | 3 created + 1 deleted + 5 modified | +4.68 KB after Wave 3 |
| 4 | 16-04 (MissionOverlay + 3 mini-clickers + investigatePlanet) | 3 commits | 4 created + 2 modified | +7.11 KB after Wave 4 |
| 5 | 16-05 (progressive disclosure + dev helpers) | 2 commits | 2 modified | +7.11 KB index + 1.09 KB CosmicHubModal lazy = +8.20 KB total final |
| **Total** | — | **14 commits** | **9 created + 1 deleted + 14 modified** | **+8.20 KB gzip** (cap: 40 KB ✓; index `index.js` 218.70 KB vs Phase 14 baseline 211.59 KB) |

**Phase 16 REQ coverage:** 27/27 ✓ (SHIP-01..10, CREW-01..08, MISSION-01..08, UX-09).
**Phase 16 outcome:** v2.0 первый fully-playable milestone — ship→mission→box loop работает; Phase 15 cascade reveal будет integration слоем (`box.bonusRarity` готов).
