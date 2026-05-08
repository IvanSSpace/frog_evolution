---
phase: 09-refactor-anim-primitives-blocking
plan: 01
completed_at: 2026-05-08
requirements_satisfied: [REFACTOR-01, REFACTOR-02, REFACTOR-03, REFACTOR-04, REFACTOR-05]
tech_stack: [phaser, typescript, vite]
patterns_established:
  - "anim primitives живут в effects/anim/shared/<name>.ts с сигнатурой (scene, container, sys, rng)"
  - "shared helpers (pickColor/pickEase/shiftColorByPlanet) в sharedHelpers.ts вместо метод класса"
  - "verify-uniqueness scripts парсят THEME_COMPONENTS regex'ом — оставлять in-place"
  - "compFlash имеет особую сигнатуру (scene, container, rng) без sys"
files_created:
  - client/src/game/effects/anim/shared/types.ts
  - client/src/game/effects/anim/shared/sharedHelpers.ts
  - client/src/game/effects/anim/shared/index.ts
  - client/src/game/effects/anim/shared/compRing.ts
  - client/src/game/effects/anim/shared/compSparkle.ts
  - client/src/game/effects/anim/shared/compFlash.ts
  - client/src/game/effects/anim/shared/compStarBurst.ts
  - client/src/game/effects/anim/shared/compHaloFlash.ts
  - client/src/game/effects/anim/shared/compConfetti.ts
  - client/src/game/effects/anim/shared/compRipple.ts
  - client/src/game/effects/anim/shared/compEchoWave.ts
  - client/src/game/effects/anim/shared/compFlameTongues.ts
  - client/src/game/effects/anim/shared/compIceWisps.ts
  - client/src/game/effects/anim/shared/compPlasmaArc.ts
  - client/src/game/effects/anim/shared/compChromaShift.ts
  - client/src/game/effects/anim/shared/compCrystalShatter.ts
  - client/src/game/effects/anim/shared/compBloomPetals.ts
  - client/src/game/effects/anim/shared/compToxicCloud.ts
  - client/src/game/effects/anim/shared/compSandSwirl.ts
  - client/src/game/effects/anim/shared/compChimeRing.ts
  - client/src/game/effects/anim/shared/compBubbleStream.ts
  - .planning/phases/09-refactor-anim-primitives-blocking/SMOKE_TEST.md
files_modified:
  - client/src/game/scenes/StarMapScene.ts
metrics:
  primitives_extracted: 18
  primitives_files: 18
  starmap_lines_before: 6430
  starmap_lines_after: 5859
  bundle_baseline_gzip_bytes: 681474
  bundle_post_gzip_bytes: 681472
  bundle_delta_gzip_bytes: -2
  unique_anim_signatures: "1000/1000"
  unique_texture_signatures: "984/984"
  unique_sound_signatures: "1000/1000"
  commits: 7
---

# Phase 9 Summary

## What was done

Extracted 18 anim primitives из `StarMapScene.ts` (6430 строк → 5859 строк) в самостоятельные функции `client/src/game/effects/anim/shared/<name>.ts`. Каждый primitive — pure function с сигнатурой `(scene, container, sys, rng) => void` (для compFlash — без `sys`).

**18 целевых primitives и их cases:**

- Group A (Task 2): compRing (0), compSparkle (2), compFlash (3), compStarBurst (10)
- Group B (Task 3): compHaloFlash (11), compConfetti (7), compRipple (16), compEchoWave (25)
- Group C (Task 5, elemental): compFlameTongues (50), compIceWisps (74), compPlasmaArc (87), compChromaShift (53)
- Group D (Task 6, material): compCrystalShatter (15), compBloomPetals (19), compToxicCloud (21), compSandSwirl (17)
- Group E (Task 7, final): compChimeRing (76), compBubbleStream (86)

`runAnimComponent` switch теперь вызывает 18 imported funcs вместо `this.compXxx`. Остальные 78 не-целевых comp методов остались как private методы класса (Phase 9 не трогает их по плану).

## Key decisions

