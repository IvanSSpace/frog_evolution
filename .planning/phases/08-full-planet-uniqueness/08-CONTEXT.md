# Phase 8: Full Planet Uniqueness - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Финализация уникальности всех 1000 планет (16 main + 984 BG) по трём axes — анимации (recipe + параметры), текстуры, звук — с сохранением тематической стилистики архетипов. Доводит Phase 7 (450 планет) до 1000/1000/1000.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**6 requirements are locked.** See `08-SPEC.md` для полных требований, boundaries и acceptance criteria.

Downstream agents (researcher, planner, executor) MUST read `08-SPEC.md` перед planning или implementing. Requirements не дублируются здесь.

**In scope (from SPEC.md):**
- Strict animation signature criterion (signature + quantized params)
- Animation pool expansion: ≥ 8 новых компонентов
- Animation pool minimums: каждый theme ≥ 12 компонентов
- Texture uniqueness fix: 984/984 (resolve 1 collision)
- Per-planet sound modulation system: pitch / note permutation / detune / cutoff
- Sound uniqueness verifier (`verify_sound_uniqueness.cjs`)
- Animation uniqueness verifier обновлён под strict criterion
- COMP_DURATIONS_MS extended для новых компонентов
- Visual smoke test: 5 случайных планет каждого archetype звучат и анимируются по-разному

**Out of scope (from SPEC.md):**
- SFX лягушек (pickup/drop/merge/evolve) — backlog Phase 9
- Музыкальные треки (`audio/tracks/*`) — отдельная независимая система
- Scaling planet count за пределы 1000
- Серверная синхронизация sound preferences
- Visual perceptual hash (image diff) — слишком тяжело для CI
- Procedural sound generation на основе цвета/размера

</spec_lock>

<decisions>
## Implementation Decisions

### Strict Animation Signature
- **D-01:** Signature расширена до `recipe + modifier_flag + theme + rotation_bin + scale_bin + hue_bin + per_comp_delay_bin`. Это база Phase 7 + 4 новых dimension'а.
- **D-02:** Quantization bins:
  - `rotation_bin`: 4 бина (`-π/2`, `-π/4`, `+π/4`, `+π/2`) — modifier rotation квантуется по знаку и magnitude
  - `scale_bin`: 4 бина (`0.7`, `0.85`, `1.15`, `1.3`) — modifier scale в 4 кластера вокруг 1.0
  - `hue_bin`: 8 бинов (по 6.25° от ±25° hue shift)
  - `delay_bin` per non-first comp: 3 бина (`50-100ms` / `100-200ms` / `200-300ms`)
- **D-03:** Theoretical signature space: ~384× больше Phase 7 → запас на 1000+ планет с большим overhead.
- **D-04:** Seed-refine: **10 attempts** (Phase 7 был 5). При collision мутируем seed XOR `(attempt+1) * 0x9e3779b9`, пересчитываем signature.

### Per-Planet Sound Modulation
- **D-05:** Compound подход — per-archetype scale-bound модуляции. Каждый archetype имеет ноты-скалу (мажор/минор) и характерные диапазоны параметров.
- **D-06:** Pitch shift по seed — **per-archetype scale notes**, не свободные ±5 semitones. Берём 7 ступеней скалы × 2 октавы = 14 вариаций, все остаются в тональности архетипа.
- **D-07:** Note rotation **+** voicing inversion: 6 перестановок аккордовых нот × 3 inversion (root/first/second) = 18 гармонических вариаций.
- **D-08:** Detune ±15¢ в **4 бинах** для лёгкой расстройки.
- **D-09:** Filter cutoff в **4 бинах** (low/mid-low/mid-high/high) — каждый синт получает свой cutoff variation от seed.
- **D-10:** Total combinations per archetype: 14 × 18 × 4 × 4 = 4032 уникальных комбинаций. Для среднего ~36 планет/архетип — 100× headroom.

### Sound Signature & Verifier
- **D-11:** Signature формат: tuple-string `archetype|pitch|rot|inv|det|cutoff` (повторяет паттерн Phase 7 anim signature). JSON-stringifiable, легко grep'ается, понятно при отладке.
- **D-12:** Seed-refine для sound signatures: **аналогично anim, 10 attempts**, отдельный pass `refineSoundSeeds()` после `refineAnimSeeds()` на загрузке.

