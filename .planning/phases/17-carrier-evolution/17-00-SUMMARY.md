---
phase: 17-carrier-evolution
plan: 00 (master)
type: summary
status: complete
completed_date: 2026-05-08
duration_minutes: ~70
total_commits: 5
total_plans: 5
total_waves: 3
bundle_delta_gzip:
  index_js: "+3.83 KB (220.23 → 224.06 KB)"
  cosmic_hub_chunk: "+1.28 KB (4.39 → 5.67 KB)"
  total: "+5.11 KB gzip (cap: +25 KB ✓)"
requirements:
  - CARRIER-01
  - CARRIER-02
  - CARRIER-03
  - CARRIER-04
  - CARRIER-05
  - CARRIER-06
  - CARRIER-07
  - CARRIER-08
  - CARRIER-09
  - CARRIER-10
  - CARRIER-11
  - CARRIER-12
  - BALANCE-06
  - BALANCE-09
  - UX-10
  - UX-11
key-files:
  created:
    - client/src/utils/carrierEvolution.ts
    - client/src/utils/carrierEvolution.spec.ts
    - client/src/utils/carrierFeed.ts
    - client/src/store/cosmic/bestiary.ts
    - client/scripts/verify_carrier_evolution.cjs
    - client/src/components/CosmicHub/CeilingDisplay.tsx
    - client/src/components/CosmicHub/CarrierInfoCard.tsx
    - client/src/components/CosmicHub/CarriersTab.tsx
    - client/src/components/CosmicHub/DisposeConfirmModal.tsx
    - client/src/components/CosmicHub/StabilizationModal.tsx
  modified:
    - client/src/store/cosmic/types.ts
    - client/src/store/cosmic/slice.ts
    - client/src/store/eventBus.ts
    - client/src/store/gameStore.ts
    - client/src/game/scenes/MainScene.ts
    - client/src/game/effects/FrogElementOverlay.ts
    - client/src/game/effects/FrogOverlayManager.ts
    - client/src/components/CosmicHub/CosmicHubModal.tsx
    - client/src/utils/devCarriers.ts
    - client/src/App.tsx
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json
---

# Phase 17 Carrier Evolution — Summary

**Single-line:** Полный carrier evolution loop — feed → hidden ceiling reveal (0-2/3-4/5+) → stabilization slot-machine modal → visual lock → merge above ceiling (S-bucket) → dispose с 30% serum recovery + bestiary write-through (1536 bits).

## What got done

5 plans executed across 3 waves в 1 session, 5 atomic commits, 13 files created/modified, +5.11 KB gzip (cap +25 KB ✓).

### Wave 1 — Foundation (Plan 17-01)
- `client/src/store/cosmic/types.ts` extended: `RollResult` discriminated union + `CarrierData.ceiling?` + `CarrierData.rollHistory?` (optional → backward compat). `CosmicTab` union extended `'carriers'`. `bestiaryBitset` Phase 17 расширен 24 → 192 bytes (1536 bits).
- `client/src/utils/carrierEvolution.ts` (143 LOC pure): `TIER_RANGES` (1-6/7-12/13-18/19-24), `TIER_BUCKET_WEIGHTS` (5/15/30/50), `ceilingForBucket`, `bucketOfCeiling`, `rollBucket`, `shouldForceS` (streak protection), `rollCeilingForCarrier`, `rollFeedOutcome`, `SUCCESS_RATE_BASE = 0.7`, `FeedOutcome` interface.
- `client/src/utils/carrierEvolution.spec.ts` (110 LOC) — pure type-checked assertions.
- `client/src/store/cosmic/bestiary.ts` (45 LOC): `BESTIARY_BIT_COUNT = 1536`, `BESTIARY_BYTE_COUNT = 192`, `bestiaryIndex(element, rarity, level)`, `readBit`, `setBit` (immutable, auto-pads).
- `client/scripts/verify_carrier_evolution.cjs` (140 LOC, self-contained CommonJS): 4 Monte-Carlo tests — distribution (10K rolls ±5%), streak (1000/1000 forced S after 3×C), bestiary (1536 unique indices, no collisions), dispose (30% recovery ±5%).
- `gameStore.ts`: STORAGE_VERSION 18 → 19 + bitset migration extends 24 → 192 bytes на load (lossless pad).

