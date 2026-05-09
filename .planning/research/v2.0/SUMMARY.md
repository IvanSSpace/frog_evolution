# Cosmic Frogs System v2.0 — Research Synthesis

**Synthesized:** 2026-05-08
**Source files:** DOMAIN.md, ARCHITECTURE.md, UX.md, CONCERNS.md

## 0. Executive summary (TL;DR в 5 пунктах)

1. **Жанр-консенсус ясен.** Cosmic Frogs — idle/clicker с gacha-эндгеймом. Стандарты жанра (Genshin/HSR/Hypixel/Cookie/AdCap) дают конкретные числа: common должна доминировать, slot-machine ≤10с с обязательным skip, pity видимый прогрессивно, бестиарий с прогрессивным reveal.

2. **Архитектурный mandate:** element-overlay рендерится внутри Phaser (не DOM), DnD сывороток — custom Pointer Events / tap-to-select (HTML5 DnD сломан на mobile WebView), state — один `useGameStore` с `CosmicSlice`, бестиарий — bitset (192 байта), бокс-anim переиспользует pool из StarMap (extract в `effects/anim/shared/` ПЕРЕД новой работой).

3. **Performance budget узкий, но проходимый.** Worst-case 27-43 fps на mid-tier Android без mitigation. Решается hard cap «max 4 visible overlay одновременно» + shared particle pool + off-screen culling + adaptive throttling.

4. **5 hard requirements с MVP** (не «фичи позже»): skip-button slot-machine, видимый pity counter, tap-to-select fallback DnD, incremental storage migration (НЕ wipe), progressive disclosure onboarding.

5. **Главный технический долг ДО старта новой работы:** extract 18 shared anim primitives из `StarMapScene.ts` (6430 строк) в `effects/anim/shared/`. Это Phase 0.

---

## 1. Cross-cutting consensus (что подтверждено в 2+ источниках)

| Утверждение | Источники |
|---|---|
| Slot-machine 14с слишком долго; cap 10с с обязательным skip с MVP | [DOMAIN][UX][CONCERNS] |
| HTML5 DnD не работает на mobile WebView — нужен custom Pointer Events / tap-to-select | [ARCH][CONCERNS] |
| 1536 ячеек давит — нужна прогрессивная reveal + виртуализация | [DOMAIN][UX][CONCERNS] |
| Hidden ceiling раскрывается прогрессивно (0-3 «???», 4-6 цвет, 7+ число) | [DOMAIN][UX][CONCERNS] |
| Auto-pause магнитов/мерджей во время DnD сыворотки — обязательно | [DOMAIN][ARCH][UX] |
| Видимый pity counter > скрытый: trust + регуляция + retention | [DOMAIN][UX] |
| 16 элементов на верхней границе casual — нужны filter/group/colorblind palette | [DOMAIN][UX][CONCERNS] |
| Cognitive overload — главный риск; решается progressive disclosure across sessions | [DOMAIN][UX][CONCERNS] |
| Performance hard cap: max 4 visible overlay + shared pool | [ARCH][CONCERNS] |
| `STORAGE_VERSION` wipe-on-mismatch — бомба после релиза; нужны incremental migrations | [ARCH][CONCERNS] |
| Двухосевая визуализация: rarity = форма/glow/border, element = hue | [UX][DOMAIN] |
| Cascade reveal: Equal → Equal → BIG (короткие фазы → пауза → slot) | [UX][DOMAIN] |
| Streak protection / soft pity на ceiling rolls — иначе frustration | [DOMAIN][CONCERNS] |

---

## 2. Conflicting recommendations

| Тема | Источник A | Источник B | Решение |
|---|---|---|---|
| **Веса rarity** | План: 35/40/20/5 | [DOMAIN]: 50/35/12/3 | Стартовать **50/35/12/3** + simulation script |
| **Pity reveal timing** | [DOMAIN]: после 3-й failed mission soft hint | [UX]: всегда видимый | Hybrid: counter существует с MVP, collapsed → expanded после 3-й, точные числа после 5-й |
| **DnD strategy** | [ARCH]: custom Pointer Events с ghost | [CONCERNS]: tap-to-select primary | **Tap-to-select primary**, custom Pointer Events secondary |
| **Slot skip** | [UX]: tap-anywhere после 0.6с | [CONCERNS]: skip кнопка с tap-after-1sec | Tap-anywhere 0.6с + visible Skip 1с + Settings toggle "Open boxes instantly" |
| **Hidden ceiling threshold** | [DOMAIN]: 7 feedings | [CONCERNS]: 1-2 carriers | После **5 feedings или 2-го carrier** |
| **Pity на legendary** | [DOMAIN]: soft 30, hard 50 | [CONCERNS]: soft 15→8%, 20→12%, hard 25 | [CONCERNS] числа (50 жёстко для casual idle) |

