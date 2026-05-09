---
phase: 19-balance-tutorial-i18n-polish
plan: master
type: overview
status: pending
depends_on: [18-bestiary-2-0]
total_plans: 7
total_waves: 4
requirements:
  - BALANCE-01
  - BALANCE-02
  - BALANCE-03
  - BALANCE-04
  - BALANCE-05
  - BALANCE-07
  - BALANCE-08
  - UX-01
  - UX-02
  - UX-03
  - UX-04
  - UX-05
  - UX-06
  - UX-08
  - PERF-01
  - PERF-05
  - PERF-07
  - I18N-02
  - I18N-03
---

# Phase 19 — Balance + tutorial + toggles + i18n polish (master plan)

> **Финальный polish layer перед v2.0 ship.** После этой фазы проект структурно
> готов к prod (с учётом deferred Phase 20 safety net). 17 REQ-IDs покрываются
> 7 sub-планами через 4 волны параллельной разработки.

---

## Goal

Финализировать v2.0:

1. **Wire pity counters** в реальный flow box-open (Phase 15 заложил
   `rollRarity`+`updatePity`, но они не вызываются из `openBox`).
2. **Visible pity counter UI** с прогрессивным reveal (`???` → dots → числа).
3. **Monte Carlo simulation script** — проверка что Locked Decisions
   (50/35/12/3 + pity 3/10/15/20/25) дают балансовые числа в спецификации.
4. **Visual audit** двухосевой визуализации (rarity = форма, element = hue)
   и colorblind-safe palette (Okabe-Ito + Krzywinski).
5. **Tutorial overlay system** с persisted seen-flags для 4 first-time событий.
6. **Settings toggles** Calm farm / Reduced effects / Open boxes instantly
   в существующей `SettingsModal`.
7. **Performance audit** — bundle delta cap +50 KB gzip vs v1.0 baseline,
   lazy-load chunks verify, FPS targets manual smoke.
8. **Full i18n coverage** RU/EN/ES — все Cosmic Hub UI + tooltips + errors +
   success toasts. Создаётся `check-translations.cjs` script.

---

## Wave structure

| Wave | Plans                                  | Parallel? | Why this wave                                                    |
|------|----------------------------------------|-----------|------------------------------------------------------------------|
| 1    | 19-01 (pity logic) + 19-04 (toggles)   | yes       | Independent; no file overlap                                     |
| 2    | 19-02 (Monte Carlo) + 19-05 (tutorial) | yes       | 19-02 needs `rollRarity`+pity API из 19-01; 19-05 reads sentinel flags из существующего store |
| 3    | 19-03 (pity UI) + 19-06 (visual+i18n)  | yes       | 19-03 needs pity API; 19-06 audits visuals что уже зафиксированы |
| 4    | 19-07 (perf audit)                     | no        | финальная проверка bundle/chunks после всех изменений            |

---

## Plans summary

### Wave 1 — Foundation (parallel)

#### 19-01: Pity counters wiring (BALANCE-01..05, BALANCE-07)

- **Files:** `client/src/store/cosmic/slice.ts`, `client/src/utils/rarityRoll.ts`,
  `client/src/store/cosmic/slice.test.ts` (NEW).
- **What:** В `openBox` действительно вызвать `rollRarity(state.pityCounters)`
  и `updatePity(...)` с записью обратно в `pityCounters`. Phase 15 положил
  utility но не подключил его к slice. Дополнительно: расширить
  `addBox` чтобы сохранять `bonusRarity` (и floor применялся в `openBox`).
- **Tests:** unit-тест slice.openBox показывает что `pityCounters.legendary`
  растёт на не-legendary и сбрасывается на legendary; hard 25 guarantee.

#### 19-04: Settings toggles (UX-04, UX-05, UX-06)

- **Files:** `client/src/store/gameStore.ts` (расширить `settings`),
  `client/src/ui/components/SettingsModal.tsx` (новая секция «Космос»),
  `client/src/i18n/{ru,en,es}.json` (3 новых ключа).
