# Phase 7 Plan — Unique Planet Animations & Textures

**Phase:** 7 of 7
**Goal:** Гарантировать визуально уникальные **анимации при клике И текстуры** для каждой из 450 планет (16 main + 434 BG), особенно для планет одного archetype/type.
**Mode:** mvp (вертикальные слайсы)
**Status:** ready

**Подсистемы:**
- **A. Анимации** — Tasks 1-8 (см. ниже)
- **B. Текстуры** — Tasks 9-14

---

## Context Files

Read before implementing:
- `.planning/phases/07-unique-planet-animations/CONTEXT.md` — locked decisions
- `client/src/game/scenes/StarMapScene.ts` — текущая система (54 компонента, THEME_COMPONENTS, THEME_PALETTES, playUniqueAnimation, animRng)
- `client/src/game/data/planetMap.json` — данные 450 планет

---

## Task Breakdown

### Task 1 — Минимум 2 компонента в recipe + распределение размеров
**Type:** refactor
**File:** `client/src/game/scenes/StarMapScene.ts`
**Function:** `playUniqueAnimation()`

**Изменение:**
```ts
// БЫЛО: 1(25%) / 2(50%) / 3(20%) / 4(5%)
// СТАЛО: 2(50%) / 3(35%) / 4(15%) — 1-компонентных recipe больше нет
const r1 = rng()
const targetCount = r1 < 0.5 ? 2 : r1 < 0.85 ? 3 : 4
```

**Acceptance:**
- В коде нет ветки выбирающей `compCount === 1`
- TS-компиляция чистая

**Commit:** `phase-7: enforce minimum 2 components per recipe`

---

### Task 2 — HSL color shift на основе rngSeed
**Type:** feature
**File:** `client/src/game/scenes/StarMapScene.ts`

**Добавить helper:**
```ts
// Сдвигает HSL hue цвета на ±25° на основе seed (детерминированно).
// Каждая планета получает уникальный подтон даже в общей палитре.
private shiftColorByPlanet(color: number, sys: Race | BgSystem, rng: () => number): number {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff
  // конвертация RGB → HSL
  const max = Math.max(r,g,b)/255, min = Math.min(r,g,b)/255
  const l = (max + min) / 2
  const d = max - min
  let h = 0, s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2*l - 1))
    if (max === r/255) h = ((g-b)/255/d + (g < b ? 6 : 0)) * 60
    else if (max === g/255) h = ((b-r)/255/d + 2) * 60
    else h = ((r-g)/255/d + 4) * 60
  }
  // shift hue ±25° на основе seed (детерминированно — тот же rngSeed → тот же сдвиг)
  const shift = ((rng() - 0.5) * 50)
  h = (h + shift + 360) % 360
  // обратно HSL → RGB
  const c = (1 - Math.abs(2*l - 1)) * s
  const x = c * (1 - Math.abs(((h/60) % 2) - 1))
  const m = l - c/2
  let r1=0,g1=0,b1=0
  if (h < 60) { r1=c; g1=x }
  else if (h < 120) { r1=x; g1=c }
  else if (h < 180) { g1=c; b1=x }
  else if (h < 240) { g1=x; b1=c }
  else if (h < 300) { r1=x; b1=c }
  else { r1=c; b1=x }
  return ((Math.round((r1+m)*255) << 16) | (Math.round((g1+m)*255) << 8) | Math.round((b1+m)*255))
}
```

**Применить в `pickColor`:**
```ts
private pickColor(rng: () => number, sys: Race | BgSystem): number {
  const theme = (sys as BgSystem).archetype ?? sys.type
  const palette = this.THEME_PALETTES[theme]
  const r = rng()
  let raw: number
  if (palette && r < 0.55) raw = palette[Math.floor(rng() * palette.length)]
  else if (r < 0.78) raw = sys.color
  else raw = sys.accent
  return this.shiftColorByPlanet(raw, sys, rng)
}
```

