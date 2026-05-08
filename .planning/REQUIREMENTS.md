# Requirements — Frog Evolution

> **v1.0 milestone завершён** (см. MILESTONES.md). Этот файл содержит requirements для **v2.0 Cosmic Frogs System**. Старые v1 requirements архивированы в MILESTONES.md.

# v2.0 Cosmic Frogs System

**Created:** 2026-05-08
**Source:** Research synthesis (DOMAIN, ARCHITECTURE, UX, CONCERNS) + 8 design decisions

## Locked Decisions

| Решение | Финал |
|---|---|
| Веса rarity | **50% common / 35% rare / 12% epic / 3% legendary** |
| Pity legendary | soft 15→+3% / 20→+7% / **hard 25** |
| Pity rare guarantee | 3 common подряд → rare+ |
| Pity epic guarantee | 10 без epic → epic+ |
| Sub-distribution в tier | 5%/15%/30%/50% (S/A/B/C) |
| DnD primary mode | **Tap-to-select → tap-to-apply** (mobile-нативно) |
| Refactor seq | **Phase 0 блокирующий** (extract shared anim primitives) |
| Cosmic Hub planet pick | **Re-use StarMap** (тап по планете → confirm send) |
| Бестиарий организация | **4 локации × 384 cells** (табы Болото/Лес/Континент/Планета) |
| Element names | 12 BG: fire, ice, water, forest, toxic, plasma, shadow, crystal, desert, gas, ring, binary <br> 4 main exclusive: arcane, mechanical, war, void |
| Reduced effects toggle | дефолт **OFF** |
| Slot-machine timing cap | **legendary 9-10s** (не 14) |
| Slot skip mode | tap-anywhere после 0.6s + Skip button с 1s + Settings toggle |
| Hidden ceiling reveal | 0-2 feeds: «???», 3-4: цветовой hint, 5+: точное число |
| Streak protection | 3 low-ceiling carriers подряд → S-roll guarantee |
| Carrier dispose | 30% serum recovery |
| Performance hard cap | max 4 visible element overlay одновременно |
| Storage strategy | localStorage + incremental migration table (НЕ wipe) |
| Bundle delta cap | +50 KB gzip |

---

## REFACTOR — Phase 0 prerequisites (blocking) — **COMPLETE (Phase 9, 2026-05-08)**

- **REFACTOR-01** ✓: Extract 18 shared anim primitives из `StarMapScene.ts` в `client/src/game/effects/anim/shared/` (compRing, compSparkle, compFlash, compFlameTongues, compIceWisps, compPlasmaArc, compStarBurst, compHaloFlash, compConfetti, compCrystalShatter, compBloomPetals, compToxicCloud, compSandSwirl, compRipple, compEchoWave, compChimeRing, compBubbleStream, compChromaShift)
- **REFACTOR-02** ✓: Каждый primitive — отдельный файл с экспортом сигнатуры `(scene, container, sys, rng) => void` (compFlash без `sys`)
- **REFACTOR-03** ✓: StarMapScene использует import'ы; `runAnimComponent` switch обновлён (18 cases вызывают imported funcs)
- **REFACTOR-04** ✓: TypeScript clean; build size delta `-2 bytes` (well within +5 KB budget); verify-uniqueness 1000/984/1000 stable
- **REFACTOR-05** ✓: SMOKE_TEST.md документирует визуальную проверку; primitives как pure functions callable из любой Phaser.Scene

## INFRA — safety nets (blocking)

- **INFRA-01**: Incremental migration table `migrations: Record<number, (data) => data>` в gameStore вместо wipe-on-mismatch
- **INFRA-02**: При load — прогон всех миграций по порядку (15→16→17...)
- **INFRA-03**: Backup snapshot перед миграцией в `localStorage.frog_evolution_backup_v{version}` с TTL 7 дней
- **INFRA-04**: Performance HUD (dev-mode): FPS, tween count, active overlay count
- **INFRA-05**: Adaptive throttle: FPS<45 в 5с → ×2 throttle; FPS<30 → ×4
- **INFRA-06**: `MainScene.shutdown()` обязан killAllTweens, освобождать pool, отписывать listeners

