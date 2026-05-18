---
phase: 26-cosmos-races-foundation
plan: 01
subsystem: cosmic-frogs
tags: [races, first-contact, i18n, state, server-sync, foundation, phase26]

# Dependency graph
requires:
  - phase: 19
    provides: ELEMENT_TINTS colorblind-safe palette (homeColor sourced from там)
  - phase: 11
    provides: cosmic slice + makeInitialCosmicSlice + saveCosmicSlice infrastructure
  - phase: 22
    provides: cosmos gate (hasCosmosUnlocked) + Element type (16-element union)
  - phase: 24
    provides: server-sync через cosmic JSON blob pattern (captainBirthSeen)
  - phase: 23
    provides: dev-helper install pattern + per-flag cleanup symmetry
provides:
  - "RaceId union type (10 string literals)"
  - "RACES readonly array + RACES_BY_ID O(1) lookup + getRaceColor/getRaceAffinity helpers"
  - "firstContactsSeen state поле в CosmicSlice (server-syncable)"
  - "markFirstContactSeen action (idempotent)"
  - "eventBus 'cosmos:first-contact' event"
  - "i18n races.* (50 keys) + cosmos.first_contact.* (3 keys) namespaces в RU/EN/ES"
  - "DEV helpers (__listRaces/__markFirstContact/__resetFirstContacts/__firstContactsState)"
affects: [26-02 planetMap inhabitants, 26-03 star map glow rendering, 26-04 Inventory tab race listing, 26-05 FirstContactController]

# Tech tracking
tech-stack:
  added: []  # No new libraries — pure data model + existing infrastructure
  patterns:
    - "Forward-compat defensive load (iterate over known raceIds from defaults, ignore unknown server-side raceIds)"
    - "Hardcoded ALL_RACE_IDS array в types.ts (avoid types↔races cycle, RaceId[] type catches drift)"
    - "Loose typing 'cosmos:first-contact' raceId: string (avoid eventBus→slice→races cycle)"

key-files:
  created:
    - client/src/game/config/races.ts
    - client/src/utils/devRaces.ts
    - .planning/phases/26-cosmos-races-foundation/deferred-items.md
  modified:
    - client/src/store/cosmic/types.ts
    - client/src/store/cosmic/slice.ts
    - client/src/store/persistence.ts
    - client/src/store/gameStore.ts
    - client/src/store/eventBus.ts
    - client/src/api/gameSync.ts
    - client/src/App.tsx
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json

key-decisions:
  - "Hardcoded ALL_RACE_IDS array в cosmic/types.ts вместо import из races.ts — избежали циклической deps (types ↔ races) + slice init остался lightweight. Compile-time check через RaceId[] type ловит drift если RaceId union расширится."
  - "emojiIcon placeholder strategy (per D-PlaceholderStrategy) — НЕ добавили iconPath поле. Swap на SVG assets когда user предоставит; placeholder = feature, не TODO."
  - "homeColor = ELEMENT_TINTS[affinity] (Phase 19-06 colorblind-safe palette reuse) — DRY против hardcoded race hex. Override возможен per-race если нужен distinct race color."
  - "firstContactsSeen живёт в cosmic JSON blob (server-sync free через standard saveCosmicSlice + gameSync.ts snapshot/hydrate). НЕ отдельный localStorage key — cross-device sync важен для meta-state."
  - "eventBus 'cosmos:first-contact' payload uses raceId: string (не RaceId type) — избегает циклической deps eventBus → slice → races → types → eventBus. Pattern consistent с LegacyRarity локальным типом."
  - "RACES_BY_ID построен через явный typed for-loop, не Object.fromEntries — TS теряет literal-key типизацию при fromEntries (получился бы Record<string, RaceConfig>)."
  - "DEV helpers gated через import.meta.env.DEV at function entry — Vite tree-shake'нет в production (T-26-01-03 mitigation)."

patterns-established:
  - "Race config registration: RaceConfig interface + RACES readonly array + RACES_BY_ID lookup + getter helpers (getRaceColor/getRaceAffinity). Будущие phases расширяют (relationships, quests) добавляя поля в RaceConfig."
  - "Per-race state init via hardcoded ALL_RACE_IDS iteration в makeInitialCosmicSlice — pattern для future per-race meta-state (relationships в Phase 29)."
  - "Defensive load для Record<RaceId, V>: iterate over Object.keys(defaults) only, accept ONLY validated value shape, ignore unknown server-side keys (forward-compat)."

requirements-completed:
  - PHASE26-RACES-CONFIG
  - PHASE26-FIRSTCONTACT-STATE
  - PHASE26-I18N-RACES
  - PHASE26-EVENTBUS