### Wave 2 — Feed action + UI (Plans 17-02, 17-03)
- `client/src/store/eventBus.ts`: добавлен event `cosmic:carrier-stabilized` { frogId, element, rarity, ceiling, bucket }.
- `client/src/store/cosmic/slice.ts`: 4 новых actions — `feedCarrier`, `mergeCarriers`, `disposeCarrier`, `setBestiaryBit`. Atomic state mutations с pre-determined ceiling, bestiary write-through, hasFirstFeed sentinel.
- `client/src/utils/carrierFeed.ts`: pure `classifyDropTarget(pair, carriers)` → 'standard-merge' | 'feed' | 'carrier-merge' | 'blocked-unstabilized' | 'blocked-mismatch' | 'no-match'.
- `client/src/game/scenes/MainScene.ts`: `performMerge` extended classification gate (5 branches с toast'ами на blocked); 2 new methods `performFeed` (~120 LOC) и `performCarrierMerge` (~80 LOC) с vortex anim, frog transfer, mergeEffect, haptic, store.feedCarrier/mergeCarriers calls.
- `client/src/components/CosmicHub/CeilingDisplay.tsx`, `CarrierInfoCard.tsx`, `CarriersTab.tsx`, `DisposeConfirmModal.tsx`: 4 React components.
- `CosmicHubModal.tsx`: 5-th tab `carriers` 🐸.
- `i18n/{ru,en,es}.json`: 21 ключ × 3 языка = 63 i18n entries (carrier section, stabilize sub-section, dispose sub-section). All UI labels ≤ 12 chars verified.

### Wave 3 — Stabilization modal + visual lock + dev helpers (Plans 17-04, 17-05)
- `client/src/components/CosmicHub/StabilizationModal.tsx` (~190 LOC): always-mounted в App.tsx, listens `cosmic:carrier-stabilized`, slot-machine 1.8s + reveal 2.2s, tier-specific копирайт (S/A/B/C), reduced-effects flag (localStorage) skip slot anim, auto-close 4s + tap-dismiss.
- `client/src/App.tsx`: mount `<StabilizationModal />` outside Suspense (eventBus listener stays alive across CosmicHubModal close/open).
- `client/src/game/effects/FrogElementOverlay.ts`: `locked: boolean` field + `setLocked()` method + reset в `detach()`.
- `client/src/game/effects/FrogOverlayManager.ts`: `syncCarriers` early-continue branch когда `existing.locked && carrier.stabilized && existing.element === carrier.element` + `setLocked(true)` после attach для stabilized carriers.
- `client/src/utils/devCarriers.ts`: 3 new dev helpers — `__forceFeed(frogId, count?)`, `__forceStabilize(frogId)`, `__bestiaryBitsSet()`.

## Verification

### Static
- `npx tsc --noEmit` — clean (after each wave)
- `npm run build` — success: `dist/assets/index-CNE3dymt.js` 224.06 KB gzip (vs Phase 15 baseline 220.23 → +3.83 KB), `CosmicHubModal-BbhQHjVR.js` 5.67 KB gzip (vs 4.39 → +1.28 KB) = **+5.11 KB cumulative** (cap +25 KB ✓)

### Monte Carlo (verify_carrier_evolution.cjs --all)
```
[distribution] over 10000 rolls: { S: 4.93, A: 14.67, B: 30.67, C: 49.73 }
[distribution] PASS — all buckets within ±5%
[streak] PASS — 1000 / 1000 forced S after 3×C
[streak] PASS — mixed history correctly skips force
[bestiary] PASS — 1536 unique indices, no collisions
[dispose] over 1000 trials: 30.0%
[dispose] PASS — rate within ±5%
ALL TESTS PASSED
```

## REQ Coverage Table (16/16)

| REQ-ID | Status | Where |
|--------|--------|-------|
| CARRIER-01 | ✓ | Phase 14 carrier created via applySerum; этот phase обогащает evolution loop |
| CARRIER-02 | ✓ | Dormant visual из Phase 12 сохраняется через `FrogElementOverlay` preset reuse |
| CARRIER-03 | ✓ | `MainScene.performFeed` + `slice.feedCarrier` + `classifyDropTarget` ('feed') |
| CARRIER-04 | ✓ | `rollFeedOutcome` (success/fail/stabilize) + RollResult union в types.ts |
| CARRIER-05 | ✓ | `TIER_RANGES` (1-6/7-12/13-18/19-24) + `TIER_BUCKET_WEIGHTS` (5/15/30/50) + `ceilingForBucket` |
| CARRIER-06 | ✓ | `shouldForceS` derives от rollHistory timestamps; verifier 1000/1000 PASS |
| CARRIER-07 | ✓ | `CeilingDisplay` 3 phases: feedCount<3 → ???, <5 → color hint, ≥5 → exact L{ceiling} |
| CARRIER-08 | ✓ | `StabilizationModal` always-mounted, slot 1.8s + reveal 2.2s + bucket-specific копирайт |
| CARRIER-09 | ✓ | `FrogElementOverlay.locked` flag + `FrogOverlayManager.syncCarriers` skip-re-acquire branch |
| CARRIER-10 | ✓ | `slice.mergeCarriers` (5-guard validation) + `MainScene.performCarrierMerge` |
| CARRIER-11 | ✓ | `slice.disposeCarrier` (`Math.random() < 0.3`) + `DisposeConfirmModal` |
| CARRIER-12 | ✓ | `bestiary.ts` (`bestiaryIndex`/`setBit`) + write-through в `feedCarrier`/`mergeCarriers` |
| BALANCE-06 | ✓ | `shouldForceS` 3 last C-bucket → 4-th forced S (same as CARRIER-06) |
| BALANCE-09 | ✓ | `rollCeilingForCarrier` pre-determines в первый feed; saved в `carrier.ceiling` |
| UX-10 | ✓ | `CarrierInfoCard` progress bar `feedCount / ESTIMATED_FEEDS_TO_STABILIZE = 8` + stabilized=full |
| UX-11 | ✓ | `DisposeConfirmModal` локализован RU/EN/ES; 3 elements × rarity placeholder strings |

## Deviations from Plan

### [Rule 3 - Blocking] STORAGE_VERSION bump 18 → 19 + bitset migration
- **Found during:** Plan 17-01 Task 1 (extending bestiaryBitset 24 → 192).
- **Issue:** Existing `loadCosmicSlice` validation `parsed.bestiaryBitset.length === 24` would always reject new 192-byte bitset, falling back на defaults и теряя persisted bits.
- **Fix:** заменили `length === 24` check на pad-to-192 IIFE; bumped `STORAGE_VERSION = 18 → 19` чтобы wipe old data preventatively, but new code also handles legacy 24-byte arrays via auto-pad (lossless).
- **Files modified:** `client/src/store/gameStore.ts`
- **Commit:** aeb1f29

### [Rule 2 - Critical functionality] hasFirstFeed sentinel update в feedCarrier
- **Found during:** Plan 17-02 Task 1.
- **Issue:** Plan 16 (UX-09) introduced `hasFirstFeed` sentinel for ShipTab progressive disclosure. Plan указывает что Phase 17 toggles it. Без этого flag carrier'ы можно создавать но Корабль tab (Phase 16) остаётся locked в production.
- **Fix:** в `feedCarrier` action set `hasFirstFeed: s.hasFirstFeed || true`.
- **Commit:** 3efb82f

### [Rule 2 - Critical functionality] CarriersTab wires DisposeConfirmModal в Wave 2 (early)
- **Found during:** Plan 17-03 Task 2.
- **Issue:** `CarriersTab.tsx` (Plan 17-03) imports `DisposeConfirmModal` (Plan 17-05) — без этого build fail в Wave 2.
- **Fix:** создал `DisposeConfirmModal.tsx` early в Wave 2; Plan 17-05 wiring уже включён в `CarriersTab` initial implementation. Atomicity: одна commit phase-17(17-03) включает оба компонента.
- **Commit:** a2a2ae5

### Plan structure consolidation
- **Plans 17-02 + 17-05 store actions consolidated:** Plan 17-02 specifies feedCarrier; Plan 17-05 specifies mergeCarriers/disposeCarrier/setBestiaryBit. Поскольку оба modify `cosmic/slice.ts`, добавил все 4 actions atomically в одной edit чтобы избежать множественных правок одной функции (Rule 3 — predictability). Final commit разбивка соответствует deliverable boundaries (feed + MainScene в 17-02, dev helpers + verify в 17-05).

### Rarity badge label re-use
- **Found during:** Plan 17-03 Task 1 (`CarrierInfoCard`).
- **Issue:** Plan указывает `t('cosmic_hub.serums.rarity_${rarity}')`, но эти keys не существуют в i18n (Phase 14 SerumsTab uses `section_common`/`section_rare` etc.). Top-level `rarity.{common|rare|epic|legendary}` keys уже существуют (Phase 1+).
- **Fix:** badge использует `t('rarity.${carrier.rarity}')` (= "обычная"/"редкая"/"эпик"/"легендарная"). Same в `DisposeConfirmModal`.

## Architecture Notes

### Store action atomicity
Все 4 carrier actions используют single `set({...})` call для минимизации subscribe-flapping в `FrogOverlayManager` (PERF-02 invariant Phase 12). EventBus emit для stabilize выполняется ПОСЛЕ `set` — гарантирует что modal listener видит обновлённый state.

### rollHistory clamp
`feedCarrier` использует `(carrier.rollHistory ?? []).slice(-23).concat(roll)` — clamps history до последних 24 entries (T-17-03 mitigation против tampered/runaway state).

### Bestiary bit indexing formula
`(level - 1) * 64 + ELEMENTS.indexOf(element) * 4 + RARITIES.indexOf(rarity)` — 24 уровня × 64 cells (16 elements × 4 rarities) = 1536 bits = 192 bytes. Verified collision-free через verify-script.

### MainScene.performMerge classification gate
До vortex anim — `classifyDropTarget` runs; 4 abort branches (toast + return), 1 dispatch branch (feed/carrier-merge), 1 fallthrough (standard-merge). Sacrifice frog never lost — 'fail' outcome restores carrier на (cx, cy) с full state cleanup (rotation/scale/interactive/draggable).

### StabilizationModal lifecycle
Always-mounted в `App.tsx` (вне `<Suspense>` с CosmicHubModal lazy chunk). Listener stays subscribed across hub close/open. Single payload state (last-event-wins overwrite если rapid-fire). 3 timer refs (slotInterval/revealTimeout/closeTimeout) — все cleaned up в `useEffect` return + `handleDismiss`.

### Visual lock semantics
`FrogElementOverlay.locked` — pool cleanliness invariant: `detach()` resets к `false` так что pool re-acquire не наследует stale lock state. `setLocked(true)` invoked в `FrogOverlayManager.syncCarriers` immediately после `attach` для stabilized carriers — covers re-acquisition после location change или camera-rotation past hard cap.

## Self-Check: PASSED

### Created files exist
- `client/src/utils/carrierEvolution.ts` ✓
- `client/src/utils/carrierEvolution.spec.ts` ✓
- `client/src/utils/carrierFeed.ts` ✓
- `client/src/store/cosmic/bestiary.ts` ✓
- `client/scripts/verify_carrier_evolution.cjs` ✓
- `client/src/components/CosmicHub/CeilingDisplay.tsx` ✓
- `client/src/components/CosmicHub/CarrierInfoCard.tsx` ✓
- `client/src/components/CosmicHub/CarriersTab.tsx` ✓
- `client/src/components/CosmicHub/DisposeConfirmModal.tsx` ✓
- `client/src/components/CosmicHub/StabilizationModal.tsx` ✓

### Commits exist
- aeb1f29 phase-17: foundation — types + carrierEvolution + bestiary + verify (17-01) ✓
- 3efb82f phase-17: feedCarrier+mergeCarriers+disposeCarrier actions + MainScene drag-feed wiring (17-02) ✓
- a2a2ae5 phase-17: CarriersTab + CarrierInfoCard + CeilingDisplay + DisposeConfirmModal + i18n (17-03) ✓
- e0458ea phase-17: StabilizationModal + visual lock (locked flag) (17-04) ✓
- 20a7c65 phase-17: dev helpers __forceFeed/__forceStabilize/__bestiaryBitsSet (17-05) ✓