- **What:** Добавить три boolean флага: `calmFarmMode`, `reducedEffects`,
  `openBoxesInstantly`. Default OFF для всех. Поверхность UI — отдельная
  секция в SettingsTab («КОСМОС»). Включение flags читается consumer'ами
  (FrogOverlayManager → calmFarmMode; awakenedPresets dispatch → reducedEffects;
  SerumSlotMachine timing → openBoxesInstantly).

### Wave 2 — Verification + tutorial scaffolding (parallel)

#### 19-02: Monte Carlo balance simulation (BALANCE-08)

- **Files:** `client/scripts/simulate_balance.cjs` (NEW),
  `client/scripts/_shared.cjs` (extend если нужно), `package.json` (новый
  script `npm run sim-balance`).
- **What:** Standalone CommonJS скрипт реплицирующий `rollRarity` + `updatePity`
  без React/Phaser deps. 10K iterations (configurable через CLI arg).
  Output JSON: distribution, avgLegendaryPer100, avgRarePer100, avgEpicPer100,
  timeToFirstLegendary (median+min+max), pityHard25Breaches (must = 0).
  Commit baseline numbers как table в начало script-файла как комментарий.

#### 19-05: Tutorial overlay system (UX-08)

- **Files:** `client/src/components/Tutorial/TutorialOverlay.tsx` (NEW),
  `client/src/components/Tutorial/tutorialSteps.ts` (NEW),
  `client/src/store/cosmic/types.ts` (расширить `tutorialState` flags),
  `client/src/store/cosmic/slice.ts` (`markTutorialSeen` action),
  `client/src/store/gameStore.ts` (persist `tutorialState`).
- **What:** Reactive overlay component слушает `cosmic.tutorialState` + событийные триггеры.
  4 шага: `first-box`, `first-serum`, `first-feed`, `first-stabilize`.
  Persist seen-flags в localStorage как часть cosmicSlice.

### Wave 3 — UI surfaces (parallel)

#### 19-03: Visible pity counter UI (UX-01)

- **Files:** `client/src/components/CosmicHub/PityCounterDisplay.tsx` (NEW),
  `client/src/components/CosmicHub/CosmicHubModal.tsx` (mount footer),
  `client/src/i18n/{ru,en,es}.json` (новые keys).
- **What:** Footer-component в CosmicHubModal показывающий progressive pity
  counter. Reading from `cosmic.pityCounters` + counting `crew.missionsToday`
  ALL-TIME (sum from history? — нет, проще: считаем opened boxes count из
  `boxes.filter(b => b.opened).length`). Показ trail:
  - opened < 3 → null
  - 3 ≤ opened < 5 → DotIndicator (3-dot, заполняется по прогрессу к hard-25)
  - opened ≥ 5 → exact numbers («До rare: 1, до epic: 4, до legendary: 17»).

#### 19-06: Visual audit + colorblind palette + i18n full coverage (UX-02, UX-03, I18N-02, I18N-03)

- **Files:** `client/src/game/effects/elements/elementTints.ts` (audit + comments),
  `client/scripts/check-translations.cjs` (NEW),
  `client/src/i18n/{ru,en,es}.json` (gap closure),
  `package.json` (script `npm run check-translations`),
  audit comments в `SerumsTab.tsx`, `BoxesTab.tsx`, `BestiaryTab.tsx`,
  `CarrierInfoCard.tsx` (если уже существуют после Phase 17).
- **What:** Audit двухосевой визуализации + colorblind palette + создание
  check-translations script + закрытие i18n gaps. Финальная проверка что
  `elementTints.ts` соответствует Okabe-Ito + Krzywinski набору.

### Wave 4 — Performance gate (sequential)

#### 19-07: Performance audit + bundle verify + lazy-load verify (PERF-01, PERF-05, PERF-07)

