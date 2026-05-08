---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: cosmic-frogs-system
current_phase: 19
status: complete
last_updated: "2026-05-08"
progress:
  total_phases: 11
  completed_phases: 10
  total_plans: 40
  completed_plans: 40
  percent: 100
---

# Project State

**Milestone:** Cosmic Frogs System (v2.0) — **COMPLETE**
**Status:** Complete — Phase 19 closed (Balance + tutorial + toggles + i18n polish — финальный v2.0 ship phase). All 17 REQ-IDs covered. v2.0 milestone закрыт.
**Current Phase:** 19 (closed); Phase 20 (Pre-release safety net) deferred до prod-релиза
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
| 15 | Boxes: cascade + slot-machine + skip | **complete** (2026-05-08) — 5 plans, 4 waves, 5 atomic commits; BoxData shape v2 (8 fields) + rollRarity utility (locked 50/35/12/3 + pity 3/10/15/20/25) + 4 store actions (addBox/rollBoxRarity/commitOpenedBox/removeBox) + STORAGE_VERSION 17→18; BoxesTab inventory cards + lazy CascadeRevealModal + bulk-open «Открыть все»; CascadeRevealModal cascade timeline (200/200/200/400ms) + state machine + instantMode bypass; SerumSlotMachine rarity-locked durations (1.2-9.5s legendary cap) + 4 checkpoints (1.5/3.5/5.5/8s gray/blue/purple/gold) + element fingerprint particles + Skip MVP (tap-anywhere 0.6s + button 1s); BulkOpenSummary grouped results + legendary glow; cosmicSettings (instantBoxes localStorage + window event subscribe) + SettingsModal toggle «Боксы мгновенно»; 27/27 unit tests passing (rarityRoll 11 + slice 11 + cosmicSettings 5); bundle delta +7.66 KB gzip (cap +35 KB ✓; index.js 220.23 KB vs Phase 16 baseline 218.70 KB) + 3 lazy chunks confirmed; dev tree-shake verified; 17/17 ✓ REQ-IDs (BOX-01..07, SLOT-01..08, UX-06, PERF-08). |
| 16 | Ship + travel + mission (1-ship navigation) | **complete** (2026-05-08) — 5 plans, 5 waves, 14 atomic commits; ShipState discriminated union + travel formula + crew daily limit + ShipSprite Phaser-native + StarMap integration + ShipTab + FlightConfirmDialog + CrewIndicator + MissionOverlay + 3 mini-clickers (rhythm/defend/hotspot) + investigatePlanet atomic + progressive disclosure (UX-09) + dev helpers + i18n RU/EN/ES; bundle delta +8.20 KB gzip (cap +40 KB ✓; index 218.70 KB vs Phase 14 baseline 211.59 KB). 27/27 ✓ REQ-IDs (SHIP-01..10, CREW-01..08, MISSION-01..08, UX-09). |
| 17 | Carrier evolution + feed + ceiling + merge | **complete** (2026-05-08) — 5 plans, 3 waves, 5 atomic commits; pure carrierEvolution helpers (TIER_RANGES + bucket weights 5/15/30/50 + streak protection) + bestiary bitset 1536 bits = 192 bytes; feedCarrier/mergeCarriers/disposeCarrier/setBestiaryBit actions atomic с pre-determined ceiling + bestiary write-through; MainScene performFeed + performCarrierMerge с classifyDropTarget gate (5 branches); CarriersTab + CarrierInfoCard + CeilingDisplay (3-phase reveal 0-2/3-4/5+) + DisposeConfirmModal; StabilizationModal slot 1.8s + reveal 2.2s; FrogElementOverlay.locked flag + FrogOverlayManager skip-re-acquire; verify_carrier_evolution.cjs 4 Monte-Carlo tests (distribution/streak/bestiary/dispose ALL PASS); STORAGE_VERSION 18→19 + lossless 24→192 byte migration; i18n RU/EN/ES (21 keys × 3 = 63 entries, all UI labels ≤12 chars); bundle delta +5.11 KB gzip (cap +25 KB ✓). 16/16 ✓ REQ-IDs (CARRIER-01..12 + BALANCE-06/09 + UX-10/11). |
| 18 | Бестиарий 2.0 (1536 cells, virtualized) | **complete** (2026-05-08) — 5 plans, 3 waves, 5 atomic commits; bestiary helpers (countUnlocked/unlockedInLocation/BESTIARY_MILESTONES/milestonesCrossed); setBestiaryBit milestone-aware (10→1000 coins/24→epic serum/96→legendary serum/576→frogExclusiveUnlocked) + cosmic:bestiary-milestone event; @tanstack/react-virtual 3.13.24 install; 4 location tabs (Болото/Лес/Континент/Планета rarity-mapped) × 384 cells each; BestiaryGrid 6-col virtualized с overscan 5 (DOM ≤30 cells); BestiaryCell memoized 64×64 (discovered: ELEMENT_TINT linear-gradient + rarity border + glow + 🐸 + L-badge / locked: ??? + tooltip); FilterPills (rarity pills + element search + sort dropdown + show-locked toggle); useBestiaryView state machine (default «Discovered only» если countUnlocked > 0); BestiaryDetailModal с CSS preview (radial-gradient orb + ELEMENT_TINT + rarity glow + bestiary-pulse/bob keyframes); MilestoneToast auto-hide queue; window.__unlockBestiaryCells/__bestiaryCount/__resetBestiary dev helpers; i18n RU/EN/ES (38 keys × 3 = 114 entries); verify_bestiary.cjs (4 tests PASS) + smoke_bestiary.cjs (18 checks PASS); bundle delta +10.60 KB gzip (cap +30 KB ✓; index 226.38 KB vs Phase 17 baseline 224.06 KB = +2.32 KB; CosmicHubModal-chunk 13.89 KB vs 5.68 KB = +8.21 KB). 9/9 ✓ + I18N-02 ✓ REQ-IDs (BESTIARY-01..09 + I18N-02). |
| 19 | Balance + tutorial + toggles + i18n polish | **complete** (2026-05-08) — 7 plans, 4 waves, 9 atomic commits; openBox wired to rollRarity+updatePity (BALANCE-01..07); 9 unit tests for pity guarantees; Monte Carlo simulate_balance.cjs (mirror of rarityRoll.ts; 100K iterations baseline avgLeg=6.073 effective, pityHard25Breaches=0, gap.max=25); progressive PityCounterDisplay footer (hidden/dots/exact reveal at 0/3/5 opened boxes); calmFarmMode + reducedEffects toggles via cosmicSettings.ts (default OFF Locked); StabilizationModal unified reducedEffects key fix (Rule 1 deviation); TutorialOverlay + 4 steps (first-box/serum/feed/stabilize) + tutorialState persist + single-active-step priority; check-translations.cjs (286 keys × 3 locales RU/EN/ES PARITY CLEAN); elementTints mechanical hex collision fix (0xfde68a→0xfdd87a vs desert) + Phase 19-06 audit comment; check-bundle-delta.cjs + .bundle-baseline-v1.json (delta 32.43 KB / 50 KB cap PASS; current main 229.24 KB vs v1.0 baseline 196 KB; CosmicHubModal lazy chunk 14.22 KB verified PERF-07); SMOKE_TEST.md visual+i18n+settings consumer audit. Settings consumer status: openBoxesInstantly WIRED (Phase 15), reducedEffects PARTIALLY WIRED (StabilizationModal), calmFarmMode TODO (Phase 20). 17/17 ✓ REQ-IDs (BALANCE-01..05/07/08, UX-01/02/03/04/05/06/08, PERF-01/05/07, I18N-02/03). |

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

