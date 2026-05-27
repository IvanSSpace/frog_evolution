# Экспедиции (космос, Fallout Shelter-style)

Отправляем корабль в космос. Он летит, копит **дневник** (поток таймштампованных
сообщений) и **лут** (золото + сыворотки). Игрок жмёт «Вернуться» — корабль идёт
домой **втрое быстрее**, чем летел. Опоздал с отзывом → растёт риск → можно
потерять корабль вместе с лутом.

Пока 1 активный корабль; с прокачкой — до 4 (`EXPEDITION_CONFIG.ships`).

## Главная идея: лог не хранится

Дневник и лут **не лежат в БД**. Это чистая функция от
`(seed, время полёта, версия контента)`. В `Expedition`-строке только: `seed`,
`startedAt`, `recalledAt`, `arrivalAt`, `status`, `tickIntervalSec`, `shipStats`.

Любой `GET` пересчитывает журнал заново через `simulate()`. Плюсы: ноль роста БД,
полный детерминизм (тот же seed → тот же полёт всегда), offline-прогресс
бесплатно (вернулся через 3ч — дневник за 3ч готов), тривиальный тест.

## Модули (`src/expedition/`)

| Файл | Что |
|------|-----|
| `prng.ts` | mulberry32 + xfnv1a, без зависимостей. `tickSeed(seed,n)` — независимый сид на бит. |
| `types.ts` | Типы: `Scenario`, `LogLine`, `ExpeditionResult`, `ShipStats`. |
| `config.ts` | Все игровые knobs. `EXPEDITION_CONFIG` (прод) и `DEMO_CONFIG` (быстрый). |
| `content.ts` | Словари сеттинга + пул сценариев. **Контент живёт тут — добавляй свободно.** |
| `engine.ts` | `simulate(params, cfg)` — чистый симулятор. |
| `render.ts` | `renderJournal()`, `toPlainText()`, `lootSummary()`, `formatTime()`. |
| `demo.ts` | Тест детерминизма + печать примера. |

## API

Все роуты — `Authorization: Bearer <jwt>` (как остальные `/game/*`).

### POST `/expedition/start`
Запускает корабль, если есть свободный слот.
Body (опц.): `{ "demo": true }` — короткий темп тиков (2с) для быстрой проверки.
```jsonc
// 200
{ "ok": true, "expedition": { /* см. Expedition View ниже */ } }
// 409 — нет свободного корабля
{ "error": "no free ship", "active": 1, "max": 1 }
```

### GET `/expedition/active`
Все летящие/возвращающиеся корабли с актуальным журналом.
```jsonc
{ "ok": true, "expeditions": [ /* Expedition View[] */ ] }
```

### GET `/expedition/:id`
Одна экспедиция, полный журнал.

### POST `/expedition/:id/recall`
Разворот домой. `arrivalAt = now + outboundSec / 3`. Если отозвали слишком
поздно (катастрофа уже была) — статус `LOST`, корабль потерян.

### POST `/expedition/:id/claim`
Забрать лут. Доступно только когда корабль пришвартовался (`now >= arrivalAt`).
```jsonc
// 200
{ "ok": true, "shipLost": false, "loot": { "gold": 4200, "serums": { "toxic": 2 } } }
// 425 — ещё летит обратно
{ "error": "still returning", "arrivalAt": "2026-05-26T07:30:00.000Z" }
```

### Expedition View (форма объекта)
```jsonc
{
  "id": 12,
  "seed": 1734920183,
  "phase": "outbound",      // outbound | returning | arrived | lost
  "status": "OUTBOUND",     // enum из БД
  "startedAt": "2026-05-26T06:00:00.000Z",
  "recalledAt": null,
  "arrivalAt": null,
  "outboundSec": 480,
  "risk": 0.0,              // 0..1, текущая опасность
  "shipLost": false,
  "canRecall": true,
  "canClaim": false,
  "loot": { "gold": 960, "serums": { "fire": 1 } },  // превью (ещё не выдан)
  "journal": [
    { "time": "00:00", "text": "Вылетаю с орбиты. Двигатели в норме.", "category": "departure" },
    { "time": "00:30", "text": "Идентифицирована галактика Мерсено.", "category": "travel" }
  ]
}
```