**Acceptance:**
- Цвета анимаций двух BG-планет одного archetype визуально различаются
- TS-компиляция чистая

**Commit:** `phase-7: per-planet HSL hue shift in pickColor`

---

### Task 3 — Композитные модификаторы recipe
**Type:** feature
**File:** `client/src/game/scenes/StarMapScene.ts`
**Function:** `playUniqueAnimation()`

**После выбора `components`:** 25% шанс — генерировать modifier и применить ко всем компонентам в recipe:

```ts
// 25% chance — recipe-level modifier
const useModifier = rng() < 0.25
const modifier = useModifier ? {
  rotationOffset: (rng() - 0.5) * Math.PI,      // ±90°
  scaleShift: 0.7 + rng() * 0.6,                // 0.7-1.3
  // hue shift handled in pickColor — здесь только geometric
} : null

components.forEach((c, i) => {
  const delay = i === 0 ? 0 : Math.floor(rng() * 250) + 50
  this.time.delayedCall(delay, () => {
    if (!sprite.active) return
    const wrapper = modifier ? this.add.container(0, 0) : null
    if (wrapper) {
      wrapper.rotation = modifier.rotationOffset
      wrapper.scale = modifier.scaleShift
      sprite.add(wrapper)
      // Запускаем компонент в wrapper вместо sprite
      this.runAnimComponent(c, wrapper, sys, rng)
      // Удаляем wrapper через 1.5s (после всех его tweens)
      this.time.delayedCall(1500, () => wrapper.destroy())
    } else {
      this.runAnimComponent(c, sprite, sys, rng)
    }
  })
})
```

**Acceptance:**
- Часть планет получает повёрнутые/масштабированные анимации
- Wrapper-контейнеры удаляются после завершения, не лагают сцену

**Commit:** `phase-7: recipe-level rotation/scale modifiers`

---

### Task 4 — Расширить параметрические диапазоны 5 «горячих» компонентов
**Type:** refactor
**File:** `client/src/game/scenes/StarMapScene.ts`

**Цель:** для топ-5 наиболее популярных в pools компонентов (`compRing`, `compSparkle`, `compHaloFlash`, `compStarBurst`, `compFlash`) — расширить ranges чтобы внутри одного компонента было гораздо больше визуальных вариаций.

**`compRing` (case 0):**
- thickness: `1 + rng() * 5` (вместо 1.5+3)
- endScale: `1.4 + rng() * 2.5` (вместо 1.8+1.5)
- duration: log-scale `200 * Math.exp(rng() * 1.7)` (200-1100, эквивалент)
- Добавить subVariant (50%): пунктирный круг (lineDashed) с rng-длиной dash

**`compSparkle` (case 2):**
- N: `4 + Math.floor(rng() * 16)` (вместо 5+11)
- dotSize: `1 + rng() * 4` (вместо 1.5+2.5)
- subVariant (40%): искорки с поворотом (как мини-плюсы вместо точек)

**`compHaloFlash` (case 11):**
- layers: `2 + Math.floor(rng() * 5)` (вместо 2+3)
- subVariant (40%): pulsing — halo пульсирует 2-3 раза вместо single fade

**`compStarBurst` (case 10):**
- rays: `4 + Math.floor(rng() * 16)` (вместо 6+10)
- mix tipping: 30% rays — длиннее остальных в 2x

**`compFlash` (case 3):**
- depth: `0.15 + rng() * 0.65` (расширили нижнюю границу)
- blinks: `1 + Math.floor(rng() * 4)` (вместо 1+3)
- subVariant (30%): asymmetric blink — длительность нечётная (быстрый-медленный)

**Acceptance:**
- В коде расширены диапазоны для 5 компонентов
- TS-компиляция чистая
- Build проходит

**Commit:** `phase-7: widen parameter ranges for hot components`

---

