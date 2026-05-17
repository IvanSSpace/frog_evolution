# Phase 22 Glossary Updates — TODO post-execution

Дата: 2026-05-17
Phase: 22-carrier-merge-redesign

После реализации Phase 22 (7 plans + cosmos gate + migration) обновить файлы в
`frog_obsidian/Glossary/`. Эти изменения **manual** — сделать в отдельной
sub-agent сессии (orchestrator + safe-editor), потому что cross-repository
работа и затрагивает author voice (Игроку / Намерение / Жаргон).

## Существующие — update sections

| Файл | Что менять | Sections | Status hint |
|------|-----------|----------|-------------|
| `Сыворотка.md` | Убрать секцию Rarity. «В коде» обновить на flat `Record<Element, number>`. «Связанные понятия» убрать «Редкость сыворотки». | В коде, Связанные понятия | intent_status: matches |
| `Пробуждённая лягушка.md` | Пометить устаревшим. В Phase 22 нет «пробуждения» через ceiling-feed — есть carrier→L18→ascension flow. | Намерение (если есть, переписать author), intent_status: removed | author edit required |
| `Стабилизация.md` | Пометить устаревшим. Stabilized больше не существует как состояние; carrier теперь не имеет ceiling. | intent_status: removed | author edit required |
| `Редкость сыворотки.md` | Пометить устаревшим. Серум-rarity полностью убран. | intent_status: removed | author edit required |
| `Эффект архетипа.md` | Обновить под 4-категорную схему (Огонь/Вода/Камень/Тень/Прочее) — Phase 22 archetype bonus pool (см. `client/src/utils/archetypeBonuses.ts`). 5 bonus keys: `flatGold`, `tractorGold`, `boxDropSpeed`, `offlineCap`, `serumDrop`. Mini bonuses от carriers на поле + full bonuses от ascended pool. | В коде, Намерение | author edit + В коде update |
| `Capтан.md` (если есть) | Обновить «Намерение» если cosmos-gate меняет flow capтанов. | Намерение | author edit |

## Создать новые файлы

| Файл | Описание |
|------|----------|
| `Ascended carrier.md` (или `Вознесённая лягушка.md`) | Объясняет L18 ascension flow: carrier достигает L18 → instant ascension tween (~1.5s) → исчезает с поля → permanent запись в `ascendedCarriers` pool → +1 essence + permanent archetype bonus. Поля: id/element/ascendedAt. См. `client/src/store/cosmic/types.ts AscendedCarrier`. |
| `Эссенция.md` | Новая meta-валюта. Источник: +1 за каждую ascension (placeholder magnitude — balance phase). Расход: Cosmic Shop (см. ниже). Persisted в `state.essence`. |
| `Космический магазин.md` | Новый shop UI в Cosmic Hub (🛒 tab). 6 items: cosmic_box (3 essence → 3 frogs L7), slot_plus_one (×2 scaling, essence), ship_speed (×2 scaling, essence), serum_drop_chance (×2 scaling, essence), skip_ship_cooldown (1 essence consumable), serum_trade_up (3 серум одного типа → 1 random, серум-валюта). См. `client/src/game/config/cosmicShop.ts` и `client/src/store/cosmic/shopSlice.ts`. |
| `Cosmos gate.md` (или `Открытие космоса.md`) | Описывает progressive disclosure mechanic: вся серум-машинерия (SerumBar, Cosmic Hub button, Star Map, серум-drop из боксов и миссий) скрыта/inactive до первого L18+L18 normal merge sentinel. После sentinel — реактивно открывается без reload. Триггер: `markCosmosUnlocked()` в MergeController. Hook: `useCosmosUnlocked()`. State: top-level `hasCosmosUnlocked: boolean` (persisted под отдельным ключом `frog_evolution_cosmos_unlocked`). |

## Drift entries (frog_obsidian/Drift/)

Если в `frog_obsidian/Drift/` есть files для:
- Пробуждение carriers (feed→ceiling→stabilize)
- Rarity серума
- mergeCarriers function

— пометить как **resolved** в Phase 22 (с указанием Plan 22-01 для cleanup и
22-02 для new merge rules).

## Меняем «В коде» секции

Глоссарий «В коде» секции этих terms должны быть обновлены автоматическим
сканом safe-editor или вручную:

- `Сыворотка.md`: указать `Record<Element, number>` shape (без rarity)
- `Лягушка-керриер.md` / `Carrier.md`: указать `{frogId, element, level}` (без rarity/stabilized/feedCount/ceiling)
- `Cosmic Hub.md` (если есть): добавить 5-й tab «Магазин» (shop, 🛒)
- `Бокс.md`: указать что `addBox` не имеет rarity dimension (rolling removed); серум drop при openBox/commitOpenedBox с +1 to `serums[element]`

## Execution checklist (для отдельной сессии)

```
[ ] 1. Запустить safe-editor против frog_obsidian/Glossary/ — scan на references к
       rarity / stabilized / feedCount / ceiling / mergeCarriers / Пробуждение
[ ] 2. Сводный report — где нужно обновление «В коде»
[ ] 3. Author review — пройтись по Намерение секциям для intent_status changes
[ ] 4. Create new entries (Ascended carrier, Эссенция, Космический магазин, Cosmos gate)
[ ] 5. Update _Glossary MOC.md если структурное добавление
[ ] 6. Optional: drift cleanup — закрыть resolved entries
```

## Cross-references

- Phase 22 SUMMARIES: `.planning/phases/22-carrier-merge-redesign/22-0[1-7]-SUMMARY.md`
- Source code: `client/src/store/cosmic/`, `client/src/utils/cosmosGate.ts`,
  `client/src/utils/archetypeBonuses.ts`, `client/src/game/config/cosmicShop.ts`,
  `client/src/store/migrations/phase22.ts`
- Design note: `frog_obsidian/Design Notes/2026-05-17-carrier-merge-redesign.md`
- Smoke test: `.planning/phases/22-carrier-merge-redesign/SMOKE_TEST_22.md`

---

**Эти обновления — separate task в `frog_obsidian/`, не часть Phase 22
implementation (cross-repository edits). Запускать вручную после code review
и smoke approval.**
