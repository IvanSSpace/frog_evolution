# Phase 8: Full Planet Uniqueness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 08-full-planet-uniqueness
**Areas discussed:** Strict animation signature, Per-planet sound modulation, Sound signature & verifier

---

## Strict Animation Signature

### Параметры в strict signature

| Option | Description | Selected |
|--------|-------------|----------|
| Recipe + modifier rot/scale (минимум) | components + modifier_flag + theme + rotation_bin(4) + scale_bin(4). ~16x вариаций. | |
| Recipe + modifier + hue + delays (рекомендую) | + hue_shift_bin(8) + per-comp delay_bin(3). ~384x вариаций. | ✓ |
| + first pickColor() | + 16 color bins. ~6000x вариаций. Избыточно. | |

**User's choice:** Recipe + modifier + hue + delays
**Notes:** Запас на будущее без overhead.

### Seed-refine attempts

| Option | Description | Selected |
|--------|-------------|----------|
| 5 попыток (Phase 7) | XOR-mutate seed, max 5 attempts. | |
| 10 попыток (рекомендую) | Запас для строгого 100%. | ✓ |
| Loop без limit | До полной развязки, warning >20. | |

**User's choice:** 10 попыток

---

## Per-Planet Sound Modulation

### Алгоритм комбинирования

| Option | Description | Selected |
|--------|-------------|----------|
| 4 независимых RNG calls | Каждый параметр из отдельного rng(). | |
| Compound: archetype-ограниченные диапазоны (рекомендую) | Pitch в скале архетипа, notes в chord, detune по стилистике. | ✓ |
| Hybrid base + per-archetype tweaks | Базовые диапазоны + override per archetype. | |

**User's choice:** Compound: archetype-ограниченные диапазоны

### Pitch shift диапазон

| Option | Description | Selected |
|--------|-------------|----------|
| ±5 semitones (из SPEC) | 11 chromatic вариаций. | |
| Per-archetype scale notes (рекомендую) | 7 ступеней × 2 октавы = 14 вариаций в тональности. | ✓ |
| ±7 (больше диапазон) | 15 chromatic, может уйти от характера. | |

**User's choice:** Per-archetype scale notes

### Note rotation + detune

| Option | Description | Selected |
|--------|-------------|----------|
| Rotation + detune ±15¢ | 6 перестановок × 4 detune. | |
| Rotation + detune + voicing inversion (рекомендую) | + 3 inversion = 18 гармонических. | ✓ |
| Только detune | 4 detune варианта. Беднее. | |

**User's choice:** Rotation + detune + voicing inversion

### Filter cutoff modulation

| Option | Description | Selected |
|--------|-------------|----------|
| Cutoff bins (рекомендую) | 4 бина low/mid-low/mid-high/high. | ✓ |
| Cutoff + reverb wet bins | + 3 reverb bins. | |
| Без cutoff | Pitch+notes+detune хватит. | |

**User's choice:** Cutoff bins (4 бина)

---

## Sound Signature & Verifier

### Формат signature

| Option | Description | Selected |
|--------|-------------|----------|
| Tuple-string archetype\|pitch\|rot\|inv\|det\|cutoff (рекомендую) | JSON-stringifiable, паттерн Phase 7. | ✓ |
| Hash в 32-bit int | MurmurHash. Кратче но отладка сложнее. | |
| Numeric tuple [n,n,n,n,n,n] | Массив, JSON.stringify ключ. Эквивалентно. | |

**User's choice:** Tuple-string

### Seed-refine для sound

| Option | Description | Selected |
|--------|-------------|----------|
| Да, аналогично anim (рекомендую) | XOR-mutate sys.rngSeed, 10 attempts. Refine pass. | ✓ (выбрано Claude в yolo-режиме) |
| Нет, 4032 хватит | Без refine. Verifier фейлит на любой collision. | |
| Separate sound seed | Независимый sys.soundSeed. Больше кода. | |

**User's choice:** "делай дальше все в yolo режиме" → Claude выбрал "Да, аналогично anim, 10 attempts" по принципу consistency с Phase 7 паттерном и SPEC требованием 100% strict.

---

## Claude's Discretion (yolo)

User в финальном вопросе сказал "делай дальше все в yolo режиме". Claude взял на себя:

1. **Sound seed-refine policy:** 10 attempts, аналогично anim, отдельный pass `refineSoundSeeds()`.
2. **THEME_SCALES** (per-archetype mapping мажор/минор/lad): Claude подбирает в planner/executor по эстетике (home=C major, shadow=C minor, mystic=Phrygian, etc. — см. CONTEXT.md specifics).
3. **≥8 новых animation components:** конкретный список выбирает Claude (bouncingBall, digitalGlitch, ringPulsar, swarmParticles, prismRefract, lifeBloom, windRibbons, wreckageOrbit — кандидаты в CONTEXT.md).
4. **Verify scripts location:** перенос в `client/scripts/verify_*.cjs` (вместо /tmp/).
5. **Pool expansion strategy:** доводим под-loaded pools до ≥14 (запас над SPEC ≥12).
6. **Build pipeline integration:** новый `npm run verify-uniqueness` запускает все 3 verifier'а.

## Deferred Ideas

- **SFX лягушек refresh** — упоминалось в исходном запросе, в multiSelect не выбрано → Phase 9 candidate.
- **Procedural sound from planet color/size** — overengineering для MVP.
- **Visual perceptual hash** — слишком тяжело для CI.
- **Server-side sound preferences** — только localStorage.
- **Pool expansion до 20+** — избыточно при 100× signature headroom.
- **Hash signature вместо tuple** — отладка важнее perf.