# Metrics
duration: ~50min
completed: 2026-05-18
---

# Phase 26 Plan 26-01: Cosmos races foundation Summary

**Заложена data foundation для всех Phase 26 downstream планов: RaceId union (10 string literals), RACES config с lore/affinity/emoji, firstContactsSeen state slice с persist + server-sync, i18n skeleton (RU/EN/ES, 50 race keys + 3 cosmos.first_contact keys), типизированный eventBus 'cosmos:first-contact' event.**

## Objective recap

Plan 26-01 = foundation для Phase 26 «cosmos races». Без RaceId + RACES + firstContactsSeen ничего из downstream planов (26-02 planet inhabitants, 26-03 race color glow, 26-04 Inventory tab, 26-05 first-contact cinematic) не было бы типизировано или persistable.

## What was built

### `client/src/game/config/races.ts` (new, 232 lines)
- `RaceId` union literal type из 10 IDs (crystalloids/gasouls/mechanidons/fireworms/liquidoids/tenebrians/plasmaspirits/forestcores/timeweavers/cometfolk).
- `RaceConfig` interface с 8 полями: id, nameKey, affinity (Element), emojiIcon, homeColor (Phaser hex), personalityKey, communicationStyleKey, loreShortKey, homePlanetNameKey.
- `RACES: readonly RaceConfig[]` — 10 entries в каноническом порядке (CONTEXT table).
- `RACES_BY_ID: Record<RaceId, RaceConfig>` — O(1) lookup через явный typed for-loop.
- `getRaceColor(raceId)` / `getRaceAffinity(raceId)` helpers — single import surface для downstream.
- homeColor = ELEMENT_TINTS[affinity] (Phase 19-06 colorblind-safe palette reuse).
- emojiIcon placeholder per race (💎/☁️/⚙️/🔥/💧/🌑/⚡/🌲/🌀/☄️).

### `client/src/store/cosmic/types.ts` (modified)
- Импорт RaceId from `../../game/config/races`.
- Новое поле в CosmicSlice: `firstContactsSeen: Record<RaceId, boolean>`.
- Новый export `ALL_RACE_IDS: readonly RaceId[]` — canonical 10 race-id array, hardcoded чтобы избежать циклической deps (types ↔ races).
- `makeInitialCosmicSlice()` инициализирует все 10 рас в false.

### `client/src/store/cosmic/slice.ts` (modified)
- Импорт RaceId.
- Declaration `markFirstContactSeen: (raceId: RaceId) => void` в `CosmicSliceActions`.
- Implementation: idempotent guard ДО set() (если already true → no state mutation, no extra persist write, no extra render).
- НЕ эмитим event здесь — cinematic trigger живёт в Plan 26-05 controller'е (там event'ит ДО mark).

### `client/src/store/persistence.ts` (modified)
- Импорт type RaceId.
- В `loadCosmicSlice()` добавлен defensive validation блок:
  - Iterate over `defaults.firstContactsSeen` keys (known raceIds).
  - Accept ONLY `v === true` (любая другая shape/value → default false).
  - Поломанный/missing `parsed.firstContactsSeen` → defaults all-false.
- T-26-01-01 (tampering localStorage) + T-26-01-02 (unknown raceId from server) mitigation.
- НЕ добавили отдельный LocalStorage key (FIRST_CONTACTS_KEY) — поле живёт в cosmic blob (COSMIC_KEY) per D-ServerSync.

### `client/src/store/gameStore.ts` (modified)
- Subscribe trigger расширен: `state.firstContactsSeen !== prev.firstContactsSeen` → schedule persist.
- saveCosmicSlice payload включает `firstContactsSeen: state.firstContactsSeen`.

### `client/src/api/gameSync.ts` (modified)
- `snapshotForSave()` cosmic blob включает `firstContactsSeen: s.firstContactsSeen` — cross-device server sync.
- `loadGameState()` hydrate: `if ('firstContactsSeen' in c) cosmicUpdate.firstContactsSeen = c.firstContactsSeen` — server snapshot применяется к store напрямую (defensive load уже сделан в loadCosmicSlice; server side validation — forward-compat для unknown raceIds).

### `client/src/store/eventBus.ts` (modified)
- Добавлен типизированный event `'cosmos:first-contact': { raceId: string; x: number; y: number }`.
- raceId: string (не RaceId) — избегаем cycle eventBus → slice → races → types → eventBus. Consumer (Plan 26-05) делает narrow cast.