- **Files:** `client/scripts/check-bundle-delta.cjs` (NEW),
  `client/scripts/.bundle-baseline-v1.json` (baseline snapshot),
  `package.json` (script `npm run check-bundle`),
  `SMOKE_TEST.md` (Phase 19 manual checklist + FPS smoke).
- **What:** Production build, dist analyse, проверить:
  - Total `dist/assets/index-*.js` gzip ≤ v1.0_baseline + 50 KB
  - Separate chunks: `CosmicHubModal-*.js`, `SerumSlotMachine-*.js` (если выделен),
    `BestiaryV2Tab-*.js`, `CascadeRevealModal-*.js`
  - Manual FPS smoke documented в SMOKE_TEST.md (60/50/30 targets)
  - tsc clean, lint clean.

---

## REQ → plan mapping (17 REQs)

| REQ-ID      | Plan  | Notes                                                        |
|-------------|-------|--------------------------------------------------------------|
| BALANCE-01  | 19-01 | weights 50/35/12/3 уже в `RARITY_WEIGHTS` (Phase 15) — verify |
| BALANCE-02  | 19-01 | sub-distribution 5/15/30/50 — это про ceiling (Phase 17 уже сделал?) — Phase 19 verify |
| BALANCE-03  | 19-01 | rare guarantee 3 → wired via openBox calling rollRarity      |
| BALANCE-04  | 19-01 | epic guarantee 10 → wired via openBox                         |
| BALANCE-05  | 19-01 | legendary soft 15/20 + hard 25 → wired via openBox            |
| BALANCE-07  | 19-01 | counters локально — pityCounters в cosmicSlice (persisted)    |
| BALANCE-08  | 19-02 | Monte Carlo script + commit baseline numbers                  |
| UX-01       | 19-03 | progressive pity counter UI                                   |
| UX-02       | 19-06 | two-axis visualization audit                                  |
| UX-03       | 19-06 | colorblind-safe palette verify                                |
| UX-04       | 19-04 | Calm farm mode toggle                                         |
| UX-05       | 19-04 | Reduced effects toggle (default OFF)                          |
| UX-06       | 19-04 | Open boxes instantly toggle                                   |
| UX-08       | 19-05 | tutorial overlay system + 4 steps + persist                   |
| PERF-01     | 19-07 | FPS targets manual smoke                                      |
| PERF-05     | 19-07 | bundle delta ≤ +50 KB gzip                                    |
| PERF-07     | 19-07 | lazy load Cosmic Hub modal verify                             |
| I18N-02     | 19-06 | full RU/EN/ES coverage UI                                     |
| I18N-03     | 19-06 | tooltips, errors, success messages                            |

**Coverage:** 17/17 ✓ (each REQ-ID assigned to exactly one plan).

---

## Architectural mandates

### Pity counters (BALANCE-01..07)

Phase 15 заложил **utility функции** (`rollRarity`, `updatePity`) и **state shape**
(`pityCounters: PityCounters` в `CosmicSlice`), но `openBox` действие slice'а
**не вызывает** их. Phase 19-01 закрывает gap:

```ts
// cosmic/slice.ts (расширение Phase 15)
openBox: (id: string) => {
  const s = get()
  const box = s.boxes.find(b => b.id === id)
  if (!box || box.opened) return

  // ✅ Phase 19: actually wire pity
  const pity: PityState = {
    rare: s.pityCounters.rare,
    epic: s.pityCounters.epic,
    legendary: s.pityCounters.legendary,
  }
  const rolled = rollRarity(pity, box.bonusRarity)
  const newPity = updatePity(pity, rolled)

  // award serum в инвентарь (element from box)
  const nextSerums = {
    ...s.serums,
    [box.element]: {
      ...s.serums[box.element],
      [rolled]: s.serums[box.element][rolled] + 1,
    },
  }

  set({
    boxes: s.boxes.map(b => b.id === id ? { ...b, opened: true } : b),
    serums: nextSerums,
    pityCounters: { common: 0, ...newPity },  // common keeps placeholder 0
  })

  eventBus.emit('cosmic:box-opened', { boxId: id, rarity: rolled, element: box.element })
}
```

