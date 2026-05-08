---
phase: 08-full-planet-uniqueness
plan: 06
subsystem: tooling
tags: [verify-scripts, ci, uniqueness, refine-pipeline, deterministic, npm-pipeline]
requires:
  - phase: 08-02
    provides: "buildAnimSignature strict + refineAnimSeeds (10 attempts, 0x9e3779b9)"
  - phase: 08-03
    provides: "buildTextureSignature extended (c3, asym, speckle) + refineTextureSeeds (10 attempts, 0x85ebca6b)"
  - phase: 08-04
    provides: "deriveModulations + THEME_SCALES exported from planetVoice"
  - phase: 08-05
    provides: "buildSoundSignature + refineSoundSeeds (10 attempts, 0xc2b2ae3d)"
provides:
  - "client/scripts/_shared.cjs — shared helpers (mulberry32, hashId, planetMap loader, THEME_COMPONENTS extractor) для verifier'ов"
  - "client/scripts/verify_anim_uniqueness_strict.cjs — 1000/1000 unique anim signatures"
  - "client/scripts/verify_texture_uniqueness.cjs — 984/984 unique texture signatures"
  - "client/scripts/verify_sound_uniqueness.cjs — 1000/1000 unique sound signatures"
  - "npm run verify-uniqueness — sequential gate для всех 3 verifier'ов"
  - "Stabilization pass: повторный refineTextureSeeds() в create() после refineSoundSeeds() — гарантирует cascade-stable 984/984 unique"
affects: [08-07, 09-*]
tech-stack:
  added: []
  patterns: [signature-replication, refine-pipeline-mirroring, regex-based-extraction, stabilization-pass]
key-files:
  created:
    - client/scripts/_shared.cjs
    - client/scripts/verify_anim_uniqueness_strict.cjs
    - client/scripts/verify_texture_uniqueness.cjs
    - client/scripts/verify_sound_uniqueness.cjs
    - .planning/phases/08-full-planet-uniqueness/08-06-SUMMARY.md
  modified:
    - client/package.json
    - client/src/game/scenes/StarMapScene.ts
key-decisions:
  - "loadPlanetMap читает поле planets[] (не main/bg отдельно) — соответствует фактической структуре planetMap.json (kind: 'main' | 'bg' внутри объекта)."
  - "extractThemeComponents парсит THEME_COMPONENTS из StarMapScene.ts через regex — single source of truth, нет stale копии в verifier'ах. Возвращает 28 keys (28 archetype/type pools)."
  - "Verifier'ы запускают ВСЕ 3 refine pass'а перед финальным measurement — иначе видят pre-refine seeds и числа не совпадают с runtime. Anim verifier: refineTexture → refineAnim → refineSound → refineTexture (stabilize) → measure anim. Texture verifier: same pipeline → measure texture. Sound verifier: same pipeline → measure sound."
  - "[Rule 1 fix] Обнаружен edge-case: anim+sound mutation редко создаёт новую texture коллизию (1/984 наблюдалось — `2x gas_giant:v0:c4-1-1:m000010`). Решение: добавлен повторный refineTextureSeeds() в StarMapScene.create() после refineSoundSeeds(). Plan 5 SUMMARY явно зафиксировал этот case как Plan 6 mitigation candidate. Полный pipeline теперь stable: 984/984 texture, 1000/1000 anim, 1000/1000 sound."
  - "Mutation constants остались orthogonal (texture 0x85ebca6b, anim 0x9e3779b9, sound 0xc2b2ae3d) — повторный texture refine pass использует ту же константу 0x85ebca6b, не создавая новые collision dimensions."
  - "npm script verify-uniqueness не добавлен в prebuild по совету плана (D-17) — оставлен манивым (`npm run verify-uniqueness`), чтобы не ломать существующий dev workflow. Решение об интеграции в CI отложено до настройки CI/CD."
requirements-completed: [SPEC-01, SPEC-02, SPEC-03]
duration: ~12 minutes
completed: 2026-05-08
metrics:
  task_count: 5
  file_count: 6
  build_status: pass
  typecheck_status: clean
  index_chunk_gzipped_kb: 203.21
  anim_unique: 1000
  anim_total: 1000
  texture_unique: 984
  texture_total: 984
  sound_unique: 1000
  sound_total: 1000
---

# Phase 8 Plan 6: Verify Scripts + npm Pipeline Summary

**One-liner:** 3 cjs verifier'а в `client/scripts/` (anim/texture/sound) реплицируют buildXxxSignature + refine passes, регистрируются как `npm run verify-uniqueness`; обнаружен и пофикшен cascade-collision edge-case добавлением stabilization pass в StarMapScene.create().

