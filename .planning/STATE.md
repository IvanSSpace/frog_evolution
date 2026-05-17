---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: cosmic-frogs-system
current_phase: 23 (complete); Phase 20 (Pre-release safety net) deferred до prod-релиза
status: completed
last_updated: "2026-05-18T22:00:00.000Z"
progress:
  total_phases: 14
  completed_phases: 2
  total_plans: 31
  completed_plans: 19
  percent: 61
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
| 22 | Carrier merge redesign | **complete** (2026-05-17) — 7 plans, ~23h scope, all atomic commits + per-plan SUMMARY; Rarity dimension removed (carrier shape = {frogId, element, level}); flat serum inventory Record<Element, number>; carrier merge rules (carrier+normal element-inherit, carrier+carrier target-wins); L18 ascension instant + pulse tween + ascendedCarriers pool + essence reward; HUD ActiveBonusesBar with mini/full breakdown + tooltip + i18n; Cosmic Shop (6 items, 2 currencies: essence + серум; perma slot/ship-speed/serum-drop + consumables cosmic_box/skip/trade-up); Cosmos gate via useCosmosUnlocked hook + persisted hasCosmosUnlocked flag (top-level, separate key) — pre-cosmos SerumBar/Hub/Star Map/HUD bonuses hidden + data-layer guards in box/ship slices; legacy migration migratePhase22() (idempotent, 10/10 vitest PASS — strip Phase 21 fields, flatten nested serums, infer hasCosmosUnlocked from discovered[19]); SMOKE_TEST_22.md (9 scenarios A-I); deferred: balance phase для precise essence/bonus/cost magnitudes + glossary refresh checklist (GLOSSARY_UPDATES.md). 10 REQ-IDs (PHASE22-CLEANUP, PHASE22-MERGE-RULES, PHASE22-ASCENSION, PHASE22-ARCHETYPE-POOL, PHASE22-HUD-BONUSES, PHASE22-COSMIC-SHOP, PHASE22-CURRENCIES, PHASE22-COSMOS-GATE, PHASE22-MIGRATION, PHASE22-SMOKE). |
| 23 | Onboarding flow (soft 4-beat) | **complete** (2026-05-18) — 6 plans, ~22h scope, 13 atomic commits + per-plan SUMMARY; soft 4-beat tutorial (Welcome modal Beat 1, Phaser tap-hint ring Beat 2, ghost-frog merge demo Beat 3, location unlock celebration с confetti burst + LocationStack pulse + DOM toast Beat 4); per-device localStorage state без server sync; reusable TutorialPulseRing/GhostFrogTrail/ConfettiBurst Phaser effects; dev helpers (__resetOnboarding/__skipOnboarding/__triggerBeat2/__triggerBeat4/__onboardingState); SMOKE_TEST_23.md (8 scenarios A-H); i18n RU/EN/ES parity verified (334 keys × 3 PASS); 8/8 vitest для onboardingSlice. 8 REQ-IDs (PHASE23-STATE/CONTROLLER/BEAT1-WELCOME/BEAT2-TAPHINT/BEAT3-MERGE/BEAT4-LOCATION/I18N/SMOKE). |

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

## Phase 23 (closed) — Performance Metrics

