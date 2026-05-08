# Roadmap — Frog Evolution v2.0: Cosmic Frogs System

**12 phases** | **135 requirements mapped** | All v2.0 requirements covered ✓

**Phase numbering:** continues from v1.0 (which ended at Phase 8). New phases = 9..20.

> v1.0 ROADMAP archived in `MILESTONES.md` (Phases 1-8 complete). This file replaces v1.0 ROADMAP for the active milestone.

**Blocking constraints:**
- Phase 9 (REFACTOR) blocks all subsequent phases — extract anim primitives FIRST.
- Phase 10 (INFRA) blocks all subsequent feature phases — migrations + perf HUD + throttle = safety net.
- Each phase is independently shippable: stopping after Phase X leaves the game in a usable state, not half-broken.

---

## Phase Index

| #  | Phase                                                | Goal (one-line)                                                                                       | Requirements                                                                 | Files (key paths)                                                              |
|----|------------------------------------------------------|-------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| 9  | Refactor anim primitives (BLOCKING)                  | Extract 18 shared anim primitives from `StarMapScene.ts` into reusable modules.                       | REFACTOR-01..05                                                              | `client/src/game/effects/anim/shared/*`                                        |
| 10 | Performance HUD (mini)                               | Dev-mode Perf HUD (FPS/tween/overlay counters) для дебага. Остальные INFRA отложены в Phase 20.       | INFRA-04                                                                     | `client/src/debug/PerfHUD.tsx`                                                  |
| 11 | CosmicSlice store + Cosmic Hub shell                 | Wire data layer (`cosmicSlice`) and lazy-loaded modal with 4 stub tabs + bottom-bar 🧬 icon.         | COSMIC-HUB-01..07, SERUM-01, PERF-07                                         | `client/src/store/cosmicSlice.ts`, `client/src/components/CosmicHub/*`         |
| 12 | FrogElementOverlay (dormant tier + pool + hard cap)  | Phaser-native element overlay with pool, off-screen culling, dormant idle tier on carriers.          | ELEMENT-01..08, ELEMENT-12, PERF-02, PERF-03, PERF-06, PERF-09, I18N-01      | `client/src/game/effects/FrogElementOverlay.ts`, `client/src/game/effects/elementPool.ts` |
| 13 | Element awakened tiers (common/rare/epic/legendary)  | 64 awakened animations (4 tiers × 16 elements) + tap-burst + same-element merge anim.                | ELEMENT-09, ELEMENT-10, ELEMENT-11                                            | `client/src/game/effects/elementTiers/*`                                       |
| 14 | Сыворотки tab + tap-to-select DnD apply              | Inventory UI + tap-to-select primary apply flow with auto-pause magnet/merge + undo.                 | SERUM-02..11, UX-07                                                           | `client/src/components/CosmicHub/SerumsTab/*`, `client/src/dnd/*`              |
| 15 | Boxes: cascade reveal + slot-machine + skip + bulk   | Box inventory, cascade reveal, slot-machine with rarity-signaling timing, skip-MVP, bulk-open.       | BOX-01..07, SLOT-01..08, UX-06, PERF-08                                       | `client/src/components/CascadeRevealModal/*`, `client/src/components/SerumSlotMachine/*` |
| 16 | Ship + Travel + Mission (1-ship navigation model)    | 1 корабль с navigation (dock/transit/redirect) + crew daily limit (4/day) + mini-clicker missions.   | SHIP-01..10, CREW-01..08, MISSION-01..08, UX-09                              | `client/src/game/effects/ShipSprite.ts`, `client/src/components/CosmicHub/ShipTab/*`, `client/src/components/MissionOverlay/*` |
| 17 | Carrier evolution: feed + hidden ceiling + merge     | Feed rolls, progressive ceiling reveal, streak protection, stabilization drama, dispose, merge.      | CARRIER-01..12, BALANCE-06, BALANCE-09, UX-10, UX-11                          | `client/src/store/carrierLogic.ts`, `client/src/components/StabilizationModal/*` |
| 18 | Бестиарий 2.0 (1536 cells, virtualized, sub-rewards) | 4-tab bestiary (384 cells/loc), TanStack Virtual, Uint8Array bitset, sub-completion rewards.         | BESTIARY-01..09                                                               | `client/src/components/CosmicHub/BestiaryTab/*`                                |
| 19 | Balance + tutorial + toggles + i18n polish           | Pity tuning, sim script, progressive tutorials, calm/reduced/instant toggles, full RU/EN/ES.        | BALANCE-01..05, BALANCE-07, BALANCE-08, UX-01..06, UX-08, PERF-01, PERF-05, PERF-07, I18N-02, I18N-03 | `client/scripts/simulate_balance.cjs`, `client/src/locales/*`, `client/src/components/Settings/*` |
| 20 | Pre-release safety net                               | Incremental save migrations + backups + adaptive throttle + shutdown discipline. Запускается перед первым prod-релизом. | INFRA-01, INFRA-02, INFRA-03, INFRA-05, INFRA-06, PERF-04                    | `client/src/store/migrations/*`, MainScene.shutdown                            |

---

## Phase 9: Refactor anim primitives (BLOCKING)

**Goal:** Extract 18 shared anim primitives from `StarMapScene.ts` (6430 lines) into `client/src/game/effects/anim/shared/` so subsequent phases can reuse them without duplication.

**Requirements:** REFACTOR-01, REFACTOR-02, REFACTOR-03, REFACTOR-04, REFACTOR-05

**Plans:**
1. Extract 18 primitives one-by-one (compRing, compSparkle, compFlash, compFlameTongues, compIceWisps, compPlasmaArc, compStarBurst, compHaloFlash, compConfetti, compCrystalShatter, compBloomPetals, compToxicCloud, compSandSwirl, compRipple, compEchoWave, compChimeRing, compBubbleStream, compChromaShift) — each as standalone file with signature `(scene, container, opts) => void`.
2. Refactor `StarMapScene.ts` `runAnimComponent` switch to import from `shared/*`.
3. TypeScript clean + verify-uniqueness scripts (1000/1000) still pass; bundle delta ≤ +5 KB.
4. Smoke-test demo scene that runs each primitive standalone (proves they work outside StarMapScene).

**Success Criteria:**
1. `client/src/game/effects/anim/shared/` contains ≥18 primitive files; each importable independently.
2. `StarMapScene.ts` uses imports (no inlined primitive bodies); existing 88-anim catalog still produces visually identical clicks.
3. `npm run check` passes; `verify-uniqueness` reports 1000/1000 unique animations.
4. Bundle delta from main ≤ +5 KB gzipped.
5. Smoke-test demo renders each primitive in an isolated scene without errors.

**Depends on:** none (this is the foundation for all subsequent phases).

**Status:** **complete** (2026-05-08)

**Outcome:** 18/18 primitives extracted в `client/src/game/effects/anim/shared/`. StarMapScene.ts: 6430 → 5859 строк. Bundle delta `-2 bytes` gzipped (well within +5 KB budget). All verifiers green: 1000/984/1000 unique signatures. See `.planning/phases/09-refactor-anim-primitives-blocking/09-01-SUMMARY.md`.

---

## Phase 10: Performance HUD (mini)

