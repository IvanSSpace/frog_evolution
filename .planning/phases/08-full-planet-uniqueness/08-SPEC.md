# Phase 8: Full Planet Uniqueness — Specification

**Created:** 2026-05-07
**Ambiguity score:** 0.13 (gate: ≤ 0.20)
**Requirements:** 6 locked

## Goal

Каждая из 1000 планет (16 main + 984 BG) звучит уникально, имеет уникальную анимацию по строгому критерию (signature + параметры) и уникальную текстуру — без единой коллизии в трёх axes (anim/texture/sound) при сохранении тематической стилистики архетипа.

## Background

После Phase 7 для 450 планет уникальность была подтверждена (100% anim, 100% texture). Текущее состояние planetMap.json — **1000 планет** (`mainCount=16, bgCount=984`), что значит после Phase 7 был выполнен скейлинг до 1000, и unique-проверки Phase 7 сейчас показывают:
- **Анимации:** 1000/1000 unique по signature, но критерий слабый — учитывает только sorted comp set + modifier flag + theme. Не отлавливает коллизии параметров (цвет, scale, rotation в близких бинах).
- **Текстуры:** 983/984 unique. 1 collision: `2x dead:v2:c1-2:m1100`.
- **Звуки:** В `client/src/audio/planetVoice.ts` всего 28 type/archetype профилей. ~36 планет в среднем шарят один тембр идентично. Per-planet variation — нулевой.
- **88 компонентов анимации** (`COMP_DURATIONS_MS` в `StarMapScene.ts`) распределены по `THEME_COMPONENTS` pool'ам разной мощности (1-21 на тип). Малые pool'ы у main-типов (home, crystal, rocky, etc.) ограничивают возможности уникальности.

Эта фаза доводит уникальность до 100% по всем трём axes, расширяет animation pool новыми компонентами (>88), и вводит per-planet sound modulation на основе seed.

## Requirements

1. **Strict animation signature**: Уникальность анимации по более строгому критерию.
   - Current: signature = `sorted_comp_ids + modifier_flag + theme` (Phase 7). 1000/1000 unique но не учитывает параметры.
   - Target: signature расширена квантованными параметрами (modifier rotation в 4 бина, modifier scale в 4 бина, цветовая палитра pick), при котором два recipe с одинаковыми component ids но разной комбинацией параметров считаются разными.
   - Acceptance: `verify_anim_uniqueness_strict.cjs` (новый скрипт) выдаёт 1000/1000 unique signatures по новому критерию; 0 collisions.

2. **Texture uniqueness 100%**: Все 984 BG планеты имеют уникальную texture-signature.
   - Current: 983/984 (1 collision `2x dead:v2:c1-2:m1100`).
   - Target: 984/984 unique через расширение `buildTextureSignature` (учёт sub-variant парам) + seed refinement до 0 conflicts.
   - Acceptance: `verify_texture_uniqueness.cjs` показывает 0 unresolved conflicts.

3. **Per-planet sound uniqueness**: Все 1000 планет звучат различимо.
   - Current: 28 archetype/type профилей в `planetVoice.ts`. ~36 планет в среднем играют идентичный звук.
   - Target: к profile'у добавлены per-planet модуляции, детерминированные по seed: pitch shift ±5 semitones, перестановка нот аккорда, detune ±15¢, filter cutoff variation. Sound signature = `archetype + pitchShift + noteOrder + detune + cutoffBin` уникальна для каждой из 1000 планет.
   - Acceptance: новый скрипт `verify_sound_uniqueness.cjs` подтверждает 1000/1000 unique sound signatures.