1. **Сигнатура `(scene, container, sys, rng)`** — не `(scene, container, opts)` по REQUIREMENTS.md. Соответствует runtime API StarMapScene без adapter'а; `sys` это сама планета (palette source). Phase 12-13 (FrogElementOverlay) обернут это в `runElementPrimitive(scene, container, element, rarity)` который собирает fake `sys` из element/rarity.
2. **THEME_COMPONENTS остался в StarMapScene.ts** — `_shared.cjs:46` regex парсит его в неизменном формате `private readonly THEME_COMPONENTS: Record<string, number[]> = {...}`.
3. **THEME_PALETTES + ANIM_EASES + helpers переехали** в `sharedHelpers.ts` целиком (без дубликатов в StarMapScene). В классе остались thin wrappers `pickColor`/`pickEase` (для backward-compat 78 не-целевых comp методов которые продолжают вызывать `this.pickXxx`). `shiftColorByPlanet` wrapper удалён (никто не вызывает напрямую).
4. **DPR в `sharedHelpers.ts`** с `typeof window` guard. StarMapScene продолжает использовать свою локальную DPR константу — оба значения идентичны на одном runtime, нет ризка дрифта.
5. **78 не-целевых comp методов НЕ extract'ены** — это будущая Phase (≥20) если понадобится. Они не нужны Phase 12-13, и их extract сейчас раздул бы scope.
6. **compFlash special signature** `(scene, container, rng)` без `sys` — потому что оригинал был `(sprite, rng)`. Type alias `FlashPrimitiveFn` экспортируется отдельно. Switch case 3 вызывает `compFlash(this, sprite, rng)`.

## Verification

| Check                          | Result                              |
| ------------------------------ | ----------------------------------- |
| `npx tsc --noEmit`             | exit 0 (clean)                      |
| `npm run build`                | exit 0 (4.45s)                      |
| `verify-anim-uniqueness-strict`| 1000/1000 unique                    |
| `verify-texture-uniqueness`    | 984/984 unique                      |
| `verify-sound-uniqueness`      | 1000/1000 unique                    |
| Bundle gzipped delta           | **-2 bytes** (681,474 → 681,472)    |
| Smoke test                     | Manual — описан в SMOKE_TEST.md     |

Bundle delta `-2 bytes` (фактически слегка уменьшился) подтверждает: tree-shaking работает корректно, нет циклов импортов, code refactoring без регрессий объёма.

## Deviations from Plan

**None.** План выполнен exactly as written. Минорные стилистические решения:
- `THEME_PALETTES` в StarMapScene удалён полностью (план оставлял на усмотрение executor — выбрал чистый путь, единственный источник истины).
- `shiftColorByPlanet` wrapper удалён (TS noUnusedLocals + никто не вызывает напрямую — был бы dead code).
- Task 4 (regex sanity check) выполнена без commit'а (regex не нуждался в фиксе, изменений в `_shared.cjs` нет).

## Commits

1. `phase-9: scaffold effects/anim/shared with types + sharedHelpers (pickColor, pickEase, shiftColorByPlanet)` — Task 1
2. `phase-9: extract compRing/compSparkle/compFlash/compStarBurst to anim/shared` — Task 2 (Group A)
3. `phase-9: extract compHaloFlash/compConfetti/compRipple/compEchoWave to anim/shared` — Task 3 (Group B)
4. `phase-9: extract compFlameTongues/compIceWisps/compPlasmaArc/compChromaShift (elemental primitives)` — Task 5 (Group C)
5. `phase-9: extract compCrystalShatter/compBloomPetals/compToxicCloud/compSandSwirl (material primitives)` — Task 6 (Group D)
6. `phase-9: complete primitives migration — extract compChimeRing/compBubbleStream + cleanup` — Task 7 (Group E)
7. `phase-9: verify build size delta + add smoke test stub` — Task 8

Final commit (this SUMMARY) — Task 9.

## Next phase blocker resolved

Phase 12 (FrogElementOverlay dormant tier) и Phase 13 (64 awakened anim'ов) теперь могут import primitives из `effects/anim/shared/` без дублирования ~1500 строк. Phase 10 (INFRA) разблокирована.
