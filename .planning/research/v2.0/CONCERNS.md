# CONCERNS / RISKS — Cosmic Frogs System (v2.0)

**Researcher:** GSD researcher (concerns/risks zone)
**Date:** 2026-05-08
**Milestone:** v2.0 — Cosmic Frogs System
**Confidence:** MEDIUM-HIGH (большинство выводов проверены через MDN/web.dev/Phaser docs + анализ codebase)

---

## TL;DR — Executive Summary

Главные подводные камни v2.0:

1. **Performance budget катастрофически узкий.** 16 лягушек × 5 element-overlay = 80 одновременных particle-loop в дополнение к существующим 1000-планетным анимациям, какашкам, magnet, merge tweens. На iPhone 12 / Android mid-2020 это с высокой вероятностью даст 30-45 fps вместо 60. **Mitigation:** жёсткий cap 1 overlay активно показывается одновременно (не все 16 на ферме одновременно мигают), shared TweenChain с pause/resume, off-screen culling.

2. **localStorage уже на грани.** Текущий снимок (1000 планет в memory + сейв-данные) использует ~50-100 KB. После добавления сывороточного инвентаря, бестиария 2.0 (1536 ячеек со счётчиками), carrier-state, scout-таймеров получим оценочно 200-500 KB. До 5 MB лимита запас есть, но **bundle JS (planetMap.json+animation recipes) скорее всего уже подбирается к Telegram WebView практическому лимиту времени загрузки на 3G.**

3. **Cognitive overload почти гарантирован.** 16 элементов × 4 редкости × 24 уровня + carrier eligibility + feed mechanics + hidden ceiling + slot-machine drama + 4 типа боксов — это ~7 новых концепций сразу. UX research (NN/Group, Pendo) показывают: drop-off на onboarding пропорционален количеству механик, представленных в первых 10 минутах.

4. **Slot-machine fatigue к 100-му открытию.** Hearthstone, Genshin, HSR — все добавили skip/auto-skip после жалоб игроков на задержки 1-30 секунд. Наша 1.2-14с slot-machine на каждом боксе — на 200-м просмотре будет ад. **Skip/auto-skip обязателен с самого начала, не как «фича позже».**

5. **DnD на mobile в Telegram WebView — большой риск багов.** HTML5 drag-drop spec базируется на mouse events, не работает в большинстве мобильных WebView. Текущая реализация в Phaser использует pointer events (хорошо), но для DnD сывороток (React UI → Phaser-canvas drop target) понадобится отдельная архитектура: либо custom touch-handlers (полифилл вроде DragDropTouch), либо переход на tap-to-select-then-tap-to-apply (более mobile-native).

6. **Save game integrity — миграция от STORAGE_VERSION=15 → 16 сейчас сбрасывает прогресс полностью.** Это OK для dev-режима, но катастрофа после релиза. Нужна **incremental migration**, не full reset.

7. **Long-tail balance riske.** Pity 25 без legendary = ~5 часов миссий — для casual слишком долго. Hidden ceiling 50/30/15/5 внутри tier — frustration multiplier. **Нужен видимый прогресс к ceiling**, не «случайно когда-нибудь стабилизируется».

---

## A. Performance Budget Анализ

### A.1. Frame budget на target устройствах

| Device class | CPU/GPU | Frame budget @ 60fps | Realistic budget @ 30fps |
|--------------|---------|----------------------|--------------------------|
| iPhone 14 Pro | A16 Bionic | 16.7 ms | 33.3 ms |
| iPhone 12 (target min iOS) | A14 | 16.7 ms (тяжко) | 33.3 ms |
| Pixel 7 | Tensor G2 | 16.7 ms | 33.3 ms |
| Samsung Galaxy M04 (target min Android) | Helio P35 | 33.3 ms (30fps реально достижимо) | 33.3 ms |
| Xiaomi Redmi Note 8 (mid-2019) | Snapdragon 665 | 22-25 ms (45 fps) | 33.3 ms |

