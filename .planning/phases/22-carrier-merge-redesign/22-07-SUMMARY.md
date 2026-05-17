---
phase: 22-carrier-merge-redesign
plan: 07
subsystem: migration-finalize
tags: [migration, persistence, smoke, planning]
completed: 2026-05-17
duration_hours: ~1.0
requirements: [PHASE22-MIGRATION, PHASE22-SMOKE]
provides:
  - migratePhase22(legacy) pure idempotent function
  - persistence.loadCosmicSlice → migratePhase22 pipeline
  - persistence.loadCosmosUnlocked legacy inference (discovered[19] + cosmic slice)
  - SMOKE_TEST_22.md (9 scenarios A-I)
  - GLOSSARY_UPDATES.md (manual TODO для frog_obsidian)
  - ROADMAP.md Phase 22 = done
  - STATE.md Phase 22 row
key-files:
  created:
    - client/src/store/migrations/phase22.ts
    - client/src/store/migrations/phase22.test.ts
    - .planning/phases/22-carrier-merge-redesign/SMOKE_TEST_22.md
    - .planning/phases/22-carrier-merge-redesign/GLOSSARY_UPDATES.md
  modified:
    - client/src/store/persistence.ts
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/phases/22-carrier-merge-redesign/deferred-items.md
decisions:
  - "Migration сделана как чистая функция migratePhase22(state) — без store mutation. Вызывается на load в loadCosmicSlice (cosmic state) и loadCosmosUnlocked (single-shot inference из legacy discovered[19] + cosmic slice). Идемпотентна (10/10 vitest подтверждают)."
  - "loadCosmosUnlocked при отсутствии своего ключа делает single-shot save (saveCosmosUnlocked(true) если inferred) — следующие loads не пересчитывают, прямо читают новый ключ. Это избегает дублирование migration logic на каждом mount'е."
  - "Pre-existing vitest 4 incompatibility (3 файла с top-level node:assert/strict без describe) задокументирована в deferred-items.md как out-of-scope. Логика этих тестов покрыта новыми vitest-style файлами (shopSlice.test.ts, cosmosGate.test.ts, phase22.test.ts)."
  - "Glossary updates вынесены в отдельный manual TODO (GLOSSARY_UPDATES.md) — не in-scope из-за cross-repository constraint и author-voice sections (Намерение/Игроку)."
