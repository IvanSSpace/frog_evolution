# UX Research — Cosmic Frogs System (v2.0)

**Зона исследования:** Quality / UX — visual & interaction patterns
**Researched:** 2026-05-08
**Целевая аудитория документа:** UI-разработчик, внедряющий v2.0
**Overall confidence:** MEDIUM-HIGH (источники = community-research + UX literature; gacha-конкретика частично из reverse-engineered исследований сообщества)

---

## TL;DR — навигация по документу

| Раздел | Что внутри |
|--------|------------|
| §1 Slot-machine UX | Tier-as-duration, checkpoint flashes, skip-mechanics |
| §2 Cascade reveal | Multi-stage drops, escalation pattern |
| §3 Drag-n-drop touch | Ghost, hover, snap, undo |
| §4 Inventory grid 1536+ | Виртуализация, фильтры, segmentation |
| §5 Pity counter UI | Видимая vs скрытая, доверие |
| §6 Toast & long actions | Скаут-возврат, Telegram API |
| §7 Carrier visual | 5 уровней визуала, hierarchy |
| §8 Color palette | 16 элементов × 4 редкости accessibility |
| §9 Cosmic Hub layout | 4 таба, badges, switching |
| §10 Anti-patterns | Что бесит, как не повторить |
| §11 10 Do / 10 Don't | Конкретные правила для v2.0 |

---

## §1. Slot-machine UX best practices

### 1.1 Принцип «длительность = индикатор tier»

