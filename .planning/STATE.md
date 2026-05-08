---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: cosmic-frogs-system
current_phase: 12
status: in-progress
last_updated: "2026-05-08"
progress:
  total_phases: 11
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
  percent: 18
---

# Project State

**Milestone:** Cosmic Frogs System (v2.0)
**Status:** In-progress — Phase 11 complete (CosmicSlice + Cosmic Hub shell shipped), next: Phase 12 (FrogElementOverlay)
**Current Phase:** 12 (next planned)
**Last Updated:** 2026-05-08

## Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 1-8 | v1.0 milestone | complete (closed) |
| 9 | Refactor anim primitives (BLOCKING) | **complete** (2026-05-08) — 18 primitives extracted, bundle delta -2 bytes, 1000/984/1000 verifiers green |
| 10 | Performance HUD (mini) | **skipped** — отложено по решению пользователя; добавим ad-hoc если потребуется |
| 11 | CosmicSlice store + Cosmic Hub shell | **complete** (2026-05-08) — 3 waves, bundle delta +3.05 KB gzip, CosmicHubModal отдельный chunk, все 9 REQ-IDs покрыты |
| 12 | FrogElementOverlay (dormant + pool + cap) | pending |
| 13 | Element awakened tiers | pending |
| 14 | Сыворотки tab + tap-to-select DnD | pending |
| 15 | Boxes: cascade + slot-machine + skip | pending |
| 16 | Scouts + StarMap pick + mini-clicker | pending |
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