## Phase 15 (closed) — Performance Metrics

| Wave | Plan | Tasks/Commits | Files | Bundle Delta gzip |
|------|------|---------------|-------|-------------------|
| 1 | 15-01 (foundation: types + rollRarity + slice + dev) | 3 commits | 5 created + 4 modified | (cumulative) |
| 2-4 | 15-02..15-05 (BoxesTab + cascade + slot + bulk + Settings + i18n) | 2 commits (merged Wave 3+4) | 4 created + 7 modified | +7.66 KB final |
| **Total** | — | **5 commits** | **9 created + 11 modified** | **+7.66 KB gzip** (cap: 35 KB ✓; index.js 220.23 KB vs Phase 16 baseline 218.70 KB; 3 lazy chunks: CascadeRevealModal 1.82 KB / SerumSlotMachine 2.05 KB / BulkOpenSummary 1.32 KB gzip) |

**Phase 15 REQ coverage:** 17/17 ✓ (BOX-01..07, SLOT-01..08, UX-06, PERF-08).
**Phase 15 outcome:** Полный box → slot-machine → serum drama-flow с lazy chunks. Связка Phase 14 + 15 + 16 даёт полный loop ship→mission→box→slot-machine→serum→apply→carrier. Все 27 unit тестов проходят (rarityRoll + slice + cosmicSettings).