`PityState` (Phase 15 utility type) использует поля `rare/epic/legendary`, а
`PityCounters` (Phase 11 store type) имеет также `common: number` placeholder.
**Phase 19-01 НЕ меняет shape** — только wire data flow.

### Pity counter UI display modes (UX-01)

```tsx
// PityCounterDisplay.tsx (концепт)
function PityCounterDisplay() {
  const t = useTranslation()
  const pity = useGameStore(s => s.pityCounters)
  const openedCount = useGameStore(s =>
    s.boxes.filter(b => b.opened).length
  )

  if (openedCount < 3) return null

  if (openedCount < 5) {
    // dot indicator: показываем progress к hard-25 (3 dots filled out of 25)
    const dots = Math.min(3, Math.floor(pity.legendary / 9))
    return (
      <div className="ff-body text-xs text-emerald-200">
        {t('cosmic_hub.pity_growing')}{' '}
        <span style={{ letterSpacing: 2 }}>
          {'●'.repeat(dots) + '○'.repeat(3 - dots)}
        </span>
      </div>
    )
  }

  // exact numbers
  return (
    <div className="ff-body text-xs flex gap-3">
      <span>{t('cosmic_hub.pity_rare', { n: Math.max(0, 3 - pity.rare) })}</span>
      <span>{t('cosmic_hub.pity_epic', { n: Math.max(0, 10 - pity.epic) })}</span>
      <span>{t('cosmic_hub.pity_legendary', { n: Math.max(0, 25 - pity.legendary) })}</span>
    </div>
  )
}
```

### Settings toggles (UX-04, UX-05, UX-06)

Добавляются в существующий `useGameStore.settings` объект (а не в новый
`cosmicSettings.ts` — следуем паттерну Phase 15/16). Имена полей:

```ts
settings: {
  // ... existing
  calmFarmMode: boolean        // UX-04 default false
  reducedEffects: boolean      // UX-05 default false (Locked Decision)
  openBoxesInstantly: boolean  // UX-06 default false
}
```

Consumer wiring:

- `calmFarmMode` → `FrogOverlayManager` (Phase 12) ранний return на acquire,
  чтобы overlay не attach'ed
- `reducedEffects` → awakened preset dispatcher (Phase 13) clamps tier на dormant
  (не запускает rare/epic/legendary effects)
- `openBoxesInstantly` → `SerumSlotMachine` (Phase 15) clamps total duration на 1с
  (даже legendary 9-10c → 1с).

### Monte Carlo script

Standalone CommonJS — НЕ имеет access к React/Phaser/Zustand. Реплицирует
**только pure logic** из `rarityRoll.ts`. Чтобы избежать drift — копируется
1:1 как `rollRarityCJS()` функция, и в комментарии указывается «mirror of
client/src/utils/rarityRoll.ts (keep in sync)».

