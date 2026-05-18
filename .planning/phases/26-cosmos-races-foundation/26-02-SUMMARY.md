---
phase: 26-cosmos-races-foundation
plan: 02
subsystem: cosmic-frogs
tags: [planets, inhabitants, deterministic-seed, mulberry32, races, runtime-api, phase26]

# Dependency graph
requires:
  - phase: 26-01
    provides: RaceId union (10 literals) + RACES + getRaceAffinity helper
  - phase: 20-01
    provides: PlanetMapEntry interface (closest existing Planet TS shape)
  - source: client/src/game/data/planetMap.json
    provides: 350 planets (16 main + 334 bg) с x/y/type/size/distFromHome
provides:
  - "PlanetInhabitant {raceId, role: 'home'|'colony'} type (cosmic/types.ts)"
  - "PlanetMapEntry.inhabitant?: PlanetInhabitant optional field (starmap/types.ts)"
  - "30 inhabitant attachments in planetMap.json (10 home + 20 colonies × 10 races)"
  - "getHabitablePlanets() / getPlanetInhabitant(planetId) / getPlanetsByRace(raceId) runtime API"
  - "HABITABLE_PLANET_IDS ReadonlySet<string> для O(1) render-loop lookup"
  - "Reproducible selection script (client/scripts/select_habitable_planets.cjs, seed=19450718)"
affects: [26-03 star map glow rendering, 26-05 first contact controller, 26-04 inventory tab если потребуется race-planet count]

# Tech tracking
tech-stack:
  added: []  # No new libraries — pure data + filter API
  patterns:
    - "Mulberry32 PRNG для deterministic seeded selection (re-run yields identical JSON)"
    - "Affinity-first selection с fallback на random non-'home' unassigned pool (matching pool was 0-1 for all races due to planetMap.type не совпадающего с race.affinity Element keys)"
    - "Module-scope memoization для filter() результата (cachedHabitable + eager HABITABLE_PLANET_IDS init)"
    - "One-time reproducibility script committed в client/scripts/ — re-runnable если seed change requested"

key-files:
  created:
    - client/src/game/data/habitablePlanets.ts
    - client/src/game/data/habitablePlanets.test.ts
    - client/scripts/select_habitable_planets.cjs
  modified:
    - client/src/store/cosmic/types.ts
    - client/src/game/scenes/starmap/types.ts
    - client/src/game/data/planetMap.json

key-decisions:
  - "Seed=19450718 = planetMap.meta.seed (19450707) + 11 derivative — distinct от base seed (исходный использовался для procedural planet generation), но deterministic-derived. Hardcoded в script."
  - "Affinity matching pool в практике = 0 для 8 из 10 рас и =1 для 2 рас (crystal, shadow). planetMap.json использует `planet.type` со значениями ['home','crystal','rocky','ancient','mystic','organic','forge','military','destroyed','crystal_bio','mechano','energy','mist','aquatic','shadow','aerial'] для main planets и ['resource','hostile','empty'] для bg. Большинство Element-union literals (fire/gas/water/mechanical/plasma/forest/void/binary) не присутствуют. Поэтому ВСЕ 10 races попадают в fallback ветку (matching <3). Fallback deterministic — берёт matching кандидата если есть (всё ещё affinity-preference), потом добирает PRNG-shuffled из non-'home' pool."
  - "PlanetMapEntry extended с inhabitant?: PlanetInhabitant вместо separate Planet type — closest existing shape, has [key:string]:unknown index signature но explicit field даёт IDE autocomplete для downstream."
  - "habitablePlanets.ts использует single `as unknown as PlanetWithInhabitant[]` cast на module-load — изоляция точки type-erasure (T-26-02-04 'accept' disposition в threat register). Downstream получает narrowed type."
  - "Mulberry32 (НЕ crypto/Math.random) — deterministic + simple + well-known sequence. 6 lines кода inline в script, нет dependency."
  - "Colonies sorted by distFromHome ASC после shuffle — colony planets рядом с home расы по distance metric (визуально логично для Plan 26-03 связывания colony→home rendering, если потребуется)."
  - "Script committed under client/scripts/ (НЕ deleted после use) — reproducibility tool, такая же конвенция как verify_anim_uniqueness_strict.cjs и check-translations.cjs (CommonJS scripts с require())."

