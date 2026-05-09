# Frog Evolution — Cosmic Frogs System

## What This Is

Endgame-расширение Telegram Mini App "Frog Evolution" — idle merge-clicker. Добавление **системы элементных лягушек через сыворотки** с космо-планет, интегрированной с существующей фермой и звёздной картой (1000 планет, 88 анимаций кликов).

## Context

- **Проект:** Telegram Mini App, на milestone v1.0 завершён базовый игровой цикл (24 уровня лягушек, 4 локации, ферма, бестиарий, настройки) и StarMap инфраструктура (1000 планет, уникальные анимации/текстуры).
- **Стек клиента:** React 19 + Vite + TypeScript + Phaser 4.1 + Zustand + TailwindCSS
- **Стек сервера:** Fastify + Prisma + PostgreSQL (не затрагивается)
- **Текущее состояние UI:** bottom-bar с кнопкой 🛍️ (магазин), 📖 (settings), кнопка локаций
- **Текущее состояние данных:** 1000 планет в `planetMap.json`, 16 main races + 984 BG, 16 типов архетипов, 88 уникальных анимаций кликов, 80 уникальных текстур

## Core Value

После прохождения базовых 24 уровней игрок получает **долгосрочный endgame-контент**: коллекционная система с 16 элементами × 4 редкости × 24 уровня = ~1500 уникальных карточек, gacha-style открытие сывороток с slot-machine drama, и mini-clicker миссии для retention.

## Milestone v2.0 — Cosmic Frogs System

### Validated (от v1.0, готовая база)
- ✓ 1000 планет в `planetMap.json` с архетипами (12 BG + 16 main)
- ✓ 88 атомарных анимаций кликов в StarMapScene
- ✓ Sound-style таблица для будущей привязки к real audio
- ✓ Cosmic Hub modal infrastructure (StarMap уже работает)
- ✓ Bestiary infrastructure (24-frog grid в SettingsModal)
- ✓ React 19 + Phaser 4.1 + Zustand паттерны установлены
- ✓ DnD knowledge — drag-merge лягушек на ферме уже работает
- ✓ Magnet/merge pause механизмы доступны через gameStore

### Active (Phase 9-15)
- [ ] 🧬 Cosmic Hub UI: новая иконка в bottom-bar (заменяет 🛍️) — fullscreen modal с 4 табами (Скауты / Боксы / Сыворотки / Бестиарий 2.0)
- [ ] 16 элементов лягушек: 12 от BG-архетипов (fire, ice, water, forest, toxic, plasma, shadow, crystal, desert, gas, ring, binary) + 4 эксклюзивных от main races (arcane, mechanical, war, void)
- [ ] 80 элементных анимаций (16 × 5: dormant + common + rare + epic + legendary) — постоянные idle-overlay на лягушках на ферме
- [ ] Скаут-экспедиции: отправка лягушки на планету → ожидание (5-30 мин) → возврат → mini-clicker миссия → бокс
- [ ] Бокс с гарантированной сывороткой: cascade reveal (монеты → ресурсы → ⭐ slot-machine на сыворотку)
- [ ] Slot-machine drama: длительность анимации = индикатор tier (1.2-14с), checkpoint flashes на 1.5/3.5/5.5/8с
- [ ] 4 редкости с весами 35/40/20/5 (щедрая балансировка для idle жанра)
- [ ] Внутри-tier распределение скрытого потолка 50/30/15/5 (топовая common ≈ нижняя rare → fomo)
- [ ] Видимая pity-механика: 3 common→rare+, 10 без epic→epic+, 25 без legendary→legendary+
- [ ] Carrier-механика: применение сыворотки на стартовую лягушку локации (DnD), визуальное «пробуждение» 2с
- [ ] Eligibility: common→L1 (Болото), rare→L7 (Лес), epic→L13 (Земля), legendary→L19 (Космос)
- [ ] Feed-эволюция: скармливание обычных лягушек carrier'у с rolls на повышение уровня
- [ ] Скрытый потолок раскрывается через mini slot-machine drama при стабилизации
- [ ] DnD UX: магнит и merge auto-pause во время применения, mis-drop возвращает сыворотку
- [ ] Бестиарий 2.0: 24 × 16 × 4 = 1536 ячеек grid, фильтры по element/rarity, прогресс-метрики

