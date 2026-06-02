# Backend Audit — Frog Evolution

> Status: 2026-06-02. Аудит серверной части (`server/src`) + клиентского слоя
> синхронизации (`client/src/api/gameSync.ts`, `store/persistence.ts`).
> Цель: довести бэкенд до состояния, где **офлайн-прогрессия надёжна** и
> накопленный прогресс не теряется.

---

## 1. Архитектура как есть

```
client (Zustand + localStorage)  ──PUT /game/state──▶  Postgres (Prisma)
       ▲   authoritative                                   dumb snapshot
       └───GET /game/state (offline goo income)────────────┘
```

- **Клиент — source of truth.** Вся геймплей-логика (мердж, покупка, клик,
  конвейер, капсулы, эволюция) выполняется на клиенте. Сервер хранит снапшот.
- Схема прямо это фиксирует: `GameState` комментарий —
  *«Не source of truth для критичных операций — только для cross-device sync»*.
- Синк: throttled `PUT /game/state` раз в 5с + flush на `beforeunload` /
  `visibilitychange`. Оптимистичный concurrency через `version`.
- Есть server-authoritative ростки, которые **не достроены**:
  - `/game/shop/*`, `/game/merge` — серверные мутации существуют, но клиент всё
    равно гонит снапшот целиком → два пути правды, могут разойтись.
  - `/game/box/open` — **заглушка** (`stub:true`, contents пустой).
  - `PityState` таблица есть — **не используется**.

---

## 2. Offline-прогрессия (главная зона)

### Что считается офлайн сейчас
1. **Goo-голд** (`GET /game/state`): `floor(earnedSec × incomePerSec)`, где
   `earnedMs = clamp(now - lastSessionAt, 0, gooCollectorCap + droneBonus)`.
   `incomePerSec` — **один глобальный float, который пишет клиент**.
2. **Боксы за офлайн** — считаются **на клиенте** (`gameSync.ts:420-437`) из
   сырого `elapsedMs`, сервер шлёт только время.

### Чего НЕ хватает для «локации живут своей жизнью»
| Локация | Офлайн-механика | Сервер сейчас |
|---|---|---|
| Loc1 Болото | goo-доход, дроп боксов | голд — да; боксы — считает клиент |
| Loc2 Лес | конвейер → L7 лягушки, авто-мердж капсул, эктоплазма-дрон | **ничего** |
| Loc3 Континент | эволюция 24ч в капсуле | **ничего** (таймер в localStorage) |

**Вывод:** офлайн-модель = одна формула голда. Per-локационная «жизнь»
(производство лягушек, накопление эктоплазмы/currencyY, прогресс эволюции)
**не симулируется сервером** и привязана к клиентским часам / localStorage.

---

## 3. Антипаттерны (по убыванию риска)

### A. `cosmic` JSON как свалка — риск потери сейва ⚠️ HIGH
~30 разнородных полей (serums, boxes, ship, carriers, ascendedCarriers, essence,
mutagen1/2/3, perma*, shopPurchaseCounts, bestiaryBitset, pityCounters,
ectoplasm, currencyY, loc2Upgrades, frogTiers, frogTierCooldowns,
temporaryIncomeBuff, l18*, preferences, tutorialState…) сериализуются в один
opaque JSONB **вручную** в трёх местах:
1. `snapshotForSave()` — что отправить;
2. `loadGameState()` — ~200 строк `if (x in c)` гидрации;
3. `persistence.*` — localStorage-зеркало на boot.

Каждое новое поле требует правки в **трёх** местах. Комментарии в коде
документируют, что это уже ломалось:
> *«2026-05-18 audit fix: WAS missing from snapshotForSave → cross-device login
> lost all ascended carriers + essence (irreversible save loss).»*

И снова для perma-upgrades. Паттерн структурно гарантирует повторение.

### B. Клиент-authoritative голд / доход ⚠️ HIGH
- `PUT /game/state` принимает `gold` от клиента; клампит только против
  `MAX_GOLD_PER_SEC = 1e11/сек` от прошлого значения. DevTools → `gold = maxAllowed`.
- `incomePerSec` принимается от клиента (кламп `1e14`). Офлайн-доход целиком
  зависит от значения, которое выставил клиент.

### C. Нет транзакций — race / двойная трата ⚠️ MED
`shop.buy-*` и `merge` = `findUnique` → вычисление → `update` без
`prisma.$transaction` и без атомарного декремента. Два параллельных запроса
читают один `gold` → тратят дважды.

### D. Голд как `Number` на клиенте ⚠️ MED
Сервер хранит `BigInt`, клиент делает `Number(data.gold)` и `Math.floor(s.gold)`.
Точность теряется >2^53. На L18-доходах (5.4e12/сек) деградирует со временем.

### E. Нет валидации ввода ⚠️ MED
Ручные `typeof`-проверки в каждом роуте. Fastify JSON-schema / zod не
используются. Легко пропустить кейс (см. отсутствие проверок формы `cosmic`).

### F. Прочее ⚠️ LOW
- `plugins/auth.ts`: `request: any, reply: any` — при наличии `fastify.d.ts`.
- `/game/box/open` — заглушка; `PityState` мёртвая таблица.
- Нет rate-limit ни на одном эндпоинте.
- `prisma.ts`: глобальный клиент без `$disconnect` на SIGTERM/SIGINT.
- CORS `origin: true` (отражает любой origin) — ок для dev, слабо для prod.
- Два пути мерджа (server `merge.ts` + клиентский снапшот) могут разойтись.