**Источник доверия:** Genshin Impact / Honkai Star Rail используют это как фактический стандарт жанра ([Genshin Wish](https://genshin-impact.fandom.com/wiki/Wish), [HSR Warp differences](https://www.ginx.tv/en/honkai-star-rail/4-star-5-star-warp-animation-differences)).

**Паттерн:**
- 4★ pull (=common/rare у нас) → быстрая короткая анимация (синий/фиолетовый стрик)
- 5★ pull (=epic/legendary у нас) → долгая, dramatic (золотой стрик, build-up, character reveal)

**Поведенческий эффект:** игрок видит длительность → дофамин anticipation запускается раньше реального reveal. Это **не обман** — это honest signaling.

> Дофамин выделяется в anticipation награды больше, чем в момент её получения. Brief hold перед reveal feels richer than quick win. ([Slot animation timing analysis](https://www.on-magazine.co.uk/stuff/gaming/how-millisecond-level-timing-in-slot-animations-shapes-player-emotion-and-perceived-luck/))

### 1.2 Конкретные тайминги для нашего случая

Наш проект декларирует 1.2-14с с checkpoints на 1.5/3.5/5.5/8с. Это разумно. Уточнения по research:

| Tier | Target duration | Checkpoint | Action на checkpoint |
|------|-----------------|------------|----------------------|
| Common | 1.2–1.8 с | none или 1.5с soft flash | Сразу к reveal |
| Rare | 2.5–3.8 с | 1.5с | Light flash → продолжение |
| Epic | 5–7 с | 1.5с + 3.5с | Light → bright color shift → продолжение |
| Legendary | 9–14 с | 1.5/3.5/5.5/8с | Light → bright → particle burst → orchestral peak → reveal |

**Микро-тайминги (из slot-machine UX literature):**
- Acceleration phase: 0–100ms
- Top speed hold: brief
- Ease-out deceleration с staggered stopping (gaps по 120ms между остановками отдельных «барабанов»)
- **Микро-пауза 250–500ms перед финальным reveal** — это «вдох» который игрок физически чувствует

### 1.3 Checkpoint flash logic — fake-out OK, но честный

Из Hearthstone-исследования (золотая рамка перед reveal): **прямой fake-out где «золотое появилось → исчезло → снова появилось»** не нашёл подтверждения как стандартная практика — это могла быть ошибка наблюдения сообщества. То что официально работает в Hearthstone:
- Карты появляются face-down → mouse hover показывает glow по rarity → reveal face up
- "NEW!" indicator для впервые открытых

**Рекомендация для нашего slot-machine:**
- ✅ ОК: Идёт common→common→common, на 5.5с вспыхивает yellow → продолжается → реально epic. Это «честный» fake-out — игрок видел, что **момент reveal ещё не наступил**.
- ❌ Не делать: показать золотую рамку → отозвать → показать обычную. Это ощущается как обман и убивает доверие.
- ✅ ОК: «Pity hint» — если до гарантии rare осталось 1, на 1.5с checkpoint обязательно flash, даже если rolled common. Это компенсация anticipation.

### 1.4 Skip / hold-to-skip / always-skippable

**Контекст:** HSR не имеет skip для warp animations (игроки жалуются годами). Genshin тоже. Это **боль жанра**.

**Что работает:**
- HSR в патче 3.4 добавил dialogue skip (не warp). Признали проблему.
- Идеал: **always-skippable tap-anywhere** для повторных пользователей
- Альтернатива: **hold-to-skip** на 0.5с (стандарт mobile UX) — защита от случайных тапов

**Конкретно для нашего случая (idle/clicker, без monetization):**
- Не делать hold-to-skip. У нас нет необходимости заставлять смотреть.
- ✅ После первой полной анимации tier (one-time educational) — добавить «Skip animation» toggle в Settings
- ✅ Tap-anywhere skip с минимальной защитой: первые 0.6с не реагируют на tap (anti-misclick), дальше — tap anywhere → instant reveal
- ✅ В bottom-right мелкий >> «Skip» текст fade-in после первой секунды

**Размеры/тайминги skip-button:**
- Размер 44×44 px (минимум touch target)
- Position: bottom-right, 16px margin
- Opacity 0 → 1 в течение 200ms после первой 1с анимации
- Tap area = 64×64 invisible (защита от fat-finger)

---

## §2. Cascade reveal — несколько дропов подряд

### 2.1 Контекст в нашем сценарии

Бокс открыт → **cascade**:
1. Coins (мгновенно или 200ms zoom-in)
2. Resources (если есть) — короткий reveal
3. ⭐ Slot-machine на сыворотку — длительность tier-dependent

### 2.2 Принцип эскалации

Из FIFA pack opening, Apex pack opening, Hearthstone:

**Pattern: Equal → Equal → BIG**
- Не делать «каждый следующий ярче» — это размывает peak момент
- Делать base drops **одинаково короткими и cleanly delivered**, потом **резкий контраст** с финальным slot-machine

```
[200ms coins] [200ms resources] [PAUSE 400ms] [SLOT-MACHINE 1.2-14s]
```

Pause перед slot-machine критична — это «breath» который сигнализирует «сейчас будет main event».

### 2.3 Бонус-дропы (если они есть после base)

Если внутри cascade нужно показать «и ещё бонус»:
- Делать ПЕРЕД slot-machine, не после
- После slot-machine ничего не показывать — это убивает peak
- Если нужен post-reveal bonus (например, pity counter обнулился) — отдельный toast 1.5с после закрытия modal

**Anti-pattern:** добавлять «и вот ещё coins!» после legendary reveal. Уже всё, peak прошёл — игрок хочет drag сыворотку на лягушку.

### 2.4 Группировка одинаковых наград

Если cascade: 5 coin-drops подряд (например, обычный бокс) — **группировать в один summary** (например «+5x coin»), не показывать 5 отдельных анимаций. Из community wisdom по batch pack opening (FIFA, HS).

---

## §3. Drag-n-drop UX в touch-играх

### 3.1 Visual feedback (стандарт NN/Group)

**Что обязательно:**
- **Drag начался:** subtle haptic feedback (на iOS — light impact, Android — vibrate 10ms). Telegram WebApp: `webApp.HapticFeedback.impactOccurred('light')` ([Telegram Mini Apps Haptic docs](https://docs.telegram-mini-apps.com/platform/haptic-feedback))
- **Ghost element:** полупрозрачный (opacity 0.7), elevated (subtle shadow `0 8px 16px rgba(0,0,0,0.25)`)
- **Source slot:** placeholder с dashed border `border: 2px dashed rgba(255,255,255,0.3)` чтобы было видно «откуда взяли»
- **Hover на valid drop zone:** glow вокруг лягушки-цели, increase scale by 1.05, haptic medium impact
- **Hover на invalid (неподходящий level):** красный outline, no scale, haptic error
- **Drop:** snap анимация 100-150ms к финальной позиции

### 3.2 Touch target sizing

Из NN/Group: минимум **1cm × 1cm = ~38px @ 1x DPR** свободного пространства вокруг draggable. Лучше 44×44px (Apple HIG / Material).

Для наших лягушек на ферме: лягушка сама может быть 60-80px — этого достаточно. Но **сыворотка в инвентаре** должна быть ≥48×48px чтобы её можно было точно схватить, не скаутая мисс-таргет.

### 3.3 Snap vs free-drop

**Для нашего случая → snap mandatory.**
- Наша цель — конкретная eligible лягушка (стартовая локации)
- Free-drop без snap = frustration «промахнулся пикселем»
- **Snap radius:** 80px (примерно 1.5× размер целевой лягушки) для достаточно жирного «магнетизма»

### 3.4 Cancel / undo

**Уровни защиты:**

| Уровень | Когда | Как работает |
|---------|-------|--------------|
| Drop в пустоту | Drop вне всех valid zones | Сыворотка возвращается в инвентарь автоматически (snap-back анимация 250ms) |
| Drop на invalid | Drop на не-стартовую лягушку или wrong level | Тот же возврат + haptic error + toast «Только стартовая лягушка [уровня X]» 2с |
| Mid-drag escape | Drag вышел за viewport | Сыворотка возвращается + cancel feedback |
| Confirm modal | Drop on valid но critical (legendary на L1 carrier) | НЕ ДЕЛАТЬ — ломает flow. Делать undo вместо preview |
| Undo | После применения | Toast «Сыворотка применена. Отменить?» 4с в bottom |

**Undo — критично для legendary:**
- 4-секундный toast с кнопкой «Undo»
- Если нажал — carrier откатывается в pre-drop состояние
- Если 4с прошло — стабилизация финальная
- **Защита от фрустрации** «случайно бросил топ-сыворотку не на ту лягушку»

### 3.5 Hover preview (показывать ли эффект перед drop)

**Рекомендация:** да, показывать.

Когда сыворотка hover'ит над valid лягушкой **>500ms**:
- Показать subtle preview: лягушка получает faint aura цвета элемента (0.3 opacity)
- Tooltip mini-card сверху лягушки: «Element: Fire | Rarity: Epic | Level cap: ~17»
- Это **drastically снижает mis-drop rate** и cognitive load

### 3.6 Магнит/merge auto-pause

Уже в плане v2.0 — это правильно. Дополнения:
- Pause не только магнита/merge — **pause всех auto-actions** (auto-merge, auto-claim coins)
- Visual indicator паузы: subtle border flash на главной игровой зоне (1 frame highlight)
- Resume **через 500ms после drop** (даём анимации carrier-awakening завершиться визуально)

---

## §4. Inventory grid с 1536+ ячейками

### 4.1 Технический подход — виртуализация обязательна

24 × 16 × 4 = **1536 уникальных ячеек** + state per cell (discovered / not). Без виртуализации это будет лагать на mobile (особенно на старых Android в Telegram WebApp).

**Рекомендованная библиотека:** **TanStack Virtual** (`@tanstack/react-virtual`). Из comparison ([TanStack vs react-window](https://mashuktamim.medium.com/react-virtualization-showdown-tanstack-virtualizer-vs-react-window-for-sticky-table-grids-69b738b36a83)):

| Параметр | TanStack Virtual | react-window | react-virtuoso |
|----------|------------------|--------------|-----------------|
| Mobile touch perf | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| API современность | hooks-based, modern | classes/render props | components-based |
| Bundle size | small | smallest | medium |
| Sticky headers | manual | hard | built-in |
| Variable size | yes | special component | auto-measured |
| 1M cells test | smooth | smooth (slightly slower) | smooth |

**Для нашего случая:** TanStack Virtual + 6 columns × ~256 rows (24 × 16 / 4 если разбито по rarity-табам, или 6×256=1536 единым гридом).

### 4.2 Layout strategy для 1536 ячеек

**Не показывать всё сразу единой стеной.** Это «christmas tree» (см. §8 + §10).

**Сегментация (пирамида внимания):**

```
Tab/Mode selector:
[All] [Discovered (X/1536)] [By Element] [By Rarity] [By Level]

Sticky filters:
[Element: All ▾] [Rarity: All ▾] [Lvl: 1-24 ▾] [Search 🔍]

Grid:
┌──┬──┬──┬──┬──┬──┐
│  │  │  │  │  │  │  ← 6 cells/row, 56×56px each + 8px gap
│  │  │  │  │  │  │
└──┴──┴──┴──┴──┴──┘

Footer summary (sticky-bottom):
"Discovered 47/1536 • Fire 12/96 • ..."
```

### 4.3 Cell design (each item, 56×56px)

Состояния:
- **Discovered:** colored frame (rarity), small element icon top-left, level number bottom-right, frog silhouette mini
- **Not discovered:** grey silhouette, "?" icon, dim background
- **New (just discovered):** golden flash border 2c после первого открытия (animation), ✦ marker

**Important:** не делать hover-эффекты на mobile (нет hover). Использовать tap → modal с детализацией.

### 4.4 Фильтры — три уровня

**Уровень 1 (chip pills, всегда видимы):**
- Element selector (16 элементов) — горизонтальный scroll или dropdown
- Rarity selector (4 редкости) — chip pills
- "Discovered only" toggle

**Уровень 2 (advanced, в expanded panel):**
- Level range slider (L1–L24)
- Sort by: name / rarity / level / discovered date
- Search by name (text input)

**Уровень 3 (segmented top-tabs):**
- All
- By element (16 групп с counter)
- By rarity (4 группы с counter)
- Recently discovered

**Не перегружать UI.** Material Design рекомендует ≤3-5 фильтров одновременно видимых ([Material Chips guidelines](https://m3.material.io/components/chips/guidelines)).

### 4.5 Production grid sizing

Для 360px viewport (typical Telegram mobile):
- 6 columns × 56px = 336px + 5×4px gaps = 356px ≈ helma
- Альтернатива: 5 columns × 64px = 320px + 4×8px gaps = 352px ≈ better readability

**Рекомендация:** 5 columns × 64×64px cells, 8px gap. Лучше читаемость чем 6×56.

### 4.6 Прогресс-метрики (как показать заполненность)

Из Pokémon GO collection screen, Genshin character menu:

**Top-bar progress:**
```
[████████░░░░░░░░░░] 47 / 1536 (3%)
Fire: 12/96 ▌ Ice: 8/96 ▌ Water: 5/96 ▌ ...
```

**Не показывать всю pyramid одновременно** — лучше aggregate %.

---

## §5. Pity counter UI

### 5.1 Видимая vs скрытая — наш выбор

Genshin **скрывает** soft pity (74-я wish). Игроки **сами расковыряли** через community-research ([Sportskeeda Pity Guide](https://www.sportskeeda.com/esports/genshin-impact-50-50-pity-soft-pity-system-simplified)).

> Soft Pity — hidden point... isn't disclosed in the game's official documentation.

**Это причина недоверия и spreadsheet-meta-game.**

Наш v2.0 уже зафиксировал «видимую pity» как Key Decision. **Это правильное решение.** Confidence: HIGH.

### 5.2 Конкретный UI pity counter

**Где показывать:**
1. **Около кнопки «Открыть бокс»** — самое контекстуальное место
2. В Cosmic Hub > таб «Боксы» — sticky top
3. Опционально: floating badge на иконке 🧬

**Формат:**
```
До гарантии rare:  ●●○ (2 из 3)
До гарантии epic+: ●●●●●●○○○○ (6 из 10)
До гарантии legendary+: ●●●○○○○○○○○○○○○○○○○○○○○○○ (3 из 25)
```

**Дизайн dot:**
- ● = filled (current count)
- ○ = empty (remaining)
- Цвет dot матчит rarity (rare=blue, epic=purple, legendary=gold)
- Текст счётчика рядом для accessibility

### 5.3 Анимация при росте counter

После каждого открытия:
- Dot заполняется с 200ms ease-in
- Если последний dot перед guarantee — pulse glow loop пока не сбросится
- Сброс counter (после получения rarity) — все dots reset с reverse animation 400ms

### 5.4 «До гарантии rare через 2 бокса» — текстовая версия

Альтернатива dots для accessibility / маленьких размеров:
```
"До гарантированного Rare+: 2 бокса"
"До гарантированного Epic+: 4 бокса"
"До гарантированного Legendary+: 22 бокса"
```

**Рекомендация:** dots primary, text secondary (под). Оба видны.

### 5.5 Trust signals

- Никогда не врать в counter (если rolled rare, counter СБРОСЬ обязательно)
- Если игрок подозревает баг — counter должен полностью объяснить математику
- Можно добавить `?` info-icon → modal с explanation: «Каждые 3 бокса гарантирован Rare+, каждые 10 — Epic+, каждые 25 — Legendary+»

---

## §6. Toast notifications для long-running actions

### 6.1 Сценарий: скаут вернулся через 15 минут

Игрок отправил скаута → закрыл игру → открыл через 20 минут. Что происходит?

### 6.2 Telegram WebApp API — что доступно

**Ключевые ограничения:**
- **Background push notifications** через бот возможны, но требуют backend ([Telegram Bot API push](https://dev.to/climentea/push-notifications-from-server-with-telegram-bot-api-32b3))
- В нашем v2.0 **серверная синхронизация Out of Scope**
- Реальный push «скаут вернулся» при закрытом приложении = **невозможен без backend** в текущей архитектуре

**Что доступно прямо сейчас (client-only):**
- При re-open приложения → читаем localStorage timestamp → если scout.returnAt < now → показываем in-app toast/badge
- HapticFeedback при open приложения если есть returned scouts
- Telegram BG push через Bot API позже добавить (out of scope v2.0)

### 6.3 In-app toast стандарт

**Когда показывать:**
- Открытие приложения после возврата скаута
- Скаут вернулся пока игрок в приложении (real-time)
- Бокс готов к открытию (mini-clicker завершён)

**Дизайн:**
- Position: top, под BottomBar safe area zone
- Width: 90% viewport, max 360px
- Height: ~64px
- Background: rgba(20,20,30,0.95) blur backdrop
- Border-left: 4px solid (color = element цвет лягушки)
- Layout: [Frog avatar 48px] [Title + subtitle] [Action button or dismiss ✕]
- Animation: slide-down 300ms cubic-bezier(0.4, 0, 0.2, 1), auto-dismiss 4s
- Action button: «Открыть» → переход в Cosmic Hub > Боксы
- Haptic: `notification('success')` при появлении

**Accessibility:**
- ARIA live region (`role="status"` для не-критичных, `role="alert"` для важных)
- Button должна быть >44px touch target

### 6.4 Multiple toasts queue

Если скаут №1 вернулся + бокс №2 готов + ачивка получена:
- НЕ стакать 3 toasts сверху друг друга
- **Группировать в badge на иконке Cosmic Hub** «3 events»
- Tap → modal со списком

### 6.5 Уведомление в Telegram (после v2.0)

Future scope:
- Backend bot отправляет message «Ваш скаут вернулся!» когда expedition.returnAt < now
- Бот пингует через Telegram Notification API
- Это требует scheduler + tracking, **не v2.0 work**

---

## §7. Visual progression carrier'а

### 7.1 5 уровней визуала элемента (как в DnD-плане)

**Спецификация:**

| Уровень | Описание | Visual indicators | Animation level |
|---------|----------|-------------------|------------------|
| Dormant | Перед применением сыворотки | Базовая лягушка без overlay | none |
| Common | Сыворотка применена (low tier) | Subtle aura color tint, рамка 1px | mild glow loop 2s |
| Rare | Стабилизировался на rare ceiling | Aura + small particle (1-2 на screen), рамка 2px | pulse 1.5s + occasional sparkle |
| Epic | Epic ceiling | Aura intensify, particles 3-5, glow усиливается | continuous orbit particles |
| Legendary | Legendary ceiling | Bold aura, ~8 particles, animated background ring | full visual treatment, light burst on click |

### 7.2 Перехода между уровнями (visual upgrade transition)

Из Sol's RNG, Marvel Snap rarity upgrades, League leveling:

**Когда лягушка повышается (rare → epic):**
1. Pause all (300ms)
2. Frog freezes, screen darkens (rgba(0,0,0,0.6) overlay)
3. Spotlight beam from sky → лягушка
4. New aura builds up (1.5s)
5. Burst (200ms full screen flash 30% opacity)
6. Resume normal play, лягушка теперь с epic visual

**Длительность всего:** 2-3с. **Skip-able через tap-anywhere после первой 1с.**

### 7.3 Visual hierarchy: rarity vs element vs level

При взгляде на лягушку игрок должен **за 0.3 секунды** распознать:

**Приоритет (от ярче к тише):**
1. **Rarity** — рамка/aura intensity (Common < Rare < Epic < Legendary)
2. **Element** — color hue (fire=red, ice=blue...)
3. **Level** — small badge bottom-right с числом (less prominent)

**Anti-pattern:** уравнять все три по визуальному весу → cognitive overload, ferma выглядит как Christmas tree.

### 7.4 Особый случай: legendary bouncing на L1 carrier

Игрок применил legendary сыворотку на стартовую лягушку L1. На ферме теперь будет огромный glow на самом мелком существе. Это **OK** — это flex, награда за luck. Но:
- Не делать full screen-shake
- Particle count: cap at ~10 чтобы не убить FPS на mobile
- Aura размер ≤ 1.5× размер frog body

### 7.5 Инвентарь preview (small sized cards)

В бестиарии 56-64px ячейка. Visual hierarchy:
- Rarity: border color + width (1px → 4px от common к legendary)
- Element: tiny icon top-left 12×12px
- Level: number bottom-right 10px font
- Sprite frog: 70% размера ячейки

В этом масштабе particles НЕ показывать (их не видно). Только статичный representation.

---

## §8. Element & rarity color palette

### 8.1 Проблема — 16 элементов × 4 редкости = 64 цвета

Это **слишком много distinct цветов** для UX. Wuthering Waves критикуют именно за это ([Wuthering Waves colorblind issues](https://progameguides.com/wuthering-waves/wuthering-waves-isnt-colorblind-friendly-and-kuro-needs-to-fix-it-as-soon-as-possible/)).

### 8.2 Решение — двухосевой подход

**Не комбинировать element-color + rarity-color в один pixel.**

**Ось 1 (rarity)** — управляется **формой и интенсивностью**:
- Common: 1px solid border, no glow
- Rare: 2px border, subtle glow 4px blur
- Epic: 3px border, glow 8px blur, faint aura particle
- Legendary: 4px gold-tinted border, glow 12px blur, strong aura

**Ось 2 (element)** — управляется **hue (color tone)** внутри aura:
- 16 элементов делятся на 4 группы по 4 (как «cardinal directions»):

### 8.3 Палитра для 16 элементов (colorblind-aware)

Базируется на Okabe-Ito + Krzywinski 16-color palette ([Lospec Colorblind 16](https://lospec.com/palette-list/colorblind-16), [Krzywinski colorblind palettes](https://mk.bcgsc.ca/colorblind/palettes.mhtml)).

**12 BG элементов (4 группы):**

| Группа | Элемент | Hue | Hex | Notes |
|--------|---------|-----|-----|-------|
| **Hot** | Fire | red-orange | `#E69F00` | colorblind-safe orange |
| | Plasma | bright pink-magenta | `#CC79A7` | distinguish from fire by hue |
| | Desert | warm gold-tan | `#F0E442` | yellow (safe) |
| | Toxic | acid yellow-green | `#B7DC2A` | only mid-saturation |
| **Cool** | Ice | sky blue | `#56B4E9` | safe blue |
| | Water | deep blue | `#0072B2` | darker than ice |
| | Crystal | cyan-teal | `#00CED1` | distinguishable |
| | Gas | pale lavender | `#D6BCFA` | desaturated cool |
| **Earth** | Forest | green | `#009E73` | colorblind-safe green |
| | Ring | bronze-brown | `#8C5E2A` | warm earthy |
| | Shadow | very dark purple | `#4B0082` | almost-black with hue |
| | Binary | silver-grey | `#A8A8A8` | neutral |
| **Main races (4 эксклюзив)** | Arcane | violet | `#7B2CBF` | high saturation |
| | Mechanical | steel-cyan | `#3C5060` | desaturated industrial |
| | War | crimson-blood | `#A62B1F` | distinct from fire (darker) |
| | Void | abyss-black with subtle violet | `#0D0317` | almost no chroma, distinguished by darkness |

### 8.4 Защита от Christmas tree эффекта на ферме

Когда на ферме 24 лягушки разного цвета — это **должно** быть визуально ярко (это endgame достижение!). Но не **chaos**.

**Решения:**
1. **Aura размер** ≤ 1× размер sprite — не overlap с соседями
2. **Animation timing desync** — каждая лягушка имеет random pulse offset 0-2с чтобы не пульсировали в унисон
3. **Lower saturation** на farm-view (60-70% saturation вместо 100%) → bestiary показывает full color
4. **«Calm farm mode» toggle** в Settings — отключает aura particles, оставляет только border tint. Для игроков которым reach overload.

### 8.5 Цветовой контраст с фоном

Обязательно: каждый element-цвет должен иметь **WCAG AA contrast ratio ≥3:1** с background фермы. Test на текущей сцене (фоны Болото / Лес / Земля / Космос) — минимум 4 проверки.

### 8.6 Mobile дисплей considerations

На 4-inch экранах (iPhone SE, дешёвые Android в Telegram):
- Aura particle ≥2px иначе не видно
- Border ≥1px (sub-pixel rendering = blur)
- Не использовать pure pastel — теряются на bright OLED

---

## §9. Cosmic Hub layout

### 9.1 4 таба — Скауты / Боксы / Сыворотки / Бестиарий

**Best practice (Material/Apple HIG/Smashing Mag):** 3-5 табов ОК для bottom-tab. 4 = sweet spot ([Smashing Mag golden rules](https://www.smashingmagazine.com/2016/11/the-golden-rules-of-mobile-navigation-design/)).

### 9.2 Порядок табов (priority left→right)

Из user journey:
```
1. Send scout → wait → 2. Open box → 3. Apply serum → 4. Browse collection
```

**Recommended order:**
1. **🚀 Скауты** (отправить — главное действие)
2. **📦 Боксы** (открыть, что вернулось)
3. **🧪 Сыворотки** (инвентарь готовых, drag source)
4. **📖 Бестиарий 2.0** (browse collection)

**Логика:** наиболее частое action слева (legacy Apple → thumb-friendly зона = bottom-left), наименее срочное справа.

### 9.3 Иконки для табов

**Принцип:** icon + text label (ВСЕГДА оба, особенно для 4 табов с иногда непонятными терминами).

| Tab | Icon options | Text label (RU/EN/ES) |
|-----|--------------|------------------------|
| Скауты | 🚀 / 🛸 / 🧭 | «Скауты» / «Scouts» / «Exploradores» |
| Боксы | 📦 / 🎁 / 🗳️ | «Боксы» / «Boxes» / «Cajas» |
| Сыворотки | 🧪 / 💉 / ⚗️ | «Сыворотки» / «Serums» / «Sueros» |
| Бестиарий | 📖 / 🔬 / 🐸 | «Бестиарий» / «Bestiary» / «Bestiario» |

**Рекомендация:** 🚀 / 📦 / 🧪 / 📖 — visual variety, нет coalitio.

### 9.4 Badges с числом

**Когда показывать badge:**
- 🚀 Скауты: badge if ≥1 скаут вернулся (ready to claim) — red dot или count
- 📦 Боксы: badge if ≥1 unopened box
- 🧪 Сыворотки: НЕ badge (это passive inventory, не actionable)
- 📖 Бестиарий: badge if ≥1 newly discovered (since last visit)

**Badge design:**
- Position: top-right of icon (relative -4px, -4px)
- Size: 18px ⌀ minimum (touch test - badge не интерактивен но должен быть видим)
- Background: red (`#E53E3E`) для urgent / blue для info
- Text: 11px white bold
- Если count > 99 → показать «99+»

### 9.5 Switching между табами — анимация

**Recommendation:** мгновенно (no transition).
- Mobile users любят speed → Material tabs стандартно instant
- Если хочется немного visual cue — content cross-fade 100ms (max!)
- НЕ slide horizontally — каждый tab имеет уникальный layout, slide создаёт flicker

**Tab indicator (active state):**
- Bottom underline 2-3px цвета primary brand
- Icon color shift (60% opacity → 100%)
- Optional: tiny scale 1.0 → 1.05 на active

### 9.6 Bottom-bar entry icon: 🧬

**Узнаваемость 🧬 (DNA helix):**
- ✅ Метафорически правильно для серумов / генетической модификации
- ✅ Универсально читается (DNA — global symbol)
- ⚠️ Может показаться «medical» / «scientific» — возможно intimidating для casual игрока
- Альтернативы: 🧪 (test tube) / 🌌 (cosmic) / ✨ (sparkle = serum effect) / 🔮 (mystery)

**Рекомендация:** оставить 🧬, добавить **первый-time tooltip** при появлении кнопки: «Cosmic Hub — открой космо-планеты!» (3 секунды, dismiss on tap).

### 9.7 Cosmic Hub modal layout

```
┌─────────────────────────────────────────┐
│ [✕] Cosmic Hub             [⚙️ help] │  ← 56px header
├─────────────────────────────────────────┤
│  🚀 Скауты  📦 Боксы  🧪 Сывор. 📖 Бест │  ← 56px tabs
│  ─────────                                │     (active underline)
├─────────────────────────────────────────┤
│                                         │
│         Tab content (scrollable)        │  ← flex-grow
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  Persistent footer (pity counter)       │  ← 64px footer
└─────────────────────────────────────────┘
```

Footer с pity counter — потому что counter актуален во всех табах.

---

## §10. Анти-паттерны и pitfalls

### 10.1 Что бесит игроков в gacha-механиках

(Из академических работ + community frustration ([CJ Dyas UX of Gacha](https://www.cjdyas.design/blog/the-user-experience-of-gacha-games), [Gacha addiction research](https://www.mdpi.com/2078-2489/14/7/399), [Dark Patterns in Gacha](https://www.diva-portal.org/smash/get/diva2:1888600/FULLTEXT01.pdf)))

**Tier S раздражители (НЕ ДЕЛАТЬ):**
1. Hidden pity (которое community сама расковыряет)
2. «Near-miss» как deceptive pattern (показать gold → отнять)
3. Forced to watch animation без skip
4. Daily login требует precise timing
5. FOMO с скрытыми сроками (event ended without warning)
6. Currency exchange traps (нужно конвертировать через 3 валюты)
7. RNG-блокеры в quest line (нельзя продвинуться без drop)
8. Drop rates спрятаны в EULA / regulatory docs only

**Tier A (минимизировать):**
- Auto-skip нет → forced watching long animations повторно
- Banner rotations без tracker
- «Soft pity» только через community wiki

### 10.2 Перегрузка UI

**Правила:**
- Не показывать больше 7±2 элементов одновременно (Miller's law)
- Sticky filter bar — максимум 3-4 chips видимы
- Pity counter — один primary, остальные accordion / collapsed
- Cosmic Hub footer — **только** pity, не пихать ещё всё

### 10.3 Когнитивная нагрузка элементов

**16 элементов** — это много. Архетипы main races связь — ещё уровень сложности.

**Mitigations:**
1. **Не требовать запоминать**. Element-icon + name всегда вместе.
2. **Filter by element** обязательно — игрок не должен видеть все 16 одновременно.
3. **Bestiary group view** — 16 строк по элементу с иконкой + counter.
4. **First-time encounter modal** для нового элемента (educational): «Fire Frogs — горячая раса с планет fiery архетипа. Стартует от L1 (common).»
5. **Search by element name** in inventory — игрок может найти «огонь» не зная иконку.

### 10.4 Mobile дисплей pitfalls

- Telegram WebApp viewport **меняется при появлении/исчезновении клавиатуры**. Использовать `Telegram.WebApp.viewportHeight` вместо `window.innerHeight`.
- Safe-area-inset-bottom — iPhone notch может скрыть BottomBar. Запас padding-bottom: env(safe-area-inset-bottom).
- Drag за пределы viewport на iOS triggers refresh-down. Нужно `overscroll-behavior: none` на drag-аctive.
- Touch events vs Pointer events — на старых Android Telegram использовать оба.

### 10.5 Performance pitfalls (Mobile WebView)

- 80 element animations × 24 лягушки = **2160 потенциальных активных animation** at peak. **Не запускать все одновременно.**
- Solution: только **активные на экране** (intersection observer)
- Particles via Canvas (Phaser) или CSS keyframes — НЕ inline JS animation per frame
- Rarity glow — CSS `box-shadow` или Phaser tint, не SVG filter (на mobile медленно)
- Bestiary 1536 cells — **обязательная виртуализация** (см. §4.1)

### 10.6 Звуковая навигация (sound mental model)

В v2.0 plan: «sound-style таблица как mental model». Это правильно. Pitfall:
- Не дать игроку **expectation что звуки уже есть** (placeholder labels могут confuse)
- Hide sound-style labels из user-facing UI пока не подключены реальные файлы
- В debug-режиме оставить (для разработчика)

### 10.7 Локализация pitfalls

RU/EN/ES — UI элементы должны fit в 3 языках:
- «Сыворотки» (10 chars) > «Serums» (6) > «Sueros» (6) → tab text fits 12 chars max
- Pity counter text «До гарантированного» = long; альтернатива «До Rare+ через 2» (короче)
- ES особенно длинный, проверять wraps
- Используем уже работающую i18n инфру (i18next)

---

## §11. 10 Do / 10 Don't для нашего v2.0

### ✅ 10 DO

1. **Использовать длительность как индикатор tier** (1.2-14с с checkpoints на 1.5/3.5/5.5/8с) — стандарт жанра, дофамин эффект работает.
2. **Видимый pity counter с dots** — это наш differentiator, доверие игрока > slot-machine deception.
3. **Always-skippable slot animation** через tap-anywhere после первой 0.6с (защита от misclick).
4. **Snap radius ≥80px на drag** для drop сыворотки — touch требует магнетизма.
5. **Undo toast 4с** после применения сыворотки — защита от случайных drop'ов в hot moment.
6. **Виртуализировать бестиарий 1536+** через TanStack Virtual — performance must.
7. **Двухосевая визуальная система** — rarity = форма/glow/border, element = hue. Не комбинировать в один pixel.
8. **Haptic feedback на ключевых моментах** через Telegram WebApp API (drag start, valid hover, drop, level-up, scout return).
9. **Иконки + текст на табах** — 4 таба требуют labels, особенно для непонятных терминов («Сыворотки»).
10. **Hover preview ≥500ms** показывает мини-карточку «Element/Rarity/Level cap» перед drop — снижает mis-drop rate.

### ❌ 10 DON'T

1. **Не делать «обманный fake-out»** (gold border → отнять → real common). Честный fake-out OK, deception убивает trust.
2. **Не скрывать pity counter** — Genshin's HIDDEN soft pity = academic research топик про dark patterns.
3. **Не делать hold-to-skip 1+ секунду** — у нас нет монетизационной причины заставлять смотреть.
4. **Не показывать все 16 элементов одновременно** на одном экране без filter — cognitive overload.
5. **Не уравнять rarity/element/level в визуале** — приоритет должен быть rarity > element > level.
6. **Не использовать «Christmas tree» цвет на ферме** — лимитировать saturation 60-70% на farm view, full color в bestiary.
7. **Не запускать все 24 carrier animations одновременно** — intersection observer + only-on-screen.
8. **Не показывать toast cascade при возврате** — группировать в badge на иконке Cosmic Hub.
9. **Не делать pure pastel border colors** — теряются на mobile OLED, минимум mid-saturation.
10. **Не пихать ВСЁ в Cosmic Hub footer** — только pity counter, остальное в табах.

---

## Sources

### Primary references (UX literature, HIGH confidence)

- [NN/Group Drag-and-Drop Guidelines](https://www.nngroup.com/articles/drag-drop/) — touch UX, ghost preview, drop zones
- [Smashing Magazine: Bottom Navigation Golden Rules](https://www.smashingmagazine.com/2016/11/the-golden-rules-of-mobile-navigation-design/) — 4 tabs sweet spot
- [Material Design 3 Chips Guidelines](https://m3.material.io/components/chips/guidelines) — filter chip patterns
- [Smart Interface Design Patterns: DnD UX](https://smart-interface-design-patterns.com/articles/drag-and-drop-ux/) — visual feedback principles
- [Telegram Mini Apps Haptic Feedback Docs](https://docs.telegram-mini-apps.com/platform/haptic-feedback) — конкретные API methods

### Gacha mechanics research (MEDIUM-HIGH confidence)

- [Genshin Impact Wish Wiki](https://genshin-impact.fandom.com/wiki/Wish) — animation tiers, pity hard cap
- [Sportskeeda: Genshin Pity System](https://www.sportskeeda.com/esports/genshin-impact-50-50-pity-soft-pity-system-simplified) — soft/hard pity values
- [Honkai Star Rail Warp Differences](https://www.ginx.tv/en/honkai-star-rail/4-star-5-star-warp-animation-differences) — tier-as-duration confirmation
- [HSR Skip Button discussion](https://www.hoyolab.com/article/37295983) — community frustration с no-skip

### Psychology / dark patterns (MEDIUM confidence — academic)

- [Dark Patterns Within Gacha Games (DiVA thesis)](https://www.diva-portal.org/smash/get/diva2:1888600/FULLTEXT01.pdf)
- [The User Experience of Gacha Games (CJ Dyas)](https://www.cjdyas.design/blog/the-user-experience-of-gacha-games)
- [Addictive Design of Mobile Gacha Games (Theseus thesis)](https://www.theseus.fi/bitstream/handle/10024/805479/Dang_Thang.pdf?sequence=2)
- [Slot Animation Timing Psychology](https://www.on-magazine.co.uk/stuff/gaming/how-millisecond-level-timing-in-slot-animations-shapes-player-emotion-and-perceived-luck/) — millisecond-level timing analysis

### Color accessibility (HIGH confidence)

- [Lospec Colorblind 16 Palette](https://lospec.com/palette-list/colorblind-16) — tested 16-color palette
- [Krzywinski colorblind palettes](https://mk.bcgsc.ca/colorblind/palettes.mhtml) — 12-15 color extended palettes
- [David Nichols Coloring for Colorblindness](https://davidmathlogic.com/colorblind/) — interactive testing tool
- [Wuthering Waves colorblind issues](https://progameguides.com/wuthering-waves/wuthering-waves-isnt-colorblind-friendly-and-kuro-needs-to-fix-it-as-soon-as-possible/) — case study how NOT to do it

### Tech / virtualization (MEDIUM-HIGH confidence)

- [TanStack Virtual vs React-Window comparison](https://mashuktamim.medium.com/react-virtualization-showdown-tanstack-virtualizer-vs-react-window-for-sticky-table-grids-69b738b36a83)
- [React virtualization libraries trends](https://npmtrends.com/@tanstack/react-virtual-vs-react-virtualized-vs-react-window)
- [LogRocket: Drag-and-drop UI examples](https://blog.logrocket.com/ux-design/drag-and-drop-ui-examples/)

### Idle/clicker retention (MEDIUM confidence)

- [Idle Clicker Game Design (MindStudios)](https://games.themindstudios.com/post/idle-clicker-game-design-and-monetization/) — retention mechanics
- [Idle Genre Game Design](https://www.designthegame.com/learning/courses/course/designing-mobile-idle-genre/a-deep-dive-idle-genre-game-design)

### Card pack opening psychology

- [Psychology of Card Pack Opening (FIFA)](https://www.fifa-infinity.com/ea-sports-fc/the-psychology-behind-pack-opening-in-ultimate-team/)
- [Slot Near-Miss Psychology](https://slotsguy.com/slot-machines-near-miss-psychology/)

---

## Confidence Assessment

| Раздел | Level | Rationale |
|--------|-------|-----------|
| §1 Slot-machine UX | HIGH | Стандарты жанра + UX literature |
| §2 Cascade reveal | MEDIUM | Patterns observed, less formal research |
| §3 Drag-n-drop touch | HIGH | NN/Group + Material + concrete API |
| §4 Inventory grid | HIGH | TanStack docs + benchmark comparisons |
| §5 Pity counter UI | HIGH | Сильный consensus в community + academic critique |
| §6 Toast & long actions | MEDIUM | Telegram API confirmed, but background notify out of scope v2.0 |
| §7 Carrier visual | MEDIUM | Patterns existing, specific mobile-perf untested |
| §8 Color palette | HIGH | Vetted colorblind palettes + WCAG |
| §9 Cosmic Hub layout | HIGH | Material/Apple HIG aligned |
| §10 Anti-patterns | HIGH | Academic + community consensus |

**Open questions / gaps:**
- Точные milliseconds reveal-pause для нашего slot-machine (нужно playtest)
- Battery impact 80 одновременных particle animations на low-end Android
- Telegram WebApp specific viewport quirks с keyboard на Android
- Real haptic support coverage на Android Telegram (некоторые модели игнорируют)
- A/B testing skip-button timing (0.6s vs 1.0s threshold)

**Implications для последующих фаз:**
- **Phase 9-10 (Cosmic Hub UI):** использовать TanStack Virtual для бестиария с самого начала
- **Phase 11-12 (Slot-machine + Boxes):** prototype skip-mechanism early, A/B test с 5 игроками
- **Phase 13 (Carrier mechanics):** prototype haptic feedback на iOS + Android Telegram, баг-репорт если не работает
- **Phase 14 (Element animations):** перформанс benchmark с 24 active animations на low-end Android (Pixel 3a, Galaxy A20 baseline)
- **Phase 15 (Bestiary 2.0):** включить colorblind toggle в Settings уже на этой фазе