| Wave | Plan | Commits | Files | Bundle Delta gzip |
|------|------|---------|-------|-------------------|
| 1 | 23-01 (foundation: store + persistence + controller shell + dev helpers + i18n + 11 vitest specs) | 3 (c98ed34, e74dffe, 578db00) | 5 created + 5 modified | **-1.32 KB** (cap +50 KB ✓; main `index-vffWbdF3.js` 659.67 KB / 194.65 KB gzip) |
| 2 | 23-02 (Beat 1 Welcome modal: WelcomeModal.tsx + welcomeModal.css + OnboardingController wire) | 2 (c580d2f, ed93d22) | 2 created + 1 modified | TBD (vite build deferred — parallel-agent TS6133 in BoxController блокирует bundle measure, см. deferred-items.md) |
| 2 | 23-05 (Beat 4 location celebration: ConfettiBurst + LocationUnlockCelebration + LocationStack pulse + scene-bridge) | 3 (fb1b50a, 79545f1, fc5f256) | 3 created + 7 modified | OK (vite build 4.04s clean) |
| 3 | 23-04 (Beat 3 merge demo: GhostFrogTrail + 2 rings + MergeHintOverlay + MergeSuccessToast + MergeController emit) | 4 (0a210d3, a23672d, f4efa94, 3ddb212) | 2 created + 3 modified | OK (vite build 4.01s clean; index.js 674.50 KB / 198.65 KB gzip) |
| 4 | 23-06 (i18n parity verify + extended dev helpers + SMOKE_TEST_23.md + ROADMAP/STATE finalize) | 2 (TBD) | 1 created (SMOKE_TEST_23.md) + 3 modified (onboardingDevHelpers.ts, ROADMAP.md, STATE.md) | no main delta (DEV-only helpers + docs) |
| **Total** | — | **14 commits** | **13 created + 19 modified** | OK (Plan 23-04 build clean; 23-02 measure pending deferred-item) |

**Phase 23 REQ coverage:** 8/8 ✓ (PHASE23-STATE, PHASE23-CONTROLLER, PHASE23-BEAT1-WELCOME, PHASE23-BEAT2-TAPHINT, PHASE23-BEAT3-MERGE, PHASE23-BEAT4-LOCATION, PHASE23-I18N, PHASE23-SMOKE).
**Phase 23 outcome:** Soft 4-beat onboarding shipped end-to-end. Welcome modal single-action (pink CTA, pastel gradient, bobbing L1 frog SVG, CSS keyframes); reusable Phaser effects (TutorialPulseRing, GhostFrogTrail, ConfettiBurst) deployed across Beats 2-4; OnboardingController DOM coordinator с state-machine logic, all guards idempotent через onboarding slice flags; per-device localStorage (`frog_evolution_onboarding`) НЕ синкается на сервер; 5 dev helpers покрывают reset/skip/beat-trigger/state-inspect; i18n RU/EN/ES parity verified (334 keys × 3 PASS); SMOKE_TEST_23.md содержит 8 scenarios (A-H) для manual приёмки. Beat 4 location celebration (Болото L7 / Лес L13 / Star Map cosmos sentinel) использует per-location confetti palette и LocationStack pulse persists ДО tap — design intent «положительное приглашение, не таймер давления». tsc + vite build clean (24-04 measured); pulse/glow CSS keyframes only (Lottie выпилен per memory feedback_animations); frog.container alpha никогда не tween'ится (Ghost = отдельный GameObject per feedback_frog_container_alpha).
**Plan 23-01 outcome:** Foundation ready — Plan 23-02/03/05 (Wave 2) can proceed in parallel against the live store; 23-04 still gated by 23-03; 23-06 finalize last. Onboarding lives in its own per-device slice (separate from cosmic), so it cannot affect Phase 22 carrier migration or any server-synced state. 97/97 vitest green.
**Plan 23-02 outcome:** Beat 1 active — игрок при first app open (welcomeSeen=false) видит centered modal с pastel gradient + bobbing frog SVG + pink CTA «Начать». Single-action: backdrop click ignored. CTA → fade-out 400ms → markWelcomeSeen → modal unmounts. Persistence через onboarding slice (Plan 23-01) гарантирует one-shot per device. Pattern для onboarding overlays установлен (createPortal, CSS keyframes only, per-flag selector, exit-animation-aware unmount) — Plan 23-04/05 могут reuse. tsc clean по моим файлам; vite build blocked by parallel Plan 23-03 unused-imports (deferred-items.md).
**Plan 23-05 outcome:** Beat 4 active — на каждый первый `location:unlocked` для {2, 3, 6} триггерится coordinated celebration: (1) Phaser confetti burst в центре canvas (palette per location: swamp green/yellow, forest green/brown, cosmos cyan/violet, 40 particles, 1.2s gravity decay), (2) LocationStack pulse — pink glow (`0 0 16px 4px #ec4899`) + bobble scale 1.0↔1.1 (1200ms infinite), persists ДО tap на pulsing button, (3) DOM toast snizu (pill `#ec4899`, slide-up 350ms, 7s auto-fade OR tap-dismiss). Per-location flag (`locationsCelebrated[id]`) обеспечивает idempotency. Сделано production-ready: `window.__mainScene` exposed unconditional (был только DEV), React↔Phaser bridge documented. tsc clean + vite build 4.04s.