## COSMIC-HUB — UI и навигация

- **COSMIC-HUB-01**: Иконка 🧬 в bottom-bar заменяет 🛍️
- **COSMIC-HUB-02**: 🧬 → fullscreen modal с 4 табами: Скауты, Боксы, Сыворотки, Бестиарий
- **COSMIC-HUB-03**: Modal lazy-loaded (`React.lazy` + `Suspense`)
- **COSMIC-HUB-04**: Badge на 🧬 — суммарное количество готовых боксов (не открытых)
- **COSMIC-HUB-05**: Toast при возврате скаута + быстрая кнопка «Открыть бокс»
- **COSMIC-HUB-06**: Multi-toast grouping (2+ возвратов одновременно → один toast)
- **COSMIC-HUB-07**: Closing modal сохраняет последний активный таб (sessionStorage)

## ELEMENT — 16 элементов

- **ELEMENT-01**: 16 элементов: 12 BG (fire, ice, water, forest, toxic, plasma, shadow, crystal, desert, gas, ring, binary) + 4 main exclusive (arcane, mechanical, war, void)
- **ELEMENT-02**: Маппинг архетип планеты → element. Main race планеты → 4 exclusive (mystic+ancient→arcane, mechano→mechanical, military+forge→war, shadow+destroyed→void)
- **ELEMENT-03**: Locked цвет (TINT TABLE) с colorblind-safe palette (Okabe-Ito + Krzywinski)
- **ELEMENT-04**: 80 элементных анимаций = 16 × 5 (dormant + common + rare + epic + legendary)
- **ELEMENT-05**: `FrogElementOverlay` Phaser Container, не DOM
- **ELEMENT-06**: Pool pattern (acquire/release), не destroy/create
- **ELEMENT-07**: Hard cap 4 visible overlay + off-screen culling каждые 6 кадров
- **ELEMENT-08**: Adaptive throttle респектируется (см. INFRA-05)
- **ELEMENT-09** ✓ (Phase 13): Tier-gated complexity: dormant=1 Graphics + 1 idle particle; common=2-3; rare=4-5 + slight aura; epic=full aura + 5-6 + ground ember; legendary=full storm + ground glow
- **ELEMENT-10** ✓ (Phase 13): При тапе на carrier — element-burst (как клик на StarMap)
- **ELEMENT-11** ✓ (Phase 13): При мердже двух same-element carriers — element-merge anim особый
- **ELEMENT-12**: 4 exclusive элемента (arcane/mechanical/war/void) только с main race миссий

### TINT TABLE

| Element | Hex | Idle effect category |
|---|---|---|
| fire | `#fb923c` | upward sparks |
| ice | `#a5f3fc` | crystal shards + falling flakes |
| water | `#38bdf8` | drops + ripple at base |
| forest | `#4ade80` | leaves swirling |
| toxic | `#86efac` | bubbles popping |
| plasma | `#fde047` | electric arcs |
| shadow | `#6b7280` | dark aura pulsing |
| crystal | `#ddd6fe` | refraction sparkles |
| desert | `#fde68a` | dust whirls |
| gas | `#fdba74` | cloud ribbons |
| ring | `#c4b5fd` | mini orbiting ring |
| binary | `#fca5a5` | 2 micro satellites |
| arcane | `#a78bfa` | rotating runes |
| mechanical | `#fde68a` | gears + pixel-glitch |
| war | `#dc2626` | sparks + flame |
| void | `#1f2937` | rift fragments |

## SERUM — сыворотки