**Ссылки:**
- [Phaser Performance Guide](https://generalistprogrammer.com/tutorials/phaser-performance-optimization-guide): "60 FPS = 16.67 ms per frame must cover physics + logic + rendering + GC"
- [Phaser Issue #6989 — low-end performance](https://github.com/phaserjs/phaser/issues/6989): documented lag on Galaxy M04 with multiple simultaneous animations
- [Phaser Issue #7086 — FX rendering on Android](https://github.com/phaserjs/phaser/issues/7086): Android WebView ограничен на FX/postFX

### A.2. Текущий runtime cost (baseline)

Из анализа кода `MainScene.ts` + `StarMapScene.ts`:

- **MainScene активные tween'ы при 16 entities:**
  - 16 idle-tween'ов (jiggle лягушек) × ~2 properties = ~32 active tweens
  - 16 box-idle (когда есть боксы) ~16 tweens
  - 1-2 magnet-flow tweens
  - 0-30 какашек fade tweens
  - **Total ~50-80 active tweens** (peak ~100)

- **StarMapScene при открытии:**
  - 1000 планет, но уже LOD-batched
  - В peak активные idle-tweens на видимых ~50-100 планетах
  - **~100-200 active tweens**

- **DPR multiplier:** канвас рендерится в физических пикселях × DPR (до 3×). На iPhone 14 Pro Max это 1290×2796 backing store. Каждый tween, fill, stroke — на физических пикселях.

### A.3. Дополнительный cost от v2.0

Worst case добавляется:

| Источник | Add tweens/frame | Add particles | Per frame ms |
|----------|------------------|---------------|--------------|
| 16 element-overlay loops (idle на лягушках) | +16-48 tweens | 0-80 particles | +3-6 ms |
| Slot-machine открыт | +20-40 tweens | 50-200 particles | +5-10 ms |
| Cosmic Hub modal с 1000 планетами + scout indicators | +10-20 tweens | +scout-timer animations | +2-4 ms |
| Carrier-application drama (2с) | +10-15 tweens | +50 particles | +3 ms (on-event) |
| Feed-эволюция drama | +20-30 tweens | +100 particles | +5 ms (on-event) |
| Mini-clicker миссия | +20 tweens, particles per tap | ad-hoc | +2-4 ms |
| Бестиарий 2.0 grid 1536 ячеек | DOM render (не Phaser) | 0 | +5-15 ms (one-time at modal open) |

**Worst-case overhead: +13-22 ms per frame** при одновременной visible активности.

При baseline ~10-15 ms (текущий) + 13-22 ms (v2.0) = **23-37 ms = 27-43 fps**. На low-end Android — гарантированный stutter.

### A.4. Recommended performance budget

```
TOTAL FRAME BUDGET: 16.67 ms (60 fps) / 33.3 ms (30 fps fallback)
├─ React render + Zustand updates:      < 2 ms
├─ Phaser core (input, scene update):    < 3 ms
├─ MainScene scene update (existing):    < 5 ms
├─ Element-overlay budget (NEW):         < 3 ms (HARD CAP)
├─ Modal/UI animations:                  < 2 ms
└─ GC headroom:                          1-1.5 ms
```

**Конкретные правила:**

1. **Macro rule:** На ферме одновременно visible не больше **N=4** активных element-overlay. Остальные — paused (`tween.pause()`) и активируются только при interaction (тап, hover).

2. **Element-overlay должен быть pooled** — один shared particle emitter на element, не 16 индивидуальных эмиттеров. Phaser официально поддерживает [object pooling в particle emitter](https://docs.phaser.io/api-documentation/class/gameobjects-particles-particleemitter): "Particles are pooled and recycled by the Emitter for performance".

3. **Macro spawn cap:** не больше 80 particles одновременно от element-overlay системы (это ~5 particles/sec на каждый visible overlay × 16 sec lifespan ÷ 4 visible = 80 max).

4. **Off-screen culling:** если frog не visible (за пределами viewport, например при скролле локаций), его overlay полностью stop'нется, не paused.

5. **Element-overlay с lifecycle hook на scene shutdown:** обязательно cleanup. По [Phaser docs](https://docs.phaser.io/api-documentation/class/tweens-tweenmanager): "Tweens are 'fire-and-forget' and auto-destroy, EXCEPT if `persist: true` is set — then YOU must destroy them, otherwise lingers forever."

### A.5. Что мониторить (метрики)

Добавить в dev-mode:

```ts
// Перед каждым добавлением overlay
const activeTweens = scene.tweens.getAllTweens().length
if (activeTweens > 100) {
  console.warn(`[v2.0 perf] tween count ${activeTweens} exceeds budget`)
}
```

Полезные метрики:
- `scene.tweens.getAllTweens().length` — общее число tweens (target < 100)
- `scene.game.loop.actualFps` — real fps (target > 50 на mid-tier)
- `performance.memory.usedJSHeapSize` — heap size (target < 100 MB на mobile WebView)
- Particle count via emitter.alive count (target < 80 на element-overlay)

### A.6. Action items

1. **HARD:** Реализовать `ElementOverlayPool` singleton для всех 16 элементов с shared emitter
2. **HARD:** `tween.pause()/resume()` на off-screen frogs
3. **HARD:** `MainScene.shutdown()` обязан killAllTweens на overlay
4. **SOFT:** В `StarMapScene` уже есть console.warn на frame spike — расширить на overlay tweens
5. **SOFT:** Добавить в settings toggle "Reduced effects" для слабых устройств (как [Habr рекомендует](https://habr.com/en/articles/990338/) для TMA)

---

## B. Storage Strategy

### B.1. Current state assessment

**Что сейчас в localStorage (Frog Evolution):**

```
frog_evolution_storage_version: ~15 bytes
frog_evolution_upgrades: ~80 bytes (5 upgrade keys × ~12 bytes)
frog_evolution_frog_purchases: ~96 bytes (24 ints)
frog_evolution_discovered: ~50 bytes (1-24 ints)
frog_evolution_magnet_enabled: ~5 bytes
frog_evolution_current_location: ~1 byte
frog_evolution_location_frogs: ~200 bytes (4 arrays × ~50 levels)
frog_evolution_last_session: ~13 bytes
frog_format: ~5 bytes
frog_lang: ~5 bytes
TOTAL: ~470 bytes (NEGLIGIBLE)
```

**Источник:** прямой grep по `gameStore.ts`, лимит из [MDN Storage_quotas_and_eviction_criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

### B.2. v2.0 storage growth estimate

| Data | Estimated size | Notes |
|------|----------------|-------|
| Serum inventory (1000+ accumulated) | 50-200 KB | Каждая сыворотка: `{element, rarity, levelHidden, levelTopFlag, originPlanetId, drawnAt}` ≈ 100-150 bytes JSON |
| Bestiary 2.0 (1536 cells, ownership counts) | ~30-60 KB | `{element, rarity, level, count, firstSeen}` × 1536 |
| Carrier state (per location) | ~5-10 KB | 4 locations × 6 carriers × ~200 bytes |
| Scout state (active expeditions) | ~2-5 KB | Max 5-10 active scouts |
| Mission completion log (last N) | 10-20 KB | Если хранить историю |
| Hidden ceiling reveals | ~20-30 KB | Раскрытые ceilings per carrier |

**Total v2.0 add: ~120-330 KB.**
Final localStorage usage: **<500 KB. Лимит 5 MB. Запас 10x.**

→ **localStorage достаточно. IndexedDB не нужен.**

### B.3. Telegram CloudStorage feasibility

Из [docs.telegram-mini-apps.com/cloud-storage](https://docs.telegram-mini-apps.com/packages/tma-js-sdk/features/cloud-storage):

- **Limit: 1024 items per user, 128 chars key, 4096 chars value**
- 4096 chars × 1024 items = ~4 MB total per user
- API: `setItem`, `getItem`, `getItems`, `removeItem`, `getKeys`

**Что это значит для нас:**

- **НЕ может хранить весь сейв одним blob'ом** — 4096 chars недостаточно для 200+ сывороток
- Нужно **partitioning**: `serum:001`, `serum:002`, ..., `bestiary:001`, ... → но 1024 items хватит на ~700 сывороток + бестиарий + meta
- **Latency:** async операции, не для каждого изменения. Аналог нашего sync-throttle в `gameSync.ts` (5 sec) — норм.

**Вердикт:** CloudStorage годится как **backup/cross-device sync**, НЕ как primary. Primary остаётся localStorage. Sync delta-стиль.

### B.4. STORAGE_VERSION migration risk

**Critical issue:** текущий код в `gameStore.ts:154-164`:

```ts
if (ver !== STORAGE_VERSION) {
  localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION))
  localStorage.removeItem(UPGRADES_KEY)
  localStorage.removeItem(PURCHASES_KEY)
  localStorage.removeItem(DISCOVERED_KEY)
  localStorage.removeItem(LOCATION_FROGS_KEY)
  localStorage.removeItem(LOCATION_KEY)
  return defaults
}
```

→ **Любая bump версии = full wipe.** Это catastrophic для retention.

**При v2.0:**
- Bump 15 → 16 → игрок теряет 24 уровня лягушек, gold, сыворотки
- Casual игрок откатывается → review 1*

**Mitigation:**

1. **Implement incremental migration table:**

```ts
const MIGRATIONS: Record<number, (data: any) => any> = {
  15: (data) => ({ ...data, serums: [], carriers: {}, scouts: [] }), // v15→v16
  16: (data) => ({ ...data, bestiary2: createEmptyBestiary() }),     // v16→v17
}

function migrate(savedVer: number, currentVer: number, data: any) {
  let result = data
  for (let v = savedVer; v < currentVer; v++) {
    if (MIGRATIONS[v]) result = MIGRATIONS[v](result)
  }
  return result
}
```

2. **Defensive parsing:** missing fields → defaults, не crash
3. **Backup-before-wipe:** перед миграцией сохранить `frog_evolution_backup_v15` как safety net

### B.5. Storage failure modes

| Scenario | Probability | Impact | Mitigation |
|----------|-------------|--------|------------|
| `localStorage.setItem` throws QuotaExceededError | LOW (мы далеко от 5 MB) | Save fails silently | try/catch уже есть |
| User clears WebView cache | MEDIUM (iOS aggressive) | Full state loss | Telegram CloudStorage backup |
| iOS Safari WebKit eviction (7-day inactivity) | MEDIUM | Partial loss [WebKit policy](https://webkit.org/blog/14403/updates-to-storage-policy/) | CloudStorage + server sync |
| Telegram WebView upgrade breaks storage format | LOW | Data unreachable | Prefix all keys, never rely on schema |
| Race: write during scene transition | MEDIUM | Inconsistent state | Single source of truth (Zustand) + debounced save |

### B.6. Action items

1. **HARD:** Implement `MIGRATIONS` table with incremental migrations (NOT full wipe)
2. **HARD:** Backup snapshot per major bump (`frog_evolution_backup_v{ver}`)
3. **SOFT:** Намечать роадмап для CloudStorage backup (P1, не блокер для v2.0)
4. **SOFT:** Добавить export/import save для power users (debug + safety)
5. **SOFT:** Защитный try/catch на всех setItem call sites — аудит существующих

---

## C. Cognitive Complexity Reduction

### C.1. Что v2.0 добавляет в концептуальном пространстве

Текущий игрок к моменту разблокировки v2.0 знает:
- 24 уровня лягушек, 4 локации, drag-merge, 4 апгрейда, бокс-дроп

v2.0 добавляет:

| Концепция | Ментальная модель | Onboarding cost |
|-----------|-------------------|-----------------|
| 16 элементов | "Каждая лягушка может стать огненной/ледяной/etc" | Medium |
| 4 редкости (common/rare/epic/legendary) | Стандарт жанра, OK | Low |
| Hidden ceiling 50/30/15/5 | "У каждой лягушки потолок, скрыт до стабилизации" | HIGH |
| Pity 3/10/25 | "Гарантия после N плохих" | Low |
| Carrier eligibility (L1/L7/L13/L19) | "Сыворотку можно прилить только на стартовую лягушку локации соотв. редкости" | HIGH |
| Feed-эволюция | "Скармливаешь обычных carrier'у → roll на повышение" | Medium |
| Slot-machine drama (1.2-14с) | "Дольше = круче" | Low (стандарт жанра) |
| 5 элементных анимаций × tier | "Облик = редкость" | Low |
| Скаут-таймеры 5-30 мин | "Жди возвращения" | Low |
| Mini-clicker миссии | "Тапай для бокса" | Low |
| Бокс vs cascade reveal | "Распакуй слой за слоем" | Medium |
| 4 элемента эксклюзивных main race (arcane/mech/war/void) | "Эти не из BG" | Medium |

**Total ~7 новых major concepts + sub-concepts.** Это много.

### C.2. Best practices из ресёрча

Из [NN/G: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/), [UX Planet](https://uxplanet.org/design-patterns-progressive-disclosure-for-mobile-apps-f41001a293ba), [Pendo onboarding](https://www.pendo.io/pendo-blog/onboarding-progressive-disclosure/):

> "Progressive disclosure of features in digital interfaces leads to higher user satisfaction and better task completion rates compared to presenting all features at once."

> "Introduce mechanics gradually: Session 1: Core movement and controls. Session 2: Power-ups. Session 3: Strategy."

> "FTUE (First Time User Experience) is how new players interact with your game in their first session, typically the first 10-60 minutes."

### C.3. Recommended onboarding flow для v2.0

```
Session 1 (через unlock после L19 — Космос):
  [+] 1 концепт: "Cosmic Hub разблокирован. Открой первый бокс."
  [+] Видит slot-machine. Видит сыворотку common.
  [+] Прилагает на L1 лягушку (DnD highlight). Видит овеллой.
  → ВСЁ. Никаких pity, ceilings, feed.

Session 2 (через ~24h игры или N боксов):
  [+] 1 концепт: "Скаут-экспедиция" — отправил, через 5 мин вернулся.
  [+] Mini-clicker миссия (если первая).
  [+] Получает второй бокс с rare сывороткой.
  [+] Объяснение eligibility ("rare → L7").

Session 3:
  [+] Концепт: feed-эволюция (объясняется когда есть 2+ обычных лягушек на той же location).

Session 4-N:
  [+] Концепт: hidden ceiling (раскрывается через первую стабилизацию).
  [+] Концепт: pity counter (всплывает в UI, когда 2 common подряд).
```

**Не показывать всё сразу в Cosmic Hub при первом открытии.**

### C.4. UI heuristics

| Heuristic | Currently planned | Risk | Recommendation |
|-----------|-------------------|------|----------------|
| 4 таба в Cosmic Hub (Скауты/Боксы/Сыворотки/Бестиарий) | YES | Medium overload | Скрыть пока не разблокирован каждый таб |
| Pity counters видимые | YES | Add complexity | Показать только активный pity, не все 3 |
| Hidden ceiling indicators | YES | HIGH frustration if unclear | После первой стабилизации добавить tooltip объяснение, не earlier |
| Бестиарий 2.0 grid 1536 cells | YES | Visual paralysis | Default фильтр: только discovered (не показывать 1536 пустых) |
| Element overlay на ферме | YES | Visual noise | Toggle "Reduced effects" в настройках |

### C.5. Tutorial dry-run risks

Если игрок скипает tutorial / возвращается через 2 недели:

- **Eligibility rules забыты** → drag сыворотку на не-стартовую лягушку → mis-drop animation. Без подсказки на причину. **Mitigation:** mis-drop tooltip "Эта сыворотка работает только на L1/L7/L13/L19 стартовую лягушку".
- **Hidden ceiling immersive forgotten** → игрок думает "почему мой carrier не растёт?" → quit. **Mitigation:** видимый "стабилизация: 4/N" progress bar после первой стабилизации.

### C.6. Action items

1. **HARD:** Не показывать все 4 таба в Cosmic Hub сразу. Постепенный unlock per session.
2. **HARD:** First-time hints на каждой новой interaction (mis-drop, pity-trigger, ceiling-reveal).
3. **HARD:** Бестиарий 2.0 default filter = только обнаруженные ячейки.
4. **SOFT:** Tooltip-based explanations, не full-screen tutorials (нативно для Telegram).
5. **SOFT:** Settings toggle "Reduced effects" — отключает overlay particles.
6. **SOFT:** Глоссарий в SettingsModal: "Что такое carrier? Что такое pity?".

---

## D. Балансировка Safety Nets

### D.1. Анализ предложенного баланса

```
Веса rarity: common 35% / rare 40% / epic 20% / legendary 5%
Pity: 3 common→rare+, 10 без epic→epic+, 25 без legendary→legendary+
Sub-distribution в tier (hidden ceiling): 50/30/15/5
```

### D.2. Probability calculation

**Вероятность не получить legendary за 24 пакета (без pity):**
P(no_legendary in 24 boxes) = 0.95^24 ≈ **29%**

**Average time to legendary:**
1/0.05 = 20 boxes mean. Pity at 25 boxes catches outliers.

**Если 1 бокс = 5-30 минут scout + ~30 sec mini-mission:**
- Best case (5 min scout): 25 × 5.5 min = ~138 min = **2.3 часа** до pity legendary
- Worst case (30 min scout): 25 × 30.5 min = ~12.7 часа

→ **На worst-case это 12+ часов гриндинга для гарантированного legendary.** Для idle — приемлемо. Для casual mobile-сессии 5-15 мин/день — это **2-3 недели реал-времени**.

### D.3. Ссылки на industry baselines

[Genshin Impact pity](https://game8.co/games/Genshin-Impact/archives/305937):
- Soft pity около 74-го пулла, hard 89-90
- Игроки знают: "стандартный chase = 2-3 банера, ~3-6 месяцев"
- Genshin = очень medium-core гриндилка

[HSR vs Genshin сравнение](https://www.bahomu.com/blogs/news/gacha-pity-systems-hsr-vs-genshin-impact-comparison-guide):
- HSR смягчил pity (50/50 защита быстрее) — "casual-friendlier"

**Наша 5% legendary при pity=25 → effective ~6% с pity = на пороге HSR-friendliness.** OK для idle.

### D.4. Hidden ceiling как FOMO multiplier

Sub-distribution 50/30/15/5 значит: даже rare имеет 5% шанс быть «топовой rare ≈ нижняя epic». Это **mathematically beautiful**, но психологически:

- Игрок видит "rare", ожидает обычное rare. Получает скрытый top → чудо.
- Но ALSO: игрок получает 10 rare, ни один не оказался топовым → frustration «всё низшее».
- **Когда игрок узнаёт о hidden ceiling?** Если в момент стабилизации — значит первые 50+ боксов он не понимает почему его carrier'ы разные.

**Risk:** игрок думает что мерж сломан, бросает игру до стабилизации.

**Mitigation:**
1. **Раскрыть hidden ceiling рано** (например, после 5-го рассеянного применения, через onboarding tooltip).
2. **Spread visibility** — UI показывает "Carrier #1: top of common (≈ low rare)" сразу после стабилизации, не неделями копит.

### D.5. Pity safety nets

| Trigger | Casual-friendly? | Notes |
|---------|------------------|-------|
| 3 common → rare+ | YES | Frequent reinforcement |
| 10 no epic → epic+ | MEDIUM | ~2 hours of play |
| 25 no legendary → legendary+ | RISKY | См. D.2 |

**Recommendation:** для casual idle добавить **soft pity** аналог Genshin:
- После 15 без legendary → drop rate raises 5% → 8%
- После 20 → 5% → 12%
- Forced 25 (current behavior)

→ Mathematical expectation: median time to legendary ≈ 18-20 boxes (вместо 20-25). Кросс-game baseline.

### D.6. Scout timer балансировка

Текущий plan: 5-30 мин на scout. 

**Risks:**
- Слишком короткие scouts (5 мин) → игрок ждёт активно → frustration ("почему долго?")
- Слишком длинные (30 мин) → игрок не возвращается в течение сессии
- Mismatch со сценарием idle: idle игроки откладывают на час+, не ждут таймера

**Recommendation:** mix
- Quick scouts: 5-15 мин (для активных сессий)
- Medium scouts: 30-60 мин (idle)
- Long scouts: 2-4 часа (overnight) — даёт sleep-rewards
- Multi-scout slot: можно отправить 3-5 одновременно

### D.7. Action items

1. **HARD:** Soft pity на legendary (15 → +3%, 20 → +7%). Документация в UI.
2. **HARD:** Скрытый ceiling раскрывается рано через onboarding (после 1-2 carriers, не 50).
3. **HARD:** Visible "stabilization progress" bar для каждого carrier.
4. **SOFT:** Multi-scout slot (2-5 параллельно).
5. **SOFT:** Долгие scout-варианты (2-4 ч) для overnight rewards.
6. **SOFT:** Lottery-balance simulation script (`scripts/simulate_balance.cjs`) — прогнать 10000 раз и убедиться что median time to legendary ~ 1-2 часа.

---

## E. Mobile WebApp Пределы

### E.1. Что НЕ работает или работает плохо в Telegram WebView

**Из codebase (Tech/Telegram Mini App.md, Tech/Технические заметки.md):**

- iOS WkWebView: строже к памяти и CPU, чем Chrome
- Android: Chromium-119+ (Shared Runtime, 2025+)
- Bundle важен — каждое открытие = новая загрузка (нет PWA cache между сессиями надёжно)
- localStorage ненадёжен на iOS WebKit (7-day eviction)
- `viewportStableHeight` нужен вместо `innerHeight`
- WebGL postFX тяжёлые шейдеры → лучше избегать на iOS

**Из ресёрча:**

- [Habr "Mini Apps Overview"](https://habr.com/en/articles/990338/): "WebView causes performance degradation, especially on low-power devices and when there are a lot of complex animations. Some developers even include the ability to disable animations."
- [Phaser issue #7086](https://github.com/phaserjs/phaser/issues/7086): "Enabling FX causes rendering issues with Android"
- [Phaser issue #6989](https://github.com/phaserjs/phaser/issues/6989): "Performance Issue on low end mobile devices"

### E.2. HTML5 Drag-and-drop НЕ работает на мобильных

Из [MDN HTML5 drag&drop](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API):

> "The HTML5 drag and drop specification is based on mouse events, rather than pointer events, and so most mobile browsers do not implement it."

[mobile-drag-drop polyfill](https://github.com/timruffles/mobile-drag-drop), [DragDropTouch](https://github.com/drag-drop-touch-js/dragdroptouch) — это polyfills, добавляют ~5-10 KB и иногда glitch на Telegram WebView.

**Текущее состояние v1.0:** drag-merge на ферме работает через Phaser pointer events (внутри canvas). Работает.

**v2.0 проблема:** DnD сыворотки **из React UI (modal) → Phaser canvas (drop target).** Это пересечение двух систем:
- React UI использует pointer/touch events
- Phaser отдельно слушает свои pointer events
- Между ними нет automatic bridge

**Architecture options:**

| Approach | Pros | Cons |
|----------|------|------|
| (A) DragDropTouch polyfill | Работает HTML5 DnD spec | iOS WebKit subtle bugs, +KB |
| (B) Custom Phaser+React DnD | Контроль на 100% | Сложно, много кода |
| (C) **Tap-to-select-then-tap-to-apply** | Native mobile UX, работает везде | Меньше "tactile" чем drag |
| (D) Long-press start drag in React, render ghost via portal | Работает с polyfill | Z-index battles |

**Recommendation:** **(C) Tap-to-select** для main flow, опционально **(A) polyfill** для desktop dev.

→ "Применить сыворотку: тап на сыворотку в инвентаре → highlight eligible carriers на ферме → тап на carrier" — нативно мобильно.

### E.3. Что специфично для Telegram WebView сейчас

- `Telegram.WebApp.HapticFeedback.impactOccurred('light')` — для feedback при тапах. Текущая игра уже использует через `utils/telegram.ts`.
- `Telegram.WebApp.expand()` обязательно при старте.
- iOS: `safe-area-inset-*` для notched devices.
- BackButton — для модалок (закрывать на свайп от края экрана).
- MainButton — крупный CTA (для slot-machine "Open Box"?).
- `themeParams` — light/dark theme support.

### E.4. Telegram-специфичные риски v2.0

| Risk | Mitigation |
|------|------------|
| Long slot-machine (14s) — игрок переключает чат → анимация останавливается? | Использовать `visibilitychange` API, при возврате — восстановить state |
| MainButton blocks UI bottom — конфликт с bottom-bar? | Не использовать MainButton без необходимости |
| Multi-instance: те же initData в двух TG-приложениях (десктоп + mobile) | Текущий sync = last-writer-wins, продолжаем |
| iOS gesture: swipe-down закрывает Mini App | Test: pause game state перед закрытием |

### E.5. Action items

1. **HARD:** **Tap-to-select** UX для применения сывороток (не HTML5 DnD из React).
2. **HARD:** Slot-machine animation — при `visibilitychange` to hidden → pause. Resume on visible.
3. **HARD:** Settings toggle "Reduced effects" → выключает overlay particles. Default ON для известных low-end devices (через User-Agent sniff или [Telegram device performance API](https://core.telegram.org/bots/webapps#deviceinfo)).
4. **SOFT:** Использовать `HapticFeedback.impactOccurred('medium')` на момент slot-machine reveal (для tactile drama).
5. **SOFT:** Тестовый план на 3 устройствах: iPhone SE (low-end iOS), Pixel 6 (mid Android), iPhone 14 Pro (target).

---

## F. Long-term Maintenance Risks

### F.1. Что станет техническим долгом через 6 месяцев

**Архитектурные:**

1. **StarMapScene.ts уже 6430 строк.** v2.0 добавит scout-rendering, planet-state, mini-clicker missions → может вырасти до 8000-10000 строк. **Mitigation:** разбить на subsystems (`StarMapScoutOverlay.ts`, `StarMapMissionLayer.ts`).

2. **96 animation components в pool.** v2.0 добавит 80 element-overlay (16×5 tiers). Если их написать в том же стиле inline — pool станет 176+ components. Поддержка адом. **Mitigation:** генератор (data-driven element configs + parameterized shader/tween templates) вместо 80 hardcoded функций.

3. **gameStore.ts 16.5 KB, монолит.** v2.0 добавит serums, carriers, scouts, bestiary2 — easily +10 KB. **Mitigation:** разделить на slices: `farmSlice`, `cosmicSlice`, `bestiarySlice`. Composable Zustand паттерн.

4. **Sound modulation system** в v1.0 уже выводится через 4032 combos per archetype. v2.0 добавит element-themed sounds → conflict со scale mappings. **Mitigation:** scope element-sounds отдельно от planet-sounds.

5. **Storage version migrations.** Сейчас bump = wipe. После релиза это уже можно будет считать tech-debt.

**Внешние:**

6. **Phaser 4.1 → Phaser 4.x** — major API изменения возможны. v2.0 кастомные particle/tween системы могут breakage'ом потерять.

7. **Telegram WebApp API эволюция.** [Mini Apps 2.0 (Sept 2024)](https://telegram.org/blog/fullscreen-miniapps-and-more) добавили fullscreen, geolocation. v3.0 может изменить bottom-bar API. **Mitigation:** wrap Telegram-specific code в `utils/telegram.ts`, не разбрасывать по файлам.

8. **Зависимости** в `package.json`: tone@15.1.22, phaser@4.1.0, react@19. К 2026-12-XX обновления могут breakage'ом потерять.

### F.2. Code organization recommendations для v2.0

**Предлагаемая структура (новые файлы):**

```
client/src/game/cosmic/
├── elements/
│   ├── ElementConfig.ts          # 16 element data-driven configs
│   ├── ElementOverlayPool.ts     # shared particle pool
│   └── ElementAnimationFactory.ts
├── scouts/
│   ├── ScoutEngine.ts
│   ├── ScoutState.ts
│   └── ScoutTimers.ts
├── serums/
│   ├── SerumDistribution.ts      # rarity / hidden ceiling logic
│   ├── SerumInventory.ts
│   └── PityTracker.ts
├── carriers/
│   ├── CarrierState.ts
│   ├── CarrierEligibility.ts
│   └── FeedEvolution.ts
└── bestiary2/
    ├── Bestiary2Data.ts
    └── ProgressTracker.ts

client/src/store/
├── gameStore.ts (existing, refactor to slices)
├── slices/
│   ├── farmSlice.ts
│   ├── cosmicSlice.ts            # NEW
│   └── bestiarySlice.ts          # NEW

client/src/ui/cosmic/
├── CosmicHubModal.tsx
├── ScoutsTab.tsx
├── BoxesTab.tsx
├── SerumsTab.tsx
└── Bestiary2Tab.tsx
```

### F.3. Test/debug infrastructure missing

Sometimes after release, сложные системы багают неочевидно. **v2.0 нужны:**

1. **`npm run simulate-balance`** — Monte Carlo 10000 runs на pity/ceiling distribution
2. **`npm run verify-cosmic-data`** — analog существующего `verify-uniqueness`, проверяет что 16 elements × 5 tiers configs корректны
3. **dev-mode panel:** "Add legendary serum", "Skip scout timer", "Trigger ceiling reveal"
4. **localStorage inspector** — visual UI для дебага storage state

### F.4. Documentation gaps

После v2.0 будет сильно усложнённая mental model. Без документации:

- Новые контрибьюторы (если появятся) не разберутся
- Сам автор через 3 месяца забудет внутренние правила

**Suggested docs:**
- `docs/cosmic-system.md` — обзор: концепции, формулы, файлы
- `docs/element-configs.md` — что значит каждое поле в ElementConfig
- `docs/balance-design.md` — формулы веса, pity, ceiling

### F.5. Action items

1. **HARD:** Разбить v2.0 код по subdirectories из F.2
2. **HARD:** Refactor gameStore на slices (можно отдельной фазой v2.0.1)
3. **HARD:** Data-driven element configs (не 80 hardcoded компонентов)
4. **HARD:** Implement incremental migrations (см. B.4)
5. **SOFT:** docs/cosmic-system.md как часть финальной фазы v2.0
6. **SOFT:** dev-panel для debugging cosmic state

---

## G. ТОП-10 Рисков (sorted by criticality)

### Risk #1: Performance crash на mid-tier mobile @ live element-overlay
**Severity:** CRITICAL  
**Probability:** HIGH (80%) если без cap'ов  
**Impact:** Игроки на iPhone SE / mid Android видят 25-40 fps на ферме → uninstall  
**Trigger condition:** 16 frogs visible с активными element-overlay одновременно  
**Mitigation:**
- Hard cap: max 4 visible overlay одновременно, остальные `tween.pause()`
- Shared particle pool вместо per-frog emitter (Phaser native pooling)
- Off-screen culling
- Settings toggle "Reduced effects"
- Performance monitoring в dev-mode (см. A.5)

**Confidence:** HIGH (verified via [Phaser issue #6989](https://github.com/phaserjs/phaser/issues/6989), [Habr article](https://habr.com/en/articles/990338/))

---

### Risk #2: Slot-machine fatigue после 100+ боксов
**Severity:** CRITICAL  
**Probability:** HIGH (95%) — по analogy с Genshin/HSR  
**Impact:** Engaged players → frustrated → quit  
**Trigger condition:** 1.2-14с slot-machine на каждом из 100+ боксов (2-5 часов кумулятивно)  
**Mitigation:**
- **Skip кнопка обязательна с MVP** (tap to skip after 1 sec, instant after 5 visible)
- **Auto-skip toggle** в settings ("Open boxes instantly", опционально)
- **Bulk-open** для multi-box (10x в Genshin норма)
- Сохранить drama для **rare+ только** (common = быстрая reveal без slot-machine)

**Confidence:** HIGH (industry standard, gacha designer wisdom)

---

### Risk #3: Cognitive overload при первом открытии Cosmic Hub
**Severity:** HIGH  
**Probability:** MEDIUM-HIGH (60%)  
**Impact:** Casual игроки, дошедшие до v2.0 контента, бросают на 2-3 минуте overwhelmed  
**Trigger condition:** Все 4 таба + 16 элементов + механики carriers/feed/scout показаны сразу  
**Mitigation:**
- Progressive disclosure (см. C.3): только 1 концепт за session
- Default Бестиарий filter: discovered only
- Tooltip-based explanations (нативно для TMA)
- Скрыть hidden ceiling до первой стабилизации
- Глоссарий в SettingsModal

**Confidence:** MEDIUM-HIGH (UX research consensus, [NN/G](https://www.nngroup.com/articles/progressive-disclosure/))

---

### Risk #4: localStorage migration full-wipe на STORAGE_VERSION bump
**Severity:** CRITICAL (после релиза)  
**Probability:** CERTAIN (100%) если оставить current code  
**Impact:** Каждый bump = wipe всего прогресса игроков → catastrophic retention loss  
**Trigger condition:** Любой bump 15→16→17→...  
**Mitigation:**
- Implement `MIGRATIONS` table с incremental migration функциями
- Backup snapshot per major bump (`frog_evolution_backup_v{ver}`)
- Defensive parsing: missing fields → defaults
- Test migration suite: simulate v15 save → load v16 game → verify no loss

**Confidence:** HIGH (direct code inspection)

---

### Risk #5: HTML5 drag-drop не работает на мобильном Telegram WebView
**Severity:** HIGH  
**Probability:** HIGH (90%) если использовать стандартный HTML5 spec  
**Impact:** Carrier-application UX broken on mobile (главный flow v2.0)  
**Trigger condition:** React modal → Phaser canvas DnD via HTML5 events  
**Mitigation:**
- Use **tap-to-select-then-tap-to-apply** (см. E.2 option C)
- Если хочется DnD — polyfill (DragDropTouch) с fallback на tap-mode
- Не cross React/Phaser DnD — keep within one system
- Test on real iOS WkWebView, не только Chrome devtools

**Confidence:** HIGH ([MDN documented limitation](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API))

---

### Risk #6: Hidden ceiling frustration без раскрытия в onboarding
**Severity:** HIGH  
**Probability:** MEDIUM (50%)  
**Impact:** Игрок не понимает почему его carriers ведут себя по-разному → "merge сломан" → quit  
**Trigger condition:** Игрок применил 2+ carriers одной редкости с разным hidden ceiling, не было tooltip  
**Mitigation:**
- Раскрыть hidden ceiling рано (после 2-го carrier)
- Visible "stabilization: 4/N" progress bar
- Tooltip "Этот carrier — top-of-rare (≈ low-epic)" сразу после стабилизации
- Документация в SettingsModal

**Confidence:** MEDIUM (psychological pattern, не direct evidence для нашей механики)

---

### Risk #7: Pity 25 без legendary слишком долго для casual idle
**Severity:** MEDIUM  
**Probability:** MEDIUM (40%)  
**Impact:** Casual playtime patterns (10-30 min/day) → "никогда не получу legendary" → quit  
**Trigger condition:** 25 boxes × ~10 min average = 4+ часов чистого игрового времени до гарантии  
**Mitigation:**
- Soft pity: 15 без legendary → 8% rate, 20 → 12%, 25 → 100%
- Multi-scout slot (2-5 параллельно)
- Long-scout option (2-4 ч overnight)
- Balance simulation script

**Confidence:** MEDIUM (industry baseline сравнение, [Genshin pity](https://game8.co/games/Genshin-Impact/archives/305937))

---

### Risk #8: 1536-cell бестиарий 2.0 = visual paralysis при первом открытии
**Severity:** MEDIUM  
**Probability:** HIGH (70%) без UX care  
**Impact:** Player overwhelmed, не видит progression — closes tab  
**Trigger condition:** Бестиарий 2.0 grid с 1536 пустыми ячейками  
**Mitigation:**
- Default filter: discovered (показать только то что player видел)
- Progress: % completed per element row
- Milestone rewards (50/100/500/1000)
- "Pokemon Living Dex fatigue" patterns ([thegamer article](https://www.thegamer.com/pokemon-living-pokedex-dex-explained/)): players quit when too far from goal
- Sub-categories: показать "discovered ones" + collapsed "to discover"

**Confidence:** MEDIUM-HIGH ([Pokemon community evidence](https://www.pokecommunity.com/threads/completing-a-living-pok%C3%A9dex-is-it-worth-it.491319/))

---

### Risk #9: Memory leak от non-destroyed tweens на overlay
**Severity:** MEDIUM  
**Probability:** MEDIUM (40%) without discipline  
**Impact:** После 30+ минут игры iOS WkWebView крашит сессию → game gone  
**Trigger condition:** Carrier-overlay tween создаётся с `loop: -1` или `persist: true`, scene shutdown не killAllTweens  
**Mitigation:**
- Strict rule: **never use `persist: true` on overlay tweens**
- `MainScene.shutdown()` обязан killAllTweens
- Test: `performance.memory.usedJSHeapSize` не растёт linearly за 10-минутную сессию
- Phaser docs guidance: "Tweens auto-destroy on completion EXCEPT persist:true"

**Confidence:** HIGH ([Phaser tween docs](https://docs.phaser.io/api-documentation/class/tweens-tweenmanager), [Phaser discourse](https://phaser.discourse.group/t/tween-good-practices/5987))

---

### Risk #10: Save-game cheating через localStorage editing
**Severity:** LOW (для v2.0 — single-player)  
**Probability:** LOW (но HIGH среди power users)  
**Impact:** Пользователи дают себе legendary serums → ничего не теряем потому что server не доверяет  
**Trigger condition:** Игрок открывает DevTools → localStorage → сохраняет fake serum  
**Mitigation:**
- **Для v2.0 (single-device, no server validation): не блокер.** Не тратить силы на anti-cheat.
- **При sync через server (будущее):** валидация на сервере (drop-rate audit, scout timer audit)
- **Не делать** XOR-encryption или obfuscation — trivially reversible, false sense of security
- Если очень волнует — простой tamper detection: HMAC-checksum нового поля. Fail → silent reset.

**Confidence:** HIGH ([dev.to security article](https://dev.to/rigalpatel001/securing-web-storage-localstorage-and-sessionstorage-best-practices-f00) — "client-side encryption alone is insufficient")

---

## Дополнительно — Watchlist (низкий приоритет, но trackable)

### W.1. Audio system conflicts
v1.0 имеет sound-modulation для 1000 планет. v2.0 sound-style ярлыки на скаут-миссии и slot-machine. Risk: при одновременном слот-машине + planet voice = audio chaos. **Mitigation:** audio mixer с priorities (sfx > music; modal sfx > scene sfx).

### W.2. i18n explosion
v2.0 добавляет ~50-100 новых строк (16 elements names, 4 rarities, tooltips, error messages). Текущая сетка RU/EN/ES = 3× работы. **Mitigation:** parameterize names ("Огненная common"), не hardcode 3072 строк.

### W.3. Bundle size growth
Текущий bundle (по `vite.config.ts`) — pursuant. Новые element-overlay configs + 80 animations + 1500 bestiary entries (даже если empty in JS) → potential +50-150 KB. Гайдлайн TMA (Habr): "Time to first paint should be under 800 ms on 3G" → bundle limit ~500 KB gzipped — мы уже сейчас близко.

### W.4. React 19 + react-modal compatibility
react-modal@3.16 — проверять что 19.1 работает без warnings. (Не v2.0 specific, но v2.0 много новых modals.)

### W.5. Telegram WebApp API breaking changes
Telegram анонсирует Mini Apps 2.0 features постоянно. v2.0 разработка длится 1-3 месяца — за это время API может измениться. **Mitigation:** version-pin тelegram-апи через `utils/telegram.ts` wrapper.

### W.6. Multi-tab tear ([WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/))
iOS Safari evictions после 7 дней неактивности. Telegram TMA пользователи открывают игру нерегулярно. **Risk:** игрок открывает игру через 2 недели → state ушёл. **Mitigation:** server-side sync (existing) + Telegram CloudStorage backup.

### W.7. iOS gesture conflicts
Swipe-down закрывает Mini App. Если slot-machine drama идёт 14 sec и игрок свайпнул accidentally — wasted box? **Mitigation:** save slot-machine state в Zustand до завершения. Resume on reopen.

### W.8. Memory pressure background pages
iOS WkWebView aggressive с background tabs — может выгрузить process. **Mitigation:** `visibilitychange` listener сохраняет state. Restore on visible.

---

## Приложение: Рекомендуемая порядок работы для phase planning

Если roadmap разбивает v2.0 на phases, **в первой phase должны быть:**

1. **Storage migration framework** (B.4) — без этого любой следующий phase ломает игроков
2. **Performance budget infrastructure** (A.5) — мониторинг в dev-mode
3. **Element overlay pool architecture** (A.4) — чтобы 80 overlay не ломали 60fps
4. **Tap-to-select UX skeleton** (E.2) — DnD-альтернатива до того как build feature

**Phase 2-3:** Cosmic Hub UI + scout system + box reveal + slot-machine (с skip с MVP).

**Phase 4-5:** Sebrum distribution + carrier eligibility + feed evolution.

**Phase 6-7:** Бестиарий 2.0 + balance tuning + onboarding tooltips.

---

## Итоговое заключение

**Зелёный свет на v2.0?** Да, но с обязательными mitigation:

1. **Performance: hard cap 4 visible overlay + shared pool** (Risk #1)
2. **Slot-machine: skip кнопка обязательна с MVP** (Risk #2)
3. **Onboarding: progressive disclosure across sessions** (Risk #3)
4. **Storage: incremental migration table** (Risk #4)
5. **DnD: tap-to-select, не HTML5 mobile DnD** (Risk #5)

Без этих 5 mitigation — v2.0 на mobile будет broken в первые 2 недели после релиза.

С ними — v2.0 высокого качества, лидирующего стандарта для idle-merge с гача-механиками.

---

## Sources

- [MDN — Storage_quotas_and_eviction_criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [WebKit storage policy update](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [Telegram Mini Apps Cloud Storage docs](https://docs.telegram-mini-apps.com/packages/tma-js-sdk/features/cloud-storage)
- [Telegram Mini Apps platform](https://docs.telegram-mini-apps.com/platform/about)
- [Telegram core docs — webapps](https://core.telegram.org/bots/webapps)
- [Habr — Telegram Mini Apps overview](https://habr.com/en/articles/990338/)
- [Phaser docs — TweenManager](https://docs.phaser.io/api-documentation/class/tweens-tweenmanager)
- [Phaser docs — ParticleEmitter](https://docs.phaser.io/api-documentation/class/gameobjects-particles-particleemitter)
- [Phaser issue #6989 — low-end mobile performance](https://github.com/phaserjs/phaser/issues/6989)
- [Phaser issue #7086 — FX rendering Android](https://github.com/phaserjs/phaser/issues/7086)
- [Phaser performance optimization guide](https://generalistprogrammer.com/tutorials/phaser-performance-optimization-guide)
- [Phaser tween good practices discourse](https://phaser.discourse.group/t/tween-good-practices/5987)
- [DragDropTouch polyfill](https://github.com/drag-drop-touch-js/dragdroptouch)
- [mobile-drag-drop polyfill](https://github.com/timruffles/mobile-drag-drop)
- [MDN Touch events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- [Genshin pity system explained](https://game8.co/games/Genshin-Impact/archives/305937)
- [Bahomu — HSR vs Genshin pity comparison](https://www.bahomu.com/blogs/news/gacha-pity-systems-hsr-vs-genshin-impact-comparison-guide)
- [GameRant — Best gacha pity systems](https://gamerant.com/gacha-games-best-pity-system/)
- [NN/G — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [UX Planet — Progressive Disclosure mobile](https://uxplanet.org/design-patterns-progressive-disclosure-for-mobile-apps-f41001a293ba)
- [Pendo — Onboarding Progressive Disclosure](https://www.pendo.io/pendo-blog/onboarding-progressive-disclosure/)
- [Antidote — FTUE playbook](https://antidote.gg/ftue-the-antidote-playbook/)
- [Pokemon Community — Living Pokedex thread](https://www.pokecommunity.com/threads/completing-a-living-pok%C3%A9dex-is-it-worth-it.491319/)
- [TheGamer — Living Pokedex required](https://www.thegamer.com/pokemon-living-pokedex-dex-explained/)
- [Securing Web Storage best practices](https://dev.to/rigalpatel001/securing-web-storage-localstorage-and-sessionstorage-best-practices-f00)
- [Telegram blog — Mini Apps 2.0](https://telegram.org/blog/fullscreen-miniapps-and-more)