### Claude's Discretion (yolo)
- **D-13:** Per-archetype scale assignments (мажор/минор + tonic per archetype) — Claude подбирает в planner/executor по эстетике (home=C major bright, shadow=C minor dark, mystic=Phrygian, lava=Locrian, etc.).
- **D-14:** Конкретные ≥8 новых animation components — выбор Claude. Цели: добавить thematic для under-loaded archetypes (rocky, organic, mist) и/или универсальные оригинальные (bouncingBall, digitalGlitch, ringPulsar). COMP_DURATIONS_MS обновлён соответственно.
- **D-15:** Verify scripts location: переносим в репо (`client/scripts/verify_anim_uniqueness.cjs`, `client/scripts/verify_texture_uniqueness.cjs`, новый `client/scripts/verify_sound_uniqueness.cjs`). Текущие версии в `/tmp/` устарели (THEME_COMPONENTS не синхронизирован с runtime — содержит pre-Phase-7-extension).
- **D-16:** Pool expansion strategy — для каждого archetype с pool < 14 добавить новые компоненты до достижения ≥14 (запас над SPEC требованием ≥12).
- **D-17:** Sound verify integrated в build pipeline — `npm run verify-uniqueness` запускает все 3 verifier'а (anim/texture/sound), CI fails если не 100%.

### Carrying Forward from Phase 7 (locked, не передискутируем)
- Recipe size distribution: 50% / 35% / 15% для 2 / 3 / 4 components
- HSL hue shift ±25° per planet
- Recipe-level rotation/scale modifiers, 25% chance, ±90° rotation, 0.7-1.3 scale
- `animRng(sys)` детерминированный per-planet RNG (`mulberry32(seed)`)
- `mainSeedOverride: Map<string, number>` для main races без rngSeed
- `THEME_PALETTES` — палитры цветов per archetype/type (без изменений)
- Texture sub-variants структура (без изменений)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 8 spec
- `.planning/phases/08-full-planet-uniqueness/08-SPEC.md` — **Locked requirements — MUST read before planning.** 6 falsifiable requirements, 10 acceptance criteria, ambiguity 0.13.

### Phase 7 prior art (carrying forward)
- `.planning/phases/07-unique-planet-animations/CONTEXT.md` — Phase 7 implementation decisions (recipe distribution, HSL hue, modifier rotation/scale, sub-variants pattern).
- `.planning/phases/07-unique-planet-animations/PLAN.md` — Phase 7 task breakdown (verify pattern, refineAnimSeeds, refineTextureSeeds).

### Animation system core
- `client/src/game/scenes/StarMapScene.ts` — содержит:
  - L33-58: `Race`, `BgSystem` interfaces
  - L268-271: `refineTextureSeeds()` + `refineAnimSeeds()` вызов на старте
  - L772-789: `handlePlanetPress` (точка входа в анимацию + sound emit)
  - L800-869: `COMP_DURATIONS_MS`, `getAnimationDurationMs(sys)` (Phase-8 уже добавлены)
  - L895-929: `THEME_COMPONENTS` Record (28 themes × 14-21 component pool каждый)
  - L856-867: `THEME_PALETTES`
  - L933-952: `animRng(sys)` детерминированный RNG
  - L953-1010: `playUniqueAnimation(sys)` — recipe build + dispatch
  - L1012-1102: `runAnimComponent(idx, ...)` — switch до case 87 (88 components)
  - L2750-2769: `buildAnimSignature(sys)` — Phase 7 signature (нужно расширить под strict)
  - L2774-2797: `refineAnimSeeds()` — 5 attempts, переписать на 10 + new strict signature
  - L2800-2804: `hashId(id)` helper

### Sound system core
- `client/src/audio/planetVoice.ts` — содержит:
  - L65-93: `PROFILES` (28 archetype/type voice profiles)
  - L100-200: `PlanetVoice` class — singleton, lazy Tone, ensureReady, play
  - `play(typeOrArchetype, durationMs)` — current entry point, нужно расширить для per-planet modulations
- `client/src/audio/types.ts` — типы `ToneLib`
- `client/src/audio/sfx.ts` — общий шаблон engine pattern (для consistency)