### Task 5 — Добавить 10 новых тематических компонентов
**Type:** feature
**File:** `client/src/game/scenes/StarMapScene.ts`

**Новые компоненты 54-63:**

| # | Метод | Описание | Под archetypes |
|---|---|---|---|
| 54 | `compAtomShells` | 3 концентрические орбиты с точками на каждой | mineral, energy, mechano |
| 55 | `compSupernova` | Яркая вспышка → ударная волна → разлёт следов | dead, plasma, destroyed |
| 56 | `compAccretionDisk` | Плоский эллиптический диск с вращением | gas_ringed, gas_giant |
| 57 | `compFlickerStars` | 15-25 мини-точек загораются и тухнут хаотично | mystic, mist, ancient |
| 58 | `compLightDance` | 3 луча следуют за движущейся точкой | energy, plasma, mechano |
| 59 | `compDimensionRift` | Длинный зигзаг-разлом с искажением | shadow, destroyed, mystic |
| 60 | `compFrostExplode` | Взрыв ледяных осколков с blue tint | ice, crystal, aerial |
| 61 | `compTimeWave` | Расходящееся искажение (3-4 концентрических ring с offset) | mystic, ancient |
| 62 | `compGlyphFlash` | Stylized руна (треугольник/квадрат с внутренней деталью) на момент | ancient, mystic, crystal_bio |
| 63 | `compPrismShift` | 7 разноцветных лучей радуги расходятся | crystal_bio, plasma, energy |

**Каждый метод имеет сигнатуру:**
```ts
private compXxx(
  sprite: Phaser.GameObjects.Container,
  sys: Race | BgSystem,
  rng: () => number,
): void
```

**Все используют:**
- `this.pickColor(rng, sys)` для тематических цветов
- `this.pickEase(rng)` для random easing
- `this.tweens.add` или `this.events.on('update', update)` для анимации
- onComplete → destroy для уборки

**В switch добавить case 54-63.**

**THEME_COMPONENTS обновить:**
- mineral: + 54
- energy: + 54, 58, 63
- mechano: + 54, 58
- dead: + 55
- plasma: + 55, 58, 63
- destroyed: + 55, 59
- gas_ringed: + 56
- gas_giant: + 56
- mystic: + 57, 59, 61, 62
- mist: + 57
- ancient: + 57, 61, 62
- shadow: + 59
- ice: + 60
- crystal: + 60
- aerial: + 60
- crystal_bio: + 62, 63

**Acceptance:**
- 10 новых методов есть в коде
- THEME_COMPONENTS обновлён
- Каждый archetype/type pool ≥10
- TS-компиляция чистая
- Build проходит

**Commit:** `phase-7: add 10 thematic components (54-63)`

---

### Task 6 — Глобальный uniqueness check на загрузке
**Type:** feature
**File:** `client/src/game/scenes/StarMapScene.ts`

**Helpers:**
```ts
// Симулирует генерацию recipe и возвращает signature как ключ для проверки уникальности.
// Те же RNG-вызовы что в playUniqueAnimation в начале — так что signature
// захватывает component selection + key params.
private buildAnimSignature(sys: Race | BgSystem): string {
  const rng = this.animRng(sys)
  const theme = (sys as BgSystem).archetype ?? sys.type
  const pool = this.THEME_COMPONENTS[theme] ?? [0,1,2,3,4,5,6,7,8,9,10,11]
  const r1 = rng()
  const targetCount = r1 < 0.5 ? 2 : r1 < 0.85 ? 3 : 4
  const compCount = Math.min(targetCount, pool.length)
  const used = new Set<number>()
  const components: number[] = []
  while (components.length < compCount) {
    const c = pool[Math.floor(rng() * pool.length)]
    if (!used.has(c)) { used.add(c); components.push(c) }
  }
  // Modifier flag (25%)
  const modFlag = rng() < 0.25 ? 1 : 0
  // Sorted for set-equality
  return `${[...components].sort((a,b)=>a-b).join(',')}|m${modFlag}|${theme}`
}

// После создания allSystems в create() — refine seeds для уникальности.
private refineAnimSeeds(): void {
  const sigs = new Map<string, string>()
  let conflicts = 0
  for (const sys of this.allSystems) {
    let attempt = 0
    let sig = this.buildAnimSignature(sys)
    while (sigs.has(sig) && attempt < 5) {
      // Детерминированно мутируем rngSeed
      const cur = (sys as any).rngSeed ?? 0
      ;(sys as any).rngSeed = (cur ^ (attempt * 0x9e3779b9 + 1)) >>> 0
      sig = this.buildAnimSignature(sys)
      attempt++
      if (attempt === 5) conflicts++
    }
    sigs.set(sig, sys.id)
  }
  // eslint-disable-next-line no-console
  console.log(`[StarMap] anim signatures: ${sigs.size}/${this.allSystems.length} unique, ${conflicts} unresolved conflicts`)
}
```