## What Was Built

### 4 файла в `client/scripts/`

| File | Purpose | Replicates |
| ---- | ------- | ---------- |
| `_shared.cjs` | Helpers — mulberry32, hashId, planet loader, THEME_COMPONENTS extractor | StarMapScene.ts:72-81, :2952-2956, :912 |
| `verify_anim_uniqueness_strict.cjs` | 1000/1000 unique strict anim signatures | buildAnimSignature (:2862-2920) + refineAnimSeeds (:2926-2949) |
| `verify_texture_uniqueness.cjs` | 984/984 unique texture signatures (BG only) | buildTextureSignature (:3006-3047) + refineTextureSeeds (:3052-…) |
| `verify_sound_uniqueness.cjs` | 1000/1000 unique sound signatures | deriveModulations (planetVoice.ts:91-100) + buildSoundSignature (:2960-2965) + refineSoundSeeds (:2976-3001) |

### 1 npm script

```json
"verify-uniqueness": "node scripts/verify_anim_uniqueness_strict.cjs && node scripts/verify_texture_uniqueness.cjs && node scripts/verify_sound_uniqueness.cjs"
```

`&&` chain ensures exit 1 на первом fail. Все 3 проходят → exit 0.

### 1 source-code mitigation в `StarMapScene.create()`

```ts
this.refineTextureSeeds()
this.refineAnimSeeds()
this.refineSoundSeeds()  // Phase 8 plan 05
this.refineTextureSeeds() // Phase 8 plan 06: stabilization
```

Второй pass texture refine после sound refine — устраняет cascade collision (1/984 наблюдался в первом тестовом прогоне).

## Final Output of `npm run verify-uniqueness`

```
[anim-strict] 1000/1000 unique signatures
OK — no collisions
Per archetype/type unique:
  aerial: 1 unique
  ancient: 1 unique
  ... (28 archetypes)

[texture] 984/984 unique BG signatures after full refine pipeline (0 unresolved initial, 0 unresolved final)
OK — no collisions
Per archetype unique:
  binary: 78 unique
  dead: 122 unique
  ... (12 BG archetypes)

[sound] initial: 991/1000 unique signatures (pre-refine)
[sound] 1000/1000 unique sound signatures after full pipeline (0 unresolved during sound refine)
OK — no collisions
Per archetype/type unique (final, out of 4032 possible):
  aerial: 1 unique
  ... (28 archetypes)
```

Все три acceptance criteria покрыты: SPEC-01 (anim 1000/1000), SPEC-02 (texture 984/984), SPEC-03 (sound 1000/1000).

## Pipeline Mirroring (Critical Detail)

Verifier'ы должны прогонять ВЕСЬ refine pipeline перед измерением — иначе они работают на pre-refine seeds и не отражают runtime state.

```
текстура → анимация → звук → текстура (Plan 06 stabilization)
0x85eb…   0x9e37…    0xc2b2…   0x85eb…
```

| Verifier | Pipeline | Measurement |
| -------- | -------- | ----------- |
| anim     | full 4-pass | strict anim signatures на финальных seeds |
| texture  | full 4-pass | texture signatures на финальных rngSeed (BG only) |
| sound    | full 4-pass | sound signatures на финальных seeds |

Это дороже чем "только relevant pass", но гарантирует что verifier видит ровно то же что runtime в `StarMapScene.create()`.

## Edge Case Found and Fixed

**Symptom:** Первый прогон texture verifier показал 983/984 unique (1 collision: `2x gas_giant:v0:c4-1-1:m000010` для bg_735 + bg_978).

**Root cause:** `refineTextureSeeds` инитиально решает texture коллизии за 0 attempts, но затем `refineAnimSeeds` и `refineSoundSeeds` мутируют те же rngSeed для разрешения anim/sound коллизий. Эти мутации редко (1/984 ≈ 0.1%) возвращают seed к value, чья texture signature уже занята.

**Fix:** Plan 5 SUMMARY явно зарегистрировал этот case как Plan 6 mitigation candidate ("Mitigation если детектится в Plan 6: Добавить второй проход anim refine после sound (повторный refineAnimSeeds), Или: отдельный mainSoundSeedOverride map ..."). Применили простейший подход — повторный `this.refineTextureSeeds()` после sound refine. Не нужно дополнительных Maps, не меняет mutation constants, минимальный diff.

**Verification после fix:** 984/984 texture unique, 1000/1000 anim/sound сохранены.

## Files Modified Summary