## Phase 17 (closed) — Performance Metrics

| Wave | Plan | Tasks/Commits | Files | Bundle Delta gzip |
|------|------|---------------|-------|-------------------|
| 1 | 17-01 (foundation: types + carrierEvolution + bestiary + verify) | 1 commit | 4 created + 2 modified | (cumulative) |
| 2 | 17-02 (feedCarrier + mergeCarriers + disposeCarrier + setBestiaryBit + MainScene drag-feed wiring) | 1 commit | 1 created + 3 modified | +0.50 KB after Wave 2/Plan 17-02 |
| 2 | 17-03 (CarriersTab + CarrierInfoCard + CeilingDisplay + DisposeConfirmModal + 5-th tab + i18n RU/EN/ES) | 1 commit | 4 created + 4 modified | (cumulative) |
| 3 | 17-04 (StabilizationModal + visual lock locked flag + App.tsx mount) | 1 commit | 1 created + 3 modified | +5.11 KB after Wave 3/Plan 17-04 |
| 3 | 17-05 (dev helpers __forceFeed/__forceStabilize/__bestiaryBitsSet) | 1 commit | 1 modified | +5.11 KB final |
| **Total** | — | **5 commits** | **10 created + 13 modified** | **+5.11 KB gzip** (cap: +25 KB ✓; index.js 224.06 KB vs Phase 15 baseline 220.23 KB = +3.83 KB; CosmicHubModal-chunk 5.67 KB vs 4.39 KB = +1.28 KB) |

**Phase 17 REQ coverage:** 16/16 ✓ (CARRIER-01..12, BALANCE-06/09, UX-10/11).
**Phase 17 outcome:** Полный carrier evolution loop end-to-end функционален — apply → feed (success/fail/stabilize) → progressive ceiling reveal (0-2/3-4/5+) → stabilization modal slot-machine → visual lock → merge above ceiling (S-bucket guaranteed) → dispose с 30% serum recovery → bestiary bit write-through (1536 unique bits / 192 bytes). Verify-script Monte Carlo all 4 tests pass (distribution ±5%, streak 1000/1000, bestiary collision-free, dispose ≈30%). STORAGE_VERSION bump 18→19 + lossless 24→192 byte migration.

## Phase 18 (closed) — Performance Metrics