patterns-established:
  - "JSON data attachment via reproducibility script: write committed script под client/scripts/, run once, commit script + patched JSON. Repeat runs дают identical output (validation harness в script ловит drift)."
  - "Module-scope memoization для filter() результатов на immutable bundled JSON — pattern для других runtime API на planetMap.json (lazy first-call, then cached)."

requirements-completed:
  - PHASE26-INHABITED-PLANETS
  - PHASE26-PLANET-SELECTION
  - PHASE26-PLANET-INHABITANT-TYPE

# Metrics
duration: ~10min (typecheck/test runs + file edits; npm ci excluded)
completed: 2026-05-18
---

# Phase 26 Plan 26-02: 30 habitable planets selection Summary

**Selected 30 habitable planets из 350 (deterministic Mulberry32, seed=19450718): 1 home + 2 colonies per race × 10 races. Помечены `inhabitant: {raceId, role}` в planetMap.json. Runtime API (`getHabitablePlanets/getPlanetInhabitant/getPlanetsByRace/HABITABLE_PLANET_IDS`) с module-scope memoization. 7 vitest invariants pass.**

## Objective recap

Без inhabitant'ов Plan 26-03 (Star Map glow/icon rendering) не имел бы данных для overlay. Plan 26-05 (first contact controller) не знал бы какой race ассоциирован с tapped planet. Selection должен быть deterministic (seed-based) и reproducible — re-run даёт identical JSON.

## What was built

### `client/src/store/cosmic/types.ts` (modified, +25 lines)
- Новый `PlanetInhabitant` interface с двумя полями: `raceId: RaceId` (из Plan 26-01 union), `role: 'home' | 'colony'`.
- JSDoc объясняет что planetMap.json shape не имеет full TS типа, optional `inhabitant?` присутствует на 30 of 350 entries, closest existing shape — PlanetMapEntry в starmap/types.ts.
- Импорт RaceId уже был там после Plan 26-01.

### `client/src/game/scenes/starmap/types.ts` (modified, +5 lines)
- Импорт type `PlanetInhabitant` из cosmic/types.
- `PlanetMapEntry` получил optional поле `inhabitant?: PlanetInhabitant`.
- JSDoc: "Phase 26 Plan 26-02 — optional race ownership; 30 of 350 entries set this".
- `[key: string]: unknown` index signature остался — explicit field даёт type-safe access без cast'ов в downstream rendering коде.

### `client/src/game/data/planetMap.json` (modified, +2.6 KB)
- 30 planet entries получили новое поле `inhabitant: { raceId, role }`.
- Total остался 350 planets (320 без inhabitant + 30 с).
- 'home' planet (id='home', player base) НЕ имеет inhabitant.
- Distribution: 10 home + 20 colonies, по 3 planets на каждую расу.

### `client/src/game/data/habitablePlanets.ts` (new, 79 lines)
- `PlanetWithInhabitant` interface — subset of PlanetMapEntry с **required** `inhabitant` (для downstream type safety).
- `getHabitablePlanets()` — lazy module-scope memoization (`cachedHabitable`).
- `getPlanetInhabitant(planetId)` — undefined если uninhabited.
- `getPlanetsByRace(raceId)` — длина 3 для всех 10 рас (invariant).
- `HABITABLE_PLANET_IDS: ReadonlySet<string>` — eager-init Set из 30 IDs для O(1) lookup'ов в render-loop'ах (Plan 26-03).

### `client/src/game/data/habitablePlanets.test.ts` (new, 67 lines)
- 7 vitest invariants:
  1. `getHabitablePlanets().length === 30`
  2. Каждая раса (10×) → 1 home + 2 colonies (структура per-race)
  3. Total: 10 home + 20 colonies
  4. `id='home'` (player base) → НЕ inhabitant
  5. `getPlanetInhabitant('definitely-not-real-id-12345')` → undefined
  6. `HABITABLE_PLANET_IDS.size === 30` + membership match
  7. All 30 IDs unique (`new Set(ids).size === 30`)

