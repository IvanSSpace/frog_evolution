# Phase 7: Unique Planet Animations & Textures — Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Source:** Direct context from prior session

<domain>
## Phase Boundary

Эта фаза — две связанные подсистемы StarMapScene:
1. **Анимации при клике** на планету (playUniqueAnimation + recipe + components).
2. **Текстуры планет** (renderBgPoint + renderMainPlanet — процедурный визуал самой планеты).

Цель: гарантировать что **каждая из 450 планет** визуально уникальна — как при клике, так и в обычном виде. Игрок не должен видеть двух планет одного archetype, выглядящих идентично.

В скоупе:
- StarMap анимации при клике (compXxx, THEME_COMPONENTS, recipe, modifiers)
- StarMap текстуры (renderBgPoint switch'и для archetypes, universal modifiers)
- Sub-variants в каждом archetype для текстур
- Глобальная проверка уникальности — отдельная для анимаций и текстур

Вне скоупа:
- Idle animations (пружинение) — оставляем как есть
- Sparkle stars (отдельная подсистема)
- Sound effects
- Транзиции между scenes

</domain>

<decisions>
## Implementation Decisions

### Recipe Generation
- Минимум **2 компонента** в recipe (раньше допускалось 1) — иначе на pool из 10 даёт всего 10 уникальных recipes
- Распределение размера recipe: 0% / 50% / 35% / 15% (на 1 / 2 / 3 / 4 компонента)

### Uniqueness Enforcement
- При загрузке: для каждой планеты вычислить **signature** = sorted component IDs + hash от ключевых параметров (count, scale, color, ease)
- Если 2+ планеты имеют идентичный signature — re-roll RNG seed для одной из них (через детерминированную трансформацию `seed XOR id_hash`)
- Цель: ≥99% уникальных подписей

### Component Pool Expansion
- Total минимум **65** компонентов (сейчас 54 → +10-12 новых)
- Pool на каждый archetype/type ≥10 (сейчас 8-15)

### Parameter Diversity
- Расширить ranges всех «горячих» компонентов (ring, sparkle, lightning, halo, starBurst):
  - count: ±50% от текущих диапазонов
  - speed/duration: log-scale random (а не linear)
  - shape variations: добавить sub-variants

### Composite Modifiers
- 25% шанс на recipe — добавить modifier поверх компонентов:
  - global rotation offset (±90°)
  - global scale shift (±30%)
  - HSL hue rotation (±25°)
- Дополняет каждую recipe миллионами доп. вариаций

### Per-Planet Color Shift
- HSL hue shift на ±20° внутри тематической палитры
- Базируется на `sys.rngSeed` детерминированно
- Каждая планета имеет визуально отличимый цветовой подтон даже в одном archetype

---

## Texture Decisions

### Sub-variants в каждом archetype
Для топ-9 visited archetypes (gas_giant, gas_ringed, ice, ocean, desert, lava, forest, mineral, dead) добавить **2-3 sub-variant'а** рендера. Variant выбирается через `rng()` из rngSeed.

Примеры:
- `gas_giant`: variant=`banded` (полосы, как сейчас) / `spotted` (пятна-штормы) / `storm` (большой ураган)
- `ice`: `patchy` (пятна, как сейчас) / `crystalline` (грани кристалла) / `glacial` (трещины)
- `ocean`: `cloudy` (облака+реки, как сейчас) / `calm` (просто blue gradient) / `archipelago` (архипелаг островов)
- `lava`: `cracked` (трещины, как сейчас) / `volcanoes` (точечные вулканы) / `flowing` (river-like flows)

### Расширенные universal modifiers
- **Surface lines** (15%): тонкие изогнутые линии-меридианы по поверхности
- **Gradient bands** (12%): плавный gradient полос
- **Multi-color spots** (15%): кластеры мелких пятен случайных hue
- **Stacked rings** (8%): 2-3 кольца разного диаметра/наклона
- **Asymmetric atmosphere** (20%): aura не круг а эллипс / capsule
- **Color speckle** (25%): мелкие пиксели-точки на поверхности (random hue)

### Texture uniqueness signature
Аналогично animation signature — соберать `buildTextureSignature(sys)` через детерминированный simulate части `renderBgPoint`. Captures: variant choice + count'ы (bands/craters/spots) + ring presence + atmosphere shape. Refine seed при коллизиях.

### Claude's Discretion (для текстур)
- Конкретные sub-variant имплементации
- Параметры новых universal modifiers (count ranges, color choices)
- Какие archetypes получают 2 vs 3 sub-variant'а

### Claude's Discretion (общая)
- Какие именно 10-12 новых компонентов добавить (с учётом archetype gaps)
- Параметры конкретных диапазонов (количество, скорость, размеры)
- Какие компоненты «горячие» — анализом по pool frequency
- Implementation структура (helper для signatures, refinePool helper, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Anim system core
- `client/src/game/scenes/StarMapScene.ts` — содержит все 54 компонента анимаций (compRing..compChromaShift), THEME_COMPONENTS, THEME_PALETTES, playUniqueAnimation, animRng, handlePlanetPress
- `client/src/game/data/planetMap.json` — source of truth для всех 450 планет (id, x, y, archetype, type, color, accent, rngSeed)

### Архетипы и типы
StarMapScene.ts содержит type Archetype (12 значений: gas_giant, gas_ringed, ice, ocean, desert, lava, forest, mineral, dead, toxic, plasma, binary).
Main races имеют `type` (16 значений: home, crystal, rocky, ancient, mystic, organic, forge, military, destroyed, crystal_bio, mechano, energy, mist, aquatic, shadow, aerial).

</canonical_refs>

<specifics>
## Detailed Specifications

### Текущие 54 компонента (по индексам)
- 0-11: универсальные (ring, multiRing, sparkle, flash, lightning, orbit, spiral, confetti, wave, comet, starBurst, halo)
- 12-23: тематические (vortex, stormSwirl, ringDance, crystalShatter, ripple, sandSwirl, lavaErupt, bloomPetals, dustPuff, toxicCloud, beam, twinPulse)
- 24-38: креативные первая волна (singularity, echoWave, gravityWell, solarFlare, auroraRibbon, dnaHelix, lensFlare, constellation, magneticField, phoenixBurst, wormhole, cosmicRay, quantumSplit, heartPulse, crackleDischarge)
- 39-53: креативные вторая волна (pixelGrid, spiralArms, crystalGrow, snowDrift, galaxySpawn, pulseHex, tornado, starPolygon, crossFlash, waveTrain, petalStorm, flameTongues, snakeTrail, bubblePop, chromaShift)

### Идеи для новых 10-12 компонентов
Атомные оригинальные кандидаты:
- atomShells — 3 концентрические орбиты с точками
- supernova — свечение → удар → разлетающиеся следы
- accretionDisk — плоский диск с вращением
- bouncingBall — мяч прыгает над планетой
- flickerStars — россыпь мини-точек загораются и тухнут
- lightDance — несколько лучей следуют за движущейся точкой
- dimensionRift — разлом-зигзаг с искажением
- frostExplode — взрыв ледяных осколков
- timeWave — расходящееся искажение пространства
- glyphFlash — иероглиф/руна на момент
- prismShift — спектр радуги
- digitalGlitch — пиксельные искажения

### Where to wire (анимации)
- Добавить новые case-ы в `runAnimComponent` switch
- Добавить методы `compXxx` рядом с существующими
- Добавить индексы в THEME_COMPONENTS pools для подходящих archetypes/types
- Расширить THEME_PALETTES если новые компоненты вводят свежие цвета

### Where to wire (текстуры)
- В `renderBgPoint` (StarMapScene.ts ~890-1170) внутри switch для каждого archetype:
  - Выбрать sub-variant через `const variant = ['a','b','c'][Math.floor(rng() * 3)]`
  - Если `variant === 'a'` — текущая логика; иначе альтернативный рендер
- После switch (universal modifiers section ~1170-1290) добавить новые modifiers
- В create() после `refineAnimSeeds()` вызвать `refineTextureSeeds()` (отдельный pass)

### Uniqueness check helper
```ts
private buildAnimSignature(sys: Race | BgSystem): string {
  const rng = this.animRng(sys)
  // simulate same recipe selection process, capture component IDs + key params
  // return JSON-stringified signature
}

// На загрузке после allSystems:
private refineAnimSeeds() {
  const sigs = new Map<string, string>() // signature → first planet id
  for (const sys of this.allSystems) {
    let attempt = 0
    let sig = this.buildAnimSignature(sys)
    while (sigs.has(sig) && attempt < 5) {
      // mutate rngSeed deterministically
      (sys as any).rngSeed = (sys.rngSeed ?? 0) ^ (attempt * 0x9e3779b9 + 1)
      sig = this.buildAnimSignature(sys)
      attempt++
    }
    sigs.set(sig, sys.id)
  }
}
```

</specifics>