**Вызвать из create() после `this.allSystems = [...MAIN_RACES, ...bg]`:**
```ts
this.refineAnimSeeds()
```

**Note:** main races не имеют rngSeed как поле — для них вместо мутации `(sys as any).rngSeed` используем мутацию переопределения через `this.mainSeedOverride[sys.id] = newSeed`. Adjustment в `animRng`:
```ts
private animRng(sys: Race | BgSystem): () => number {
  let seed: number
  if ('rngSeed' in sys && typeof (sys as BgSystem).rngSeed === 'number') {
    seed = (sys as BgSystem).rngSeed
  } else {
    // Main: hash от id, плюс возможный override от refine pass
    const override = this.mainSeedOverride.get(sys.id)
    if (override !== undefined) seed = override
    else {
      let h = 5381
      for (let i = 0; i < sys.id.length; i++) h = ((h * 33) ^ sys.id.charCodeAt(i)) >>> 0
      seed = h
    }
  }
  return mulberry32(seed)
}

private mainSeedOverride = new Map<string, number>()
```

И в `refineAnimSeeds` — для main записывать в map вместо мутации:
```ts
if ('rngSeed' in sys) (sys as any).rngSeed = newSeed
else this.mainSeedOverride.set(sys.id, newSeed)
```

**Acceptance:**
- В консоли при старте: `[StarMap] anim signatures: ≥445/450 unique`
- Без unresolved conflicts (0) — или с минимальным числом (≤2)
- TS-компиляция чистая

**Commit:** `phase-7: global anim uniqueness check via seed refinement`

---

### Task 7 — Verification скрипт
**Type:** test
**File:** `/tmp/verify_anim_uniqueness.cjs` (вне репо)

Скрипт читает `planetMap.json`, реплицирует logic из `buildAnimSignature` (без Phaser зависимостей — только RNG + THEME_COMPONENTS pools), генерирует signatures и логирует:
- Total unique
- Per-archetype unique count
- Top 5 наиболее общих signatures (если есть)

**Acceptance:**
- Скрипт запущен, output показывает ≥99% unique
- ≥10 уникальных signatures в каждом archetype/type pool

**Commit:** N/A (вспомогательный скрипт)

---

### Task 8 — Build & Smoke (анимации)
**Type:** verify

```bash
cd client && npx tsc --noEmit && npm run build
```

**Acceptance:**
- `tsc --noEmit` без ошибок
- `npm run build` успешно
- Dev-сервер запускается, при клике на 5 случайных планет одного archetype анимации визуально разные

**Commit:** N/A (только проверка)

---

## B. ТЕКСТУРЫ ПЛАНЕТ

### Task 9 — Sub-variants для топ-9 archetypes
**Type:** feature
**File:** `client/src/game/scenes/StarMapScene.ts`
**Function:** `renderBgPoint()` switch

