# Phase 7 Research — Unique Planet Animations

**Researched:** 2026-05-07
**Source:** Direct analysis of existing system + iterative session feedback

## Problem Statement

Текущая система анимаций при клике (StarMapScene.ts) имеет:
- 54 атомарных компонента
- THEME_COMPONENTS pools (8-15 на archetype/type)
- THEME_PALETTES (тематические цвета)
- Recipe из 1-4 компонентов с rng-параметрами
- Per-planet detrministic RNG через `mulberry32(sys.rngSeed)`

Юзер сообщил что **визуально видны повторы** — особенно среди планет одного архетипа.

## Root Cause Analysis

Анализ источников коллизий:

### 1. Recipe size 1 — главный source повторов
Probability распределение раньше: `1(25%) / 2(50%) / 3(20%) / 4(5%)`.
На pool из 10 компонентов, 1-component recipes дают всего **10 уникальных вариантов**. С 450 планет, ~112 (25%) попадают в эту категорию → принципиально не могут быть все уникальными.

### 2. Параметрические ranges узкие
Например `compRing` имеет `endScale = 1.8 + rng() * 1.5` (1.8-3.3). Это всего 1.5x range. Визуально близкие 2 ring'а с scale 2.0 и 2.3 — почти неотличимы. Нужно расширить до 2.5x+.

### 3. Цвет — сильный perceptual driver
`pickColor` в 55% берёт из тематической палитры. Палитра ice имеет 5 цветов. Значит ~55% × 5 цветовых вариантов = высокая частота повторов tint'а среди ice планет.

Решение: HSL hue shift на ±25° по seed → каждая планета имеет свой подтон.

### 4. Components shared между archetypes
`compSparkle` (case 2) присутствует в pools 14 archetypes из 28. Если 2 планеты разных archetype получают recipe `[compSparkle, compFlash]` (компоненты из общего перекрытия pools), то signature одинаковый.

Решение: уникальность сравнивается **внутри archetype** (signature включает theme), а кросс-archetype overlap — нормально (планеты разных типов и так визуально разные).

### 5. Modifier diversity отсутствует
Нет глобальных модификаторов рецепта (rotation/scale/HSL). Каждый recipe играется в одной "канонической" ориентации — ring всегда concentric, sparkle всегда radial.

Решение: 25% chance — wrap recipe в modifier (rotation ±90°, scale ±30%) → новые миллионы вариаций.

## Combinatorial Math

**Сейчас:**
- Avg pool size = 11
- Recipes: C(11,1) + C(11,2) + C(11,3) + C(11,4) = 11 + 55 + 165 + 330 = **561 уникальных recipes**
- Но 1-component (11) × 25% = 2.75 случаев на recipe в среднем → коллизии

**После Task 1+3 (минимум 2, +modifier):**
- Recipes: C(11,2) + C(11,3) + C(11,4) = 55 + 165 + 330 = **550 уникальных recipes**
- × 2 (modifier on/off) = **1100 уникальных recipes**
- × scaleShift вариаций (3 категории small/medium/large) = **3300 уникальных recipes**

**На archetype с pool 11 и ~30-50 планет** → коллизий случайно очень мало.

**После Task 2 (HSL shift):**
- HSL hue shift в 7 категориях → перцептуально различимые цвета даже при одинаковой recipe-signature

**После Task 5 (+10 components):**
- Pool 11 → 13-14 на тематических archetype
- Recipes: C(14,2) + C(14,3) + C(14,4) = 91 + 364 + 1001 = **1456 уникальных recipes**
- × 2 modifier × 3 scale = **8736 уникальных recipes**

## Why This Approach (not alternatives)

### ❌ Альтернатива 1: 100+ компонентов руками
Слишком много кода (~300 LOC на каждый × 50 = 15000 LOC). Поддерживать невозможно.

### ❌ Альтернатива 2: Полностью процедурные shader-effects
Сложно в Phaser 4 (каждый эффект — свой shader pipeline). Не reusable. Гораздо больше work.

### ✅ Выбранный подход: Combinatorial expansion
- Минимум 2-component recipes — главный fix (убирает principled источник повторов)
- HSL shift — perceptual diversity дешево
- Modifier wrappers — структурная diversity дешево
- 10 новых компонентов — qualitative coverage of archetype gaps
- Uniqueness check — guarantee a posteriori

## Pitfalls

### Detrministic seed mutation
`refineAnimSeeds` мутирует `sys.rngSeed`. Для main races — нет такого поля → используем `mainSeedOverride: Map<string, number>`. `animRng` сначала проверяет map.

### Wrapper container memory
Container с modifier создаётся per click → 25% recipes. Уборка через `delayedCall(1500)`. Risk: если игрок спам-нажимает, накапливаются. Mitigation: `1500ms` < flash interval (≈2-5s), так что они уйдут вовремя.