| Wave | Plan | Tasks/Commits | Files | Bundle Delta gzip |
|------|------|---------------|-------|-------------------|
| 1 | 18-01 (bestiary helpers + setBestiaryBit milestone trigger + verify_bestiary) | 1 commit | 1 created + 5 modified | (cumulative) |
| 1 | 18-02 (@tanstack/react-virtual install + BestiaryCell + rarityStyles) | 1 commit | 4 created + 1 modified | (cumulative) |
| 2 | 18-03 (BestiaryTab full rewrite + BestiaryGrid + FilterPills + useBestiaryView + Modal stub) | 1 commit | 5 created + 1 modified | +7.56 KB after Wave 2 |
| 3 | 18-04 (BestiaryDetailModal full + AwakenedPreviewCanvas) | 1 commit | 1 created + 2 modified | (cumulative) |
| 3 | 18-05 (i18n RU/EN/ES + MilestoneToast + dev helpers + smoke_bestiary) | 1 commit | 3 created + 5 modified | +10.60 KB final |
| **Total** | — | **5 commits** | **14 created + 14 modified** | **+10.60 KB gzip** (cap: +30 KB ✓; index.js 226.38 KB vs Phase 17 baseline 224.06 KB = +2.32 KB; CosmicHubModal-chunk 13.89 KB vs 5.68 KB = +8.21 KB) |

**Phase 18 REQ coverage:** 9/9 ✓ + I18N-02 ✓ (BESTIARY-01..09 + I18N-02).
**Phase 18 outcome:** Замкнутый коллекционный мета-loop — игрок видит 1536 уникальных combos в performant virtualized grid (DOM ≤30 cells одновременно), фильтрует по rarity/element/sort, открывает cell detail modal с CSS-based awakened preview, получает milestone rewards (1000 монет / epic-серум / legendary-серум / frogExclusiveUnlocked flag) на 10/24/96/576 ячейках. verify_bestiary.cjs PASS 4/4 (count/location/milestones/size); smoke_bestiary.cjs PASS 18/18 + tsc clean. dev helpers `__unlockBestiaryCells(N)` для testability.

## Phase 19 (closed) — Performance Metrics

| Wave | Plan | Commits | Files | Bundle Delta gzip |
|------|------|---------|-------|-------------------|
| 1 | 19-01 (openBox wiring + 9 unit tests) | 2 | 3 modified + 1 created | (cumulative) |
| 1 | 19-04 (calmFarmMode + reducedEffects toggles + i18n) | 1 | 5 modified | +0.5 KB after Wave 1 |
| 2 | 19-02 (Monte Carlo simulate_balance.cjs + npm script) | 1 | 1 created + 1 modified | (cumulative) |
| 2 | 19-05 (TutorialOverlay + tutorialState persist + 4 steps + i18n) | 2 | 2 created + 4 modified + 3 i18n | +1.8 KB after Wave 2 |
| 3 | 19-03 (PityCounterDisplay footer + reveal rules) | 1 | 1 created + 1 modified | +0.4 KB |
| 3 | 19-06 (check-translations.cjs + elementTints collision fix + SMOKE_TEST.md) | 1 | 2 created + 2 modified | (no main delta) |
| 4 | 19-07 (check-bundle-delta.cjs + baseline JSON + StabilizationModal unify) | 1 | 2 created + 3 modified | +2.86 KB final main |
| **Total** | — | **9 commits** | **10 created + 12 modified** | **+2.86 KB main / +0.33 KB chunk** (cap: +30 KB ✓; index.js 229.24 KB vs Phase 18 baseline 226.38 KB; vs v1.0 baseline 196 KB = +33.24 KB / 50 KB cap) |

**Phase 19 REQ coverage:** 17/17 ✓ (BALANCE-01..05/07/08 + UX-01/02/03/04/05/06/08 + PERF-01/05/07 + I18N-02/03).
**Phase 19 outcome:** v2.0 milestone feature-complete. Pity counters реально влияют на rolled rarity (avgLegendary effective ≈ 6% при базе 3% — pity inflation expected behavior); Monte Carlo verifies pityHard25Breaches=0 + gap.max=25 invariants hold. Progressive pity UI (hidden/dots/exact) даёт игроку trust + retention loop. 4-step tutorial overlay onboarding с persisted seen-flags. Bundle delta 32.43/50 KB cap headroom. Lazy CosmicHubModal-chunk preserved. i18n 286 keys × 3 locales parity verified by script. Settings consumer wiring: openBoxesInstantly WIRED (Phase 15), reducedEffects PARTIAL (StabilizationModal), calmFarmMode TODO (Phase 20).