Для каждого из 9 наиболее частых archetypes (gas_giant, gas_ringed, ice, ocean, desert, lava, forest, mineral, dead) добавить **2-3 sub-variant'а** рендера. Variant выбирается через `const variant = Math.floor(rng() * 3)` в начале case'а.

**Конкретные variant'ы:**

```ts
case 'gas_giant': {
  const variant = Math.floor(rng() * 3)
  if (variant === 0) {
    // banded — текущая логика (полосы + штормы)
    ...
  } else if (variant === 1) {
    // spotted — 6-12 круглых пятен разного размера
    const spots = 6 + Math.floor(rng() * 7)
    for (let i = 0; i < spots; i++) {
      const ang = rng() * Math.PI * 2
      const dist = sys.size * rng() * 0.7
      const r = sys.size * (0.08 + rng() * 0.15)
      g.fillStyle(rng() < 0.5 ? sys.color : sys.accent, 0.5 + rng() * 0.4)
      g.fillCircle(Math.cos(ang)*dist, Math.sin(ang)*dist, r)
    }
  } else {
    // storm — 1 большой ураган в центре + полосы
    g.fillStyle(sys.accent, 0.85)
    g.fillEllipse(0, 0, sys.size * 0.7, sys.size * 0.45)
    g.fillStyle(0xffffff, 0.4)
    g.fillEllipse(-sys.size * 0.1, -sys.size * 0.05, sys.size * 0.45, sys.size * 0.25)
    // вокруг — 2 полосы
    g.fillStyle(sys.color, 0.5)
    g.fillEllipse(0, -sys.size * 0.55, sys.size * 1.4, sys.size * 0.18)
    g.fillEllipse(0, sys.size * 0.55, sys.size * 1.4, sys.size * 0.18)
  }
  break
}

case 'ice': {
  const variant = Math.floor(rng() * 3)
  if (variant === 0) {
    // patchy — текущая (ледяные пятна)
    ...
  } else if (variant === 1) {
    // crystalline — грани кристалла (как mineral но в blue tint)
    g.lineStyle(1.5 * D, 0xa5f3fc, 0.8)
    const facets = 5 + Math.floor(rng() * 4)
    for (let i = 0; i < facets; i++) {
      const ang = baseRotation + (i / facets) * Math.PI * 2
      g.lineBetween(0, 0, Math.cos(ang)*sys.size*0.85, Math.sin(ang)*sys.size*0.85)
    }
    g.fillStyle(0xffffff, 0.5)
    g.fillCircle(0, 0, sys.size * 0.25)
  } else {
    // glacial — трещины во льду
    g.lineStyle(2 * D, 0xbae6fd, 0.6)
    for (let i = 0; i < 3 + Math.floor(rng() * 3); i++) {
      const startAng = rng() * Math.PI * 2
      const startR = sys.size * 0.2
      let px = Math.cos(startAng) * startR, py = Math.sin(startAng) * startR
      for (let s = 0; s < 4; s++) {
        const a = startAng + (rng() - 0.5) * 0.6
        const r = startR + (sys.size * 0.7 - startR) * (s + 1) / 4
        const x = Math.cos(a) * r, y = Math.sin(a) * r
        g.lineBetween(px, py, x, y)
        px = x; py = y
      }
    }
  }
  break
}
```

**Аналогично для остальных:** ocean (cloudy/calm/archipelago), desert (dunes/canyon/oasis), lava (cracked/volcanoes/flowing), forest (patches/biomes/jungle), mineral (faceted/veined/raw), dead (cratered/scarred/bare), gas_ringed (banded-rings/wide-disk/multi-ring).

**Acceptance:**
- 9 archetypes × 3 variants = 27 уникальных стилей рендера
- TS-компиляция чистая
- Build проходит

**Commit:** `phase-7: add 2-3 sub-variants for 9 hot archetypes`

---