---

## 3. Critical decisions to make BEFORE writing REQUIREMENTS.md

8 открытых вопросов для юзера:

1. **Финальные веса rarity:** 50/35/12/3 (research) vs 35/40/20/5 (исходный план)
2. **Pity floor:** soft 15/20, hard 25 vs soft 30, hard 50
3. **DnD primary mode:** tap-to-select vs custom Pointer Events DnD
4. **Refactor sequencing:** Phase 0 блокирующий vs параллельный
5. **Cosmic Hub StarMap:** re-use existing vs отдельный list
6. **Бестиарий 1536:** глобальный grid vs 4 локации × 384 cells
7. **Element naming:** финальные имена 16 элементов в RU/EN/ES
8. **«Reduced effects» toggle default:** OFF / ON / auto-detect

---

## 4. Architecture-level guidelines (mandates)

| # | Правило |
|---|---|
| 4.1 | Phaser-native overlay (не DOM поверх canvas). `FrogElementOverlay` = Phaser Container |
| 4.2 | Custom Pointer Events для DnD (не react-dnd / dnd-kit). Tap-to-select primary, DnD secondary |
| 4.3 | Один `useGameStore` + `CosmicSlice` (не второй store) |
| 4.4 | Бестиарий = `Uint8Array(192)` bitset (не `Record<string, true>`) |
| 4.5 | Lazy-load Cosmic Hub modal (`lazy(() => import(...))`) |
| 4.6 | Phase 0: extract 18 shared anim primitives из StarMapScene в `effects/anim/shared/` |
| 4.7 | Pool pattern для overlay (`acquire/release`, не `destroy/create`) |
| 4.8 | Hard cap: max 4 visible overlay одновременно + culling + adaptive throttle |
| 4.9 | Incremental migration table (НЕ wipe-on-mismatch) + backup snapshots |
| 4.10 | EventBus = events, store = state |
| 4.11 | TanStack Virtual для бестиария 1536 cells |
| 4.12 | Settings toggle "Reduced effects" обязателен |
| 4.13 | `MainScene.shutdown()` обязан killAllTweens; никаких `persist:true` на overlay tweens |

---

## 5. Balance recommendations (consensus numbers)

| Параметр | Рекомендация |
|---|---|
| Веса rarity | **50% common / 35% rare / 12% epic / 3% legendary** |
| Sub-distribution в tier | 5%/15%/30%/50% (S/A/B/C roll) |
| Soft pity legendary | После 15 без → +3%; после 20 → +7% |
| Hard pity legendary | **25 boxes** |
| Pity rare+ guarantee | 3 common подряд → rare+ |
| Pity epic+ guarantee | 10 без epic → epic+ |
| Slot durations | common 1.2-1.8с / rare 2.5-3.8с / epic 5-7с / **legendary 9-10с (cap)** |
| Skip availability | Tap-anywhere после 0.6с + Skip button с 1с |
| Hidden ceiling reveal | 0-2 feeds: «???», 3-4: цвет, 5+: точное число |
| Streak protection | 3 low-ceiling carriers подряд → guarantee S-roll |
| Carrier dispose | 30% serum recovery |
| Scout duration mix | 5-15 min quick / 30-60 min medium / 2-4 ч overnight + 2-5 parallel slots |
| Бестиарий milestones | 10 / 24 / 96 / 576 cells |

---

## 6. UX must-haves (non-negotiable для MVP)

1. Skip-button slot-machine с MVP
2. Видимая pity counter (collapsed → expanded → точные числа progressive)
3. Tap-to-select сывороток primary
4. Drop zone glow + haptic medium при valid hover; red outline при invalid
5. Auto-pause всех auto-actions во время DnD
6. TanStack Virtual бестиария 1536 cells
7. Cascade reveal: [200ms coins] → [200ms resources] → [PAUSE 400ms] → [SLOT-MACHINE]
8. Двухосевая визуализация (rarity = форма/glow, element = hue)
9. Progressive onboarding across sessions
10. First-time mis-drop tooltip
11. Stabilization progress bar
12. «Calm farm mode» toggle
13. Colorblind toggle
14. Haptic feedback на всех ключевых действиях
15. Multi-toast grouping в badge