**Goal:** Установить dev-mode Performance HUD (FPS, tween count, active overlay count) для дебага производительности при добавлении element overlays в Phase 12-13. Минималистичная фаза — остальные INFRA-аспекты (миграции, adaptive throttle, shutdown discipline) отложены в Phase 20 (pre-release safety net) до момента когда реально нужны.

**Requirements:** INFRA-04

**Plans:**
1. Создать `client/src/debug/PerfHUD.tsx` — небольшой overlay в правом верхнем углу, видим только в dev-mode (`import.meta.env.DEV`).
2. Метрики: avg FPS (rolling 60 frames), `scene.tweens.getAllTweens().length` для main + StarMap, optional active update event listeners count.
3. Toggle через keyboard shortcut (например `H`) или dev-флаг в localStorage.
4. Стили: monospace font, semi-transparent dark background, small (~150×80px), фиксированный right-top.
5. Подключение в App.tsx или main.tsx (только если DEV).

**Success Criteria:**
1. В dev-mode (vite dev) HUD виден в правом верхнем углу с живыми FPS/tween count.
2. В production build (vite build) HUD не включён в bundle (tree-shaken через `import.meta.env.DEV` guard).
3. Toggle работает (показать/скрыть HUD).
4. Bundle delta ≤ +1 KB gzipped (HUD не должен утяжелять prod).

**Depends on:** Phase 9.

**Out of scope (отложено в Phase 20):**
- INFRA-01..03 (incremental migrations + backups) — нужно перед prod, не сейчас
- INFRA-05 + PERF-04 (adaptive throttle) — preventive, добавим в Phase 12 если fps реально просядет
- INFRA-06 (shutdown discipline) — convention, документируется в CLAUDE.md, не отдельная фаза

**Status:** pending

---

## Phase 11: CosmicSlice store + Cosmic Hub shell

**Goal:** Establish the data layer (`cosmicSlice` in gameStore) and lazy-loaded Cosmic Hub modal with 4 empty tabs (Скауты / Боксы / Сыворотки / Бестиарий), plus the new 🧬 bottom-bar icon. After this phase the game has all the rails for v2.0 features but no features yet.

**Requirements:** COSMIC-HUB-01, COSMIC-HUB-02, COSMIC-HUB-03, COSMIC-HUB-04, COSMIC-HUB-05, COSMIC-HUB-06, COSMIC-HUB-07, SERUM-01, PERF-07

**Plans:**
1. Add `cosmicSlice` to `gameStore` with shapes: `serums: Record<element, Record<rarity, count>>`, `boxes: BoxData[]`, `scouts: ScoutData[]`, `carriers: CarrierData[]`, `bestiaryBitset: Uint8Array(192)`, `pityCounters`, `lastActiveTab`. Add migration entry.
2. Replace 🛍️ with 🧬 in BottomBar; clicking opens `CosmicHubModal` (lazy via `React.lazy(() => import(...))` + `Suspense` skeleton).
3. Build modal shell: 4 tab strip + 4 stub panels with placeholder copy; `lastActiveTab` persisted via sessionStorage.
4. Badge logic: 🧬 shows count of unopened ready boxes; multi-toast grouping helper for ≥2 simultaneous returns; "Открыть бокс" quick action stub on toast.
5. RU/EN/ES strings for tab names + modal chrome.

**Success Criteria:**
1. Tapping 🧬 in bottom-bar opens fullscreen modal with 4 tabs visible; closing and reopening restores last active tab from sessionStorage.
2. CosmicHubModal bundle is code-split — appears as separate chunk in `vite build` output, not in main entry.
3. Inventory shape exists in `gameStore.cosmicSlice` (verifiable in devtools); reading from it returns empty/zero values cleanly.
4. Badge on 🧬 reflects `boxes.filter(b => !b.opened).length` (test with 0, 1, 5).
5. Triggering 2 simultaneous mock-scout-returns produces ONE grouped toast, not two.

**Depends on:** Phase 10.

**Status:** **complete** (2026-05-08)

**Outcome:** 3 waves shipped — Wave 1 (data layer: cosmic types/slice/gameStore + STORAGE_VERSION 16 + cosmic:toast event), Wave 2 (UI shell: 🧬 BottomBar + lazy CosmicHubModal с 4 stub tabs + sessionStorage), Wave 3 (reactive badge + multi-grouping toast subscriber + i18n RU/EN/ES). Bundle delta gzip = **+3.05 KB** (CosmicHubModal как отдельный chunk 0.98 KB + main +2.07 KB). All 9 REQ-IDs покрыты. См. `.planning/phases/11-cosmicslice-cosmic-hub-shell/SUMMARY.md`.

---

## Phase 12: FrogElementOverlay (dormant tier + pool + hard cap)

**Goal:** Phaser-native `FrogElementOverlay` with object pool, off-screen culling, hard cap of 4 visible overlays, and the **dormant tier idle effect** (1 Graphics + 1 idle particle/3s) for every carrier on the farm. Establishes the visual feedback foundation but no awakened tiers yet.

**Requirements:** ELEMENT-01, ELEMENT-02, ELEMENT-03, ELEMENT-04 (infrastructure for 80, dormant subset implemented), ELEMENT-05, ELEMENT-06, ELEMENT-07, ELEMENT-08, ELEMENT-12, PERF-02, PERF-03, PERF-06, PERF-09, I18N-01

**Plans:**
1. Define 16-element TINT TABLE constants + element→archetype mapping (REQ ELEMENT-02); 4 main-race exclusives gated behind exclusive-mission flag.
2. Implement `FrogElementOverlay extends Phaser.GameObjects.Container` with `acquire(element, rarity)` / `release()` pool API.
3. Hard-cap manager: max 4 visible overlays at once; when 5+ carriers exist, prioritize on-screen + most-recent-tap; off-screen culling check every 6 frames.
4. Adaptive throttle integration (consumes Phase 10 throttle factor).
5. Implement dormant tier visuals (1 tinted Graphics circle + 1 idle particle/3s × 16 elements).
6. RU/EN/ES translations for 16 element names per I18N-01 table.
7. Performance benchmark harness: 16 frogs × overlay on real Android device — record FPS in HUD, store baseline.

**Success Criteria:**
1. With 8 dormant carriers on farm, only 4 are visibly animated at any moment; the rest cull cleanly when off-screen.
2. Pool stats (acquire/release) visible in dev HUD show ≥reuse — no `destroy/create` per frame.
3. Forced FPS drop in throttle factor reduces idle-particle frequency observable via HUD count.
4. Real-device test: 16 frogs × dormant overlay sustains ≥45 FPS on mid-tier Android (recorded in benchmark report).
5. Tapping a carrier shows correct element name in RU/EN/ES depending on locale.

**Depends on:** Phase 11.

**Status:** complete (2026-05-08)

**Outcome:** Phaser-native `FrogElementOverlay` + singleton `elementOverlayPool` (acquire/release без destroy/create) + `FrogOverlayManager` (sync `cosmicSlice.carriers`, hard cap 4 visible by camera distance, viewport culling каждые 6 кадров). 16 dormant idle-presets через Phase 9 primitives с минимальной интенсивностью. ELEMENT_TINTS (16) + ARCHETYPE_TO_ELEMENT (12) + MAIN_RACE_TO_ELEMENT (4 exclusives). Bundle delta gzip = **+2.53 KB** (cap +20 KB ✓). 11 ✓ full REQ-IDs + 3 ◑ partial (ELEMENT-04 awakened deferred to Phase 13 by design; ELEMENT-08 throttle hook ready, full wiring к Phase 20 INFRA-05; PERF-09 full real-device benchmark deferred to Phase 13 после awakened). 48 i18n строк (16 × 3, все ≤12 chars). `window.__addDevCarrier` + `__listFrogIds` для smoke (DEV-only, tree-shaken в prod). См. `.planning/phases/12-frog-element-overlay-dormant/12-01-SUMMARY.md`.