### `client/scripts/select_habitable_planets.cjs` (new, 240 lines)
- Standalone CommonJS reproducibility tool. Same convention как existing `verify_*` scripts и `check-translations.cjs`.
- Mulberry32 PRNG inline (6 lines + Fisher-Yates shuffle).
- `RACE_ORDER` hardcoded — должен совпадать с RACES в config/races.ts; canonical order из 26-CONTEXT.
- Selection algorithm с affinity-preference + fallback (см. "Selection algorithm decisions" ниже).
- Validation harness ловит drift (30 unique, 10 home, 20 colonies, 3 per race, 350 total, home untouched).
- Re-run idempotent: clears pre-existing `inhabitant` поля до selection, потом записывает.

## Selection algorithm decisions

### Seed value
**`SEED = 19450718`** = planetMap.json `meta.seed` (19450707) + 11. Derivative для:
- Distinct от base seed (19450707 уже использован для procedural generation в `StarMapScene` Mulberry — иначе мог бы быть collision).
- Deterministic-derived и self-documenting (любой может вычислить +11).

### PRNG choice
**Mulberry32** — 6 lines кода, well-known, deterministic для same seed. Не используется `Math.random()` (non-deterministic) или crypto (overkill).

### Affinity-first selection
Для каждой расы in canonical order:
1. **Matching pool** = planets where `planet.type === race.affinity` AND `planet.id !== 'home'` AND not already assigned.
2. Если matching pool **≥ 3** → shuffle + take первые 3.
3. Если matching pool **< 3** → fallback: take all matching кандидатов (preserving affinity preference where possible), потом добрать из shuffled `unassigned non-'home'` pool.

### Реальность данных vs spec
**ВСЕ 10 races попали в fallback ветку**: planetMap.json использует `planet.type` со значениями, отличающимися от race.affinity Element literals:

| Race affinity | Pool count | Race fell back? |
|---|---|---|
| crystal | 1 (planet 'bliks') | да (need 3, got 1 affinity match) |
| shadow | 1 (planet 'noctis') | да (same) |
| gas/fire/water/mechanical/plasma/forest/void/binary | 0 | да (no matches at all) |

→ 10/10 races используют fallback (документировано в Plan 26-02 deviation note ниже).

### Colony ordering
2 colonies per race sorted by `distFromHome ASC` после selection — colonies ближе к home расы (потенциально полезно для Plan 26-03 если colonies связаны линиями к home, и для UI flavor).

### Per-race assignments (output)

| Race | Affinity | Home planet | Colony 1 | Colony 2 |
|------|----------|-------------|----------|----------|
| crystalloids | crystal | bliks | lyor | bg_208 |
| gasouls | gas | bg_186 | bg_185 | bg_457 |
| mechanidons | mechanical | bg_753 | bg_793 | bg_706 |
| fireworms | fire | bg_635 | bg_960 | bg_370 |
| liquidoids | water | bg_82 | bg_522 | bg_931 |
| tenebrians | shadow | noctis | bg_564 | bg_499 |
| plasmaspirits | plasma | bg_553 | cairn | bg_580 |
| forestcores | forest | bg_760 | bg_489 | bg_275 |
| timeweavers | void | bg_98 | bg_827 | bg_24 |
| cometfolk | binary | bg_72 | bg_225 | bg_465 |

4 of 30 inhabited planets — 'main' kind (bliks/cairn/lyor/noctis). Остальные 26 — 'bg' kind. Сюрприз: tenebrians (shadow affinity) got `noctis` (planet.type='shadow') как home — это affinity-match preserved через fallback's "take matching first" branch.

## Stats final

- **Affinity-matched races:** 0/10 (matching pool ≥ 3 для нуля рас)
- **Fallback races:** 10/10 (все 10 рас попали в fallback — see note выше)
- **distFromHome stats (in DPR-units, см. meta.note):**
  - home planets: min=160, max=9969, mean=5652
  - colony planets: min=360, max=9946, mean=4980
  - all 30 inhabited: min=160, max=9969, mean=5204
