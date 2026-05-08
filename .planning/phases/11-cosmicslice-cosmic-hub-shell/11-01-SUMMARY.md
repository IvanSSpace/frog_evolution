---
phase: 11-cosmicslice-cosmic-hub-shell
plan: 01
type: execute
wave: 1
status: complete
completed_at: 2026-05-08
requirements: [SERUM-01, COSMIC-HUB-05, COSMIC-HUB-06]
---

# Phase 11 Plan 01: CosmicSlice Data Layer — Summary

Реализован data layer для Cosmic Frogs System: типы (16 элементов × 4 редкости), Zustand slice с action stubs, интеграция в `useGameStore`, bump `STORAGE_VERSION` 15→16, типизация `eventBus` для `cosmic:toast`.

## Что сделано

1. **Создан `client/src/store/cosmic/types.ts`** — все типы Cosmic Frogs System:
   - `Element` (16 значений: fire/ice/water/forest/toxic/plasma/shadow/crystal/desert/gas/ring/binary/arcane/mechanical/war/void)
   - `Rarity` (4 значения: common/rare/epic/legendary)
   - `CosmicSlice` interface (serums 16×4, boxes/scouts/carriers placeholder arrays, bestiaryBitset[24], pityCounters, lastActiveTab, crew)
   - `CosmicToastPayload` (для COSMIC-HUB-06 grouping)
   - `makeInitialCosmicSlice()` — factory с 64 serum-ячейками = 0
2. **Создан `client/src/store/cosmic/slice.ts`** — Zustand factory с actions stubs (addSerum/removeSerum/addBox/openBox/addScout/removeScout/addCarrier/removeCarrier/setLastActiveTab/consumeMissionCredit/resetCrewIfNewDay)
3. **Расширен `gameStore.ts`** — `GameState = GameStateBase & CosmicState`, spread `createCosmicSlice + loadCosmicSlice`, `useGameStore.subscribe(...)` для auto-persist в `frog_evolution_cosmic` localStorage key
4. **Bumped `STORAGE_VERSION` 15→16** + добавлен wipe `COSMIC_KEY` в block wipe-on-mismatch (старые сейвы v15 будут сброшены)
5. **Расширен `eventBus.ts`** — добавлен типизированный event `'cosmic:toast': CosmicToastPayload`

## Ключевые решения

- **Flat структура** (CosmicState полей напрямую в GameState через intersection type) вместо вложенного `cosmicSlice: {...}` — consistent с Zustand best practices, позволяет селекторы вида `useGameStore(s => s.serums)`.
- **`subscribe(...)`-based persist** вместо ручного `saveCosmicSlice` в каждом action — гарантирует что любое изменение cosmic-данных попадает в localStorage без дублирования логики.
- **Graceful fallback per-field** в `loadCosmicSlice` — поломанная подструктура не валит весь load, заменяется defaults (T-11-01 mitigation).
- **`lastActiveTab` validation** при load — только 4 допустимых значения, иначе fallback `'scouts'` (T-11-05 ранний mitigation).
- **`bestiaryBitset.length === 24`** проверка — иначе defaults (защита от tampering).

## Артефакты

| Path | Exports |
|------|---------|
| `client/src/store/cosmic/types.ts` | `Element`, `Rarity`, `ELEMENTS`, `RARITIES`, `CosmicSlice`, `BoxData`, `ScoutData`, `CarrierData`, `ShipState`, `PityCounters`, `CosmicTab`, `CosmicToastPayload`, `makeInitialCosmicSlice` |
| `client/src/store/cosmic/slice.ts` | `createCosmicSlice`, `CosmicSliceActions`, `CosmicState` |
| `client/src/store/gameStore.ts` | `STORAGE_VERSION = 16`, `COSMIC_KEY = 'frog_evolution_cosmic'`, GameState = base & CosmicState |
| `client/src/store/eventBus.ts` | event `'cosmic:toast'` typed |

## Verify

- `npx tsc --noEmit` — clean
- `npm run build` — clean, gzip delta ≈ +5 KB на index chunk
- `grep "STORAGE_VERSION = 16" gameStore.ts` — найдено
- `grep "cosmic:toast" eventBus.ts` — найдено

## Следующий шаг

**Plan 02 (Wave 2): UI shell** — заменить 🛍️ на 🧬 в BottomBar, создать lazy-loaded CosmicHubModal с 4 stub-табами, sessionStorage persist активного таба.