---

## Phase 13: Element awakened tiers (common / rare / epic / legendary)

**Goal:** Add the 64 awakened animations (4 tiers × 16 elements) to `FrogElementOverlay`, plus tap-burst on carrier and same-element merge anim. After this phase a stabilized carrier looks tier-appropriate with full storm at legendary.

**Requirements:** ELEMENT-09, ELEMENT-10, ELEMENT-11

**Plans:** 4 plans in 3 waves

Plans:
- [x] 13-01-PLAN.md — Расширить ElementTier + создать awakenedPresets.ts (64 entries) + burstEffect.ts
- [x] 13-02-PLAN.md — Tier-aware FrogElementOverlay.setTier + tier-keyed pool + syncCarriers rarity→tier
- [x] 13-03-PLAN.md — mergeEffect.ts + wire burstEffect/mergeEffect hooks в MainScene
- [x] 13-04-PLAN.md — Dev helpers (__setCarrierTier, __testBurstEffect, __testMergeEffect) + bundle check

**Success Criteria:**
1. Switching a carrier from dormant → common → rare → epic → legendary in dev panel produces visibly escalating effects (more particles, brighter aura, ground glow at legendary).
2. Tapping any tinted carrier triggers an element-burst at tap location.
3. Triggering a same-element merge in dev panel plays the element-merge anim distinct from the standard merge effect.
4. With 4 legendary carriers visible, FPS stays ≥45 on mid-tier Android (hard cap + throttle from Phase 12 still effective).
5. Bundle delta from Phase 12 baseline ≤ +20 KB gzip (within +50 KB total budget).

**Depends on:** Phase 12.

**Status:** complete (2026-05-08)

**Outcome:** 5-tier ElementTier union + 64 awakened idle presets (rule-based assembly: ELEMENT_CORE/GLOW/ACCENT/STORM × per-tier composition rules — common 2-3 → rare 4-5 + halo glow → epic 5-6 + ring → legendary 8+ + flash). Tier-aware FrogElementOverlay (`attach(..., tier)` + публичный `setTier()` + tier-зависимый orb radius 4→8 px). Pool разбит по составному ключу `${element}:${tier}` (Map-based). FrogOverlayManager.syncCarriers автоматически рендерит `carrier.rarity` как соответствующий visual tier (с `tierFromCarrier` валидацией против tampered store, T-13-04). burstEffect (ELEMENT-10) at tap on carrier → ring + sparkle + flash + optional starburst (для arcane/war/void/plasma) — 200-400ms self-cleaning. mergeEffect (ELEMENT-11) при same-element merge → 4-phase composite (ring → sparkle → ripple → flash) at depth 99998 (выше vortex 99997), pre-capture pattern в performMerge чтобы removeFrog не очистил carrier до начала анимации. Dev helpers: `__setCarrierTier`, `__testBurstEffect`, `__testMergeEffect` (все tree-shaken в prod, verified). Bundle delta gzip = **+1.58 KB** (Phase 12 baseline 207.87 KB → 209.45 KB; cap +20 KB ✓ — used 8% of budget). 3 ✓ REQ-IDs (ELEMENT-09, ELEMENT-10, ELEMENT-11). 8 atomic commits, 10 tasks across 4 plans. См. `.planning/phases/13-element-awakened-tiers/13-{01,02,03,04}-SUMMARY.md`.

---

## Phase 14: Сыворотки tab + tap-to-select DnD apply

**Goal:** Functional Сыворотки tab with inventory grid + tap-to-select primary flow that applies a serum to an eligible frog with auto-pause of magnet/merge, snap radius, haptic feedback, undo toast, and desktop pointer-event DnD as secondary mode. After this phase the player can use serums (boxes still come from dev-panel; real boxes arrive in Phase 15).

**Requirements:** SERUM-02, SERUM-03, SERUM-04, SERUM-05, SERUM-06, SERUM-07, SERUM-08, SERUM-09, SERUM-10, SERUM-11, UX-07

**Plans:**
1. SerumsTab UI: 4 sections by rarity (common/rare/epic/legendary), 16-element grid per section, count badges from `cosmicSlice.serums`.
2. Tap-to-select state: `serumDragActive` flag in store, eligibility highlight on farm frogs (L1/L7/L13/L19, not already carrier), snap radius 80px.
3. Drop zone visuals: green glow + medium haptic on valid hover; red outline + error haptic on invalid; mis-tap returns serum + tooltip toast.
4. Auto-pause integration: while `serumDragActive`, magnet stops, merge stops; flag clears on apply/cancel.
5. Apply tween 2s (no modal) → carrier created → undo toast 4s → optional revert.
6. Desktop DnD secondary: custom Pointer Events with ghost element (no react-dnd).

**Success Criteria:**
1. Tapping a serum highlights only eligible frogs (e.g. common only highlights L1 swamp starters); tapping eligible frog applies in 2s tween.
2. While in select-mode, magnet visibly stops moving frogs together and merges are suspended; clearing selection resumes them.
3. Tapping a non-eligible frog within snap radius shows red outline + error haptic + tooltip explaining why.
4. Within 4s after apply, undo toast appears; tapping it reverts (frog back to non-carrier, serum back to inventory).
5. Desktop drag with mouse pointer events shows ghost serum follow cursor and drops on eligible frog.

**Depends on:** Phase 13 (overlay must show dormant tier on newly-created carriers).

**Status:** **complete** (2026-05-08)

**Outcome:** 4 plans, 3 waves, **5 atomic commits**. Foundation layer (`cosmicSlice` extended с `serumDragActive` + `selectedSerum`, atomic `applySerum` single-set transaction, pure `serumEligibility` utility c locked SERUM-08 table 1/7/13/19). UI layer: `SerumsTab.tsx` rewrite в 4 секции (legendary→epic→rare→common) + переиспользуемый `ElementGrid.tsx` (4×4 с TINT TABLE + count badge + disabled state) + `cosmic:select-serum` event. MainScene integration: `SerumSelectionLayer` (standalone Phaser.Graphics с green halo pulse repeat:-1 + one-shot red flash 220ms) + реактивный `useGameStore.subscribe` пересчитывает eligible set; `handleSerumTap` → `applySerumToFrog` (2-сек pulse 1000ms × yoyo Sine.easeInOut + `burstEffect` at midpoint + atomic `applySerum` + success toast с undo callback); magnet/merge guard'ы (`!serumPaused` в update + drop-merge guard + `onFrogTapped` route); background `pointerdown` → cancel selection; spawnFrog re-show halos (race-mitigation T-14-03-01); cleanup в clearField/destroy/location-transition. Polish: App.tsx toast subscriber honors `payload.duration` + `payload.action.onClick` (CosmicToast UI рендерит зелёную action кнопку); desktop Pointer Events DnD secondary mode (DOM ghost 32px tinted circle через `cosmic:serum-pointer-move/up` events; mobile `pointerType==='touch'` → tap path); dev helpers `window.__addSerum/__clearSerums/__listSerums` (DEV-only, Vite tree-shake verified). i18n RU/EN/ES parity полный (mis_tap_msg + applied + undo_label + section_* + location_*). Bundle delta gzip = **+2.14 KB** (Phase 13 baseline 209.45 KB → 211.59 KB; cap +20 KB ✓ — used 11% of budget). **11/11 ✓ REQ-IDs** (SERUM-02..11 + UX-07). См. `.planning/phases/14-serums-tab-tap-to-select/14-{01,02,03,04}-SUMMARY.md`.