- **Inhabited planet kind breakdown:** 4 main + 26 bg
- **File size delta:** planetMap.json grew 132,525 → 135,155 bytes (+2,630 bytes / +2.0%). Within expected ~+1.5KB band, slight overshoot due to JSON indent on nested inhabitant objects.

## Interfaces exported (downstream plans consume)

| Export | From | Used by |
|--------|------|---------|
| `PlanetInhabitant` (interface) | `store/cosmic/types` | Plan 26-03 (raceId/role → glow style), Plan 26-05 (controller payload) |
| `PlanetMapEntry.inhabitant?: PlanetInhabitant` (field) | `game/scenes/starmap/types` | Plan 26-03 (in-place check `if (planet.inhabitant)`), всех iterates over planetMap |
| `PlanetWithInhabitant` (interface) | `game/data/habitablePlanets` | (internal — exported для downstream type narrowing если потребуется) |
| `getHabitablePlanets()` | `game/data/habitablePlanets` | Plan 26-03 (iterate over 30 для glow rendering), Plan 26-04 если потребуется race-planet count |
| `getPlanetInhabitant(planetId)` | `game/data/habitablePlanets` | Plan 26-05 (resolve race для tapped planet ID) |
| `getPlanetsByRace(raceId)` | `game/data/habitablePlanets` | Plan 26-04/26-05 (per-race planet list если UI нужно показать) |
| `HABITABLE_PLANET_IDS` (Set) | `game/data/habitablePlanets` | Plan 26-03 (O(1) check в render-loop'е для cosmos-gate) |

## Validation results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS (clean across all touched files) |
| `npx vitest run src/game/data/habitablePlanets.test.ts` | PASS (7/7 tests) |
| Full `vitest run` | 104 PASS + 1 skip / 3 pre-existing FAIL (same profile как post-Plan 26-01; +7 = my new tests) |
| ESLint на touched files | habitablePlanets.ts/.test.ts/types.ts — 0 errors after `--fix`. Script .cjs has 2 `no-var-requires` errors (same pattern as existing `check-translations.cjs` — не run in CI per current eslint config). |
| planetMap.json invariants | PASS: 30 inhabited (10 home + 20 colonies), 10 races × 3, 350 total, home untouched |
| Reproducibility | PASS: 2 runs of script → byte-identical planetMap.json (diff /tmp/run1 ↔ /tmp/run2 returns 0) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Code style consistency] Prettier autofix on Task 2 files**
- **Found during:** Task 3 lint step
- **Issue:** Plan 26-02 не указал явно про prettier compliance, но project ESLint config имеет `prettier/prettier: 'error'` rule. Trailing commas в multi-line function args отсутствовали в новых файлах (habitablePlanets.ts и select_habitable_planets.cjs) — 9 prettier errors.
- **Fix:** `npx eslint --fix` на touched files. Cosmetic-only (trailing commas, "Insert `,`"). Re-running script даёт byte-identical planetMap.json — функциональность не затронута.
- **Files modified:** `client/src/game/data/habitablePlanets.ts`, `client/scripts/select_habitable_planets.cjs`
- **Commit:** 1a506f9 (bundled с Task 3 test commit)

**2. [Rule 2 — Foundation extension] Extend PlanetMapEntry с inhabitant?**
- **Found during:** Task 1 design
- **Issue:** Plan текст: "Если в коде есть существующий Planet interface — расширить его inhabitant?". В коде есть `PlanetMapEntry` (Phase 20-01 starmap/types.ts) — closest existing Planet TS shape, с `[key: string]: unknown` index signature. Plan didn't explicitly mandate extending его — но без этого downstream rendering код мог бы trip на `(planet as any).inhabitant` cast'ах вместо typed access.
- **Fix:** Добавил `inhabitant?: PlanetInhabitant` explicit field в PlanetMapEntry (+ import type). Index signature остался для остальных fields. Все existing usages PlanetMapEntry в StarMapScene/planetarium продолжают работать без изменений (optional field).
- **Files modified:** `client/src/game/scenes/starmap/types.ts`
- **Commit:** a4309d6 (bundled с Task 1)