### Task 10 — 6 новых universal modifiers поверх текстур
**Type:** feature
**File:** `client/src/game/scenes/StarMapScene.ts`
**Section:** "УНИВЕРСАЛЬНЫЕ МОДИФИКАТОРЫ ПОВЕРХ" (~ строка 1170)

Добавить:

```ts
// Surface lines — тонкие меридианы по поверхности (15%)
if (rng() < 0.15) {
  g.lineStyle(0.6 * D, sys.color, 0.4)
  const lines = 2 + Math.floor(rng() * 3)
  for (let i = 0; i < lines; i++) {
    const yOff = (i - lines/2 + 0.5) * sys.size * 0.35
    const w = sys.size * Math.cos(yOff / sys.size * Math.PI / 2) * 1.6
    g.strokeEllipse(0, yOff, w, sys.size * 0.12)
  }
}

// Gradient bands — плавный gradient (12%)
if (rng() < 0.12) {
  const bandY = (rng() - 0.5) * sys.size * 0.5
  for (let i = 0; i < 5; i++) {
    g.fillStyle(rng() < 0.5 ? sys.color : sys.accent, 0.05 + i * 0.03)
    g.fillEllipse(0, bandY, sys.size * 1.6, sys.size * (0.15 - i * 0.02))
  }
}

// Multi-color spots — кластеры мелких пятен с разными hue (15%)
if (rng() < 0.15) {
  const colors = [0xfde047, 0xa5f3fc, 0x86efac, 0xfca5a5, 0xc4b5fd]
  const clusters = 1 + Math.floor(rng() * 2)
  for (let c = 0; c < clusters; c++) {
    const cAng = rng() * Math.PI * 2
    const cDist = sys.size * (0.3 + rng() * 0.4)
    const cx = Math.cos(cAng) * cDist, cy = Math.sin(cAng) * cDist
    const tint = colors[Math.floor(rng() * colors.length)]
    for (let i = 0; i < 3 + Math.floor(rng() * 3); i++) {
      const dx = (rng() - 0.5) * sys.size * 0.3
      const dy = (rng() - 0.5) * sys.size * 0.3
      g.fillStyle(tint, 0.5 + rng() * 0.3)
      g.fillCircle(cx + dx, cy + dy, sys.size * (0.04 + rng() * 0.06))
    }
  }
}

// Stacked rings — 2-3 кольца разного диаметра/наклона (8%)
if (sys.archetype !== 'gas_ringed' && sys.archetype !== 'binary' && rng() < 0.08) {
  const n = 2 + Math.floor(rng() * 2)
  for (let i = 0; i < n; i++) {
    const ringGfx = this.add.graphics()
    ringGfx.lineStyle((0.8 + rng()) * D, i % 2 === 0 ? sys.color : sys.accent, 0.3 + rng() * 0.3)
    ringGfx.strokeEllipse(0, 0, sys.size * (2.0 + i * 0.4), sys.size * (0.3 + rng() * 0.4))
    ringGfx.angle = (rng() - 0.5) * 90
    container.add(ringGfx)
  }
}

// Asymmetric atmosphere — aura эллипсом / капсулой (20%)
if (showAura && rng() < 0.2) {
  const tilt = rng() * Math.PI * 2
  const ax = sys.size * (1.6 + rng() * 0.4)
  const ay = sys.size * (1.0 + rng() * 0.3)
  g.fillStyle(sys.color, 0.1 * sys.brightness)
  g.fillEllipse(0, 0, ax * 2, ay * 2)
  // повёрнутая атмосфера выглядит как капсула
  void tilt
}

// Color speckle — мелкие пиксели-точки случайных hue по поверхности (25%)
if (rng() < 0.25) {
  const N = 8 + Math.floor(rng() * 12)
  for (let i = 0; i < N; i++) {
    const ang = rng() * Math.PI * 2
    const r = sys.size * Math.sqrt(rng()) * 0.85
    const tint = rng() < 0.5 ? sys.color : sys.accent
    g.fillStyle(tint, 0.4 + rng() * 0.4)
    g.fillCircle(Math.cos(ang)*r, Math.sin(ang)*r, (0.5 + rng() * 1) * D)
  }
}
```