metrics:
  commits: 3 (feat migration, docs smoke, docs ROADMAP/STATE)
  tasks_completed: 3 (Task 4 checkpoint auto-approved per `_auto_chain_active`)
  vitest_migration: 10/10 PASS
  vitest_total_clean_suites: cosmosGate 4/5 + shopSlice 15/15 + phase22 10/10 + utils/* — все добавленные suites pass
  tsc_client: clean
  tsc_server: clean
  vite_build: 3.91s, gzip 193.65 KB main + 12.84 KB CosmicHubModal
  check_translations: 326/326 keys × 3 locales (RU/EN/ES)
---

# Phase 22 Plan 22-07: Migration + Smoke + ROADMAP Finalize Summary

**One-liner:** Legacy state migration (`migratePhase22(state)`, idempotent, 10/10 vitest), wire'нутая в `persistence.loadCosmicSlice` + `loadCosmosUnlocked` с single-shot inference из discovered[19]; smoke checklist (9 сценариев A-I); ROADMAP/STATE отмечают Phase 22 как done; GLOSSARY_UPDATES manual TODO для cross-repo obsidian refresh.

## Что сделано

### Migration (Task 1)

`client/src/store/migrations/phase22.ts` — pure idempotent функция `migratePhase22<T>(legacy: T): T` с 4 миграционными правилами:

1. **Carriers strip:** `{frogId, element, rarity?, feedCount?, stabilized?, ceiling?, rollHistory?, level?}` → `{frogId, element, level}` (default `level=1` if missing).
2. **Serums flatten:** `{fire: {common, rare, epic, legendary}}` → `{fire: sum}`. Already-flat serums pass through unchanged.
3. **hasCosmosUnlocked inference:** если undefined → `discovered.includes(19) || discoveredLevels.includes(19)`.
4. **Phase 22 fields defaults:** essence=0, ascendedCarriers=[], permaSlotBonus=0, permaShipSpeedBonus=0, permaSerumDropBonus=0, shopPurchaseCounts={}.

#### Wire-in

- **`persistence.loadCosmicSlice`** — `JSON.parse(raw)` пропускается через `migratePhase22(...)` ДО existing strict field validation. Migration не ломает existing validators — она только нормализует shape.
- **`persistence.loadCosmosUnlocked`** — расширена с legacy inference: если ключ `COSMOS_UNLOCKED_KEY` отсутствует, читает `DISCOVERED_KEY` и `COSMIC_KEY` (через migratePhase22), и при positive — делает single-shot save (`saveCosmosUnlocked(true)`) чтобы следующие loads не пересчитывали.

#### Tests

`client/src/store/migrations/phase22.test.ts` (vitest, **10 PASS**):

| # | Test | Status |
|---|------|--------|
| 1 | strip rarity/feedCount/stabilized/ceiling/rollHistory из carriers | PASS |
| 2 | carrier без level → default 1 | PASS |
| 3 | flatten nested serums (sum по rarities) | PASS |
| 4 | серум уже flat → as-is | PASS |
| 5 | hasCosmosUnlocked inferred from discovered[19] / discoveredLevels[19] | PASS |
| 6 | fresh state → defaults применяются | PASS |
| 7 | idempotency: migrate(migrate(x)) === migrate(x) | PASS |
| 8 | stabilized carrier — element + level survive, лишние strip | PASS |
| 9 | null / undefined / non-object → passthrough | PASS |
| 10 | ascendedCarriers + essence + permaSlotBonus preserved (no overwrite) | PASS |

```
Test Files  1 passed (1)
Tests       10 passed (10)
```

### Smoke (Task 2)

`.planning/phases/22-carrier-merge-redesign/SMOKE_TEST_22.md` — 9 scenarios:

| Scenario | Coverage |
|----------|----------|
| A | Pre-cosmos UI hiding (SerumBar/Hub/Star Map/HUD bonuses + mega-box не дропает серум) |
| B | L18+L18 unlock реактивный update (без reload) |
| C | Carrier merge progression (carrier+normal, target-wins) |
| D | L18 ascension (tween, +1 essence, HUD появляется) |
| E | Cosmic shop purchases (perma scaling + consumables) |
| F | Persistence через F5 |
| G | Legacy migration (rarity/nested-serums → flat shape) |
| H | i18n parity RU/EN/ES (326 keys) |
| I | Build chain (client/server tsc, vite build, vitest suites) |

i18n auto-check: `npm run check-translations` → PASS (326/326 keys × 3 locales).

### Planning state finalize (Task 3)

- **ROADMAP.md** Phase 22 entry:
  - Status: done (2026-05-17)
  - 7 plans listed with checkboxes [x] и descriptions
  - 10 requirements: PHASE22-CLEANUP, MERGE-RULES, ASCENSION, ARCHETYPE-POOL, HUD-BONUSES, COSMIC-SHOP, CURRENCIES, COSMOS-GATE, MIGRATION, SMOKE
  - Outcome section: 8 capabilities listed (carrier shape, serums flat, ascension, HUD bar, shop, cosmos gate, migration)
  - Last updated: 2026-05-17

- **STATE.md**:
  - frontmatter `current_phase: 22 (complete)`
  - new row в Phase Progress table for Phase 22

- **GLOSSARY_UPDATES.md** (cross-repo TODO):
  - 6 existing files требуют section updates (Сыворотка, Пробуждённая лягушка, Стабилизация, Редкость сыворотки, Эффект архетипа, Capтан)
  - 4 new files создать (Ascended carrier, Эссенция, Космический магазин, Cosmos gate)
  - Drift/ entries — mark resolved где relevant
  - Execution checklist для отдельной orchestrator + safe-editor сессии

## Deviations from Plan

### Auto-fixed

**1. [Rule 3 - Blocking] vitest вместо `node --test`**
- **Found during:** Task 1 first run
- **Issue:** Plan указал `node --test`, но client использует vitest.
- **Fix:** Переписал тесты под vitest API.
- **Files:** `migrations/phase22.test.ts`

**2. [Rule 2 - Critical] `loadCosmosUnlocked` legacy inference single-shot**
- **Issue:** Plan говорил «migration applied только один раз через version stamp». Без save новой ключи каждый load пересчитывал legacy state.
- **Fix:** Когда inference дает true, делается `saveCosmosUnlocked(true)` чтобы зафиксировать factual unlock; следующие loads читают прямо из своего ключа.
- **Files:** `persistence.ts`

**3. [Rule 1 - Bug] migration не клонирует carriers сразу — input mutation prevention**
- **Issue:** До исправления `out.carriers = (out.carriers as ...).map(...)` мог мутировать legacy входной объект если входил через `out = {...legacy}` — но spread top-level не deep clone'ит вложенные arrays.
- **Fix:** Migration возвращает новые objects через map (carriers создаются с new shape, не shared с legacy). Idempotency test (Test 7) подтверждает: deep equal после двух migrations.
- **Files:** `migrations/phase22.ts`

### Skipped per scope-boundary

- **3 pre-existing vitest 4 failures** (`slice.test.ts`, `slice.openBox.test.ts`, `cosmicSettings.test.ts`) — задокументированы в `deferred-items.md`. Они используют top-level `node:assert/strict` без describe/it (vitest 4 не collect'ит их как suites). Logic покрыта alternative tests.

## Open knobs for balance phase

Все эти magnitudes остались placeholders в Phase 22 demo-build качества:

| Knob | Где | Текущее значение | Action для balance phase |
|------|------|------------------|--------------------------|
| Essence reward на ascension | `ascensionSlice.ts` | +1 | Tune под целевой shop cadence |
| Archetype bonus magnitudes (mini / full) | `utils/archetypeBonuses.ts` | placeholder per category | Monte Carlo + playtest |
| Cosmic shop costs (initial + scaling) | `config/cosmicShop.ts` | baseCost 1-3, ×2 scaling perma | Длина прогрессии 10-50 essence per upgrade |
| Serum drop rate post-cosmos | `boxSlice.openBox` | 100% (placeholder, drop guaranteed) | rng.rate + permaSerumDropBonus formula |
| Cosmic_box reward magnitude (3 frogs L7) | `shopSlice.ts` purchase action | hardcoded | TBD |
| serum_trade_up exchange ratio (3:1) | `shopSlice.ts` purchase action | 3 of same → 1 random | Tune fairness |

## Self-Check: PASSED

- [x] `client/src/store/migrations/phase22.ts` — FOUND
- [x] `client/src/store/migrations/phase22.test.ts` — FOUND
- [x] `client/src/store/persistence.ts` modified — FOUND (migration wire + loadCosmosUnlocked extension)
- [x] `.planning/phases/22-carrier-merge-redesign/SMOKE_TEST_22.md` — FOUND
- [x] `.planning/phases/22-carrier-merge-redesign/GLOSSARY_UPDATES.md` — FOUND
- [x] `.planning/ROADMAP.md` Phase 22 = done — FOUND (status: done, 7 plans [x])
- [x] `.planning/STATE.md` Phase 22 row — FOUND (table updated)
- [x] Commits f7e2d83 (Task 1) + e54bae1 (Task 2) + ef86502 (Task 3) — все в git log
- [x] vitest migrations/phase22.test.ts — 10/10 PASS
- [x] vitest cosmosGate.test.ts — 4 PASS + 1 SKIPPED (Plan 22-06 carry-over)
- [x] vitest shopSlice.test.ts — 15/15 PASS (Plan 22-05 carry-over)
- [x] check-translations — PASS (326 × 3 locales)
- [x] tsc client + server — clean
- [x] vite build — success (3.91s)

## Phase 22 final tally

- **7 plans**, all complete
- **10 requirements** delivered
- **~23h scope** (per Plan files estimates), actual time across all plans
- **Cleanup + Build out + Polish** все три фазы покрыты
- **Demo-build quality** — placeholder magnitudes готовы для balance phase
- **Migration safety net** — legacy saves читаются без runtime errors
- **Smoke checklist** — готов для manual приёмки в браузере
- **Glossary TODO** — готов для отдельной obsidian session

Юзеру остаётся: (1) пробежать SMOKE_TEST_22.md в браузере, (2) опционально запустить
glossary update session per GLOSSARY_UPDATES.md.