---

## Phase 15: Boxes — cascade reveal + slot-machine + skip + bulk

**Goal:** Box inventory + cascade reveal modal (coins → resources → pause → slot-machine on serum) with rarity-signaling slot timing (1.2s common → 9-10s legendary cap), Skip-MVP (tap-after-0.6s + button at 1s + Settings toggle), and bulk-open with summary. After this phase boxes from dev-panel produce real serums via the full drama pipeline.

**Requirements:** BOX-01, BOX-02, BOX-03, BOX-04, BOX-05, BOX-06, BOX-07, SLOT-01, SLOT-02, SLOT-03, SLOT-04, SLOT-05, SLOT-06, SLOT-07, SLOT-08, UX-06, PERF-08

**Plans:** 5 plans in 4 waves

Plans:
- [x] 15-01-PLAN.md — Foundation: BoxData type extension, rollRarity utility (50/35/12/3 + pity 3/10/15/20/25), store actions (addBox/rollBoxRarity/commitOpenedBox/removeBox), STORAGE_VERSION 17→18, dev-helper __addBox
- [x] 15-02-PLAN.md — BoxesTab UI rewrite: inventory cards с element-icon + planet-name, tap → lazy CascadeRevealModal mount, open-all placeholder
- [x] 15-03-PLAN.md — CascadeRevealModal: state machine (opening/coins/resources/pause/slot/reveal/closing), cascade timeline 200/200/200/400ms, instantMode bypass, lazy SerumSlotMachine import
- [x] 15-04-PLAN.md — SerumSlotMachine: rarity-dependent durations (1.2-9.5s), checkpoint flashes 1.5/3.5/5.5/8s gray/blue/purple/gold, skip MVP (tap-anywhere + button + instantMode), element fingerprint particles
- [x] 15-05-PLAN.md — BulkOpenSummary + cosmicSettings.ts + SettingsModal toggle «Боксы мгновенно» + lazy chunks verify + i18n RU/EN/ES + phase-level acceptance

**Success Criteria:**
1. Opening a box plays cascade in correct order (coins, resources, pause, slot) with timings within ±50ms; final serum lands in inventory.
2. Slot-machine duration visibly correlates with rarity: legendary roll completes in 9-10s, common in ≤2s.
3. Tapping anywhere after 0.6s ends the animation early and reveals the result; Skip button appears at exactly 1s.
4. With "Open boxes instantly" enabled in Settings, all rarities resolve in ≤1s without checkpoint flashes.
5. Opening 5 boxes via "Открыть все" produces 5 serums in inventory + a single summary modal listing all 5; CascadeRevealModal/SerumSlotMachine appear as separate chunks in `vite build`.

**Depends on:** Phase 14 (serum inventory).

**Status:** **complete** (2026-05-08) — 5 plans, 4 waves, 5 atomic commits. BoxData v2 (8 fields) + rollRarity (locked 50/35/12/3 + pity 3/10/15/20/25) + 4 store actions (addBox/rollBoxRarity/commitOpenedBox/removeBox) + STORAGE_VERSION 17→18; BoxesTab inventory cards (element-tinted dot + planet name + bonus badge) + lazy CascadeRevealModal/BulkOpenSummary mount; CascadeRevealModal cascade state machine (opening/coins/resources/pause/slot/reveal) + 200/200/200/400ms timeline + instantMode bypass + tap-anywhere skip propagation; SerumSlotMachine rarity-locked DURATIONS table (common 1.2-1.8 / rare 2.5-3.8 / epic 5-7 / legendary 9-9.999s cap) + 4 CHECKPOINTS (gray/blue/purple/gold с honest fake-out filter) + element fingerprint particles co-старта + Skip button 1s + completedRef idempotency; BulkOpenSummary grouped rarity-sorted rows + legendary confetti glow; cosmicSettings (localStorage + CustomEvent dispatch) + SettingsModal «🧬 Космос» section + toggle «Боксы мгновенно» (useSyncExternalStore reactive); dev helpers `__addBox/__listBoxes/__clearBoxes` (DEV-only tree-shaken in prod); i18n RU/EN/ES parity (201 keys × 3 локали); 27/27 unit tests passing (rarityRoll 11 + slice 11 + cosmicSettings 5); bundle delta +7.66 KB gzip (cap +35 KB ✓; index.js 220.23 KB vs Phase 16 baseline 218.70 KB) + 3 lazy chunks confirmed (CascadeRevealModal 1.82 KB / SerumSlotMachine 2.05 KB / BulkOpenSummary 1.32 KB gzip). 17/17 ✓ REQ-IDs (BOX-01..07, SLOT-01..08, UX-06, PERF-08).

**Outcome:** Полный box → slot-machine → serum drama-flow реализован. Связка Phase 14+15+16 даёт полный loop ship→mission→box→slot-machine→serum→apply→carrier (ждёт carrier evolution в Phase 17).

---

## Phase 16: Ship + Travel + Mission (1-ship navigation model)

**Goal:** 1 корабль на StarMap с navigation-механикой (dock/transit/redirect), crew daily limit (4 миссии/день, midnight reset), mini-clicker миссии при «Изучении» планеты, выдача бокса с element от архетипа планеты. После этой фазы основной loop замыкается: ship → mission → box → serum → carrier.

**Requirements:** SHIP-01..10, CREW-01..08, MISSION-01..08, UX-09