**Acceptance:**
- 6 новых модификаторов добавлены
- TS-компиляция чистая

**Commit:** `phase-7: add 6 universal texture modifiers (surface lines, gradient bands, multi-spot clusters, stacked rings, asymmetric atmosphere, color speckle)`

---

### Task 11 — Texture uniqueness signature + seed refinement
**Type:** feature
**File:** `client/src/game/scenes/StarMapScene.ts`

**Helper:**
```ts
// Симулирует первые ~10 rng() вызовов в renderBgPoint и кодирует выборы как signature.
// Captures: aura visibility, sub-variant choice, key counts, modifier flags.
private buildTextureSignature(sys: Race | BgSystem): string {
  if (!('archetype' in sys)) return `main:${sys.id}` // main races уникальны по id
  const rng = mulberry32(sys.rngSeed)
  // simulate первых калей в renderBgPoint порядке:
  // 1) aura
  rng()
  // 2) baseRotation
  rng()
  // 3) sub-variant choice
  const variant = Math.floor(rng() * 3)
  // 4-5) первые два counts (зависит от archetype)
  const c1 = Math.floor(rng() * 5)
  const c2 = Math.floor(rng() * 5)
  // 6-9) modifier flags
  const surfaceLines = rng() < 0.15 ? 1 : 0
  const gradientBands = rng() < 0.12 ? 1 : 0
  const multiSpots = rng() < 0.15 ? 1 : 0
  const stackedRings = rng() < 0.08 ? 1 : 0
  return `${sys.archetype}:v${variant}:c${c1}-${c2}:m${surfaceLines}${gradientBands}${multiSpots}${stackedRings}`
}

private refineTextureSeeds(): void {
  const sigs = new Map<string, string>()
  let conflicts = 0
  for (const sys of this.allSystems) {
    if (!('archetype' in sys)) continue // skip main
    let attempt = 0
    let sig = this.buildTextureSignature(sys)
    while (sigs.has(sig) && attempt < 5) {
      const cur = (sys as any).rngSeed ?? 0
      ;(sys as any).rngSeed = (cur ^ ((attempt + 1) * 0x85ebca6b)) >>> 0
      sig = this.buildTextureSignature(sys)
      attempt++
      if (attempt === 5) conflicts++
    }
    sigs.set(sig, sys.id)
  }
  // eslint-disable-next-line no-console
  console.log(`[StarMap] texture signatures: ${sigs.size}/${this.allSystems.length - 16} unique BG, ${conflicts} unresolved`)
}
```

**Вызвать:** после `this.allSystems = ...` в create():
```ts
this.refineTextureSeeds()  // ВАЖНО: до refineAnimSeeds(), т.к. изменения rngSeed повлияют на анимации
this.refineAnimSeeds()
```

**Acceptance:**
- В консоли при старте: `[StarMap] texture signatures: ≥430/434 unique`
- TS-компиляция чистая

**Commit:** `phase-7: global texture uniqueness check via seed refinement`

---

### Task 12 — Variability в renderMainPlanet
**Type:** feature
**File:** `client/src/game/scenes/StarMapScene.ts`
**Function:** `renderMainPlanet()`

Главные расы (16) рендерятся по фиксированной логике на `sys.id`. У них нет sub-variant'ов — каждая раса уже уникальна по дизайну. Но добавить **больше деталей** на каждую:
- Более выразительные континенты (HOME)
- Более яркие кольца кристаллов (BLIKS)
- Больше кратеров и текстуры на разрушенных (RELICT, NOCTIS)

Для каждой расы — 5-15 строк дополнительной деталировки в существующих if-ветках. **НЕ менять структуру**, только обогатить детали.