---

## 7. Risk hot list (top 7)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Performance crash mid-tier mobile (16 frogs × overlay) | CRITICAL | Hard cap 4 visible + pool + culling + throttle |
| R2 | Slot-machine fatigue к 100-му боксу → quit | CRITICAL | Skip с MVP + bulk-open + auto-skip toggle |
| R3 | `STORAGE_VERSION` wipe-on-mismatch после релиза | CRITICAL | Incremental migration + backup snapshots |
| R4 | HTML5 DnD не работает на mobile Telegram | HIGH | Tap-to-select primary, polyfill secondary |
| R5 | Cognitive overload при первом open Cosmic Hub | HIGH | Постепенный unlock табов + tooltips |
| R6 | Hidden ceiling frustration без onboarding reveal | HIGH | Раскрыть после 5 feeds + visible bar |
| R7 | Memory leak от non-destroyed overlay tweens | MEDIUM | Strict «no `persist:true`» + shutdown killAllTweens |

---

## 8. Phase ordering recommendations (11 фаз)

| # | Phase | Why |
|---|---|---|
| **0** | Refactor: extract shared anim primitives | [ARCH] mandate — без этого фазы дублируют код |
| 1 | Storage migration + performance infra | Safety net до feature work |
| 2 | CosmicSlice store + types + DnD skeleton | Data layer + DnD foundation |
| 3 | Cosmic Hub UI shell + lazy load + tabs stubs | Navigation, code-split |
| 4 | `FrogElementOverlay` + pool + throttle | Core визуальный feedback |
| 5 | Сыворотки tab + DnD apply | Минимально-играбельный loop |
| 6 | Box opening + cascade + slot-machine + skip | Источник сывороток |
| 7 | Скаут-экспедиции + mini-clicker mission | Источник боксов |
| 8 | Carrier-эволюция + feed + hidden ceiling | Late progression |
| 9 | Бестиарий 2.0 + virtualization | Late — нужны все данные |
| 10 | Balance + tutorial + toggles | Endgame polish |

---

## 9. Open questions для playtest (A/B candidates)

| # | Вопрос | A | B |
|---|---|---|---|
| Q1 | Веса rarity | 50/35/12/3 | 55/30/12/3 |
| Q2 | Hidden ceiling reveal | 5 feedings | 7 feedings |
| Q3 | Streak protection | 3 low-rolls | 5 low-rolls |
| Q4 | Slot legendary duration | 8с | 10с |
| Q5 | Pity reveal | После 3 missions | После 5 missions |
| Q6 | Scout duration default | 5-15 min | 30-60 min |
| Q7 | Skip-button delay | 0.6с | 1.0с |
| Q8 | Element bottom-bar icon | 🧬 | 🧪 / 🌌 |

---

## 10. Out of scope для v2.0 (явно)

- L25-командир unlock
- Backend pity tracking / server-side validation
- Push notifications через Telegram Bot API
- Telegram CloudStorage sync
- Production A/B infrastructure
- Reroll механизм для carrier ceiling
- Multi-device sync
- Tamper detection / save encryption
- Curated shop с гарантированными items
- Achievement system 2.0
- Daily quest layer

---

## 11. Confidence: MEDIUM-HIGH overall

| Зона | Confidence |
|---|---|
| Gacha mechanics | HIGH |
| Phaser overlay strategy | HIGH |
| DnD на Telegram WebApp | HIGH |
| localStorage limits | HIGH |
| UX patterns | HIGH |
| Color palette | HIGH |
| Bundle size estimate | MEDIUM |
| FPS budget на mid-tier Android | MEDIUM (нужен playtest) |
| Balance numbers | MEDIUM (нужен playtest) |

---

## SYNTHESIS METADATA

- **Suggested phases:** 11 (включая Phase 0 refactor)
- **Research flags:** Phase 4 (real-device perf), Phase 6 (skip A/B), Phase 8 (balance sim)
- **Standard patterns:** Phase 1, 2, 3, 9
- **Ready for Requirements:** после ответов на 8 вопросов из §3
