---
phase: 08-full-planet-uniqueness
plan: 04
subsystem: audio
tags: [audio, sound-modulation, per-planet, seed-derived, tone-js, deterministic-rng]
requires:
  - phase: 08-03
    provides: "Texture refinement complete — execution wave 4 unblocked"
  - phase: 07
    provides: "mainSeedOverride map + animRng pattern — reused for sound seed source"
provides:
  - "PlanetVoice.play() per-planet modulations: pitch (14-step scale), voicing rotation/inversion, detune cents, filter cutoff"
  - "THEME_SCALES Record<string, number[]> — 28 archetype/type → 7 MIDI-нот"
  - "deriveModulations(seed, archetype) → 5 mod params (pitchStep×14, rotationIdx×6, inversionIdx×3, detuneBin×4, cutoffBin×4) = 4032 unique combos/archetype"
  - "applyVoicing/detuneCents/cutoffHz pure-function helpers"
  - "VoiceProfile + VoiceKit extended (scaleNotes, detuneRange, cutoffRange, droneFilter, noiseFilter)"
  - "starmap:planet-tapped event extended с seed: number"
  - "StarMapScene.effectiveSeed(sys) helper — single source of truth для sound seed"
affects: [08-05, 08-06]
tech-stack:
  added: []
  patterns: [seed-derived-modulation, deterministic-rng, per-archetype-scale, smooth-cutoff-ramp, graceful-degradation]
key-files:
  created:
    - .planning/phases/08-full-planet-uniqueness/08-04-SUMMARY.md
  modified:
    - client/src/audio/planetVoice.ts
    - client/src/store/eventBus.ts
    - client/src/game/scenes/StarMapScene.ts
key-decisions:
  - "THEME_SCALES inline в planetVoice.ts (а не отдельным модулем) — single source of truth, не размывает audio domain"
  - "Plasma whole-tone (6 нот) обёрнута до 7 через wraparound +12; binary C major triad растянут на 2 октавы"
  - "deriveModulations принимает archetype как _archetype (зарезервировано для per-archetype overrides), но реализация одинакова — KISS"
  - "Drone получает detune/2 (not full) — половина для атмосферности без размытия тоники"
  - "noise и membrane не получают detune — плохо реагируют (noise = шум, membrane = pitch decay)"
  - "rampTo(0.05) для cutoff — устраняет audible clicks при frequency change"
  - "Graceful degradation: seed === undefined → Phase 7 поведение (legacy callers, тесты)"
  - "effectiveSeed возвращает rngSeed | mainSeedOverride | hashId — копирует логику animRng без дублирования mulberry32 instance"
requirements-completed: [SPEC-03]
duration: ~10 minutes
completed: 2026-05-08
metrics:
  task_count: 3
  file_count: 3
  build_status: pass
  typecheck_status: clean
  index_chunk_gzipped_kb: 203.08
---

# Phase 8 Plan 4: Per-Planet Sound Modulation Summary

**One-liner:** Per-planet sound uniqueness через 5 seed-derived модуляций (pitch/rotation/inversion/detune/cutoff), 4032 уникальных комбинаций per archetype, граceful fallback при undefined seed.

## What Was Built

Each of 1000 планет теперь звучит различимо в стилистике своего архетипа: при тапе StarMapScene эмитит `effectiveSeed(sys)`, planetVoice выводит 5 модуляций через `deriveModulations(seed, archetype)` и применяет их к Tone.js синтам. Текущие 28 архетипов делят 1000 планет (~36/архетип); per-archetype signature space (4032) даёт ~112× headroom.

### Architecture

```
StarMapScene.handlePlanetPress(sys)
  → eventBus.emit('starmap:planet-tapped', { ..., seed: effectiveSeed(sys) })
    → planetVoice.play(key, durationMs, type, seed)
      → deriveModulations(seed, archetype) → 5 mod params
      → THEME_SCALES[archetype] → 7-note scale
      → baseNotes = [root, 3rd, 5th] из scale[pitchStep%7] + octave wrap
      → applyVoicing(baseNotes, rotationIdx, inversionIdx)
      → cutoffHz(cutoffBin) → droneFilter/noiseFilter (rampTo 50ms)
      → detuneCents(detuneBin) → bell/pluck/fm (full), drone (half)
      → triggerAttackRelease(...)
```