### `client/src/i18n/{ru,en,es}.json` (modified, +53 keys × 3 locales)
- Новый top-level namespace `races` с 10 entries × 5 keys = 50 race keys per locale.
  Поля per race: name, lore_short, personality, communication_style, home_planet_name.
  RU тексты из Design Notes (sections #### 1..10). EN/ES — переводы с canonical names.
- Новый top-level namespace `cosmos` с подключом `first_contact` (3 keys): title, cta, subtitle_template.
- subtitle_template использует `{{raceName}}` interpolation для подстановки `t(races.{id}.name)`.
- Placement: between `cosmic_shop` и `tutorial` namespaces (per Plan placement spec).
- check-translations.cjs: **390/390 PARITY CLEAN**.

### `client/src/utils/devRaces.ts` (new, 90 lines)
- `installRaceDevHelpers()` — DEV-only (import.meta.env.DEV early-return); returns cleanup function.
- 4 helpers exposed on window: __listRaces (console.table 10 рас), __markFirstContact(id), __resetFirstContacts (all 10 false, no reload required), __firstContactsState (snapshot).
- T-26-01-03 mitigation: DEV gate at function entry — Vite tree-shake в production.

### `client/src/App.tsx` (modified)
- Импорт `installRaceDevHelpers`.
- DEV useEffect: `const raceDevCleanup = installRaceDevHelpers()` рядом с captainBirthDevHelpers.
- Return ветка: `raceDevCleanup()` симметрично с другими delete w.__* строками.

## Interfaces exported (downstream plans consume)

| Export | From | Used by |
|--------|------|---------|
| `RaceId` (type) | `game/config/races` | 26-02 (PlanetInhabitant), 26-03 (raceId param в render), 26-04 (Inventory race list), 26-05 (controller payload) |
| `RaceConfig` (interface) | `game/config/races` | 26-04 (Inventory item shape) |
| `RACES` (readonly array) | `game/config/races` | 26-04 (Inventory iteration), devRaces helpers |
| `RACES_BY_ID` (Record) | `game/config/races` | 26-03 (planet → race lookup), 26-05 (race resolution) |
| `getRaceColor` (helper) | `game/config/races` | 26-03 (Phaser glow color) |
| `getRaceAffinity` (helper) | `game/config/races` | 26-02 (planet affinity matching) |
| `firstContactsSeen` (state field) | `cosmic/slice` | 26-05 (gate cinematic trigger) |
| `markFirstContactSeen` (action) | `cosmic/slice` | 26-05 (post-cinematic mark) |
| `ALL_RACE_IDS` (readonly array) | `cosmic/types` | (internal slice init, may be used by future migrations) |
| `'cosmos:first-contact'` event | `eventBus` | 26-05 (emitter) → cinematic subscribers |
| `races.*` i18n namespace | `i18n/*.json` | 26-04 (display names), 26-05 (cinematic subtitle), tooltips |
| `cosmos.first_contact.*` i18n namespace | `i18n/*.json` | 26-05 (modal title/cta/subtitle template) |

## Validation results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS (clean across all touched files) |
| `npm run check-translations` | PASS (**390 keys × 3 locales**, 0 missing — parity preserved) |
| ESLint на touched files | PASS (0 errors, 0 warnings; prettier autofix applied) |
| `RACES.length === 10` | PASS (verified via tsx smoke) |
| `RACES_BY_ID.crystalloids.affinity === 'crystal'` | PASS |
| `getRaceColor('fireworms') === 0xfb923c` (fire tint) | PASS |
| `getRaceAffinity('timeweavers') === 'void'` | PASS |
| `makeInitialCosmicSlice().firstContactsSeen` → 10 keys all false | PASS |
| JSON validity (ru/en/es) | PASS (`JSON.parse` clean) |
| Existing test suite | 97 PASS, 1 skip — 3 pre-existing failures (not caused by Plan 26-01; see `deferred-items.md`) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] Server-sync wiring**
- **Found during:** Task 2 (firstContactsSeen state)
- **Issue:** Plan task 2 described only persistence через saveCosmicSlice (localStorage). Без обновления `gameSync.ts` (snapshotForSave + loadGameState) поле НЕ переезжало бы между устройствами — что противоречит CONTEXT D-ServerSync intent.
- **Fix:** Добавил firstContactsSeen в `snapshotForSave().cosmic` блок (cross-device save) + hydrate в `loadGameState()` через `if ('firstContactsSeen' in c) cosmicUpdate.firstContactsSeen = c.firstContactsSeen` (consistent с captainBirthSeen pattern).
- **Files modified:** `client/src/api/gameSync.ts`
- **Commit:** 285140e

