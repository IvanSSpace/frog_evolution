# Phase 27 — QA Checklist для ручной проверки

**Версия:** 2026-05-18
**Scope:** Полный manual QA после Phase 27 ship'а + tech-debt полировки (affinity matching + chain expansion 10→15)

> Дополняет `client/SMOKE_TEST_27.md` (sub-agent версия). Этот файл — orchestrator-сгенерированный extended QA с user-facing language.

---

## 1. Базовая видимость

- [ ] **Перед cosmos unlock**: tab «Контакты» 📡 скрыт/disabled в Cosmic Hub
- [ ] **После L18+L18 normal merge**: tab появляется 7-м в strip (ship/boxes/bestiary/carriers/shop/inventory/**contacts**)
- [ ] Tab strip не выходит за пределы на узком viewport (7 элементов)

## 2. Contacts list

- [ ] Открыть таб → видны 10 рас (порядок из `config/races.ts`)
- [ ] Каждая строка: emoji + name + tier badge + relationship 1-10
- [ ] Unread dot ● появляется когда у расы есть pending
- [ ] Все расы стартуют с **relationship ≈ 2** (низкий порог)
- [ ] Tap на строку → переход в race detail

## 3. Race detail screen

- [ ] Back arrow возвращает в list
- [ ] Header: emoji + name
- [ ] Lore блок: affinity + home planet + personality text
- [ ] Relationship bar: progress 1-10 + tier label + numeric value
- [ ] **Tier colors корректны:**
  - 1-2 красный «враждебный»
  - 3-4 оранжевый «прохладный»
  - 5-6 жёлтый «нейтральный»
  - 7-8 зелёный «дружелюбный»
  - 9-10 циан «союзник»
- [ ] Empty state «Ожидание сообщения» когда нет pending
- [ ] Pending interaction отображается с текстом + кнопками

## 4. Reply UX

- [ ] **Поддержать** → relationship +1 (clamp ≤10) + pending pops + следующий step из chain pull'ится
- [ ] **Отказать** → relationship -1 (clamp ≥1) + pending pops + advance
- [ ] **Понятно** (для `msg` type) → no delta + pop
- [ ] Tier label обновляется при пересечении границ (e.g. 2→3 = прохладный)

## 5. Pending engine

- [ ] Cap 3 global — нельзя накопить более 3 одновременно
- [ ] Pull priority: race с lowest chainProgress первый
- [ ] **Event ChainItem не появляется в pending** — авто-применяется -1 + появляется **toast** «{{raceName}} {{description}}: -1»
- [ ] Toast: slide-in анимация сверху, fade-out через ~3s (CSS keyframes, не Lottie)

## 6. First contact gate (зависимость от Phase 26)

- [ ] Race chain **не движется** до first contact с этой расой
- [ ] После первого визита home-планеты (Phase 26 cinematic) — chain активируется

## 7. Personalities — tone matching

Прочитать 1-2 сообщения от каждой и сверить tone:
- [ ] Кристаллозиды — холод, геометрия, медленно
- [ ] Газо-облака — поэтично, резонансы
- [ ] Механидоны — данные, точно
- [ ] Огнечервы — агрессия, дуэли, короткие команды
- [ ] Жидко-сферы — торг, гибко
- [ ] Тенебрисы — загадки, мистика
- [ ] Плазма-духи — импульсивно, быстро
- [ ] Лесо-кореня — мудро, медленно, метафоры
- [ ] Время-ткачи — парадоксы, временные намёки
- [ ] Кометники — восторженно, истории

## 8. Quest_hook stub

- [ ] Accept на quest_hook = +1 relationship (как dialog)
- [ ] **НЕ** запускается реальный quest (Phase 28 wiring) — может быть text hint «Запрос принят»

## 9. i18n переключение

- [ ] RU → EN → ES в Настройках: все тексты Contacts переключаются
- [ ] Tier labels переключаются
- [ ] Reply кнопки переключаются
- [ ] Chain тексты переключаются

## 10. Persistence

- [ ] Reload браузера → relationships сохранены
- [ ] Reload → chainProgress сохранён
- [ ] Reload → pendingItems сохранены (с теми же текстами)
- [ ] Logout/login → server sync восстанавливает state

## 11. Cliclability (mobile / touch)

- [ ] Race rows не закрывают modal при tap (stopPropagation)
- [ ] Back button working
- [ ] Reply buttons tappable (минимум 44×44 hit area)
- [ ] Toast не блокирует tap'ы под собой

## 12. Affinity matching (tech-debt fix, 2026-05-18)

На Star Map проверь визуально:
- [ ] **Огнечервы home** = планета type `lava` (красный)
- [ ] **Механидоны home** = планета type `rocky`
- [ ] **Тенебрисы home** = планета type `dead/dark`
- [ ] **Время-ткачи home** = планета type `ancient`
- [ ] **Жидко-сферы home** = планета type `water` (если такого type нет — fallback на closest)
- [ ] 27/30 habitable планет matched (10/10 home + 17/20 colonies)

## 13. Race chain depth (10→15 expansion, tech-debt 2026-05-18)

- [ ] Полная chain progression от item 1 до item 15 — narrative arc целый, не повторяется
- [ ] Phase 28 quest_id `_b` suffix виден в pending text (грубо — попадается «второй» / «следующий» квест от расы)

## 14. Edge cases

- [ ] Открыть таб когда pendingItems пустой — пусто/«Ожидание»
- [ ] Все 3 pending от разных рас (round-robin работает)
- [ ] Игрок offline 24h → нет сообщений (player-paced, НЕ real-time clock)
- [ ] Chain закончен (15-й item resolved) → race detail = «Все сообщения прочитаны»

## 15. Dev helpers (через DevTools console)

```js
window.__addPending('crystalloids')        // force pending для расы
window.__resetRelationships()              // back to 2/race
window.__advanceChain('fireworms', 5)      // skip ahead chain
window.__dumpContacts()                    // state inspector в console
```

---

## Если что-то сломалось

Отметь сломавшееся + опиши что именно — orchestrator разрулит через safe-editor.

Файлы для трибутов:
- Visual / animations / colors → CSS keyframes / inline styles в `client/src/components/CosmicHub/contacts/` или `Contacts/`
- Logic / state → `client/src/store/cosmic/slice.ts` или `client/src/game/contacts/pendingEngine.ts`
- Texts → `client/src/i18n/{ru,en,es}.json` под `cosmic_hub.contacts.*` или `races.<id>.chain.<step>.*`
- Chain structure → `client/src/game/config/raceChains.ts`