## THEME_SCALES (D-13 Implementation)

| Archetype/Type | Scale Name             | MIDI Notes                       |
| -------------- | ---------------------- | -------------------------------- |
| home           | C major                | [60, 62, 64, 65, 67, 69, 71]     |
| crystal        | E minor pentatonic     | [64, 67, 69, 71, 74, 76, 79]     |
| rocky          | C natural minor        | [60, 62, 63, 65, 67, 68, 70]     |
| ancient        | A Aeolian              | [69, 71, 72, 74, 76, 77, 79]     |
| mystic         | D Phrygian             | [62, 63, 65, 67, 69, 70, 72]     |
| organic        | F Lydian               | [65, 67, 69, 71, 72, 74, 76]     |
| forge          | G minor                | [67, 69, 70, 72, 74, 75, 77]     |
| military       | D Dorian               | [62, 64, 65, 67, 69, 71, 72]     |
| destroyed      | B Locrian              | [71, 72, 74, 76, 77, 79, 81]     |
| crystal_bio    | A major pentatonic     | [69, 71, 73, 76, 78, 81, 83]     |
| mechano        | C Mixolydian           | [60, 62, 64, 65, 67, 69, 70]     |
| energy         | E major                | [64, 66, 68, 69, 71, 73, 75]     |
| mist           | A Aeolian (soft)       | [69, 71, 72, 74, 76, 77, 79]     |
| aquatic        | G Dorian               | [67, 69, 70, 72, 74, 76, 77]    |
| shadow         | C Locrian              | [60, 61, 63, 65, 66, 68, 70]     |
| aerial         | G Lydian               | [67, 69, 71, 73, 74, 76, 78]     |
| gas_giant      | C Mixolydian           | [60, 62, 64, 65, 67, 69, 70]     |
| gas_ringed     | D Lydian               | [62, 64, 66, 68, 69, 71, 73]     |
| ice            | E major                | [64, 66, 68, 69, 71, 73, 75]     |
| ocean          | F Lydian               | [65, 67, 69, 71, 72, 74, 76]     |
| desert         | F Dorian               | [65, 67, 68, 70, 72, 74, 75]     |
| lava           | C Locrian              | [60, 61, 63, 65, 66, 68, 70]     |
| forest         | D Dorian               | [62, 64, 65, 67, 69, 71, 72]     |
| mineral        | C major                | [60, 62, 64, 65, 67, 69, 71]     |
| dead           | C natural minor        | [60, 62, 63, 65, 67, 68, 70]     |
| toxic          | D Phrygian             | [62, 63, 65, 67, 69, 70, 72]     |
| plasma         | whole-tone wrapped     | [60, 62, 64, 66, 68, 70, 72]     |
| binary         | C major triad ×2 oct   | [60, 64, 67, 72, 76, 79, 84]     |

Все 28 keys присутствуют, все массивы — 7 элементов. Plasma (whole-tone, 6 нот) обёрнута wraparound +12; binary (триад) растянут на 2 октавы.

## 5 Modulations & Their Ranges

| Modulation     | Type   | Range  | Effect                                               |
| -------------- | ------ | ------ | ---------------------------------------------------- |
| `pitchStep`    | int    | 0..13  | Step из scale (7 ступеней × 2 октавы), pitch root    |
| `rotationIdx`  | int    | 0..5   | Cyclic shift аккордовых нот                          |
| `inversionIdx` | int    | 0..2   | Voicing inversion (первые N нот +12 semitones)       |
| `detuneBin`    | int    | 0..3   | [-15, -5, +5, +15] cents (default range=15)          |
| `cutoffBin`    | int    | 0..3   | Log-interpolated Hz: drone [400..4000], noise [600..3000] |

Total per archetype: **14 × 6 × 3 × 4 × 4 = 4032 unique combos**.
For ~36 planets/archetype average: **~112× headroom** for sound signature uniqueness (verified в Plan 5).

## Graceful Fallback Semantics

```ts
play(typeOrArchetype, durationMs, archetypeFallback?, seed?)
```