### Acknowledged: All 10 races fell into fallback branch (not a deviation, expected behavior)
- **Reason:** planetMap.json's `planet.type` values (rocky, mystic, organic, forge, ...) don't match the 16-element Element union literals (fire/gas/water/mechanical/plasma/forest/void/binary). Only `crystal` and `shadow` types are present as 1-each.
- **Outcome:** Plan's algorithm explicitly handles this — "Если matching pool < 3: fallback". All 10 races got 3 deterministic planets via fallback. Не bug, expected per plan algorithm design.
- **Documentation:** Per-race table outputs в SUMMARY показывает что 2 рас (crystalloids/tenebrians) получили affinity-matched home planet (bliks/noctis) даже через fallback, что аккуратно preserves intent.

## Threat Flags

(empty — no new security surface introduced; threat model in 26-02-PLAN covers все 4 STRIDE items)

## Downstream blockers cleared

- **Plan 26-03 (Star Map glow rendering):** HABITABLE_PLANET_IDS Set + getHabitablePlanets()[i].inhabitant.raceId + getRaceColor(raceId) (from Plan 26-01) → full data chain для glow Phaser sprite/Graphics rendering.
- **Plan 26-05 (First contact controller):** getPlanetInhabitant(tappedPlanetId) → resolves {raceId, role} → controller проверяет firstContactsSeen[raceId] (Plan 26-01 slice) → triggers cinematic.
- **Plan 26-04 (Inventory tab):** Optional getPlanetsByRace(raceId) если UI хочет показать "N planets discovered" per race row.

## Commits (in order)

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | a4309d6 | feat | add PlanetInhabitant type + extend PlanetMapEntry |
| 2 | d541b80 | feat | 30 habitable planets selection + helpers + script |
| 3 | 1a506f9 | test | 7 vitest invariants for habitablePlanets + prettier autofix |

## Reproducibility note

`client/scripts/select_habitable_planets.cjs` — committed reproducibility tool. Re-run:

```bash
cd client && node scripts/select_habitable_planets.cjs
```

Output: byte-identical planetMap.json (verified via `diff` of two consecutive runs). Если seed нужно изменить (e.g. для re-distribution в будущем — race re-balance), edit `SEED` constant в script (line ~45), re-run. Validation harness в script ловит invariant violations при run-time.

## Success criteria checklist

- [x] `PlanetInhabitant` type + export (cosmic/types.ts) + extended PlanetMapEntry
- [x] 30 inhabitant'ов attached в planetMap.json (10 home + 20 colony per race × 10 races)
- [x] Selection deterministic (seed=19450718 + Mulberry32 + RACE_ORDER hardcoded в commit'нутом script)
- [x] Runtime helpers (`getHabitablePlanets`, `getPlanetInhabitant`, `getPlanetsByRace`, `HABITABLE_PLANET_IDS`) работают и memoize'ятся
- [x] 7 vitest tests pass
- [x] Affinity preference применён where possible (fallback documented for all 10 races due to planet.type-vs-Element mismatch — expected per algorithm)
- [x] Reproducible: 2 runs of script → identical JSON
- [x] tsc clean + target tests pass + full suite не regressed (same 3 pre-existing failures from Plan 26-01 deferred-items)

## Self-Check: PASSED

- `client/src/game/data/habitablePlanets.ts` — exists ✓
- `client/src/game/data/habitablePlanets.test.ts` — exists ✓
- `client/scripts/select_habitable_planets.cjs` — exists ✓
- `client/src/game/data/planetMap.json` modified (30 inhabitant entries) — verified via python ✓
- Commit a4309d6 (PlanetInhabitant type + PlanetMapEntry extend) — found in git log ✓
- Commit d541b80 (selection + helpers + script) — found in git log ✓
- Commit 1a506f9 (tests + prettier autofix) — found in git log ✓
- `npx tsc --noEmit` clean — verified ✓
- `npx vitest run src/game/data/habitablePlanets.test.ts` — 7/7 PASS verified ✓
- planetMap.json invariants — python script confirms 30 inhabited, 10 home, 20 colony, 10 races × 3, 350 total, home untouched ✓