**2. [Rule 3 — Blocking issue] gameStore.ts persist whitelist**
- **Found during:** Task 2 typecheck failed
- **Issue:** `saveCosmicSlice()` принимает CosmicPersist (typeof makeInitialCosmicSlice ReturnType), которое уже включает новое поле — но саму payload в `gameStore.ts` subscribe нужно было обновить чтобы добавить firstContactsSeen, иначе TS2345 missing property error.
- **Fix:** Добавил `firstContactsSeen: state.firstContactsSeen` в `saveCosmicSlice()` call + subscribe trigger condition `state.firstContactsSeen !== prev.firstContactsSeen`.
- **Files modified:** `client/src/store/gameStore.ts`
- **Commit:** 285140e

**3. [Rule 2 — Code style consistency] Prettier autofix**
- **Found during:** Task 5 lint step
- **Issue:** Earlier commits ввели long-line interface/import statements; prettier-плагин ESLint требует одну строку для не-overlapping signatures.
- **Fix:** `npx eslint --fix` через 9 файлов. 15 errors → 0. Изменения cosmetic-only (multi-line → single-line where it fits, vice versa).
- **Files modified:** `client/src/store/{cosmic/slice.ts,cosmic/types.ts,gameStore.ts,persistence.ts}`, `client/src/api/gameSync.ts`
- **Commit:** 361446d

### Deferred issues (out of Plan 26-01 scope)

См. `.planning/phases/26-cosmos-races-foundation/deferred-items.md` — 3 pre-existing test failures в `slice.test.ts` / `slice.openBox.test.ts` / `cosmicSettings.test.ts`. Verified failure exists на main `cefa897` baseline (stashed Task 2, ran tests, same failure profile). Phase 22 openBox refactor source. Не блокирует Plan 26-01.

## Downstream blockers cleared

- **Plan 26-02** (planet inhabitants): RaceId + getRaceAffinity → planet selection matching готов.
- **Plan 26-03** (star map glow): getRaceColor(raceId) → Phaser glow color готов. ELEMENT_TINTS reuse — colorblind-safe.
- **Plan 26-04** (Inventory tab): RACES iteration + races.{id}.name i18n keys → 10-row race list rendering готов.
- **Plan 26-05** (FirstContactController): firstContactsSeen gate + markFirstContactSeen action + 'cosmos:first-contact' eventBus event + cosmos.first_contact.* i18n keys — full coordination surface готова.

## Commits (in order)

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | cefa897 | feat | race data model (config/races.ts с 10 races) |
| 2 | 285140e | feat | firstContactsSeen state + persistence + server-sync |
| 3 | e2aae6a | docs | track pre-existing test failures (deferred-items.md) |
| 4 | 6a0b1a5 | feat | eventBus 'cosmos:first-contact' event |
| 5 | f2f84c4 | feat | i18n races.* + cosmos.first_contact.* keys (RU/EN/ES parity) |
| 6 | 2c86858 | feat | dev helpers (devRaces.ts + App.tsx wiring) |
| 7 | 361446d | style | apply prettier autofix |

## Success criteria checklist

- [x] RaceId type + 10 RaceConfig entries в config/races.ts
- [x] firstContactsSeen поле в CosmicSlice + init all-false + idempotent markFirstContactSeen action
- [x] Persistence работает (defensive load + standard save через cosmic blob)
- [x] Server-sync routing — поле едет через gameSync cosmic blob (snapshotForSave + hydrate)
- [x] eventBus 'cosmos:first-contact' типизирован
- [x] 50 i18n keys × 3 locales + 3 cosmos.first_contact keys × 3 locales. Parity (390/390)
- [x] DEV helpers exposed и cleanup'ятся (return cleanup function + useEffect return ветка)
- [x] tsc clean + check-translations clean + ESLint clean
- [x] Existing test suite green (modulo 3 pre-existing failures документированы в deferred-items.md)

## Self-Check: PASSED
- `client/src/game/config/races.ts` — exists ✓
- `client/src/utils/devRaces.ts` — exists ✓
- Commit cefa897 (race data model) — found in git log ✓
- Commit 285140e (firstContactsSeen state) — found in git log ✓
- Commit 6a0b1a5 (eventBus event) — found in git log ✓
- Commit f2f84c4 (i18n) — found in git log ✓
- Commit 2c86858 (dev helpers) — found in git log ✓
- Commit 361446d (prettier autofix) — found in git log ✓
- Commit e2aae6a (deferred-items.md) — found in git log ✓
- `check-translations` 390 keys parity — verified ✓
- `tsc --noEmit` clean — verified ✓