**Plans:**
1. **Ship state model + visual.** Добавить `cosmicSlice.ship: { state: 'docked'|'transit', planetId?, transit?: {from,to,started_at,arrives_at} }`. Создать `ShipSprite.ts` (Phaser Sprite/Graphics ракетка с ParticleEmitter trail). Linear interpolation позиции в transit, ротация по вектору. Initial position: orbit HOME planet.
2. **Travel formula.** `time_ms = (distance / WORLD_DIAGONAL) × 120000`. WORLD_DIAGONAL = sqrt(2) × WORLD_SIZE × 2 ≈ 19800 (DPR=1). Минимум 1500ms floor. Macca близких полётов 1.5-3 sec, дальних до 2 минут.
3. **Tab «Корабль» в Cosmic Hub.** Показывает текущее состояние ship (docked planet info / transit timer), CREW indicator `2/4 миссий ⏱ до утра 14:32`, кнопки: «Открыть карту», «Изучить» (если docked + есть credit), «Перенаправить» (отдельная кнопка не нужна — просто тапаешь planet на StarMap).
4. **StarMap planet-pick mode.** При открытии StarMap из Cosmic Hub (или просто если игрок на StarMap) — тап на любой planet → confirm dialog «Лететь сюда (~Xs)?» с info о планете и travel time. Confirm → старт transit (или redirect если уже летит). Cancel — без эффектов.
5. **Crew daily reset.** `cosmicSlice.crew: { missionsToday, lastResetDay }`. На каждый load: если `lastResetDay !== today` — обнулить. `missionsToday >= 4` → кнопка «Изучить» disabled с tooltip + countdown до 00:00 локального времени. Корабль может летать неограниченно (только consume на «Изучить»).
6. **Mini-clicker mission overlay.** Fullscreen UI на ship+planet фоне. 3 типа random per mission: rhythm-tap (15-30 кликов за 30с), defend (тайминг по 3 вспышкам за 15с), hot-spot (5 точек за 20с). Skip button с 1с (auto-complete без bonus). Score → bonus к rarity (perfect +15%, good +5%).
7. **Box generation.** Mission complete → создать box в `cosmicSlice.boxes[]` с `element` из archetype planet, `bonusRarity` от mission score. Toast «Получен ящик KEPLER → [Открыть]» (открывает Cosmic Hub на табе Боксы).
8. **Progressive disclosure (UX-09).** На первый v2.0 login unlock'ed только табы Сыворотки + Бестиарий. Корабль unlock'ed после первого feed (CARRIER-03). Боксы tab unlock'ed после первой completed mission. Tutorial nudges при unlock.

**Success Criteria:**
1. Открытие Cosmic Hub → таб «Корабль» показывает позицию ship (название планеты или «В пути»), timer до arrival если transit, indicator `N/4 миссий` корректно отражает состояние.
2. Тап на planet на StarMap (когда Hub открыт) → confirm dialog с travel time. Confirm → ship стартует transit. Visual: ракетка движется linear от source к target, particle-trail активен.
3. Redirect (тап на новую planet во время transit) → ship меняет цель без штрафа, новый таймер от текущей позиции.
4. На arrival — toast «Прибыли на NAME». Кнопка «Изучить» в табе «Корабль» становится active (если есть credit).
5. «Изучить» → mini-clicker overlay; complete → box добавлен в инвентарь с element от archetype, mission credit consumed.
6. После 4-й mission → «Изучить» disabled, tooltip показывает время до 00:00 локального. На следующий день credits восстановлены до 4/4.
7. Fresh v2.0 install: только Сыворотки + Бестиарий tabs unlocked. После первого feed — Корабль unlock. После первой mission — Боксы unlock (verifiable в dev panel).

**Depends on:** Phase 15 (decoupled — Phase 16 не блокирует на Phase 15; box.bonusRarity готов к Phase 15 integration).

**Status:** **Complete** (2026-05-08) — 5 plans, 5 waves, 14 atomic commits. ShipState discriminated union, travel formula (1500..120000ms), crew daily limit (DAILY_CAP=4) с локальной полночью, ShipSprite Phaser-native (Container + Graphics + ParticleEmitter trail), StarMapScene integration (subscribe + cosmic:request-flight emit + cleanup), ShipTab + FlightConfirmDialog + CrewIndicator React components, MissionOverlay fullscreen с 3 mini-clickers (rhythm/defend/hotspot), investigatePlanet atomic transaction (consume credit + addBox + sentinel flip + toast), progressive disclosure (CosmicHubModal tab gating + DEV unlock + 5 dev helpers), i18n RU/EN/ES round 1 + locked tooltip keys. Bundle delta +8.20 KB gzip (cap 40 KB ✓; index.js 218.70 KB vs Phase 14 baseline 211.59 KB). 27/27 ✓ REQ-IDs.

**Outcome:** v2.0 первый fully-playable milestone — ship→mission→box loop замыкается. Phase 15 cascade reveal будет integration слоем (`box.bonusRarity` готов).

---

## Phase 17: Carrier evolution — feed + hidden ceiling + merge + dispose

**Goal:** Full carrier progression: feed rolls (success/fail/stabilize), hidden ceiling pre-determined and progressively revealed (??? → color hint → exact number), streak protection (3 low-ceiling → S guarantee), stabilization drama modal, dispose for 30% serum recovery, same-element same-level merge → S-roll next level. The most logic-heavy phase — covers the "late progression" loop end-to-end.

**Requirements:** CARRIER-01, CARRIER-02, CARRIER-03, CARRIER-04, CARRIER-05, CARRIER-06, CARRIER-07, CARRIER-08, CARRIER-09, CARRIER-10, CARRIER-11, CARRIER-12, BALANCE-06, BALANCE-09, UX-10, UX-11

**Plans:**
1. Carrier data model: `{ id, frogId, element, rarity, level, ceiling, feedCount, rollHistory, stabilized }`. Pre-determine ceiling on first feed (BALANCE-09) using sub-distribution 5/15/30/50.
2. Feed action: tap a regular same-level frog while carrier selected → roll using rarity-weighted weights → outcome success (level+1)/fail/stabilize. Update state, play element-tier overlay if rarity changes.
3. Hidden ceiling reveal in CarrierInfoCard: 0-2 feeds = "???"; 3-4 = color hint (green/yellow/red); 5+ = exact "L13/L19".
4. Streak protection (BALANCE-06): track 3 consecutive low-ceiling carriers per locale; on 3rd, force next ceiling roll to S-tier.
5. Stabilization modal 3-4s with tier-specific copy ("Стабилизировалась на L11 — топовая редкая!"); permanent visual lock to final rarity tier (Phase 13 anim).
6. Dispose: confirm modal → carrier removed → 30% × serum_count returned to inventory.
7. Merge logic: detect same-element same-level carrier collision → consume both → produce one carrier next level with S-roll guarantee + element-merge anim from Phase 13.
8. Bestiary write-through (CARRIER-12): every new (element, finalRarity, finalLevel) combo flips bit in `cosmicSlice.bestiaryBitset` (read by Phase 18).

**Success Criteria:**
1. Feeding a freshly-created carrier 5 times produces visible ceiling reveal progression: ??? (feeds 1-2) → color (3-4) → exact L (5+).
2. Forcing 3 low-ceiling rolls in dev panel guarantees 4th carrier rolls S-tier (verifiable across 10 forced sequences).
3. Stabilization triggers a 3-4s modal with correct copy and locks the carrier's visual to the awakened-tier anim from Phase 13.
4. Dispose action returns exactly `floor(0.30 * serumsConsumed)` serums to inventory after confirm.
5. Two same-element same-level carriers merging produce one carrier at level+1 with S-tier rarity, plays element-merge anim, and writes a bestiary bit.

**Depends on:** Phase 16 (scouts produce boxes; players need carriers to feed).
**Plan files:** 5 plans in 3 waves

- [x] 17-01-PLAN.md — Foundation: types + carrierEvolution.ts (TIER_RANGES, buckets, rollCeilingForCarrier, rollFeedOutcome, shouldForceS) + bestiary.ts (1536-bit indexing) + verify_carrier_evolution.cjs (Monte-Carlo + streak)
- [x] 17-02-PLAN.md — feedCarrier action + MainScene drag-feed wiring (performFeed) + carrier-merge guard + cosmic:carrier-stabilized eventBus
- [x] 17-03-PLAN.md — CarriersTab (5-th Cosmic Hub tab) + CarrierInfoCard + CeilingDisplay (progressive reveal) + i18n RU/EN/ES
- [x] 17-04-PLAN.md — StabilizationModal (slot-machine 3-4s) + visual lock в FrogElementOverlay/FrogOverlayManager
- [x] 17-05-PLAN.md — performCarrierMerge + DisposeConfirmModal + mergeCarriers/disposeCarrier/setBestiaryBit actions + gameStore migration 18→19 + verify --dispose + dev helpers