### Recipe signature stability
Signature собирается через `animRng` — те же RNG calls что в реальной игре. Если в реальной игре в начале есть `rng()` calls которых нет в signature builder → divergence. Solution: `buildAnimSignature` точно реплицирует первые ~5 rng() calls.

### HSL shift на тёмных цветах
Если color = 0x000000, HSL shift не имеет эффекта (нет hue). Но в палитрах нет чёрных. Проверка не нужна.

## Recommended Reading

- `client/src/game/scenes/StarMapScene.ts:1370-2000` — `playUniqueAnimation`, `runAnimComponent`, все `compXxx`
- `client/src/game/scenes/StarMapScene.ts:1305-1370` — `THEME_PALETTES`, `THEME_COMPONENTS`, `pickColor`, `pickEase`
- `client/src/game/scenes/StarMapScene.ts:1280-1305` — `animRng`, `handlePlanetPress`
- `client/src/game/scenes/StarMapScene.ts:870-1170` — `renderBgPoint` switch'и для archetypes (тут добавляются sub-variants)
- `client/src/game/scenes/StarMapScene.ts:1170-1290` — universal modifiers (тут добавляются 6 новых)

---

## TEXTURE SUBSYSTEM (Tasks 9-14)

### Текущий рендер планет — анализ

Каждый archetype рендерится по фиксированной формуле в `renderBgPoint` switch:
- `gas_giant`: 2-6 полос + 0-3 шторма
- `ice`: 3-7 ледяных пятен
- `lava`: 4-8 трещин + ядро
- ...

Параметры варьируются через `mulberry32(sys.rngSeed)`. Итого по архетипу ~36 планет (434 / 12) каждая со случайными counts/positions.

### Почему юзер видит «одинаковые»

1. **Один шаблон рендера на archetype** — все gas_giant получают полосы. Только число и положение варьируется. Структура та же → перцептуально похоже.

2. **Узкие диапазоны параметров**:
   - bands: 2-6 (range 5)
   - storms: 0-3 (range 4)
   - patches: 3-7 (range 5)
   
   На 36 планет одного архетипа коллизий бэндов/positions много.

3. **Modifier шансы низкие**:
   - кратер 12%, кольцо 22%, тёмный пояс 12%, яркое пятно 12%
   - Модификаторы не trigger'ятся часто, нет дополнительной вариативности

### Combinatorial Math (текстуры)

**Сейчас (gas_giant как пример):**
- 5 bands variations × 4 storms variations × 36 planets per archetype = 720 теоретических
- Но визуально различимо ~50-100 (положения штормов rng-varied но мелкие)
- Перцептуально ~10-15 «семейств» одного archetype → коллизий много

**После Task 9 (3 sub-variants):**
- 3 variants × 5 bands × 4 storms = 60 базовых  
- Каждый variant ВЫГЛЯДИТ ИНАЧЕ → перцептуально 30-50 различимых вариантов
- На 36 planets → коллизии редкие

**После Task 10 (+6 modifiers):**
- × 2^6 modifier flags = × 64
- Total 60 × 64 = **3840 unique signature comb's** на архетип
- На 36 planets → ≥35 unique

**После Task 11 (uniqueness check):**
- ≥99% unique гарантировано через seed refinement

### Pitfalls (текстуры)

#### Sub-variants добавляют rng() call
Если в начале switch case'а будет `rng()` для variant, существующие положения штормов/полос (которые тоже идут через rng()) сдвинутся. Это значит **все existing planets изменят внешний вид**. Это OK для нашей цели — но важно понимать что текущая «знакомая» картина пропадёт.

#### Texture signature и refinement порядка
`refineTextureSeeds` мутирует `rngSeed` → это влияет на animation signatures (тоже зависят от rngSeed). Решение: вызывать `refineTextureSeeds` **первым**, потом `refineAnimSeeds` — animation видит уже мутированный seed и refine'ит по нему.

#### Variant choice signature
Если текущая логика case'а использует rng() сразу, добавив `rng() * 3` в начале сдвинем последующие values. Поэтому signature builder должен реплицировать **новый** порядок rng() calls.

### Why this approach

✅ **Sub-variants** — большой qualitative leap (новые «семейства» текстур) с минимумом кода (~40 LOC на variant × 9 archetypes × 2 new variants = ~720 LOC)
✅ **Modifiers** — low-cost дополнительная diversity, обогащают любой variant
✅ **Uniqueness check** — гарантия a posteriori
❌ **Полностью переписать рендер** — too much work, теряем существующий шарм

### Reading

- `client/src/game/scenes/StarMapScene.ts:870-1170` — switch'и archetypes
- `client/src/game/scenes/StarMapScene.ts:1170-1290` — universal modifiers
- `client/src/game/data/planetMap.json` — `archetype` поля для распределения