- **SERUM-01**: Inventory `gameStore.cosmicSlice.serums: Record<element, Record<rarity, count>>`
- **SERUM-02**: UI таб «Сыворотки» — 4 секции по rarity (common/rare/epic/legendary)
- **SERUM-03**: Tap-to-select: тап на сыворотку выделяет → подсветка eligible лягушек на ферме → второй тап применяет
- **SERUM-04**: Snap radius 80px вокруг лягушки
- **SERUM-05**: Drop zone glow + haptic medium при valid hover, red outline + haptic error при invalid
- **SERUM-06**: Auto-pause magnet/merge во время выбора (флаг `serumDragActive`)
- **SERUM-07**: Mis-tap — сыворотка возвращается, toast tooltip
- **SERUM-08**: Eligibility:
  - common → L1 (Болото)
  - rare → L7 (Лес)
  - epic → L13 (Континент)
  - legendary → L19 (Планета)
  - НЕ применима на лягушку, которая уже carrier
- **SERUM-09**: Применение — 2-сек tween пробуждения (без модалки), сыворотка списывается
- **SERUM-10**: Optional undo toast 4с после применения
- **SERUM-11**: DnD secondary (desktop) — кастомные Pointer Events, не react-dnd

## BOX — боксы

- **BOX-01**: Inventory `gameStore.cosmicSlice.boxes: BoxData[]`
- **BOX-02**: Бокс приходит с миссии скаута, гарантированно содержит сыворотку
- **BOX-03**: Tap по боксу → cascade reveal модалка
- **BOX-04**: Cascade: монеты → ресурсы → бонусы → ⭐ slot-machine на сыворотку
- **BOX-05**: Cascade timing: [200ms coins] → [200ms resources] → [PAUSE 400ms] → [SLOT-MACHINE]
- **BOX-06**: Bonus drops перед slot-machine (Equal → Equal → BIG, не «каждый ярче»)
- **BOX-07**: Box-archetype от планеты-источника детерминирует element сыворотки

## SLOT — slot-machine

- **SLOT-01**: Длительность signal'ит rarity:
  - common 1.2-1.8с / rare 2.5-3.8с / epic 5-7с / **legendary 9-10с (cap)**
- **SLOT-02**: Чекпоинты на 1.5/3.5/5.5/8с — visual flash (серый/синий/фиолетовый/золотой)
- **SLOT-03**: Звук пока через sound-style ярлыки (audio attachment позже)
- **SLOT-04**: Build-up phase (0-50%): drone + crescendo
- **SLOT-05**: Reveal phase: drop → element-specific вспышка → текст
- **SLOT-06**: Skip MVP-ready:
  - Tap anywhere после 0.6с
  - Skip button visible с 1с
  - Settings toggle «Open boxes instantly» (минимизирует drama до 1с)
- **SLOT-07**: Bulk-open для 5+ боксов: «Открыть все» применяет skip автоматически, summary в конце
- **SLOT-08**: Element fingerprint particle style со старта (огонь = fire-particles, лёд = ice-flakes)

## SHIP — корабль (1 ship navigation model)

- **SHIP-01**: 1 ship на StarMap. State: `docked: planetId` либо `transit: { from, to, started_at, arrives_at }`. Хранится в `gameStore.cosmicSlice.ship`
- **SHIP-02**: Visual = ракетка с particle-trail. Phaser Sprite/Graphics + ParticleEmitter в transit (выключается при docking). Ротация по вектору движения
- **SHIP-03**: Travel time formula: `distance / WORLD_DIAGONAL × 120s`. WORLD_DIAGONAL = sqrt(2)·WORLD_SIZE·2 ≈ 19800 (DPR=1). Минимум ~30 сек floor для самых близких. Максимум ~2 минуты для самых далёких
- **SHIP-04**: Dock state: ship остаётся на орбите выбранной планеты до следующего полёта. На StarMap виден как маленький triangle/sprite рядом с планетой
- **SHIP-05**: Transit anim: linear interpolation позиции `from → to` за `arrives_at - started_at`. Particle-trail отключается при `t > 0.95`
- **SHIP-06**: Redirect: игрок может тапнуть новую планету во время transit. Новый таймер = distance(current_position, new_target) / WORLD_DIAGONAL × 120s. Нет штрафа
- **SHIP-07**: При тапе на planet (любой) во время `Cosmic Hub` открыт или с таба «Корабль» — confirm dialog «Лететь сюда (~Xs)?»
- **SHIP-08**: Если ship уже docked у этой planet — confirm не показывается, кнопка «Изучить» доступна (если есть mission credits)
- **SHIP-09**: Если ship в transit — индикатор времени до arrival («Прибытие через 0:42»)
- **SHIP-10**: На arrival — toast «Прибыли на KEPLER. [Изучить]», без auto-mission. Игрок жмёт «Изучить» сам