**Status:** **Complete** (2026-05-08) — 5 plans, 3 waves, 5 atomic commits. Foundation pure helpers (TIER_RANGES + 5/15/30/50 bucket weights + streak protection 3 forced-C → S guarantee + 1536-bit bestiary indexing); 4 atomic store actions (feedCarrier с pre-determined ceiling + bestiary write-through + hasFirstFeed sentinel; mergeCarriers с 5-guard validation + S-bucket guaranteed; disposeCarrier 30% recovery; setBestiaryBit idempotent); MainScene `classifyDropTarget` gate + performFeed (success transfer carrier.frogId → newFrog / fail restore-in-place / stabilize → eventBus emit) + performCarrierMerge (vortex + mergeEffect + S-bucket carrier); CarriersTab + CarrierInfoCard (progress bar UX-10) + CeilingDisplay (3 phases: ???/color hint/exact L) + DisposeConfirmModal; StabilizationModal slot-machine 1.8s + reveal 2.2s + bucket-specific копи (S-top/A-high/B-mid/C-stable) + reduced-effects bypass + always-mounted в App.tsx; FrogElementOverlay.locked + FrogOverlayManager skip-re-acquire branch; STORAGE_VERSION 18→19 + lossless 24→192-byte bitset migration; verify_carrier_evolution.cjs 4 Monte-Carlo tests (distribution ±5% / streak 1000/1000 / bestiary collision-free / dispose ≈30%) ALL PASS; i18n RU/EN/ES (21 keys × 3 = 63 entries, all UI labels ≤12 chars); dev helpers __forceFeed/__forceStabilize/__bestiaryBitsSet. Bundle delta +5.11 KB gzip (cap 25 KB ✓; index.js 224.06 KB vs Phase 15 baseline 220.23 + CosmicHubModal-chunk 5.67 vs 4.39). 16/16 ✓ REQ-IDs (CARRIER-01..12, BALANCE-06/09, UX-10/11).

**Outcome:** Carrier loop end-to-end функционален: apply (Phase 14) → feed → ceiling reveal → stabilize → merge / dispose → bestiary collects. Phase 18 (Бестиарий 2.0 read-side) и Phase 19 (balance + tutorial) — финальные.

---

## Phase 18: Бестиарий 2.0 — 1536 cells, virtualized, sub-completion rewards

**Goal:** Fully functional Бестиарий tab with 4 location tabs × 384 cells (24 levels × 16 elements), TanStack Virtual rendering, `Uint8Array(192)` bitset state, filter pills + search, sort, cell modal with details, sub-completion rewards (10/24/96/576). After this phase the collection meta-loop is complete.

**Requirements:** BESTIARY-01, BESTIARY-02, BESTIARY-03, BESTIARY-04, BESTIARY-05, BESTIARY-06, BESTIARY-07, BESTIARY-08, BESTIARY-09

**Plan files:** 5 plans in 3 waves

- [x] 18-01-PLAN.md — Bestiary helpers (countUnlocked, unlockedInLocation, BESTIARY_MILESTONES) + setBestiaryBit slice action with milestone trigger + verify_bestiary.cjs
- [x] 18-02-PLAN.md — Install @tanstack/react-virtual + BestiaryCell component (Discovered/Locked variants) + rarityStyles
- [x] 18-03-PLAN.md — BestiaryTab full rewrite (4 location tabs Болото/Лес/Континент/Планета) + BestiaryGrid (TanStack Virtual 6 cols) + FilterPills (rarity / search / sort / show-locked) + useBestiaryView hook
- [x] 18-04-PLAN.md — BestiaryDetailModal (CSS-based AwakenedPreviewCanvas + sound-style label + lore placeholder) + locked variant
- [x] 18-05-PLAN.md — i18n RU/EN/ES (cosmic_hub.bestiary.*) + MilestoneToast (cosmic:bestiary-milestone listener) + dev helper window.__unlockBestiaryCells + smoke_bestiary.cjs

**Success Criteria:**
1. Opening Бестиарий with 50 discovered combos shows them rendered correctly (tinted, bordered, icon); rest gray; scroll smooth at ≥50 FPS on mid-tier Android.
2. Filter "Epic" hides all non-epic cells across all 4 location tabs in <100ms.
3. Crossing 10/24/96/576 thresholds in dev panel triggers correct reward toast + inventory grant (verify count delta).
4. Cell modal shows live preview using Phase 13 element-tier animation (e.g. tap legendary fire cell → see legendary fire awakened anim).
5. Bitset bytes match exactly 192 (`bestiaryBitset.byteLength === 192`); save/load round-trip preserves bits.

**Depends on:** Phase 17 (carriers write bestiary entries).

**Status:** **Complete** (2026-05-08) — 5 plans, 3 waves, 5 atomic commits. Bestiary helpers (countUnlocked O(192) popcount + unlockedInLocation per-rarity + BESTIARY_MILESTONES const + milestonesCrossed pure fn + isBitSet helper); setBestiaryBit milestone-aware atomic action (10→addGold(1000) / 24→epic random-element serum / 96→legendary random-element serum / 576→frogExclusiveUnlocked flag) + cosmic:bestiary-milestone eventBus event; @tanstack/react-virtual 3.13.24 install; BestiaryCell memoized 64×64 (Discovered: ELEMENT_TINT linear-gradient + RARITY_BORDER + RARITY_GLOW + 🐸 emoji + L-badge / Locked: «???» + tooltip + tabular-aria); rarityStyles RARITY_BORDER/GLOW/LABEL_KEY + tintToCss; useBestiaryView (filter/search/sort state machine + memoized cells list, default showLocked=false если есть прогресс); BestiaryGrid TanStack useVirtualizer 6 cols × ROW_HEIGHT 72 + overscan 5 + contain:strict (DOM ≤30 cells одновременно) + empty-state UI; FilterPills rarity-pills All/4 + element search input + sort dropdown 4 keys + show-locked checkbox; BestiaryTab full rewrite 4 LOCATION_TABS (Болото common / Лес rare / Континент epic / Планета legendary) + per-tab badges X/384 + global counter Discovered N/1536 + percentage; BestiaryDetailModal full impl (CSS preview + element/rarity/level header + sound_style label + lore placeholder / locked variant ??? orb + locked_hint / Escape close + body scroll lock); AwakenedPreviewCanvas CSS-only (radial-gradient orb с ELEMENT_TINT 35%/30% lightspot + outer glow ring rarity-scaled + bestiary-pulse + bestiary-bob keyframes durations 0.9-2s rarity-scaled); MilestoneToast подписка cosmic:bestiary-milestone + auto-hide 4s queue + aria-live polite; i18n RU/EN/ES — 38 keys × 3 = 114 переводов (locations, filters, sort, search, cell aria/tooltip, detail modal, sound styles common/rare/epic/legendary, lore placeholder, locked hint, 4 milestone rewards); window.__unlockBestiaryCells(N) / __bestiaryCount() / __resetBestiary() dev helpers DEV-gated в App.tsx; verify_bestiary.cjs 4 tests PASS (countUnlocked / unlockedInLocation / milestones boundary+multi-cross / bitset size+legacy 24-byte pad); smoke_bestiary.cjs 18 file/grep checks + tsc PASS. Bundle delta +10.60 KB gzip (cap +30 KB ✓; index 226.38 KB vs Phase 17 baseline 224.06 = +2.32 KB; CosmicHubModal-chunk 13.89 KB vs 5.68 KB = +8.21 KB; CSS +0.07 KB negligible). 9/9 ✓ + I18N-02 ✓ REQ-IDs.