**Acceptance:**
- 16 main races визуально более насыщенные
- Build проходит

**Commit:** `phase-7: enrich main race textures with extra details`

---

### Task 13 — Verification скрипт для текстур
**Type:** test
**File:** `/tmp/verify_texture_uniqueness.cjs`

Скрипт читает `planetMap.json` и реплицирует `buildTextureSignature` (вне Phaser зависимостей). Считает unique signatures, per-archetype distribution. Лог: топ повторяющиеся signatures если есть.

**Acceptance:**
- Output показывает ≥99% unique
- Каждый archetype: ≥5-10 разных signatures (зависит от количества planets per archetype)

**Commit:** N/A

---

### Task 14 — Final Build & Visual Smoke
**Type:** verify

```bash
cd client && npx tsc --noEmit && npm run build && npm run dev
```

**Acceptance:**
- TS чистая, build OK
- Console: `[StarMap] texture signatures: ≥430/434 unique` + `anim signatures: ≥445/450 unique`
- Visual: открыть dev-сервер, отдалить камеру до zoom=0.4, найти 5 планет одного archetype (например ice) — они визуально разные
- Кликнуть на каждую: 5 разных анимаций

**Commit:** N/A

---

## Dependencies

**A. Анимации:**
- Task 1, 2, 3, 4 — независимые, параллельно
- Task 5 — независимый
- Task 6 — после 1, 5 (нужен правильный pool size + размер recipe)
- Task 7 — после 6
- Task 8 — после 1-7

**B. Текстуры:**
- Task 9, 10 — независимые, параллельно
- Task 11 — после 9, 10 (нужны новые variants и modifiers для signature)
- Task 12 — независимый
- Task 13 — после 11
- Task 14 — после всех

**Cross-phase:**
- `refineTextureSeeds()` должен вызываться **до** `refineAnimSeeds()` — мутация rngSeed для текстур повлияет на анимационные сигнатуры, поэтому текстуры — первый pass.

## Files Modified

- `client/src/game/scenes/StarMapScene.ts` (основной)
- `client/src/game/data/planetMap.json` (read-only)
- `.planning/STATE.md` (обновить current phase + completion)

## Risks / Notes

- **Phaser 4.1.0** — Container для wrapper-modifier должен поддерживать setRotation/setScale; tested выше работает.
- **Performance** — `refineAnimSeeds` + `refineTextureSeeds` запускаются один раз при старте, ~450 × 5 × 2 = 4500 hash ops. Negligible.
- **Mainsedoverride map** — память растёт на 16 entries max. ОК.
- **Wrapper container** на каждое срабатывание анимации с modifier — лишний draw call. 25% recipes × 5-15 срабатываний per session = ~30 wrappers активно. Уборка через delayedCall(1500) → safe.
- **Идемпотентность HSL shift** — детерминированный (тот же seed → тот же сдвиг) → стабильная подпись.
- **Texture signature simulator** должен **точно** реплицировать первые ~10 rng() вызовов в renderBgPoint. Если порядок rng() в renderBgPoint изменится — переписать signature builder.
- **Sub-variants** добавляют новый rng() call в начале каждого case → existing planets могут получить разные текстуры. Это ОК для нашего случая (рестарт scene всё равно всё перерисовывает).

---

## Verification

После завершения всех 14 task'ов:
1. `npx tsc --noEmit` чистая
2. `npm run build` проходит
3. Console output:
   - `[StarMap] texture signatures: ≥430/434 unique BG`
   - `[StarMap] anim signatures: ≥445/450 unique`
4. Visual smoke:
   - Отдалить камеру до zoom 0.4, посмотреть на 5 случайных планет одного archetype (ice/gas_giant/lava) — они визуально разные текстуры
   - Кликнуть на каждую — 5 разных анимаций

Update `.planning/STATE.md`: Phase 7 complete.