### Plan 23-01 Decisions Logged

- Per-device-only onboarding store, isolated from gameStore/cosmic to keep blast radius zero from Phase 22 migration logic.
- subscribeWithSelector enabled now (cheap) so Plan 23-02..05 can subscribe to single flags without forced refactor.
- Mark actions persist synchronously inside the slice (no debounce) — onboarding writes are infrequent one-shot events.
- Defensive per-field validation in `loadOnboarding` (T-11-01 pattern) — partial corruption preserves valid fields.
- `__resetOnboarding()` triggers `window.location.reload()` so the Welcome modal (Plan 23-02) re-mounts during QA.

### Plan 23-02 Decisions Logged

- Inline SVG для L1 frog (вместо external asset) — zero network deps, мгновенный mount, нет flash-of-no-image. Plan 23-06 может swap на existing frog asset когда визуальный язык frog assets устаканится.
- `setTimeout(markSeen, 400ms)` перед store mutation — store mutate триггерит синхронный re-render, который unmount'ит modal; задержка совпадает с длительностью @keyframes onb-welcome-fade-out так что игрок видит плавный fade-out а не резкое исчезновение.
- Per-flag selector в OnboardingController (`s => s.welcomeSeen` вместо combined object) — каждый beat изолированно re-render'ится, готово для Plan 23-03..05 conditional branches.
- Backdrop intentionally без onClick handler — single-action UX (это первый и единственный blocking onboarding step). Cliclability checklist выполнен другими механизмами: `type="button"`, z-index 100, touchAction manipulation, stopPropagation на inner modal.
- CSS keyframes only (не Lottie) per memory feedback_animations. Frog bob — DOM SVG, отдельная сущность от Phaser frog.container, никакого риска мерцания (memory feedback_frog_container_alpha n/a здесь).
- Reused pink CTA gradient (#f9a8d4 → #ec4899) и pastel bg (lake-blue #bae6fd → swamp-green #bef264) от LocationStack/LOCATION_VISUAL для визуальной consistency с остальным миром локаций.

### Plan 23-05 Decisions Logged

- Pulse persists ДО tap на location button — toast auto-fade его НЕ гасит. Это per CONTEXT.md design intent: «положительное приглашение, а не таймер давления». Toast и pulse имеют независимые жизненные циклы (toast 7s OR tap; pulse — только button tap).
- `window.__mainScene` exposed в production (не только DEV) — Plan 23-05 первое production-bridge использование. Документировано inline в `MainScene.create()` / `destroy()` (ownership check `if (w.__mainScene === this) delete`).
- Phaser particle texture генерируется один раз на scene (4x4 white pixel, key `onb-confetti-pixel`) — tint накладывается per-particle через emitter `tint: palette`. Это избегает зависимости от ассета `confetti.png` и работает на любой instance MainScene/StarMapScene без preload.
- LocationUnlockCelebration mount unconditional (НЕ conditional через store flag) — event-driven visibility избегает race между `eventBus.emit('location:unlocked')` и React's store-subscription re-render cycle.
- Confetti depth=6000 (выше TutorialPulseRing=5000) — confetti всегда поверх tutorial visual hints, но depth conservative: не лезет в HUD space.
- `LOC_INFO` table (locationId → emoji+nameKey) пока внутри `LocationUnlockCelebration.tsx`. Если Plan 23-06 smoke-test захочет reuse (manual `eventBus.emit('location:unlocked', {locationId: 2})`), извлечь в shared util.
- CSS keyframes для DOM pulse + Phaser tweens для confetti (memory feedback_animations) — никакого Lottie. Pulse bobble keyframe inline `<style>` в LocationStack JSX (один раз), toast keyframes в отдельном `locationCelebration.css`.
- Cliclability: добавлен `type="button"` к LocationButton и collapse-toggle, `z-index: 101` для toast (выше LocationStack=50), `touchAction: manipulation` чтобы избежать iOS double-tap-zoom delay.

### Plan 23-04 Decisions Logged

- Ghost = отдельный `Phaser.GameObjects.Image` clone (через `textureKeyForLevel(level)`), НЕ модификация frog.container — соблюдает memory:feedback_frog_container_alpha. Никогда не tween'им alpha настоящей frog'и.
- MergeController emit'ит `tutorial:firstMerge` внутри `performMerge` ПОСЛЕ classify'я — покрывает все варианты (normal+normal/carrier+normal/carrier+carrier) единой точкой. `markFirstMergeSeen` idempotent → повторные merges no-op.
- `MergeSuccessToast` вынесен в отдельный always-mounted компонент (рядом с `MergeHintOverlay` в том же файле) — нужно пережить unmount overlay'я сразу после `markFirstMergeSeen`. Race window 0ms иначе.
- Coords для ghost trail capture'ятся const'ами в момент demo start, а НЕ follow'ят frog real-time — frogs wander idle anim'ой, follow создавал бы visual jitter pill'а. Trade-off acceptable: за 8с frogs далеко не уйдут, demo демонстрирует intent а не GPS.
- `useRef` idempotency guard (`demoStartedRef.current`) вместо state-flag — re-render не нужен (lifecycle полностью внутри Phaser), exhaustive-deps satisfied только реальными зависимостями.
- Реюз `window.__mainScene` от Plan 23-05 (вместо создания нового `window.__phaserMainScene` как просил план) — типизация `MainScene` дает прямой доступ к `scene.frogs` без any-cast'а.
- Ring radius=38px (frog-sized) против 23-03 box ring ~50px — frog меньше чем box (BASE_SCALE ≈ 0.67), ring не должен выходить далеко за body.
- Performance: `new Set(carriers.map(c => c.frogId))` для O(1) lookup вместо O(n*m) `.some()` в filter — useEffect re-run'ится при каждом spawn.
- Auto-fade timer + immediate event listener дублируют dismiss path по двум источникам (store-flag re-run + immediate `tutorial:firstMerge` listener) — race-safe, обе ветки идемпотентно гасят свою половину.

### Plan 23-06 Decisions Logged

- Task 1 (i18n parity) был no-op в плане execution: `npm run check-translations` показал 334/334 на старте — все 7 onboarding keys × 3 locales уже на месте после Plans 23-01..05 bootstrap. Документировано как «verification PASS without code change», не как deviation.
- `__triggerBeat3` сознательно не добавлен в dev helpers — Beat 3 требует 2 реальных L1 frogs на field'е (controller subscribe'нут на gameStore.locationFrogs filter'ом). Workaround через existing `installBestiaryDevHelpers` (`__giveFrog(1)`) задокументирован в SMOKE_TEST_23.md Scenario C.
- `__triggerBeat2` имеет caveat: эмитит fake `tutorial:firstBoxSpawned` event, но Phaser pulse-ring НЕ появится без real box (BoxController owns ring lifecycle, привязан к box game object). Helper полезен только для DOM «Тапни 👆» label test. Документировано в JSDoc + SMOKE_TEST_23.md.
- `__triggerBeat4(locationId)` whitelist'ит `[2, 3, 6]` — те же ids что в `__skipOnboarding`. Если future Phase 25+ добавит location id 4 (Континент) в Beat 4 trigger set, расширить обе функции одновременно.
- `__onboardingState()` использует `console.table` для flat fields + отдельный `console.info` для nested `locationsCelebrated` — `console.table` плохо рендерит nested objects, splitting улучшает читаемость в DevTools.
- SMOKE_TEST_23.md следует pattern SMOKE_TEST_22.md (8 scenarios A-H, [ ] checkboxes, dev helper callouts) — ensure manual QA имеет одинаковый shape across phases.