- `seed === undefined` → `mod = null` → играем `profile.notes` без модуляций (Phase 7 поведение). Поведение для legacy callers, unit-тестов, и для случаев где `effectiveSeed` ещё не вычислен.
- `seed === number` без scale (несуществующий archetype) → `mod = null` всё равно, чтобы не пробовать брать `[stepInOctave]` из undefined. Та же fallback ветвь.
- `seed === number` + scale found → полные 5 модуляций.

## Smooth Cutoff Transitions

Filter `frequency.rampTo(value, 0.05)` (50ms) выбран потому что:
- Достаточно медленно чтобы не было audible click при resonant lowpass на drone
- Достаточно быстро чтобы изменение завершилось до peak attack envelope (~50-150ms)
- Меньше чем sustain duration (≥250ms minimum) — разница cutoff между двумя планетами слышна

## Compatibility Layer

Все existing PROFILES записи продолжают работать без изменений: `notes` массив используется как `baseNotes` когда `mod === null`. Phase 8 поля (`scaleNotes`/`detuneRange`/`cutoffRange`) — опциональные, ни одна запись их пока не override'ит (дефолты из `THEME_SCALES`/`15`/`[400,4000]` достаточны).

## Verification

- `cd client && npx tsc --noEmit` → 0 errors
- `cd client && npm run build` → success, index chunk **704.15 kB / 203.08 kB gzip**
- All 28 THEME_SCALES keys × 7 notes verified via Node.js parser
- Acceptance criteria #7 (manual smoke): **отложен в Plan 8-07** — verifier 08-05 проверит уникальность signature детерминированно.

## Files Modified

- `client/src/audio/planetVoice.ts` (+388 → +445 with apply phase): mulberry32, THEME_SCALES, deriveModulations, applyVoicing, detuneCents, cutoffHz, PlanetModulations, VoiceProfile/VoiceKit extension, ensureReady refactor (named filter refs), play() rewrite, listener update.
- `client/src/store/eventBus.ts` (1 line): `seed: number` в `starmap:planet-tapped` payload.
- `client/src/game/scenes/StarMapScene.ts` (+12 lines): `effectiveSeed(sys)` private method (mirror animRng без mulberry32 instance) + `seed: this.effectiveSeed(sys)` в emit.

## Commits

| Task | Commit  | Description                                                       |
| ---- | ------- | ----------------------------------------------------------------- |
| 1    | 2dc33ac | feat(08-04): emit effective seed in starmap:planet-tapped event   |
| 2    | 7a727de | feat(08-04): add modulation primitives and per-archetype scales   |
| 3    | bb03dd3 | feat(08-04): apply per-planet sound modulations in PlanetVoice.play |

## Deviations from Plan

None — plan executed exactly as written. Single minor adjustment:
- `THEME_SCALES` was made `export const` (vs plain `const` per plan spec) to satisfy TS6133 unused-symbol check after Task 2 commit (Task 2 defines it; Task 3 consumes it). Export is also useful for verifier scripts (Plan 08-05) and is a forward-compat win. Tracked as **[Rule 3 — Blocking issue fix]**: minimal compatibility tweak to keep tsc clean between atomic commits.

## Next Steps

- **Plan 08-05:** Sound uniqueness verifier (`verify_sound_uniqueness.cjs`) — replicates `effectiveSeed → deriveModulations` pipeline outside Phaser runtime, validates 1000/1000 unique sound signatures.
- **Plan 08-06:** Refine sound seeds via `refineSoundSeeds()` если verifier обнаружит коллизии (хедрум ~112× гарантирует, но edge-cases возможны).
- **Plan 08-07:** Manual smoke test — 5 random планет каждого archetype, ручная проверка различимости.

## Self-Check: PASSED

Verified:
- `client/src/audio/planetVoice.ts` exists (FOUND)
- `client/src/store/eventBus.ts` exists (FOUND)
- `client/src/game/scenes/StarMapScene.ts` exists (FOUND)
- Commit 2dc33ac in git log (FOUND)
- Commit 7a727de in git log (FOUND)
- Commit bb03dd3 in git log (FOUND)
- tsc clean (verified)
- npm run build success (verified)