---

## 4. Целевое состояние

Принцип игры (формулировка автора): пользователь играет, копит прогресс; при
выходе мы ждём; при следующем заходе **сервер выдаёт состояние, накопленное за
прошедшие часы**, по всем 3 локациям, как будто они жили своей жизнью. Весь
прогресс сохранён.

Из этого следует:
1. **Сервер — authority по офлайн-accrual.** Детерминированный расчёт
   «что произошло пока тебя не было» из `lastSessionAt` + конфигов локаций.
   Клиент остаётся authority по responsive online-игре.
2. **Per-локационная офлайн-модель**, а не один `incomePerSec`:
   - Loc1: goo + боксы (боксы перенести на сервер).
   - Loc2: конвейер-производство L7, накопление эктоплазмы дроном, авто-мердж.
   - Loc3: прогресс эволюции по wall-clock сервера (не localStorage).
3. **Структурировать persisted-state**: вынести валюты/прогресс из `cosmic`-блоба
   в типизированные поля/таблицы → убрать класс багов «потерялось из snapshot».
4. **Закрыть антипаттерны**: транзакции, валидация, типы, graceful shutdown,
   доделать/убрать box-stub.

---

## 5. План работ

- [x] **P1 Разгрузка `cosmic`-блоба** — единый список `COSMIC_SYNC_KEYS`
      (`satisfies (keyof StoreState)[]`) на save-стороне + валюты (ectoplasm,
      currencyY, essence, mutagen1-3) и loc2Upgrades вынесены в типизированные
      колонки (миграция + backfill). `10603a1`, `b03a255`.
- [x] **P1 Транзакции** на shop/merge — Serializable `$transaction`, атомарное
      списание голда. `0cbf230`.
- [x] **P2 Хардненинг** — graceful `$disconnect` (SIGINT/SIGTERM), типы в
      auth-плагине, CORS allowlist в prod (`CLIENT_ORIGIN`). `0cbf230`.
- [x] **P0 Эволюция (Loc3) cross-device** — колонки evo*, bridge localStorage↔
      сервер (restore-only). `1cbbb70`.
- [x] **P0 Offline box-fill на сервере** — `computeOfflineBoxes` (детерминированно,
      капнуто), клиент больше не считает сам. `84ff5e0`.
- [ ] **P0 Офлайн-accrual Loc2/Loc3 (ectoplasm/конвейер/капсулы)** — РАЗВИЛКА,
      нужна балансная модель (см. §7). Колонки готовы, сервер сможет инкрементить.
- [ ] **P1 Валидация-фреймворк** (zod / fastify schema) — сейчас ручные `typeof`
      (функционально полные, но без единого слоя). Отложено как объёмный рефактор.
- [ ] **P2 Голд как строка/BigInt сквозь клиент** (убрать `Number()` — точность >2^53).
- [ ] **P2 Box endpoint** — реализовать rarity/pity server-side или удалить stub+PityState.
- [ ] **P2 Эволюция server-wall-clock authority** — сейчас endsAt ставит клиент;
      завершение по серверным часам = анти-чит для 24ч-таймера (низкий приоритет).

## 7. Открытые развилки (нужно решение автора)

### A. Офлайн-симуляция поля Loc2/Loc3 (ectoplasm / конвейер L7 / авто-мердж капсул)
Это эмерджентная механика поля: конвейер спавнит L7, капсулы авто-мерджат, дрон
собирает слизь. Честная server-симуляция требует либо порта всей field-логики,
либо **закрытой формулы** (idle-стандарт: `ectoRatePerSec × cappedElapsed`).
Закрытая форма требует балансных чисел (base-rate слизи), которых сейчас нет в
конфиге — это дизайн-решение, не код. Колонки (`ectoplasm` и т.д.) уже готовы;
как только модель выбрана — сервер инкрементит в GET по аналогии с goo-голдом.

Варианты: (1) closed-form rate per-loc (быстро, приблизительно); (2) полная
детерминированная симуляция (точно, дорого); (3) пока не accrue'ить Loc2/Loc3
офлайн (только онлайн), голд покрывает основной доход.

### B. Валидация-фреймворк
Принять zod или Fastify JSON-schema на всех мутирующих роутах? Объёмный, но
убирает класс «забыли проверку». Сейчас ручные проверки покрывают известные кейсы.

---

## 6. Карта файлов

| Файл | Роль | Заметки |
|---|---|---|
| `prisma/schema.prisma` | модели | `cosmic`/`onboarding` — opaque JSON |
| `routes/gameState.ts` | GET/PUT снапшот + офлайн goo | ядро sync |
| `routes/shop.ts` | buy-frog / buy-upgrade | нет транзакций |
| `routes/merge.ts` | server-side merge | дублирует клиентский путь |
| `routes/box.ts` | open box | **stub** |
| `routes/cosmic.ts` | apply-serum | единственная живая cosmic-мутация |
| `config/economy.ts` | зеркало клиентской экономики | SYNC POINT, легко разъехаться |
| `client/src/api/gameSync.ts` | load/save снапшота | ручная гидрация cosmic |
| `client/src/store/persistence.ts` | localStorage-зеркало | primary на boot |
</content>
</invoke>
