---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: cosmic-frogs-system
current_phase: 26 (complete)
status: completed
last_updated: "2026-05-18T11:00:00.000Z"
progress:
  total_phases: 15
  completed_phases: 5
  total_plans: 42
  completed_plans: 34
  percent: 81
---

# Project State

**Milestone:** Cosmic Frogs System (v2.0) — **COMPLETE**
**Status:** Complete — Phase 26 closed (Cosmos races foundation — 10 races, 30 habitable planets, Star Map race overlays, Inventory tab, first contact cinematic+modal). All 23 PHASE26-* REQ-IDs covered.
**Current Phase:** 26 (complete); Phase 20 (Pre-release safety net) deferred до prod-релиза
**Last Updated:** 2026-05-18

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
| 24 | Captain creation cinematic | **complete** (2026-05-18) — 5 plans, ~18h scope, atomic commits + per-plan SUMMARY; captainBirthSeen flag (gameStore toplevel + server-sync via cosmic JSON blob + legacy migration from discovered[19]); CaptainBirthEffect.ts Phaser-native (~70 particles golden/white/cyan + 3 concentric rings + camera zoom 1.0→1.08→1.0 ~3s); CaptainBirthModal.tsx DOM (L1 frog SVG + gold drop-shadow + CSS pulse 1.5s + pink #ec4899 CTA «В космос →»); MergeController L18+L18 hook (idempotent, повторные merges no-op); captainBirthController coordinator (Beat 4 addFrogToLocation на currentLocation + Beat 5 eventBus.emit('starmap:open')); i18n RU/EN/ES (captain.birth.{title,subtitle,cta}, parity verified 337 keys × 3 PASS); dev helpers __triggerCaptainBirth/__resetCaptainBirth/__captainBirthState; SMOKE_TEST_24.md 6 scenarios A-F; bundle delta +3.79 KB gzip (cap +20 KB ✓; current main 199.88 KB gzip vs Phase 23 baseline 198.65 KB). Reuse patterns: ConfettiBurst.ts (particle texture-generation), WelcomeModal.tsx (modal centering + inline SVG + inline-block CTA + cliclability checklist), DiscoveryModal.tsx (radial-gradient backdrop drama), Phase 22 cosmos gate (toplevel flag + isolated localStorage key + server sync через cosmic blob), Phase 23 OnboardingController (install-once coordinator pattern). 17/17 ✓ REQ-IDs (PHASE24-*). |
| 25 | Cosmic Hub restyle | **complete** (2026-05-18) — 4 plans, visual restyle CosmicHub под единый app design language (dark cosmic `#1a2e1a` + pink `#ec4899` accents); CosmicHubModal shell (header textShadow + pink-tinted close + dark bg) + tab strip (pink underline 3px + `cosmic-tab-bobble` keyframe 1.5s scaleY 1.0↔1.02 + dim inactive + 🔒 disabled) + lock screen (WelcomeModal-style dark card + gold `#fde047` title); 5 tabs content polish (ShipTab pink gradient pill CTAs `linear-gradient(180deg, #f9a8d4→#db2777)` + SerumInventoryTab rounded glass cards с gold box badge / pink serum badge + BestiaryTab pink `#ec4899` location tabs + CarriersTab + CarrierInfoCard WelcomeModal-style + CosmicShopTab rounded items с conditional pink border + gold/pink currency); 3 sub-modals (SerumModal dark + Rule 2 backdrop fix `rgba(0,0,0,0.6)` blur(2px), BulkOpenSummary NEW card container `#1a2e1a` + inset row pattern + pink count pills + Rule 1 i18n element-name fix backtick template literal, PityCounterDisplay pink dots rendered divs + NEW progress bar `linear-gradient(90deg, #f9a8d4→#ec4899)` 4px thin); shared `_styles.ts` design tokens module (9 exports — DRY across 6 файлов); CascadeRevealModal + bestiary/ subdir НЕ trogались (per CONTEXT.md scope); Tailwind layout utilities preserved (flex/grid/gap/px/py), color/text/border заменены inline (D-Tailwind-Cleanup); cliclability checklist соблюдён (type="button" + touchAction: manipulation + z-index hierarchy 50→99/100→200 + stopPropagation на inner modals); bundle delta cumulative gzip +0.98 KB (cap +5 KB ✓ per CONTEXT.md; CosmicHubModal chunk gzip 12.85→13.83 KB); i18n RU/EN/ES intact (337/337); SMOKE_TEST_25.md 6 scenarios A-F (lock screen / tab strip / Ship+Серумы / Бестиарий+Носители / Магазин / sub-modals+PityCounter); 4 atomic feat commits (Plans 01/02a/02b/03) + 3 docs commits (per-plan SUMMARY) + 1 final docs commit (this finalize). 14/14 ✓ REQ-IDs (PHASE25-SHELL, PHASE25-HEADER, PHASE25-TABSTRIP, PHASE25-LOCKSCREEN, PHASE25-TAB-SHIP, PHASE25-TAB-SERUMS, PHASE25-TAB-BESTIARY, PHASE25-TAB-CARRIERS, PHASE25-TAB-SHOP, PHASE25-SUB-SERUM-MODAL, PHASE25-SUB-BULKOPEN, PHASE25-SUB-PITY-COUNTER, PHASE25-SMOKE, PHASE25-FINALIZE). |
| 26 | Cosmos races foundation | **complete** (2026-05-18) — 6 plans, ~18h scope, all atomic commits + per-plan SUMMARY (26-01..06); 10 races config с полным lore (RaceId union + RACES readonly array + RACES_BY_ID O(1) lookup + getRaceColor/getRaceAffinity helpers + emojiIcon placeholder per race; homeColor = ELEMENT_TINTS[affinity] reuse от Phase 19-06 colorblind-safe palette) + firstContactsSeen state (server-syncable cosmic blob через standard saveCosmicSlice + gameSync.ts snapshotForSave/loadGameState; defensive load для unknown raceIds; idempotent markFirstContactSeen) + 30 habitable planets selection (deterministic Mulberry32 seed=19450718, affinity-first selection с fallback на PRNG-shuffled non-'home' pool — affinity matching pool в практике =0 для 8 рас и =1 для 2 рас т.к. planetMap.type literals не совпадают с Element union, поэтому ВСЕ races fallback; reproducibility script committed под client/scripts/select_habitable_planets.cjs) + runtime helpers (getHabitablePlanets/getPlanetInhabitant/getPlanetsByRace/HABITABLE_PLANET_IDS ReadonlySet O(1) lookup, module-scope memoization) + 7 vitest invariants PASS; Star Map RaceGlowController (Phaser texture-gen radial gradient reuse от ConfettiBurst — concentric circles 32 steps + quadratic alpha falloff, 256px texture cached в textures.exists; 3-GameObject overlay group per planet: glow Image depth -1 ADD blend + race emoji Text depth +1 + optional home gold halo Image depth -2 ADD blend + Sine.easeInOut yoyo 1500ms; tracked в Map<planetId, OverlayGroup>) + planetRenderer integration (tryAttachRaceOverlay для обоих renderMain/renderBg, defensive guards cosmos+HABITABLE_PLANET_IDS+id!=='home'; attachAllHabitable для reactive cosmos unlock через scene.systemSprites map) + StarMapScene.shutdown invokes planetRenderer.destroy() (Zustand unsubscribe + RaceGlowController.destroy chain — leak-free teardown) + popovers race info badge (race emoji + name + role label «⭐ Главный мир» / «· Колония» — встроен в existing capsule, не отдельный modal); Inventory tab 6-я в Cosmic Hub (4 секции: currencies essence/gold live values granular Zustand selectors, 16-serum grid 4×4 с ELEMENT_EMOJI local mapping + element-tint border при count>0/opacity 0.5 при count===0, artifacts placeholder dark card, 10 race relationships rows с emoji+name+"?" placeholder badge + native title tooltip; reuse Phase 25 `_styles.ts` design tokens DARK_CARD_STYLE/SECTION_HEADER_STYLE/MINI_BADGE_STYLE/GOLD/PINK; CosmicTab union extended с 'inventory' literal; Rule 3 deviation: `s.coins` план text → `s.gold` actual поле) + FirstContactEffect.ts (Phaser cinematic ~2s: 35 particles radial 360° burst race.homeColor+white mixed tint lifespan 1.8s scale 0.4→1.6 alpha 1→0 + 1 expanding ring race.homeColor radius 12→140 alpha 0.8→0 duration 1.5s Quad.easeOut + NO camera zoom; defensive paths — unknown raceId queueMicrotask emit-complete + no scene setTimeout 0 emit-complete; idempotent install/uninstall activeHandler swap HMR-safe; lazy scene resolution window.__starMapScene → window.__mainScene fallback) + FirstContactModal.tsx (DOM portal — WelcomeModal pattern reuse, dark card #1a2e1a + race emoji big + race name + personality italic + lore_short + pink CTA #ec4899 «Понятно» + backdrop click closes + markFirstContactSeen ПОСЛЕ fade-out 300ms setTimeout; useEffect ДО early-return для !race case — Rule 1 plan-text bug fix) + firstContactController.tsx (App-level 3-step coordinator: starmap:planet-tapped subscriber → gate firstContactsSeen + getPlanetInhabitant → emit cosmos:first-contact с planet coords → effect handler runs → emit cosmos:first-contact-effect-complete → controller setState pendingRaceId → mount FirstContactModal; useRef для pendingRaceIdInFlightRef vs closure object — mitt не кеширует last payload) + StarMapScene.getPlanetWorldCoords(planetId) helper (existing allSystems collection linear scan, rare event — приемлемо для 451 planets) + window.__starMapScene exposure (`if (... === this) delete` cleanup pattern mirror MainScene); eventBus extended ('cosmos:first-contact' raceId:string + 'cosmos:first-contact-effect-complete' raceId:string; raceId:string vs RaceId — избегаем cycle eventBus→slice→races→types→eventBus); SMOKE_TEST_26.md 7 scenarios A-G (race config / habitable planets / star map visuals / cosmos gate / inventory tab / first contact flow / dev helpers+cliclability) + i18n + build chain + regression sanity; i18n RU/EN/ES parity 337→**402 keys × 3 locales = 1206 entries** (+65 keys per locale: 50 races.{id}.{name,lore_short,personality,communication_style,home_planet_name} + 3 cosmos.first_contact.{title,cta,subtitle_template} + 11 cosmic_hub.inventory.{tab_label,section_currencies,section_serums,section_artifacts,section_relationships,placeholder_empty,placeholder_artifacts,placeholder_relationships,currency_essence,currency_gold,relationship_unknown} + 1 cosmic_hub.tab_inventory); bundle delta gzip main +9.29 KB (cap ~+15 KB ✓; 199.88 KB Phase 25 → 209.17 KB), CosmicHubModal chunk +0.43 KB (13.83→14.26 KB); 104 PASS / 0 FAIL vitest (3 pre-existing suite-import failures from Phase 22 documented в deferred-items.md — slice.test.ts / slice.openBox.test.ts / cosmicSettings.test.ts); DEV helpers __listRaces / __markFirstContact / __resetFirstContacts / __firstContactsState / __triggerFirstContact (DEV-gated through import.meta.env.DEV — Vite tree-shake в production); никакого Lottie (CSS keyframes + Phaser tweens только, memory feedback_animations); НЕ trogает frog.container.alpha (race overlays — отдельные GameObjects на depth -2/-1/+1 relative; DOM modals через createPortal, memory feedback_frog_container_alpha); cliclability checklist (type="button" + touchAction: manipulation + z-index hierarchy modal 200 > Cosmic Hub 100 > Star Map 50 + stopPropagation + backdrop click closes first contact modal). 23/23 ✓ REQ-IDs (PHASE26-RACES-CONFIG, PHASE26-FIRSTCONTACT-STATE, PHASE26-I18N-RACES, PHASE26-EVENTBUS, PHASE26-INHABITED-PLANETS, PHASE26-PLANET-SELECTION, PHASE26-PLANET-INHABITANT-TYPE, PHASE26-STARMAP-GLOW, PHASE26-STARMAP-ICONS, PHASE26-COSMOS-GATE-INHABITANTS, PHASE26-POPOVER-RACE-INFO, PHASE26-INVENTORY-TAB, PHASE26-INVENTORY-CURRENCIES, PHASE26-INVENTORY-SERUMS, PHASE26-INVENTORY-PLACEHOLDERS, PHASE26-I18N-INVENTORY, PHASE26-FIRSTCONTACT-EFFECT, PHASE26-FIRSTCONTACT-MODAL, PHASE26-FIRSTCONTACT-WIRING, PHASE26-FIRSTCONTACT-IDEMPOTENT, PHASE26-SMOKE, PHASE26-I18N-PARITY, PHASE26-FINALIZE). |

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

## Phase 24 (closed) — Performance Metrics

| Wave | Plan | Commits | Files | Bundle Delta gzip |
|------|------|---------|-------|-------------------|
| 1 | 24-01 (state + persistence + gameSync + eventBus) | 1 | 4 modified | (cumulative) |
| 2 | 24-02 (Phaser cosmic effect — CaptainBirthEffect + MainScene wire) | 2 | 1 created + 1 modified | (cumulative) |
| 2 | 24-03 (DOM modal + i18n + eventBus event) | 2 | 2 created + 4 modified | (cumulative) |
| 3 | 24-04 (MergeController hook + captainBirthController + App.tsx mount) | 4 | 1 created + 2 modified | (cumulative) |
| 4 | 24-05 (dev helpers + SMOKE_TEST_24.md + ROADMAP/STATE finalize) | 2 | 2 created + 4 modified | +3.79 KB final main |
| **Total** | — | **11 commits** | **6 created + 14 modified** | **+3.79 KB gzip** (cap +20 KB ✓; index.js gzip 199.88 KB vs Phase 23 baseline ≈198.65 KB) |

**Phase 24 REQ coverage:** 17/17 ✓ (PHASE24-STATE, PHASE24-PERSISTENCE, PHASE24-SERVER-SYNC, PHASE24-MIGRATION, PHASE24-EVENTBUS, PHASE24-COSMIC-EFFECT, PHASE24-EFFECT-AUTO-MOUNT, PHASE24-CAPTAIN-MODAL, PHASE24-I18N, PHASE24-CTA-EXIT, PHASE24-MERGE-HOOK, PHASE24-BEAT4-SPAWN, PHASE24-BEAT5-STARMAP, PHASE24-MODAL-MOUNT, PHASE24-DEV-HELPERS, PHASE24-SMOKE, PHASE24-FINALIZE).

**Phase 24 outcome:** 5-beat cinematic при первом L18+L18 normal merge — flash → cosmic growing effect (particles + 3 rings + camera zoom ~3s) → Captain Birth modal (L1 frog SVG + gold glow + pink CTA) → Beat 4 spawn L1 frog на current location → Beat 5 Star Map auto-open. Idempotent через `captainBirthSeen` флаг (server-syncable via cosmic JSON blob, legacy-migrated из `discovered[19]`). Никакого Lottie (CSS keyframes + Phaser tweens только, memory feedback_animations). frog.container.alpha не trogается (memory feedback_frog_container_alpha; particles/rings — отдельные GameObjects поверх frog layer на depth 9000). Cliclability checklist соблюдён (`type="button"`, z-index 200 поверх HUD, backdrop click ≡ CTA exit, stopPropagation, `touchAction: manipulation`). i18n RU/EN/ES parity (3 ключа `captain.birth.{title,subtitle,cta}` × 3 locales = 9 entries; check-translations.cjs 337/337 PASS). Dev helpers покрывают force trigger (без state change — replay-safe), full reset с reload, snapshot inspection. SMOKE_TEST_24.md содержит 6 scenarios A-F (fresh save, replay protection, legacy migration, server sync, backdrop dismiss, timing+cliclability) + i18n + build chain + regression sanity.

### Plan 24-05 Decisions Logged

- `installCaptainBirthDevHelpers()` идёт в DEV bootstrap useEffect (рядом с installBestiaryDevHelpers/installOnboardingDevHelpers), отдельно от production-critical `installCaptainBirthController()` (Plan 24-04, без DEV gate). Cleanup в return ветке useEffect.
- `__triggerCaptainBirth` НЕ модифицирует state — следующий реальный L18+L18 НЕ сыграет cinematic если `captainBirthSeen=true`. Replay-safe testing: для full re-test нужен `__resetCaptainBirth()` + reload. Документировано в JSDoc.
- `__triggerCaptainBirth` читает `window.__mainScene.cameras.main.{centerX,centerY}` для emit'а в центре camera; fallback `(200, 300)` если scene не активна. Cast через `window as unknown as { __mainScene?: ... }` (НЕ глобальный `declare`) — иначе конфликт с более узкими типами в devCarriers/OnboardingController/MainScene.
- `__captainBirthState()` возвращает snapshot `{captainBirthSeen, hasCosmosUnlocked, currentLocation, discoveredLevels}` — `console.table` для flat fields + отдельный `console.info` для discovered массива (как `__onboardingState` Plan 23-06).
- i18n parity verification = no-op (Task 2 A): `npm run check-translations` показал 337/337 уже после Plans 24-01..04 bootstrap. `i18n/index.ts` НЕ модифицирован. Документировано в SUMMARY.
- SMOKE_TEST_24.md следует pattern SMOKE_TEST_23.md (numbered scenarios + [ ] checkboxes + dev helper callouts + i18n + build chain + regression sanity) — manual QA имеет одинаковый shape across phases.
- Backdrop click ≡ CTA tap — backdrop dismiss path триггерит те же Beat 4 spawn + Beat 5 Star Map переходы (per CONTEXT.md design). Scenario E проверяет.
- ROADMAP.md Phase 24 entry финализирован: 5 plans listed с [x] checkmark, 17 REQ-IDs заменили `TBD`, outcome paragraph с bundle delta + i18n + SMOKE refs.

## Phase 25 (closed) — Performance Metrics

| Wave | Plan | Commits | Files | Bundle Delta gzip |
|------|------|---------|-------|-------------------|
| 1 | 25-01 (shell + header + tab strip + lock screen) | 1 feat + 1 docs | 1 modified (`CosmicHubModal.tsx`) | +0.40 KB chunk |
| 2 | 25-02 (5 tabs content polish + shared `_styles.ts`) | 2 feat + 1 docs | 1 created (`_styles.ts`) + 6 modified | +0.31 KB chunk cumulative |
| 2 | 25-03 (sub-modals: SerumModal + BulkOpenSummary + PityCounterDisplay) | 1 feat + 1 docs | 3 modified | +0.27 KB chunk cumulative |
| 3 | 25-04 (smoke test + ROADMAP/STATE finalize) | 1 docs | 1 created (`SMOKE_TEST_25.md`) + 2 modified (`ROADMAP.md` + `STATE.md`) + SUMMARY | no main delta (docs-only) |
| **Total** | — | **4 feat + 4 docs commits** | **2 created + 9 modified (code) + 1 SMOKE + ROADMAP/STATE + 4 SUMMARY** | **+0.98 KB gzip cumulative** (cap +5 KB ✓ per CONTEXT.md; CosmicHubModal chunk gzip 12.85→13.83 KB) |

**Phase 25 REQ coverage:** 14/14 ✓ (PHASE25-SHELL, PHASE25-HEADER, PHASE25-TABSTRIP, PHASE25-LOCKSCREEN, PHASE25-TAB-SHIP, PHASE25-TAB-SERUMS, PHASE25-TAB-BESTIARY, PHASE25-TAB-CARRIERS, PHASE25-TAB-SHOP, PHASE25-SUB-SERUM-MODAL, PHASE25-SUB-BULKOPEN, PHASE25-SUB-PITY-COUNTER, PHASE25-SMOKE, PHASE25-FINALIZE).

**Phase 25 outcome:** CosmicHub теперь visually consistent с rest of app (WelcomeModal Phase 23 + CaptainBirthModal Phase 24 design language). Dark cosmic theme (`#1a2e1a`) + pink accents (`#ec4899`) + 3D inset-shadow buttons из LocationStack pattern + WelcomeModal-style cards. Tailwind layout utilities preserved (flex/grid/gap/padding) — заменены только color/text/border utilities inline (D-Tailwind-Cleanup). Никакой Lottie (CSS keyframes `cosmic-tab-bobble` + `bulkSummaryGlow` для эффектов + Phaser tweens где нужно — memory `feedback_animations`). Cliclability checklist соблюдён (`type="button"`, `touchAction: manipulation`, z-index hierarchy 50→99/100→200, `stopPropagation` на inner modals). CascadeRevealModal animations + `bestiary/` subdir (FilterPills, BestiaryCell, BestiaryGrid, BestiaryDetailModal — Phase 18 territory) НЕ trogались. Bundle delta cumulative gzip +0.98 KB (well within ±5 KB cap per CONTEXT.md; shared `_styles.ts` module минимизирует overhead inline-styles). i18n parity preserved (337/337 RU/EN/ES). SMOKE_TEST_25.md покрывает 6 scenarios A-F. Two auto-fixed bugs surfaced и зафиксированы по дороге: SerumModal без backdrop (Rule 2 critical) и BulkOpenSummary element-name i18n bug (single-quote literal вместо backtick template — Rule 1).

### Plan 25-04 Decisions Logged

- **Lock screen title цвет** (Plan 25-01): gold `#fde047` выбран т.к. matches CaptainBirthModal + WelcomeModal pattern; pink reserved для interactive (CTAs, active tab). Не pink т.к. lock screen — passive informational state, gold = «cosmic vibe» без подсказки на действие.
- **Tab padding** (Plan 25-01): `12px 4px` вместо плановых `12px 16px` — 5 tabs × 32px = переполнение узкого viewport. `flex: 1` распределяет ширину, минимальный horizontal padding достаточен. Если визуально зажат — bump до `12px 8px` в Phase 26 polish.
- **CosmicShopTab фон/тема** (Plan 25-02): dark cosmic (`#1a2e1a`) НЕ pastel-green variant — consistency со shell + другими tabs; pastel-green создал бы visual disconnect.
- **SerumInventory box vs serum badge цвет** (Plan 25-02): gold (`#fde047`) для box count badge, pink (`#ec4899`) для serum count badge — дифференцирует loot (boxes) от currency (серумов) visually. Plus matches Plan 25-01 lock-title gold pattern.
- **Shop currency values цвет** (Plan 25-02): inline gold для essence, pink для серума — quick visual scan балансов.
- **BulkOpenSummary count badge** (Plan 25-03): pink pill (Phase 25 accent) на right, **element-tint kept** на left circle — сохраняем visual association с element планетой, при этом count выделяется pink accent.
- **BulkOpenSummary legendary glow** (Plan 25-03): infrastructure готова через `hasLegendary` flag (`boxShadow` + radial overlay + `bulkSummaryGlow` keyframe), но gated `false` т.к. Phase 22 убрал rarity. Reactivatable если Phase 26+ rarity вернётся.
- **PityCounterDisplay progress bar location** (Plan 25-03): только в `exact` state (opened≥5) — Phase 19 dots state остаётся textual indicator в opened∈[3,5). Hidden state pre-3 без изменений. Phase 19 progressive reveal logic preserved.
- **PityCounterDisplay legendary text цвет** (Plan 25-03): pink `#ec4899` (raised from gold `#fde047`) — gold в Phase 25 reserved для passive titles; pink — interactive/progress accent.
- **Shared `_styles.ts` design tokens module** (Plan 25-02): создан НЕ в Plan 25-01 (1 файл — не оправдывал DRY), а в Plan 25-02 когда 6 файлов нуждались в same tokens. 9 exports: PINK/PINK_LIGHT/PINK_DARK/GOLD colors + DARK_CARD_STYLE/PINK_CTA_STYLE/PINK_CTA_MINI_STYLE/DISABLED_CTA_OVERRIDES/PINK_BADGE_STYLE/SECTION_HEADER_STYLE patterns. Plan 25-03 не импортировал (parallel agent — untracked dependency); consolidate `_styles.ts` usage в Phase 26 polish если потребуется.
- **Commit стратегия Phase 25**: per-plan atomic feat коммиты + per-plan docs SUMMARY коммиты + final docs finalize (этот plan). Pre-existing user changes (.DS_Store, map0.png, planetMap.json.bak.451) — НЕ stage'ились во всех 4 планах.
- **Bundle delta source of truth**: per-plan CosmicHubModal chunk gzip estimates (Plan 25-01: 13.25 KB, Plan 25-02: 13.56 KB, Plan 25-03: 13.83 KB) vs Phase 24 baseline 12.85 KB → cumulative +0.98 KB. Vite build пишет точные gzip numbers в build log; для verification повторного build после finalize.

### Phase 25 Known TODOs deferred для Phase 26 polish

- `cosmic_hub.locked.title` + `cosmic_hub.locked.hint` i18n keys (hard-coded в Plan 25-01 per scope «i18n не trogается»).
- `bestiary/FilterPills.tsx` restyle (pink-active pill state) — Phase 18 territory, не входило в Phase 25 scope.
- `bestiary/BestiaryCell.tsx` review compat с dark cosmic shell (rarity-tints visual sync).
- `bestiary/BestiaryDetailModal.tsx` restyle (Phase 18 territory).
- Hover states на inactive shell + bestiary location tabs (desktop demo path — mobile-first scope в Phase 25).
- Tab padding tweak (12px 4px → 12px 8px если визуально зажато).
- CosmicShopTab `<select>` Safari native fallback (custom dropdown) — Safari игнорит inline `<option>` background styling.
- CarrierInfoCard dispose visual destructive-warning variant (red-pink) если UX feedback укажет на пропавший warning affordance.
- `@media (prefers-reduced-motion)` на bobble + progress bar transitions.
- Bundle: split CosmicHubModal chunk dynamically если когда-нибудь >50 KB.
- Consolidate Plan 25-03 inline tokens → `_styles.ts` imports (consistency).
- Legendary glow reactivation в BulkOpenSummary (если Phase 26+ rarity вернётся).

## Phase 26 (closed) — Performance Metrics

| Wave | Plan | Commits | Files | Bundle Delta gzip |
|------|------|---------|-------|-------------------|
| 1 | 26-01 (race config + firstContactsSeen state + i18n + eventBus + dev helpers) | 7 (cefa897/285140e/e2aae6a/6a0b1a5/f2f84c4/2c86858/361446d) + 1 docs SUMMARY | 3 created (`config/races.ts`, `utils/devRaces.ts`, `deferred-items.md`) + 10 modified (cosmic/types.ts, cosmic/slice.ts, persistence.ts, gameStore.ts, eventBus.ts, api/gameSync.ts, App.tsx, i18n/{ru,en,es}.json) | +1.5 KB est. (cumulative) |
| 2 | 26-02 (30 habitable planets selection + PlanetInhabitant + runtime API + 7 vitest) | 1 + 1 docs SUMMARY | 3 created (`game/data/habitablePlanets.ts`, `habitablePlanets.test.ts`, `client/scripts/select_habitable_planets.cjs`) + 3 modified (cosmic/types.ts, starmap/types.ts, planetMap.json) | +2.5 KB est. (cumulative; planetMap.json +30 inhabitant attachments) |
| 3 | 26-03 (Star Map RaceGlowController + planetRenderer integration + popovers race info + i18n role) | 3 (d2f038b/743f54e/d5b314b) + 1 docs SUMMARY (e59df3b) | 1 created (`starmap/effects/raceGlow.ts`) + 5 modified (planetRenderer.ts, StarMapScene.ts, starmap/popovers.ts, i18n/{ru,en,es}.json) | +3.5 KB est. (cumulative; Phaser texture-gen + 3-overlay group) |
| 3 | 26-04 (Inventory tab 6-я в Cosmic Hub + i18n cosmic_hub.inventory.*) | 1 + 1 docs SUMMARY | 1 created (`CosmicHub/InventoryTab.tsx`) + 5 modified (cosmic/types.ts, CosmicHubModal.tsx, i18n/{ru,en,es}.json) | +1.5 KB est. (cumulative; CosmicHubModal chunk grows) |
| 4 | 26-05 (FirstContactEffect + FirstContactModal + firstContactController + StarMapScene helpers + DEV helper) | 4 (f99c3f6/8b9528a/6687839/b4b7801) + 1 docs SUMMARY (4dbf77f) | 3 created (`game/effects/FirstContactEffect.ts`, `components/FirstContact/FirstContactModal.tsx`, `firstContactController.tsx`) + 4 modified (eventBus.ts, StarMapScene.ts, App.tsx, utils/devRaces.ts) | +0.3 KB est. (cumulative; reuses Phase 24 cinematic pattern) |
| 5 | 26-06 (SMOKE_TEST_26 + ROADMAP/STATE finalize) | 1 docs (1a095f4) + final docs commit | 1 created (`client/SMOKE_TEST_26.md`) + 2 modified (`ROADMAP.md` + `STATE.md`) + SUMMARY | no main delta (docs-only) |
| **Total** | — | **~17 atomic feat/style commits + 6 docs SUMMARY + 1 docs finalize** | **12 created + 23 modified (code) + 1 SMOKE + ROADMAP/STATE + 6 SUMMARY** | **+9.29 KB main / +0.43 KB CosmicHubModal chunk cumulative** (cap ~+15 KB ✓; main `index-*.js` 209.17 KB vs Phase 25 baseline 199.88 KB; CosmicHubModal chunk 14.26 KB vs Phase 25 baseline 13.83 KB) |

**Phase 26 REQ coverage:** 23/23 ✓ (PHASE26-RACES-CONFIG, PHASE26-FIRSTCONTACT-STATE, PHASE26-I18N-RACES, PHASE26-EVENTBUS, PHASE26-INHABITED-PLANETS, PHASE26-PLANET-SELECTION, PHASE26-PLANET-INHABITANT-TYPE, PHASE26-STARMAP-GLOW, PHASE26-STARMAP-ICONS, PHASE26-COSMOS-GATE-INHABITANTS, PHASE26-POPOVER-RACE-INFO, PHASE26-INVENTORY-TAB, PHASE26-INVENTORY-CURRENCIES, PHASE26-INVENTORY-SERUMS, PHASE26-INVENTORY-PLACEHOLDERS, PHASE26-I18N-INVENTORY, PHASE26-FIRSTCONTACT-EFFECT, PHASE26-FIRSTCONTACT-MODAL, PHASE26-FIRSTCONTACT-WIRING, PHASE26-FIRSTCONTACT-IDEMPOTENT, PHASE26-SMOKE, PHASE26-I18N-PARITY, PHASE26-FINALIZE).

**Phase 26 outcome:** Foundation для multi-phase космической экспансии shipped. 10 рас с полным lore (RaceId union + RaceConfig + RACES_BY_ID + getRaceColor/getRaceAffinity helpers; homeColor = ELEMENT_TINTS[affinity] colorblind-safe reuse от Phase 19-06) + firstContactsSeen state (server-syncable cosmic blob, defensive load для unknown raceIds, idempotent markFirstContactSeen) + 30 habitable planets attached deterministic Mulberry32 seed 19450718 (1 home + 2 colonies per race, affinity-first selection с PRNG-shuffled fallback; reproducibility script committed под `client/scripts/select_habitable_planets.cjs`) + Star Map RaceGlowController (Phaser texture-gen radial gradient reuse от ConfettiBurst, 3-GameObject overlay group per planet, ADD blend mode, home gold pulse halo Sine.easeInOut yoyo 1500ms, reactive cosmos subscribe для unlock-mid-session; PlanetRenderer.destroy() chain ensures leak-free teardown) + popovers race info badge (emoji + name + role label «⭐ Главный мир» / «· Колония» — встроен в existing capsule) + Inventory tab 6-я в Cosmic Hub (4 секции: currencies essence/gold live granular Zustand selectors, 16-serum grid 4×4 element-tint border + opacity cue, artifacts placeholder, 10 race relationships rows placeholder; reuse Phase 25 `_styles.ts` design tokens) + first contact cinematic (Phaser ~2s burst: 35 particles + 1 ring tinted race color, lighter scale vs CaptainBirth, idempotent install/uninstall HMR-safe, defensive paths emit-complete на unknown raceId/no-scene) + first contact DOM modal (WelcomeModal pattern reuse, dark card #1a2e1a + race emoji big + name + personality italic + lore_short + pink CTA «Понятно», backdrop click closes, markFirstContactSeen после fade-out 300ms) + firstContactController.tsx (App-level 3-step coordinator: planet-tapped → cosmos:first-contact emit → effect handler → cosmos:first-contact-effect-complete → DOM modal mount, useRef pendingRaceIdInFlightRef) + StarMapScene.getPlanetWorldCoords helper + `window.__starMapScene` exposure (mirror MainScene Phase 23-05). i18n RU/EN/ES parity (337 → **402 keys × 3 locales**, +65 keys per locale: 50 races.* + 3 cosmos.first_contact.* + 11 cosmic_hub.inventory.* + 1 tab_inventory). Bundle delta gzip main +9.29 KB / CosmicHubModal chunk +0.43 KB (cap ~+15 KB ✓). 104 PASS / 0 FAIL vitest (3 pre-existing suite-import failures from Phase 22 documented в deferred-items.md, не блокируют). 7 SMOKE_TEST_26 scenarios A-G + i18n + build chain + regression sanity. Никакого Lottie (CSS keyframes + Phaser tweens только, memory `feedback_animations`). НЕ trogает frog.container.alpha (race overlays — отдельные GameObjects на relative depth -2/-1/+1; DOM modals через createPortal, memory `feedback_frog_container_alpha`). Cliclability checklist (type="button" + touchAction: manipulation + z-index hierarchy modal 200 > Cosmic Hub 100 > Star Map 50 + stopPropagation + backdrop click closes first contact modal). DEV helpers (__listRaces / __markFirstContact / __resetFirstContacts / __firstContactsState / __triggerFirstContact) DEV-gated через import.meta.env.DEV — Vite tree-shake в production. Replay-safe DEV testing: `__triggerFirstContact` НЕ markSeen — для full replay нужен `__resetFirstContacts()` first (mirror Phase 24 `__triggerCaptainBirth`). 6 plans, ~18h scope.

### Phase 26 Known TODOs deferred для Phase 27+

- Tab strip 6 buttons squeeze на 320px viewport (Plan 26-04 known issue — `12px 4px` padding уже compact; если визуально зажато → bump до `12px 2px` или scroll-x).
- Custom popover tooltip для race relationship rows (vs native `title` attribute — mobile-poor accept в Plan 26-04).
- Race SVG assets когда user их предоставит (replace emoji placeholders Plan 26-01 — emojiIcon field уже abstract'нут).
- i18n русские склонения для «Связь установлена с расой «{{raceName}}»» (genitive case) — приемлемо для Phase 26.
- Affinity matching pool fix: planetMap.json `planet.type` literals (['crystal','rocky','ancient','mystic','organic','forge','military',...]) НЕ совпадают с Element union (['fire','water','crystal','shadow','gas','plasma','forest','void','binary','mechanical',...]) — поэтому всё селектится через fallback PRNG branch. Если Phase 27+ нужна тесная affinity match — добавить mapping table planetType → Element или regenerate planetMap.json с Element-literal types.
- 3 pre-existing test failures в `slice.test.ts` / `slice.openBox.test.ts` / `cosmicSettings.test.ts` (Phase 22 openBox refactor source) — требует dedicated test-maintenance plan (Phase 27 first task если будет critical).

### Plan 26-06 Decisions Logged

- **i18n parity verification = no code change** (Task 1): `npm run check-translations` показал 402/402 на старте — все 65 Phase 26 keys × 3 locales уже на месте после Plans 26-01..05. Документировано как «verification PASS without code change», не как deviation.
- **Bundle delta source of truth** (Task 1): vite build pass пишет точные gzip numbers — main `index-0swE8E6J.js` 209.17 KB vs Phase 25 baseline 199.88 KB = +9.29 KB. CosmicHubModal `index-BZ8rW4rU.js` 14.26 KB vs Phase 25 baseline 13.83 KB = +0.43 KB. В рамках cap ~+15 KB (CONTEXT не указывает explicit cap, reasonable budget = +15 KB gzip per scale Phase 24-25).
- **Vitest 3 suite-import failures** (Task 1): 104/0/1 (passed/failed-assert/skip) — все individual assertions pass. 3 suite-import failures (slice.test.ts / slice.openBox.test.ts / cosmicSettings.test.ts) pre-existing from Phase 22 openBox refactor — Plan 26-01 deferred-items.md verified zero-impact (failures existed on main `cefa897` baseline). НЕ блокирует Phase 26 closure.
- **SMOKE_TEST_26.md follows pattern** of SMOKE_TEST_25.md (numbered scenarios A-G + [ ] checkboxes + dev helper callouts + i18n + build chain + regression sanity) — manual QA имеет одинаковый shape across phases (precedent Phases 22-25).
- **Auto-mode checkpoint approval** (Task 3): per `workflow.auto_advance: true` — `checkpoint:human-verify` auto-approved with log `⚡ Auto-approved: SMOKE_TEST_26.md created. Phase 26 final smoke checklist ready for QA.` Manual smoke run может быть выполнен пользователем post-shipping; ROADMAP/STATE финализация не блокируется.
- **ROADMAP.md Phase 26 entry финализирован** (Task 4): 6 plans listed с [x] checkmark, 23 REQ-IDs preserved (Phase 26 plan уже имел их при creation), outcome paragraph с bundle delta + i18n + SMOKE refs. «Last updated» обновлён на «Phase 26 complete».
- **STATE.md frontmatter**: `current_phase: 26 (complete)`, `status: completed`, `progress.total_phases: 15`, `completed_phases: 5`, `total_plans: 42`, `completed_plans: 34`, `percent: 81`. YAML parse-able (T-26-06-02 mitigation verified).
- **Pre-existing user changes** (.DS_Store, public/map0.png, planetMap.json.bak.451): НЕ stage'ились во всех 6 планах Phase 26 (consistent с Phase 25 precedent).
- **Per-plan SUMMARY existence**: ls .planning/phases/26-cosmos-races-foundation/26-0?-SUMMARY.md → все 5 files present (26-01..05 SUMMARY созданы в их respective планах + 26-06 SUMMARY создан этим plan).

### Handoff to Phase 27 (quests)

- 30 habitable planets с stable IDs готовы как quest targets (getPlanetsByRace / getPlanetInhabitant / HABITABLE_PLANET_IDS runtime API).
- Per-race `firstContactsSeen` flag можно extend с per-race quest progress в Phase 27 (`raceQuests: Record<RaceId, QuestId[]>` или подобная shape).
- Inventory tab artifacts/relationships placeholder секции готовы заполниться в Phase 27 (artifacts) / Phase 29 (relationships) — UI surface ready, data wiring deferred.
- eventBus 'cosmos:first-contact' event типизирован — Phase 27 quest controller может подписаться для quest-trigger pattern.
- ConfettiBurst-style cinematic pattern (FirstContactEffect.ts) reusable для quest complete / relationship milestone bursts.