### Out of Scope (для v2.0)
- L25-командир + unlock-логика (всё открыто в dev-mode для разработки; gating добавится отдельной мелкой фазой позже)
- Сюжетные квесты главных рас (вынесено в будущий milestone)
- Реальные звуковые эффекты (sound-style ярлыки уже есть как mental model, привязка к audio файлам — потом)
- Real-time PvP / multiplayer / leaderboard
- Серверная синхронизация прогресса сывороток
- Командирские особые механики (после v2.0)

## Core Value Loop

```
Игрок прокачал ферму → активируется Cosmic Hub
    ↓
Отправляет скаута на planet (5-30 мин)
    ↓
Mini-clicker миссия при возврате
    ↓
Открывает БОКС → cascade reveal → slot-machine на СЫВОРОТКУ
    ↓
DnD сыворотку на стартовую лягушку локации (пауза магнита/merge)
    ↓
Carrier пробуждается → feed-эволюция (скармливание обычных)
    ↓
Скрытый ceiling раскрывается → стабилизация → mini-drama
    ↓
Если хочется выше потолка → ищет другого carrier того же элемента и уровня
    ↓
Бестиарий 2.0 заполняется → коллекционный fomo → loop continues
```

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 16 элементов вместо 12 | 12 от BG + 4 эксклюзив от main races = доп. chase-target | element pool: 12 farm + 4 endgame |
| Каждый бокс = всегда сыворотка | Idle/clicker жанр — игрок не должен возвращаться с пустыми руками | rarity варьируется, slot-machine всегда играет |
| 4 редкости со скрытым потолком внутри tier | Stochastic-RPG fomo: топовая common ≈ нижняя rare → каждая лягушка уникальна | weights 35/40/20/5, sub-distribution 50/30/15/5 |
| Eligibility = только стартовая лягушка локации | Связывает farm-progression с космо-системой автоматически | Common→L1, Rare→L7, Epic→L13, Legendary→L19 |
| DnD-применение, не модалка-список | Tactile + visual + игрок видит карту фермы | Магнит/merge auto-pause |
| Slot-machine длительность как сигнал tier | Стандарт gacha (Genshin/HSR), играет на anticipation | 1.2-14с с checkpoint flashes |
| Видимая pity (счётчики в UI) | Доверие игрока к балансу | "До rare через 2 бокса" |
| Iconка 🧬 (DNA) в bottom-bar | Тематично для сывороток/генов; заменяет старый 🛍️ | новая ENTRY POINT для всего Cosmic-контента |
| Dev-mode без unlock-блоков | Юзер сейчас разрабатывает, нужно тестировать всё сразу | unlock через L25-командира — отдельная будущая фаза |
| Использовать существующие 88 анимаций | 80 element-анимаций можно строить на тех же атомарных компонентах | reusable через element pool в FrogElementOverlay |

## Tech Foundations (наследует от v1.0)

- React 19 + TypeScript strict
- Phaser 4.1 для игры (StarMapScene + MainScene)
- Zustand для state (gameStore с persist)
- i18next для локализации (RU/EN/ES)
- mitt eventBus для cross-component communication
- localStorage для persist фермы и инвентаря
- planetMap.json как источник истины для StarMap

## Out of Scope для всего проекта (не только v2.0)
- Серверная игра (всё локально + sync позже)
- Multiplayer / лидерборды
- Реклама / monetization

---

## История milestones

### v1.0 — Локализация + Настройки + Редкие боксы + Уникальные планеты (2026-05-06 → 2026-05-08, COMPLETE)
- 8 фаз, 26 планов, 100% complete
- i18n RU/EN/ES, settings modal, бестиарий 24-grid, формат чисел, rare crate, rare box rework, unique planet animations & textures, full planet uniqueness (1000 planets, 96+ animation components, 80 unique textures)

### v2.0 — Cosmic Frogs System (active)
- Создан 2026-05-08
- Phase 9-15 (нумерация продолжается из v1.0)
- Endgame extension с элементной коллекцией

---
*Last updated: 2026-05-08 — milestone v2.0 initiated*