## CREW — система усталости (mission daily limit)

- **CREW-01**: `gameStore.cosmicSlice.crew: { missionsToday: number, lastResetDay: string }`
- **CREW-02**: Daily mission cap = **4** (configurable константа в game config)
- **CREW-03**: Reset: каждые 24h по локальному времени (00:00 в часовом поясе устройства). На load если `lastResetDay !== today` — обнулить `missionsToday`
- **CREW-04**: «Изучить планету» mission consumes 1 credit
- **CREW-05**: При `missionsToday >= cap`:
  - Кнопка «Изучить» disabled (серый), tooltip «Экипаж устал. Возвращайтесь завтра» с временем до reset
  - Корабль может летать как обычно (transit + dock доступны без ограничений)
- **CREW-06**: UI индикатор в табе «Корабль» Cosmic Hub: `Сегодня: 2/4 миссий ⏱ до утра 14:32`
- **CREW-07**: Тап на индикатор → tooltip объяснение системы
- **CREW-08**: Pity-counter растёт **только** на использованных credits (mission-based). Не привязан к календарю

## MISSION — mini-clicker challenge

- **MISSION-01**: При тапе «Изучить планету» (когда ship docked + есть credit) → запускается mini-clicker overlay
- **MISSION-02**: 3 типа миссий (random per «Изучить»):
  - «Кликни планету N раз за 30 сек» (rhythm) — N ∈ [15, 30]
  - «Защити корабль от 3 вспышек» (timing — тапни в нужный момент) — 3 вспышки за 15 сек
  - «Найди скрытое» (touch hot-spot) — 5 hidden точек за 20 сек
- **MISSION-03**: Performance score → multiplier к rarity rate бокса:
  - Perfect (100% completion): +15% rare-bonus
  - Good (60-99%): +5%
  - Skip / Fail (<60%): no bonus
- **MISSION-04**: Skip-button visible с 1 sec; auto-complete с no bonus
- **MISSION-05**: Завершённая миссия → выдаёт бокс в инвентарь сразу + toast («Получен ящик с MISSION_PLANET_NAME»)
- **MISSION-06**: Box element детерминирован archetype планеты (см. ELEMENT-02)
- **MISSION-07**: Mission consumes 1 mission credit (CREW-04)
- **MISSION-08**: Visual mission overlay — fullscreen UI, корабль и планета на фоне

## CARRIER — carrier-эволюция

- **CARRIER-01**: Применение сыворотки на eligible лягушку → carrier
- **CARRIER-02**: Visual carrier (dormant): tint + 1 крошечный орб + 1 idle particle/3с
- **CARRIER-03**: Feed: подкормить carrier'у обычную того же уровня → roll
- **CARRIER-04**: Roll результаты: success (level up) / fail (остаётся) / stabilize (ceiling раскрылся)
- **CARRIER-05**: Веса rolls по rarity сыворотки; ceiling distribution в tier 5%/15%/30%/50% (S/A/B/C)
- **CARRIER-06**: Streak protection: 3 low-ceiling carriers подряд → guarantee S-roll
- **CARRIER-07**: Hidden ceiling reveal:
  - 0-2 feeds: «???»
  - 3-4: цветовой hint (зелёный/жёлтый/красный)
  - 5+: точное число