### Data
- `client/src/game/data/planetMap.json` — 1000 planets (mainCount=16, bgCount=984), source of truth.
- `client/src/store/eventBus.ts` — events `starmap:planet-selected`, `starmap:planet-tapped` (последний несёт `durationMs`).

### Verifiers (current /tmp/, перенести в репо)
- `/tmp/verify_anim_uniqueness.cjs` — Phase 7 baseline (THEME_COMPONENTS устарел, нужна синхронизация)
- `/tmp/verify_texture_uniqueness.cjs` — 983/984 last run
- New: `verify_sound_uniqueness.cjs` (Phase 8 deliverable)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mulberry32(seed)` (StarMapScene.ts:71-80): детерминированный PRNG, используется для anim, texture, можно reuse для sound
- `animRng(sys)` (StarMapScene.ts:933-952): per-planet RNG instance с поддержкой `mainSeedOverride`. Sound modulation должен использовать **тот же** животрепещущий seed (или derived).
- `mainSeedOverride: Map<string, number>` — расширяется в `refineAnimSeeds`. Для sound уникальности нужен аналогичный `mainSoundSeedOverride` ИЛИ переиспользовать тот же `mainSeedOverride` (последний предпочтительнее — single source of truth).
- `buildAnimSignature(sys)` (L2750): паттерн dry-run RNG для сигнатуры. Reuse для `buildSoundSignature(sys)`.
- `getAnimationDurationMs(sys)` (StarMapScene.ts L817-849, Phase-8 уже добавлен в текущей сессии): паттерн dry-run для извлечения детерминированных параметров без побочных эффектов.

### Established Patterns
- **Signature → seed-refine pattern (Phase 7):** для каждого sys считать signature, если уже видели — мутировать seed, повторить, max N attempts. Phase 8 переиспользует для anim (strict) + sound.
- **Lazy Tone loading (planetVoice.ts):** ensureReady promise + first user gesture. Не нарушать для sound modulation.
- **Per-archetype profile pattern (planetVoice.ts PROFILES):** существующая структура достаточна — расширим `VoiceProfile` дополнительными полями (scaleNotes, detuneRange, cutoffRange).
- **Verify script pattern:** Node.js cjs скрипт читает planetMap.json + копию THEME_COMPONENTS, реплицирует RNG порядок. Хрупко — текущая копия устарела. Phase 8 использует import/extract из source.

### Integration Points
- **`handlePlanetPress` (StarMapScene.ts:772):** уже эмитит `starmap:planet-tapped` с durationMs. Phase 8 расширяет payload — добавить `seed: number` чтобы planetVoice мог вычислять modulations без re-import StarMapScene.
- **`PlanetVoice.play` (planetVoice.ts:200):** меняется сигнатура на `play(typeOrArchetype, durationMs, seed)`, внутри derive все 4 modulations из seed.
- **Build pipeline (`package.json`):** добавить `verify-uniqueness` скрипт, который запускает 3 verifier'а последовательно. Можно добавить в `prebuild` для CI gate (опционально).
- **`refineXxxSeeds()` order:** в `create()` уже есть `refineTextureSeeds()` → `refineAnimSeeds()`. Phase 8 добавляет `refineSoundSeeds()` третьим. Order: texture → anim → sound (each conservative для предыдущего).

</code_context>

<specifics>
## Specific Ideas

### Sound modulation derivation от seed
```ts
// В planetVoice.ts (или новом utils файле)
function deriveModulations(seed: number, archetype: string): {
  pitchStep: number     // 0..13 (7 scale steps × 2 octaves)
  rotationIdx: number   // 0..5 (note permutation)
  inversionIdx: number  // 0..2 (root/first/second)
  detuneBin: number     // 0..3 (-15, -5, +5, +15 cents)
  cutoffBin: number     // 0..3 (low/mid-low/mid-high/high)
} {
  const rng = mulberry32(seed)
  return {
    pitchStep: Math.floor(rng() * 14),
    rotationIdx: Math.floor(rng() * 6),
    inversionIdx: Math.floor(rng() * 3),
    detuneBin: Math.floor(rng() * 4),
    cutoffBin: Math.floor(rng() * 4),
  }
}
```

### Sound signature dry-run
```ts
function buildSoundSignature(sys): string {
  const seed = effectiveSeed(sys)  // sys.rngSeed | mainSeedOverride.get(sys.id) | hashId(sys.id)
  const archetype = (sys as BgSystem).archetype ?? sys.type
  const m = deriveModulations(seed, archetype)
  return `${archetype}|${m.pitchStep}|${m.rotationIdx}|${m.inversionIdx}|${m.detuneBin}|${m.cutoffBin}`
}
```

### Strict anim signature (extending Phase 7)
```ts
// Расширить существующий buildAnimSignature
private buildAnimSignature(sys): string {
  const rng = this.animRng(sys)
  // ... Phase 7 recipe build ...
  // Phase 8 additions (после useModifier rng calls):
  const rotationBin = useModifier ? quantize(modRotation, [-π/2, -π/4, +π/4, +π/2]) : -1
  const scaleBin = useModifier ? quantize(modScale, [0.7, 0.85, 1.15, 1.3]) : -1
  const hueBin = quantize(huePerPlanet, /* 8 bins */)
  // delay bins computed during forEach (3 bins per non-first comp)
  return `${comps}|m${modFlag}|r${rotationBin}|s${scaleBin}|h${hueBin}|d${delayBins.join(',')}|${theme}`
}
```

### THEME_SCALES (recommendation для D-13)
- `home`: C major (bright, neutral)
- `crystal`: E minor pentatonic (sparkly, hopeful)
- `rocky`: C natural minor (heavy, grounded)
- `ancient`: A Aeolian (mournful, deep)
- `mystic`: D Phrygian (mystical, eastern)
- `organic`: F Lydian (fresh, growing)
- `forge`: G minor (mechanical, fiery)
- `military`: D Dorian (martial)
- `destroyed`: B Locrian (broken, unstable)
- `crystal_bio`: A major pentatonic (bright bio)
- `mechano`: C Mixolydian (industrial)
- `energy`: E major (electric, bright)
- `mist`: A Aeolian soft (quiet, foggy)
- `aquatic`: G Dorian (flowing)
- `shadow`: C Locrian (dark)
- `aerial`: G Lydian (airy, lifting)
- BG archetypes: matched to character (lava=Locrian, ice=major bright, plasma=whole-tone, etc.)

### Pool expansion targets (D-16)
Текущие themes с pool size < 14: `forest` (14 — на границе), `organic` (14), `mist` (14), `destroyed` (14), `aquatic` (15), `crystal_bio` (14). Добавить новые компоненты которые усиливают именно эти pool'ы.

### New animation components candidates (D-14)
1. `bouncingBall` — мяч прыгает по орбите планеты
2. `digitalGlitch` — пиксельные искажения с RGB-shift
3. `ringPulsar` — пульсирующее кольцо с heartbeat-ритмом
4. `swarmParticles` — рой точек огибает планету
5. `prismRefract` — преломление спектра через "грань"
6. `lifeBloom` — растущие кривые-лозы (для organic)
7. `windRibbons` — ленты ветра (для mist/aerial)
8. `wreckageOrbit` — мелкие куски обломков на орбите (для destroyed)

</specifics>

<deferred>
## Deferred Ideas

### Phase 9 candidates (явно out of scope для Phase 8)
- **SFX лягушек refresh** — 4 звука (pickup/drop/merge/evolve) переписать на новые версии в стилистике, не повторяя текущие. User упоминал в исходном запросе но в multiSelect не выбрал — оставлено для отдельной фазы.
- **Procedural sound from planet color/size** — нелинейные mappings от RGB → tone params. Overengineering для текущей цели.
- **Visual perceptual hash** — рендер планеты в PNG + pHash. Дорого, для CI не подходит.
- **Server-side sound preferences** — sync mute/volume через backend. Только localStorage.

### Reviewed but not folded
- "Pool expansion до 20+ per theme" — обсуждалось, но избыточно при 100× headroom для signature space. Достигаем 14+ а не 20+.
- "Hash signature вместо tuple-string" — обсуждалось, отложено: tuple-string легче при отладке, perf не критичен.

</deferred>

---

*Phase: 08-full-planet-uniqueness*
*Context gathered: 2026-05-07*