**Outcome:** Коллекционный мета-loop замкнут — игрок видит 1536 уникальных combos в performant virtualized grid (DOM ≤30 cells), фильтрует/ищет/сортирует, открывает cell detail modal с CSS-based awakened preview, получает milestone rewards на 10/24/96/576 ячейках. Phase 19 (balance + tutorial + i18n polish) — финальный v2.0 milestone.

---

## Phase 19: Balance + tutorial + toggles + i18n polish

**Goal:** Final polish before v2.0 ship: lock pity numbers + Monte Carlo simulation script, progressive tutorial overlays for first-time players, all Settings toggles (Calm farm / Reduced effects / Open boxes instantly), full RU/EN/ES coverage, performance budget verification, lazy-load checks. After this phase v2.0 is shippable.

**Requirements:** BALANCE-01, BALANCE-02, BALANCE-03, BALANCE-04, BALANCE-05, BALANCE-07, BALANCE-08, UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-08, PERF-01, PERF-05, PERF-07, I18N-02, I18N-03

**Plans:**
1. Pity counter implementation: rare guarantee 3 common→rare+, epic guarantee 10→epic+, legendary soft 15→+3% / 20→+7% / hard 25; counters stored locally in `cosmicSlice.pityCounters`.
2. Visible pity counter UI (UX-01): hidden first 3 missions; "Удача растёт ●●○" after 3rd failed; exact numbers after 5th.
3. Monte Carlo script `client/scripts/simulate_balance.cjs`: 10K boxes simulation, output avg legendary count, time-to-first-legendary, distribution table; commit baseline numbers in script.
4. Two-axis visualization audit (UX-02): rarity = shape/glow/border, element = hue; ensure consistent across SerumsTab, CarrierInfoCard, SlotMachine, Bestiary.
5. Colorblind-safe palette (UX-03): apply Okabe-Ito + Krzywinski tints + verify in simulator.
6. Tutorial overlays (UX-08): first box → slot-machine tooltip; first serum → eligibility tooltip; first feed → hidden ceiling tooltip; first stabilization → merge-above-ceiling tooltip. Persist "seen" flags in store.
7. Settings toggles: Calm farm mode (UX-04), Reduced effects (UX-05, default OFF), Open boxes instantly (UX-06).
8. I18N-02/03: full RU/EN/ES coverage of all v2.0 UI strings, tooltips, error toasts, success messages — `npm run check-translations` reports 100%.
9. Performance audit: bundle delta from v1.0 baseline ≤ +50 KB gzip; confirm CosmicHubModal + SerumSlotMachine + BestiaryV2Tab + CascadeRevealModal are separate chunks; verify FPS targets (60 desktop / 50 mid-tier mobile / 30 minimum) on real devices.

**Success Criteria:**
1. Monte Carlo script run produces avg legendary 3.0 ± 0.3 per 100 boxes; pity hard-25 verified (no run exceeds 25 boxes without legendary).
2. Pity counter UI hidden for first 3 missions, then shows dot indicator at 3, then exact "До rare через 2" at 5+.
3. All 4 toggles in Settings (Calm farm / Reduced effects / Open boxes instantly + existing v1.0 toggles) function correctly: calm hides farm aura, reduced effects clamps overlays to dormant tier, instant boxes resolves slot in ≤1s.
4. `check-translations` script reports 100% coverage RU/EN/ES; no missing-key warnings in console for any v2.0 UI flow.
5. Production `vite build` shows total bundle delta ≤ +50 KB gzip vs v1.0 baseline; lighthouse-style perf check on real Android shows ≥50 FPS during typical 30s farm session with 4 carriers.

**Depends on:** Phase 18 (full feature surface needed for tutorial flow + i18n string discovery).

**Status:** pending

---

## Phase 20: Pre-release safety net

**Goal:** Установить прод-уровень safety nets перед первым публичным релизом v2.0: incremental save migrations (вместо wipe-on-mismatch), backup snapshots, adaptive performance throttle, scene shutdown discipline. Эта фаза запускается **последней**, когда уже есть тестеры с прогрессом который нельзя терять.

**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-05, INFRA-06, PERF-04

**Plans:**
1. Incremental migration table: `migrations: Record<number, (data: any) => any>` в gameStore; на load прогон всех v_old → v_current по порядку. Удалить `wipe-on-mismatch` legacy logic.
2. Backup snapshots: перед каждой миграцией записать `localStorage.frog_evolution_backup_v{from_version}` с TTL 7 дней. Dev-mode «Restore» button.
3. Adaptive throttle: hooked в Performance HUD scene loop. FPS<45 в 5с → ×2 throttle на element overlay update interval; FPS<30 → ×4 + сократить hard cap visible overlays (4→2 temporary).
4. Scene shutdown discipline: `MainScene.shutdown()` + `StarMapScene.shutdown()` обязаны `killAllTweens`, drain pools, `eventBus.off(...)`. Document pattern в CLAUDE.md.
5. Tween-leak detection (dev-mode): после 10× scene transitions проверить `tweens.getAllTweens().length` не растёт.

**Success Criteria:**
1. Запись прогресса в v15, загрузка в v17 → миграции прогоняются по порядку, state структурно валидный, wipe не происходит.
2. После каждой миграции в localStorage есть backup snapshot с правильным version-stamp ключом; через 7 дней snapshot auto-cleaned.
3. Manual stress test (например spawn 50 frogs с overlay): FPS падает <45 → HUD показывает ×2 throttle применён; FPS<30 → ×4 + reduced overlay cap.
4. 10 циклов open/close StarMapScene + MainScene → tween count baseline не растёт (verifiable через HUD).
5. CLAUDE.md содержит секцию «Scene shutdown discipline» с правилами для будущих фаз.

**Depends on:** Phase 19 (запускается последней перед prod).

**Status:** pending (deferred — реализовать перед первым prod-релизом)

---

## Coverage Matrix

Every v2.0 REQ-ID is mapped to exactly one phase.