```js
// client/scripts/simulate_balance.cjs
// MIRROR of client/src/utils/rarityRoll.ts (pure logic, no React/Phaser).
// Keep in sync. Last verified against rarityRoll.ts: 2026-05-08.

const RARITY_WEIGHTS = { common: 50, rare: 35, epic: 12, legendary: 3 }
const ORDER = ['common', 'rare', 'epic', 'legendary']

function rollRarity(pity, bonusRarity, rng = Math.random) { /* ... 1:1 mirror ... */ }
function updatePity(pity, rolled) { /* ... 1:1 mirror ... */ }

const ITERATIONS = parseInt(process.argv[2] || '10000', 10)

let pity = { rare: 0, epic: 0, legendary: 0 }
const dist = { common: 0, rare: 0, epic: 0, legendary: 0 }
let firstLegIdx = -1
const legendaryGapHistogram = []
let pityBreaches = 0
let consecNonLeg = 0

for (let i = 0; i < ITERATIONS; i++) {
  if (pity.legendary > 25) pityBreaches++
  const r = rollRarity(pity)
  pity = updatePity(pity, r)
  dist[r]++
  if (r === 'legendary') {
    if (firstLegIdx < 0) firstLegIdx = i
    legendaryGapHistogram.push(consecNonLeg)
    consecNonLeg = 0
  } else {
    consecNonLeg++
  }
}

console.log(JSON.stringify({
  iterations: ITERATIONS,
  distribution: dist,
  pct: {
    common: (dist.common * 100 / ITERATIONS).toFixed(2),
    rare: (dist.rare * 100 / ITERATIONS).toFixed(2),
    epic: (dist.epic * 100 / ITERATIONS).toFixed(2),
    legendary: (dist.legendary * 100 / ITERATIONS).toFixed(2),
  },
  avgLegendaryPer100: (dist.legendary * 100 / ITERATIONS).toFixed(3),
  timeToFirstLegendary: firstLegIdx,
  pityHard25Breaches: pityBreaches,  // MUST be 0
  legendaryGap: {
    min: Math.min(...legendaryGapHistogram),
    max: Math.max(...legendaryGapHistogram),
    median: legendaryGapHistogram.sort((a,b) => a-b)[Math.floor(legendaryGapHistogram.length / 2)],
  },
}, null, 2))
```

**Acceptance:**
- avgLegendaryPer100 ≈ 3.0 ± 0.3 (Locked Decision baseline)
- pityHard25Breaches === 0 на любом seed
- max legendary gap ≤ 25 (hard pity verify)

### Tutorial overlay system

Persisted seen-flags хранятся в `cosmic.tutorialState`:

```ts
// в CosmicSlice:
tutorialState: {
  seenFirstBox: boolean
  seenFirstSerum: boolean
  seenFirstFeed: boolean
  seenFirstStabilize: boolean
}

// Action:
markTutorialSeen: (step: TutorialStepId) => void
```

Триггеры читают существующие sentinel флаги:

| Step              | Trigger condition                                              |
|-------------------|----------------------------------------------------------------|
| first-box         | `hasOpenedAnyBox === true` && `!seenFirstBox`                   |
| first-serum       | `serumDragActive === true` && `!seenFirstSerum` (ON ENTRY)      |
| first-feed        | `hasFirstFeed === true` && `!seenFirstFeed`                     |
| first-stabilize   | первый `carrier.stabilized === true` && `!seenFirstStabilize`   |

`TutorialOverlay` mount'ится в `App.tsx` рядом с `CosmicHubModal`. На каждом
рендере проверяет один-step-active rule (никогда не показывать 2 одновременно),
после tap на «Понятно» вызывает `markTutorialSeen(step)`.

### check-translations script

```js
// client/scripts/check-translations.cjs
// Сравнивает ключи в ru.json/en.json/es.json. Reports missing.
const fs = require('fs')
const path = require('path')

function flatten(obj, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) out.push(...flatten(v, key))
    else out.push(key)
  }
  return out
}

const ru = JSON.parse(fs.readFileSync('client/src/i18n/ru.json', 'utf8'))
const en = JSON.parse(fs.readFileSync('client/src/i18n/en.json', 'utf8'))
const es = JSON.parse(fs.readFileSync('client/src/i18n/es.json', 'utf8'))

const ruKeys = new Set(flatten(ru))
const enKeys = new Set(flatten(en))
const esKeys = new Set(flatten(es))

const allKeys = new Set([...ruKeys, ...enKeys, ...esKeys])

const missingEn = [...allKeys].filter(k => !enKeys.has(k))
const missingEs = [...allKeys].filter(k => !esKeys.has(k))
const missingRu = [...allKeys].filter(k => !ruKeys.has(k))

if (missingRu.length || missingEn.length || missingEs.length) {
  console.error('Missing translations:')
  if (missingRu.length) console.error('  RU:', missingRu)
  if (missingEn.length) console.error('  EN:', missingEn)
  if (missingEs.length) console.error('  ES:', missingEs)
  process.exit(1)
}
console.log(`OK: ${ruKeys.size} keys, RU=EN=ES`)
```