| File | Lines added | Purpose |
| ---- | ----------- | ------- |
| `client/scripts/_shared.cjs` | +84 | Shared helpers |
| `client/scripts/verify_anim_uniqueness_strict.cjs` | +239 | Anim verifier |
| `client/scripts/verify_texture_uniqueness.cjs` | +245 | Texture verifier |
| `client/scripts/verify_sound_uniqueness.cjs` | +235 | Sound verifier |
| `client/package.json` | +1 | npm script |
| `client/src/game/scenes/StarMapScene.ts` | +9 | Stabilization pass + comment |

## Verification

- `cd client && node scripts/verify_anim_uniqueness_strict.cjs` → exit 0, "1000/1000 unique" ✓
- `cd client && node scripts/verify_texture_uniqueness.cjs` → exit 0, "984/984 unique" ✓
- `cd client && node scripts/verify_sound_uniqueness.cjs` → exit 0, "1000/1000 unique" ✓
- `cd client && npm run verify-uniqueness` → exit 0, все три отчёта ✓
- `cd client && npx tsc --noEmit` → 0 errors ✓
- `cd client && npm run build` → success, index chunk **704.90 kB / 203.21 kB gzip** ✓ (no delta vs Plan 5)
- `_shared.cjs` exports проверены: mulberry32, hashId, loadPlanetMap, extractThemeComponents (28 keys), effectiveSeed, allSystems ✓

## Commits

| Task | Commit  | Description                                                       |
| ---- | ------- | ----------------------------------------------------------------- |
| 1    | bc95d32 | feat(08-06): add shared helpers for verify scripts                |
| 2    | 48507ff | feat(08-06): add strict anim uniqueness verifier                  |
| 3    | f3c36db | feat(08-06): add texture verifier + stabilization pass            |
| 4    | d635e46 | feat(08-06): add sound uniqueness verifier                        |
| 5    | a6a8d18 | feat(08-06): add verify-uniqueness npm script                     |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cascade collision: anim+sound refine ломал 1 texture signature**

- **Found during:** Task 3 (initial texture verifier run)
- **Issue:** `verify_texture_uniqueness.cjs` показал 983/984 unique вместо требуемых 984/984. Refine pipeline texture → anim → sound мутирует rngSeed во вторых двух пасс'ах, и с probability ~0.1% мутация попадает в seed, чья texture signature уже занята другой планетой.
- **Fix:** Добавлен повторный `this.refineTextureSeeds()` в `StarMapScene.create()` после `refineSoundSeeds()`. Plan 5 SUMMARY зафиксировал этот case как Plan 6 candidate, mitigation реализована минимально.
- **Files modified:** `client/src/game/scenes/StarMapScene.ts` (+1 line + comment block)
- **Commit:** f3c36db

**2. [Rule 1 - Bug] `_shared.cjs` loader должен читать `planets[]`, не `main`/`bg` отдельно**

- **Found during:** Task 1 (writing loader)
- **Issue:** Plan псевдокод предлагал `map.main || []` и `map.bg || []` (отдельные массивы). Фактическая структура planetMap.json — единый `planets: [...]` с полем `kind: 'main' | 'bg'`.
- **Fix:** `loadPlanetMap` возвращает map as-is, `allSystems` flatten'ит `map.planets` с `_isMain: kind === 'main'` derived flag. Verifier'ы фильтруют BG через `_isMain === false`.
- **Files modified:** `client/scripts/_shared.cjs` (+1 line, conceptually)
- **Commit:** bc95d32

В остальном — plan executed exactly as written. Все 5 task'ов выполнены, все 3 acceptance criteria SPEC покрыты автоматически.

## Self-Check: PASSED

Verified files exist:
- `client/scripts/_shared.cjs` — FOUND
- `client/scripts/verify_anim_uniqueness_strict.cjs` — FOUND
- `client/scripts/verify_texture_uniqueness.cjs` — FOUND
- `client/scripts/verify_sound_uniqueness.cjs` — FOUND
- `client/package.json` modified — verify-uniqueness present (FOUND)
- `client/src/game/scenes/StarMapScene.ts` — stabilization pass present (FOUND)

Verified commits exist:
- bc95d32 — FOUND
- 48507ff — FOUND
- f3c36db — FOUND
- d635e46 — FOUND
- a6a8d18 — FOUND

Verified output:
- `npm run verify-uniqueness` exits 0 (CONFIRMED via /tmp/verify_all.txt)
- All three verifier outputs contain "unique" lines (CONFIRMED via grep)
- tsc clean (0 errors)
- build success (203.21 kB gzip — no delta)