- **CARRIER-08**: Stabilization модалка 3-4с — «Стабилизировалась на L11 (топовая редкая!)»
- **CARRIER-09**: Visual carrier фиксируется на финальном rarity-эффекте (см. ELEMENT-09)
- **CARRIER-10**: Merge двух same-element same-level carriers → S-roll следующий уровень
- **CARRIER-11**: Dispose option — 30% serum recovery; UI кнопка с confirm
- **CARRIER-12**: Bestiary запись каждой комбинации (element + final rarity + final level)

## BESTIARY — бестиарий 2.0

- **BESTIARY-01**: 4 таба по локациям (Болото/Лес/Континент/Планета); каждый = 24 уровня × 16 элементов = 384 cells
- **BESTIARY-02**: TanStack Virtual для рендеринга (не react-window)
- **BESTIARY-03**: `Uint8Array(192)` bitset для состояния (192 байта)
- **BESTIARY-04**: Filter pills: All / Common / Rare / Epic / Legendary + поиск по element
- **BESTIARY-05**: Default filter — «Discovered only» при наличии прогресса
- **BESTIARY-06**: Cell content:
  - Discovered: tint + рамка по rarity + мини-icon
  - Locked: серый силуэт + «???» tooltip
- **BESTIARY-07**: Sub-completion rewards:
  - 10 cells → 1000 монет
  - 24 cells (один уровень) → epic сыворотка любого элемента
  - 96 cells (одна локация) → legendary сыворотка
  - 576 cells → exclusive frog visual
- **BESTIARY-08**: Сортировка: Level ↑ / ↓ / Element / Rarity
- **BESTIARY-09**: Tap по cell → modal с детальной info (visual preview, sound-style label, lore)

## BALANCE — балансировка

- **BALANCE-01**: Веса rarity tier roll: 50/35/12/3
- **BALANCE-02**: Sub-distribution внутри tier: 5%/15%/30%/50%
- **BALANCE-03**: Pity rare guarantee: 3 common → rare+
- **BALANCE-04**: Pity epic guarantee: 10 без epic → epic+
- **BALANCE-05**: Pity legendary: 15→+3%, 20→+7%, 25→guarantee
- **BALANCE-06**: Streak protection (carrier): 3 low-ceiling → guarantee S-roll
- **BALANCE-07**: Pity counters локально (без backend)
- **BALANCE-08**: Скрипт `client/scripts/simulate_balance.cjs` — Monte Carlo 10K боксов, output: avg legendary count, time to first legendary, distribution
- **BALANCE-09**: Hidden ceiling roll: при первом feed — pre-determine из distribution. Save в carrier data. Reveal прогрессивно (REQ CARRIER-07)

## UX — пользовательский опыт

- **UX-01**: Visible pity counter:
  - Первые 3 миссии: скрыт
  - После 3-й failed mission: «Удача растёт ●●○»
  - После 5-й: точные числа
- **UX-02**: Двухосевая визуализация: rarity = форма/glow/border, element = hue
- **UX-03**: Colorblind-safe palette
- **UX-04**: Settings toggle «Calm farm mode» (отключает aura/ambient particles на ферме)
- **UX-05**: Settings toggle «Reduced effects» — дефолт OFF
- **UX-06**: Settings toggle «Open boxes instantly» — минимизирует drama до 1с
- **UX-07**: Haptic feedback (`Telegram.WebApp.HapticFeedback`):
  - light на drag start
  - medium на valid hover
  - error на invalid
  - heavy на slot drop / level-up / stabilization
- **UX-08**: Tutorial overlay first-time:
  - Первый бокс → tooltip про slot-machine
  - Первая сыворотка → tooltip про eligibility
  - Первый feed → tooltip про hidden ceiling
  - Первый stabilization → tooltip про merge выше потолка