4. **Animation pool expansion**: Расширить набор компонентов > 88.
   - Current: 88 компонентов (`runAnimComponent` switch до case 87).
   - Target: ≥ 96 компонентов (минимум +8 новых: для main-типов с маленькими pool'ами добавить ≥1 уникальный компонент each).
   - Acceptance: `runAnimComponent` switch покрывает индексы 0..95+; `COMP_DURATIONS_MS` содержит ≥ 96 записей.

5. **Theme pool minimums**: Каждый archetype/type имеет достаточный pool.
   - Current: главные типы home/crystal/rocky/ancient/mystic/organic/forge/military/destroyed имеют 1 уникальную планету каждый (16 main races) — pool size недостаточно тестировался при 1 планете.
   - Target: каждый theme в `THEME_COMPONENTS` содержит ≥ 12 компонентов в pool (увеличено с текущих 10-21).
   - Acceptance: `Object.values(THEME_COMPONENTS).every(p => p.length >= 12) === true`.

6. **Bundle budget**: Прирост bundle ≤ +50KB gzipped к текущему состоянию.
   - Current: index chunk ~196KB gzipped (last build).
   - Target: после фазы 8 — index chunk ≤ 246KB gzipped. Tone.js chunk не растёт.
   - Acceptance: `npm run build` показывает прирост index chunk gzipped ≤ 50KB.

## Boundaries

**In scope:**
- Strict animation signature criterion (signature + quantized params)
- Animation pool expansion: ≥ 8 новых компонентов (с sound-style descriptions)
- Animation pool minimums: каждый theme ≥ 12 компонентов
- Texture uniqueness fix: 984/984 (resolve 1 collision)
- Per-planet sound modulation system: pitch / note permutation / detune / cutoff
- Sound uniqueness verifier (`verify_sound_uniqueness.cjs`)
- Animation uniqueness verifier обновлён под strict criterion
- COMP_DURATIONS_MS extended для новых компонентов
- Visual smoke test: 5 случайных планет каждого archetype звучат и анимируются по-разному

**Out of scope:**
- SFX лягушек (pickup/drop/merge/evolve) — backlog Phase 9. Юзер явно отметил OUT.
- Музыкальные треки (`audio/tracks/*`) — отдельная независимая система, без коллизий.
- Scaling planet count за пределы 1000 — этой фазы это не касается.
- Серверная синхронизация sound preferences — только localStorage.
- Visual perceptual hash (image diff) — слишком тяжело для CI; signature+params достаточно.
- Procedural sound generation на основе цвета/размера планеты (нелинейные mappings) — overengineering для MVP.

## Constraints

- **Bundle:** прирост index chunk ≤ +50KB gzipped относительно текущего baseline.
- **Determinism:** все per-planet параметры (anim recipe, sound modulations) детерминированы по `animRng(sys)` seed — два запуска дают идентичный результат для одной планеты.
- **TypeScript:** компиляция чистая (`npx tsc --noEmit` returns 0 errors).
- **Build:** `npm run build` проходит без warnings уровня error.
- **Backward compat:** существующие планеты не меняют id, type, archetype в planetMap.json; меняется только runtime-генерация anim/sound.

## Acceptance Criteria

- [ ] `verify_anim_uniqueness_strict.cjs` отдаёт `1000/1000 unique` под strict signature criterion (signature + quantized params)
- [ ] `verify_texture_uniqueness.cjs` отдаёт `984/984 unique` (0 unresolved conflicts)
- [ ] `verify_sound_uniqueness.cjs` отдаёт `1000/1000 unique` sound signatures
- [ ] `runAnimComponent` switch содержит ≥ 96 cases (88 → ≥ 96)
- [ ] `COMP_DURATIONS_MS` содержит ≥ 96 записей
- [ ] `Object.values(THEME_COMPONENTS).every(p => p.length >= 12) === true`
- [ ] `client/src/audio/planetVoice.ts`: при `play(type, dur)` две планеты одного archetype с разным `seed` дают различимо разные tone-параметры (pitch / detune / cutoff / note order)
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run build` проходит, index chunk gzipped ≤ baseline + 50KB
- [ ] Smoke: для каждого из 28 archetype/type выбраны 5 случайных планет → ручное прослушивание подтверждает что звучат различимо (не идентично) и в стилистике своего архетипа

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                         |
|--------------------|-------|------|--------|---------------------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | Goal: 100% уникальность по 3 axes, signature+params criterion |
| Boundary Clarity   | 0.92  | 0.70 | ✓      | SFX лягушек явно OUT, perceptual hash OUT                     |
| Constraint Clarity | 0.85  | 0.65 | ✓      | +50KB bundle budget, determinism, tsc clean                   |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 10 falsifiable checkboxes                                     |
| **Ambiguity**      | 0.13  | ≤0.20| ✓      |                                                               |

## Interview Log

| Round | Perspective     | Question summary                                | Decision locked                                                |
|-------|-----------------|-------------------------------------------------|----------------------------------------------------------------|
| 1     | Researcher      | Что считать "повтором" анимации?                | Strict: signature + quantized parameters (rotation/scale bins) |
| 1     | Researcher      | Как различать звуки 1000 планет в архетипе?     | Per-planet модуляции от seed (pitch/note order/detune/cutoff)  |
| 2     | Simplifier      | Что обработать в Phase 8?                       | Anim params + per-planet sound + новые компоненты (>88)        |
| 2     | Boundary Keeper | Порог уникальности?                             | 100% по всем axes (anim, texture, sound = 1000/1000)           |
| 3     | Boundary Keeper | SFX лягушек — этой фазы или backlog?            | Out of scope этой фазы (Phase 9 candidate)                     |
| 3     | Constraint      | Performance budget?                             | Bundle: ≤ +50KB gzipped к текущему состоянию                   |

---

*Phase: 08-full-planet-uniqueness*
*Spec created: 2026-05-07*
*Next step: /gsd-discuss-phase 8 — implementation decisions (как считать quantized params, формат sound signature, какие именно новые компоненты добавить)*