### Bundle delta script

```js
// client/scripts/check-bundle-delta.cjs
// Reads dist/assets/index-*.js gzip size, compares to baseline.
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const BASELINE = JSON.parse(fs.readFileSync('client/scripts/.bundle-baseline-v1.json', 'utf8'))
// e.g. { "indexJsGzip": 196000, "version": "v1.0", "savedAt": "2026-XX-XX" }

const distDir = 'client/dist/assets'
const files = fs.readdirSync(distDir).filter(f => /^index-.+\.js$/.test(f))
if (files.length !== 1) {
  console.error(`expected 1 index-*.js, found ${files.length}`)
  process.exit(1)
}
const main = path.join(distDir, files[0])
const buf = fs.readFileSync(main)
const gz = zlib.gzipSync(buf).length
const delta = gz - BASELINE.indexJsGzip
const cap = 50 * 1024  // 50 KB

const expectedChunks = ['CosmicHubModal', 'BestiaryV2Tab']
const actualChunks = fs.readdirSync(distDir).filter(f => /\.js$/.test(f) && !f.startsWith('index-'))
const missingChunks = expectedChunks.filter(name =>
  !actualChunks.some(f => f.includes(name))
)

console.log(JSON.stringify({
  baseline: BASELINE.indexJsGzip,
  current: gz,
  delta,
  capPassed: delta <= cap,
  expectedChunks,
  actualChunks,
  missingChunks,
}, null, 2))

if (delta > cap) process.exit(1)
if (missingChunks.length > 0) process.exit(1)
```

---

## Acceptance criteria (overall phase)

1. **Build clean:** `tsc --noEmit` clean; `vite build` succeeds.
2. **Bundle delta:** `npm run check-bundle` passes (delta ≤ 50 KB gzip vs v1.0 baseline).
3. **Lazy chunks:** dist contains separate `CosmicHubModal-*.js`, `BestiaryV2Tab-*.js`
   chunks (verified by check-bundle script).
4. **Monte Carlo:** `node client/scripts/simulate_balance.cjs 10000` outputs:
   - avgLegendaryPer100 ∈ [2.7, 3.3]
   - pityHard25Breaches === 0
   - max legendary gap ≤ 25
5. **Pity counter UI:**
   - Hidden first 3 opened boxes (returns null)
   - DotIndicator at 3-4
   - Exact numbers at 5+ (`До rare через 1`, `До epic через 4`, `До legendary через 17`)
6. **Settings toggles function:**
   - Calm farm: aura/idle particles не появляются на ферме (verify через FrogOverlayManager guard)
   - Reduced effects: awakened presets clamps на dormant tier
   - Open boxes instantly: SerumSlotMachine total duration ≤ 1с независимо от rarity
7. **Tutorial overlays:**
   - 4 steps trigger один раз каждый
   - markTutorialSeen persist'ится в localStorage
   - reload не показывает уже-seen overlay
8. **i18n full coverage:**
   - `npm run check-translations` exits 0
   - все новые keys (cosmic_hub.pity_*, settings.calm_farm, settings.reduced_effects,
     settings.open_boxes_instantly, tutorial.first_box, tutorial.first_serum,
     tutorial.first_feed, tutorial.first_stabilize) присутствуют RU/EN/ES
9. **Phase 19 commits:** atomic; conventional `phase-19: <action>` format.

---

## Source audit

### GOAL coverage