- **UX-09**: Progressive disclosure: первый login после v2.0 → unlock табы Сыворотки + Бестиарий. Скауты unlock после первого feed. Боксы unlock после первого scout
- **UX-10**: Stabilization progress bar в info-card carrier'а
- **UX-11**: Dispose confirmation modal

## PERF — performance budget

- **PERF-01**: Target FPS: 60 desktop / 50 mid-tier mobile / 30 minimum low-tier
- **PERF-02**: Hard cap visible overlays: 4 одновременно
- **PERF-03**: Off-screen culling overlay
- **PERF-04**: Adaptive throttle (см. INFRA-05)
- **PERF-05**: Bundle delta cap: +50 KB gzip
- **PERF-06**: Memory: tween count <200 в любой момент
- **PERF-07**: Lazy load Cosmic Hub modal
- **PERF-08**: Code-split SerumSlotMachine, BestiaryV2Tab, CascadeRevealModal
- **PERF-09**: Performance benchmark report (Phase 4): 16 frogs × overlay на real Android — ≥45 FPS

## I18N — локализация

- **I18N-01**: 16 элементов имеют RU/EN/ES переводы (≤12 chars):
  - fire: Огонь / Fire / Fuego
  - ice: Лёд / Ice / Hielo
  - water: Вода / Water / Agua
  - forest: Лес / Forest / Bosque
  - toxic: Яд / Toxic / Tóxico
  - plasma: Плазма / Plasma / Plasma
  - shadow: Тень / Shadow / Sombra
  - crystal: Кристалл / Crystal / Cristal
  - desert: Песок / Desert / Desierto
  - gas: Газ / Gas / Gas
  - ring: Кольцо / Ring / Anillo
  - binary: Бинарь / Binary / Binario
  - arcane: Магия / Arcane / Arcano
  - mechanical: Меха / Mech / Mecánico
  - war: Война / War / Guerra
  - void: Пустота / Void / Vacío
- **I18N-02**: Все UI строки Cosmic Hub переведены
- **I18N-03**: Tooltips, error toasts, success messages переведены

## Out of Scope для v2.0

- L25-командир unlock-механика
- Backend pity tracking / cloud sync
- Push notifications (in-app toast достаточно)
- Telegram CloudStorage
- A/B testing infrastructure
- Reroll механизм для carrier ceiling
- Multi-device sync
- Tamper detection / save encryption
- Curated shop с гарантированными items
- Achievement system 2.0
- Daily quest layer
- Реальный audio для slot-machine

## Coverage

| Subsystem | REQ count |
|---|---|
| REFACTOR | 5 |
| INFRA | 6 |
| COSMIC-HUB | 7 |
| ELEMENT | 12 |
| SERUM | 11 |
| BOX | 7 |
| SLOT | 8 |
| SHIP | 10 |
| CREW | 8 |
| MISSION | 8 |
| CARRIER | 12 |
| BESTIARY | 9 |
| BALANCE | 9 |
| UX | 11 |
| PERF | 9 |
| I18N | 3 |
| **Total** | **135** |

## Open Questions для playtest

| # | Вопрос | A | B |
|---|---|---|---|
| Q1 | Веса rarity refine | 50/35/12/3 | 55/30/12/3 |
| Q2 | Hidden ceiling reveal threshold | 5 feedings | 7 feedings |
| Q3 | Streak protection | 3 low-rolls | 5 low-rolls |
| Q4 | Slot legendary duration | 8с | 10с |
| Q5 | Pity reveal threshold | После 3 missions | После 5 missions |
| Q6 | Scout duration default | 5-15 min | 30-60 min |
| Q7 | Skip-button delay | 0.6с | 1.0с |
| Q8 | Element bottom-bar icon | 🧬 | 🧪 / 🌌 |

---

**Last updated:** 2026-05-08 — initial REQUIREMENTS for milestone v2.0