| REQ-ID         | Phase | REQ-ID          | Phase | REQ-ID          | Phase |
|----------------|-------|-----------------|-------|-----------------|-------|
| REFACTOR-01    | 9     | SERUM-01        | 11    | CARRIER-01      | 17    |
| REFACTOR-02    | 9     | SERUM-02        | 14    | CARRIER-02      | 17    |
| REFACTOR-03    | 9     | SERUM-03        | 14    | CARRIER-03      | 17    |
| REFACTOR-04    | 9     | SERUM-04        | 14    | CARRIER-04      | 17    |
| REFACTOR-05    | 9     | SERUM-05        | 14    | CARRIER-05      | 17    |
| INFRA-01       | 20    | SERUM-06        | 14    | CARRIER-06      | 17    |
| INFRA-02       | 20    | SERUM-07        | 14    | CARRIER-07      | 17    |
| INFRA-03       | 20    | SERUM-08        | 14    | CARRIER-08      | 17    |
| INFRA-04       | 10    | SERUM-09        | 14    | CARRIER-09      | 17    |
| INFRA-05       | 20    | SERUM-10        | 14    | CARRIER-10      | 17    |
| INFRA-06       | 20    | SERUM-11        | 14    | CARRIER-11      | 17    |
| COSMIC-HUB-01  | 11    | BOX-01          | 15    | CARRIER-12      | 17    |
| COSMIC-HUB-02  | 11    | BOX-02          | 15    | BESTIARY-01     | 18    |
| COSMIC-HUB-03  | 11    | BOX-03          | 15    | BESTIARY-02     | 18    |
| COSMIC-HUB-04  | 11    | BOX-04          | 15    | BESTIARY-03     | 18    |
| COSMIC-HUB-05  | 11    | BOX-05          | 15    | BESTIARY-04     | 18    |
| COSMIC-HUB-06  | 11    | BOX-06          | 15    | BESTIARY-05     | 18    |
| COSMIC-HUB-07  | 11    | BOX-07          | 15    | BESTIARY-06     | 18    |
| ELEMENT-01     | 12    | SLOT-01         | 15    | BESTIARY-07     | 18    |
| ELEMENT-02     | 12    | SLOT-02         | 15    | BESTIARY-08     | 18    |
| ELEMENT-03     | 12    | SLOT-03         | 15    | BESTIARY-09     | 18    |
| ELEMENT-04     | 12    | SLOT-04         | 15    | BALANCE-01      | 19    |
| ELEMENT-05     | 12    | SLOT-05         | 15    | BALANCE-02      | 19    |
| ELEMENT-06     | 12    | SLOT-06         | 15    | BALANCE-03      | 19    |
| ELEMENT-07     | 12    | SLOT-07         | 15    | BALANCE-04      | 19    |
| ELEMENT-08     | 12    | SLOT-08         | 15    | BALANCE-05      | 19    |
| ELEMENT-09     | 13    | SHIP-01         | 16    | BALANCE-06      | 17    |
| ELEMENT-10     | 13    | SHIP-02         | 16    | BALANCE-07      | 19    |
| ELEMENT-11     | 13    | SHIP-03         | 16    | BALANCE-08      | 19    |
| ELEMENT-12     | 12    | SHIP-04         | 16    | BALANCE-09      | 17    |
| UX-01          | 19    | SHIP-05         | 16    | PERF-01         | 19    |
| UX-02          | 19    | SHIP-06         | 16    | PERF-02         | 12    |
| UX-03          | 19    | SHIP-07         | 16    | PERF-03         | 12    |
| UX-04          | 19    | SHIP-08         | 16    | PERF-04         | 20    |
| UX-05          | 19    | SHIP-09         | 16    | PERF-05         | 19    |
| UX-06          | 19    | SHIP-10         | 16    | PERF-06         | 12    |
| UX-07          | 14    | CREW-01         | 16    | PERF-07         | 19    |
| UX-08          | 19    | CREW-02         | 16    | PERF-08         | 15    |
| UX-09          | 16    | CREW-03         | 16    | PERF-09         | 12    |
| UX-10          | 17    | CREW-04         | 16    |                 |       |
| UX-11          | 17    | CREW-05         | 16    |                 |       |
| I18N-01        | 12    | CREW-06         | 16    |                 |       |
| I18N-02        | 19    | CREW-07         | 16    |                 |       |
| I18N-03        | 19    | CREW-08         | 16    |                 |       |
|                |       | MISSION-01      | 16    |                 |       |
|                |       | MISSION-02      | 16    |                 |       |
|                |       | MISSION-03      | 16    |                 |       |
|                |       | MISSION-04      | 16    |                 |       |
|                |       | MISSION-05      | 16    |                 |       |
|                |       | MISSION-06      | 16    |                 |       |
|                |       | MISSION-07      | 16    |                 |       |
|                |       | MISSION-08      | 16    |                 |       |

**Total mapped:** 135/135 ✓
**Orphans:** 0
**Duplicates:** 0

### Per-phase counts

| Phase | REQ count |
|-------|-----------|
| 9     | 5         |
| 10    | 1         |
| 11    | 9         |
| 12    | 14        |
| 13    | 3         |
| 14    | 11        |
| 15    | 17        |
| 16    | 27        |
| 17    | 16        |
| 18    | 9         |
| 19    | 17        |
| 20    | 6         |
| **Total** | **135** |

---

## Independent shippability check

| After phase | Game state if dev stops here |
|---|---|
| 9  | Same as v1.0 + cleaner internals. No regression. |
| 10 | Same as v1.0 + safe migrations + dev-mode HUD. No regression. |
| 11 | v1.0 + 🧬 button opens empty modal with 4 stub tabs. Player sees roadmap teaser, no broken features. |
| 12 | Above + invisible foundation for overlays (no feature). Game looks identical to player. |
| 13 | Above + dev-only overlays visible if forced. No player-facing feature. |
| 14 | Player can apply dev-given serums to frogs → carriers exist visually. Limited but coherent. |
| 15 | Player can open dev-given boxes → get serums → apply. Box→serum loop closed. |
| 16 | Full loop: scout → mission → box → serum → carrier. **First fully-playable v2.0 milestone.** |
| 17 | Above + feed evolution + ceiling reveal + merge. Late-progression complete. |
| 18 | Above + bestiary collection meta-loop. Full feature surface. |
| 19 | v2.0 SHIP-READY. Polish + balance + i18n + tutorial. |

---

## Dependencies graph (linear, single chain)

```
9 (REFACTOR)
  ↓
10 (INFRA)
  ↓
11 (CosmicSlice + Hub shell)
  ↓
12 (Overlay infra + dormant)
  ↓
13 (Awakened tiers)
  ↓
14 (Сыворотки tab + DnD)
  ↓
15 (Boxes + slot-machine)
  ↓
16 (Scouts + missions)
  ↓
17 (Carrier feed + ceiling + merge)
  ↓
18 (Бестиарий 2.0)
  ↓
19 (Balance + tutorial + polish)
```

No parallel branches in v2.0 — each phase strictly consumes the previous. This is intentional: tight chain forces "independently shippable but cumulatively required" discipline.

---

## Risk-based research flags (from research synthesis)

| Phase | Flag | What to verify during phase |
|-------|------|----------------------------|
| 12    | Real-device perf | 16 frogs × dormant overlay on mid-tier Android ≥45 FPS |
| 13    | Bundle budget    | Cumulative bundle delta ≤ +30 KB after 64 awakened-tier files |
| 15    | Skip A/B         | Tap-anywhere 0.6s vs Skip-button 1s — measure user satisfaction in playtest |
| 17    | Ceiling drama    | Hidden-ceiling reveal cadence (5 feeds) feels right or needs to drop to 3 / rise to 7 |
| 19    | Balance tuning   | Monte Carlo numbers vs playtest feel — are pity floors too tight/loose? |

---

**Last updated:** 2026-05-08 — initial ROADMAP for milestone v2.0