ROADMAP Phase 19 goal:
> «Final polish before v2.0 ship: lock pity numbers + Monte Carlo simulation
> script, progressive tutorial overlays for first-time players, all Settings
> toggles, full RU/EN/ES coverage, performance budget verification,
> lazy-load checks. After this phase v2.0 is shippable.»

| Goal element            | Coverage plan |
|-------------------------|---------------|
| Lock pity numbers       | 19-01         |
| Monte Carlo script      | 19-02         |
| Progressive tutorial    | 19-05         |
| Settings toggles        | 19-04         |
| Full RU/EN/ES           | 19-06         |
| Performance budget      | 19-07         |
| Lazy-load checks        | 19-07         |
| Pity UI (UX-01)         | 19-03         |
| Visual audit (UX-02/03) | 19-06         |

✅ All goal elements covered.

### REQ coverage

17/17 — see REQ → plan mapping table above.

✅ Each requirement assigned to exactly one plan.

### CONTEXT (Locked Decisions)

| Decision                                  | Plan(s)         |
|-------------------------------------------|-----------------|
| Веса 50/35/12/3                            | 19-01 verify    |
| Pity soft 15/20 hard 25                    | 19-01           |
| Pity rare guarantee 3                      | 19-01           |
| Pity epic guarantee 10                     | 19-01           |
| Reduced effects default OFF                | 19-04           |
| Bundle delta cap +50 KB                    | 19-07           |
| Hard cap 4 visible overlay (PERF-02)       | (Phase 12, не Phase 19 — verify only) |
| Pity counter visible progressive (UX-01)   | 19-03           |

✅ All applicable Locked Decisions reflected.

### RESEARCH coverage

UX research 5.1-5.2 (visible pity counter): 19-03.
UX research 8.4 («Calm farm mode» toggle): 19-04.
DOMAIN balance recommendations (50/35/12/3, pity 3/10/25): 19-01 + 19-02.
ARCHITECTURE 4.5 (lazy Cosmic Hub modal): 19-07 verify.
ARCHITECTURE 4.12 (Reduced effects toggle): 19-04.

✅ All in-scope research items covered.

### Out of scope (explicitly deferred)

- INFRA-01..03 (incremental migration) — Phase 20
- INFRA-05 (adaptive throttle) — Phase 20
- INFRA-06 (scene shutdown discipline) — Phase 20
- PERF-04 (adaptive throttle) — Phase 20

These are documented as Phase 20 dependencies в ROADMAP.

---

## Threat model (security_enforcement disabled — no external surface)

Phase 19 не вводит новых trust boundaries: всё локальное (localStorage,
in-memory state). Monte Carlo script runs only при manual invocation
разработчиком. check-translations и check-bundle scripts read-only.

| Threat ID    | Category      | Component                      | Disposition | Mitigation                                                        |
|--------------|---------------|--------------------------------|-------------|-------------------------------------------------------------------|
| T-19-01      | Tampering     | localStorage settings/pity      | accept      | Solo single-player idle; tampering = self-cheat без impact на others |
| T-19-02      | Disclosure    | Monte Carlo script output       | accept      | dev-only; numbers уже в открытом ROADMAP/REQUIREMENTS               |
| T-19-03      | DoS           | tutorial overlay infinite loop  | mitigate    | one-step-active rule + markTutorialSeen idempotent                  |

---

## Plans index

| Plan ID  | Title                                         | Wave | REQs |
|----------|-----------------------------------------------|------|------|
| 19-01    | Pity counters wiring                          | 1    | 6    |
| 19-02    | Monte Carlo balance simulation                | 2    | 1    |
| 19-03    | Visible pity counter UI                       | 3    | 1    |
| 19-04    | Settings toggles                              | 1    | 3    |
| 19-05    | Tutorial overlay system                       | 2    | 1    |
| 19-06    | Visual audit + colorblind palette + i18n      | 3    | 4    |
| 19-07    | Performance audit + bundle verify + lazy-load | 4    | 3    |