## Балансировка

Крути `EXPEDITION_CONFIG` в `config.ts` — движок не трогай.

| Knob | Эффект |
|------|--------|
| `tickIntervalSec` | РЕАЛЬНЫЙ темп: сек реального времени на один бит. Прод 60, демо 2. Меньше → лог растёт быстрее. |
| `fictionGapSec` | Шаг часов дневника (ЧЧ:ММ) на бит. 60 → один бит = одна минута журнала, 1-3 строки/мин (FS-вид). Не зависит от реального темпа. |
| `returnSpeedMultiplier` | Ускорение возврата (3 = обратно втрое быстрее). |
| `returnRiskFactor` | Опасность на обратном пути ×норма (0.25 = на 75% безопаснее). |
| `maxOutboundSec` | Предел дальности (8ч). |
| `ships.base` / `.max` | Сколько кораблей одновременно. v1 = base. |
| `goldPerTickBase` | Базовое золото за тик полёта (× `ship.speed`). |
| `serumChancePerTick` | Шанс сыворотки за тик (× `ship.luck`). |
| `riskFreeSec` | Окно без риска (30 мин). |
| `riskRampSec` | За сколько риск дорастает до максимума. |
| `catastrophePerTickMax` | Пиковый шанс потерять корабль за тик. |

Веса событий — поле `weight` в каждом `Scenario` (`content.ts`). Hazard-события
автоматически тяжелеют с ростом риска (foreshadowing — игрок видит, что пора домой).

## Контент и связность (`content.ts`)

Журнал — поток коротких реплик от лица пилота-лягушки: структурные строки
(«Найдено место: …», «Пытаюсь вскрыть замок.») вперемешку с болтовнёй и записями
дневника. **Добавляй сценарии свободно — движок трогать не нужно.**

Поля `Scenario` для связности:

| Поле | Что делает |
|------|-----------|
| `set: ['combat']` | бит оставляет «настроение» (живёт ~3 бита) |
| `needs: 'combat'` | бит-**реакция** — выпадает только пока настроение свежо |
| `weight` | базовый вес в пуле (реакции ×3 при активном настроении) |
| `minSec` | раньше этого времени полёта бит не появляется |

Так событие «играется потом»: бой (`set: ['combat','spooked']`) → через пару
битов выпадает реакция (`needs: 'combat'` — «перевожу дух», «проверяю пушку»).
Текущие настроения: `combat`, `spooked`, `loot`, `lonely`, `weird`, `wreck`.

Анти-повтор: последние 6 битов не повторяются (кулдаун в движке).

Токены в тексте:
- `{galaxy}` / `{arm}` — фиксированы на весь полёт; `{planet}` / `{anomaly}` /
  `{creature}` / `{faction}` / `{place}` / `{star}` / `{phenomenon}` — катятся из `DICT`;
- `{slime}` / `{gold}` — реальный лут, который выдаёт этот бит (FS-стиль: «+{gold}»);
- слоты лучше держать в именительном падеже или после `—`/`:` (наивная подстановка
  не склоняет); предложения капитализируются автоматически (многоточие не триггерит).

## Запуск

```bash
# демо-тест детерминизма + пример журнала
./node_modules/.bin/ts-node src/expedition/demo.ts

# миграция БД (создаёт таблицу expeditions + enum) — НУЖНА перед использованием API
npm run prisma:add-migration expedition
```

## Минимальный рендер для Mini App

См. `docs/expedition-journal.html` — самодостаточный пример (mock-данные).
Суть рендера журнала:

```ts
const res = await fetch('/expedition/active', {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json())

const exp = res.expeditions[0]
const list = document.getElementById('journal')!
list.innerHTML = exp.journal
  .map((l) => `<li class="cat-${l.category}"><span class="t">${l.time}</span> ${l.text}</li>`)
  .join('')

// риск-бар + кнопки
recallBtn.disabled = !exp.canRecall
claimBtn.disabled = !exp.canClaim
```
