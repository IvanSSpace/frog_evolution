# Progressive Location Unlock — Design

**Date:** 2026-05-11
**Status:** Approved (design phase)
**Owner:** orchestrator → writing-plans next

## Problem

В текущей версии LocationStack показывает все 4 фарм-локации + Звёздную карту одновременно с момента старта новой игры. Игрок видит цели, до которых ему ещё годы прогрессии. Хочется поэтапного раскрытия: каждая следующая локация открывается, когда игрок впервые получает лягушку соответствующего уровня. Звёздная карта (космос) — финальное событие, открываемое мерджем L24+L24.

## Goals

1. Запертые локации полностью скрыты в LocationStack.
2. Триггер анлока — первый спавн лягушки `minLevel` локации (через мердж).
3. Cosmos открывается мерджем L24+L24 без материализации L25.
4. LocationStack не рендерится, пока разблокирована только одна локация (Болото — старт).
5. Каждый анлок проигрывает «комикс» (пока placeholder, контент позже).
6. Существующие сейвы (включая dev-сейв пользователя) автоматически получают правильное состояние без отдельного миграционного кода.

## Non-goals

- Полноценные кадры комикса (это контент-задача, делается отдельно).
- `seenComics: number[]` persist (повторное проигрывание при reload приемлемо для pre-release).
- L25 как материализованная лягушка с дальнейшей игровой механикой (явно отложено — «следующие соединения пока не придуманы»).
- Анимация fly-in новой иконки в LocationStack (отдельная задача, может быть добавлена позже).
- UI кнопки «вернуться к комиксу позже» — комикс играется один раз in-the-moment.

## Approach

**Derived state.** Никаких новых полей в game store / persistence. Анлок-состояние — чистая производная от уже существующего `discoveredLevels: number[]`.

- `discoveredLevels.includes(7)` → Лес открыт
- `discoveredLevels.includes(13)` → Континент открыт
- `discoveredLevels.includes(19)` → Планета открыта
- `discoveredLevels.includes(25)` → Звёздная карта открыта (sentinel: L25 не материализуется, на merge L24+L24 вызывается `markDiscovered(25)` искусственно)
- Болото (id=1) всегда открыто

## Components

### Новые файлы

1. `client/src/game/config/locationUnlocks.ts` — pure helpers
   - Константа `LOCATION_UNLOCK_THRESHOLD: Record<number, number>` — locationId → minDiscoveredLevel
   - `getUnlockedLocations(discovered: number[]): Set<number>`
   - `isLocationUnlocked(id: number, discovered: number[]): boolean`
   - Константа `LOCATION_BY_TRIGGER_LEVEL: Record<number, number>` — обратный маппинг: level → locationId (7→2, 13→3, 19→4, 25→6)
   - `getLocationUnlockedByLevel(level: number): number | null` — для использования в MergeController

2. `client/src/ui/components/UnlockComic/UnlockComic.tsx` — модальный плеер комикса
   - Props: `locationId: number`, `onClose: () => void`
   - Рендерит массив кадров из `COMIC_FRAMES[locationId]`
   - Кнопка «Дальше» — переход кадра; на последнем — закрытие
   - Стиль повторяет существующий `FrogUnlockModal` (full-screen overlay, центрированный текст, кнопка снизу)

3. `client/src/ui/components/UnlockComic/frames.ts` — placeholder контент
   - `export const COMIC_FRAMES: Record<number, ComicFrame[]>`
   - 2 → `[{text: 'Лес открыт'}]`
   - 3 → `[{text: 'Континент открыт'}]`
   - 4 → `[{text: 'Планета открыта'}]`
   - 6 → `[{text: 'Звёздная карта открыта'}]`
   - Тип `ComicFrame = { text: string; imageUrl?: string }` — расширяемо

### Изменяемые файлы

4. `client/src/ui/components/LocationStack.tsx`
   - Импорт `getUnlockedLocations`
   - Subscribe на `discoveredLevels`
   - Фильтр `ordered = ordered.filter(loc => unlocked.has(loc.id))`
   - Early-return `if (ordered.length < 2) return null` — прячем весь стек если только Болото

5. `client/src/game/scenes/main/MergeController.ts`
   - После успешного merge на `newLevel`:
     - Уже есть вызов `markDiscovered(newLevel)` (проверить и переиспользовать; если нет — добавить)
     - Если merge даёт L24+L24 (новый кейс) — обе лягушки уничтожаются, материализации L25 нет, и вызывается `markDiscovered(25)` + emit `'location:unlocked'` с `locationId: 6`
   - Для обычных уровней (7/13/19): если `markDiscovered` вернул true И `getLocationUnlockedByLevel(newLevel) !== null` — emit `'location:unlocked'` с `locationId: getLocationUnlockedByLevel(newLevel)`
   - Маппинг level → locationId — через `LOCATION_BY_TRIGGER_LEVEL` (определён в `locationUnlocks.ts`)

6. `client/src/App.tsx` (или новый `UnlockComicManager.tsx`)
   - Top-level listener на `'location:unlocked'`
   - State `activeUnlock: number | null`
   - Рендер `{activeUnlock && <UnlockComic locationId={activeUnlock} onClose={() => setActiveUnlock(null)} />}`

7. `client/src/ui/components/FrogUnlockModal.tsx` (или местоэквивалент)
   - Подавить открытие для `level === 25` (там играет комикс)
   - `if (level === 25) return null` или эквивалент в trigger-логике

### Event bus

Новый событие:
- `'location:unlocked'` — payload `{ locationId: number }`
- Эмиттер: `MergeController`
- Слушатель: `App.tsx` / `UnlockComicManager`

## Data Flow

```
merge L24+L24 на Планете
  → MergeController:
      обе L24 destroy
      markDiscovered(25) returns true
      eventBus.emit('location:unlocked', { locationId: 6 })
  → App.tsx UnlockComicManager: setActiveUnlock(6)
  → <UnlockComic locationId={6} /> рендерится
  → игрок жмёт «Дальше» (1 кадр placeholder)
  → onClose → setActiveUnlock(null)
  → LocationStack пересчитывает: discoveredLevels.includes(25) → true
  → Звёздная карта появляется в стеке (тап → старый flow открытия)
```

Для уровней 7/13/19:
```
merge → newLevel=7 (например)
  → markDiscovered(7) returns true
  → emit 'location:unlocked' { locationId: 2 }
  → комикс Леса → закрыть → Лес виден в LocationStack
```

## Migration

Не требуется. `discoveredLevels` у существующих игроков уже содержит правильные значения исторически (каждый markDiscovered происходил при первом спавне лягушки уровня). Игрок с L13 в истории прогресса автоматически имеет Болото+Лес+Континент после внедрения фичи.

L25 sentinel НЕ backfill-ится для cosmic-state-юзеров. Проект pre-release, нет production-юзеров с прогрессом в космосе. Если такие появятся в DEV-сейвах — есть утилита `__unlockAllLocations()` (см. ниже).

## Dev helpers

В `client/src/utils/devHelpers.ts` добавить (под `import.meta.env.DEV`):

```ts
window.__unlockAllLocations = () => {
  useGameStore.setState({ discoveredLevels: [1, 7, 13, 19, 25] })
  console.log('[dev] all locations unlocked')
}

window.__lockAllLocations = () => {
  useGameStore.setState({ discoveredLevels: [] })
  console.log('[dev] all locations locked (back to start)')
}
```

## Edge cases

1. **L25 нет в `FROG_LEVELS`** — `markDiscovered(25)` валидно (number[] принимает любое значение); `configForLevel(25)` вернёт `FROG_LEVELS[23]` (последний реальный, из-за `Math.min(level-1, length-1)`), но это вызывается только если что-то рендерит L25 как лягушку — таких путей не должно быть.
2. **Двойной emit `'location:unlocked'`** — `markDiscovered` возвращает `false` если уровень уже был → emit только при первой регистрации, защита автоматическая.
3. **Перезаход в игру во время комикса** — комикс non-persistent, при reload пропускается. Acceptable для placeholder; будущий контент потребует `seenComics: number[]` persist.
4. **Космос разблокирован, но игрок ещё на Болоте** — LocationStack показывает обе иконки; тап по Космосу → существующий `eventBus.emit('starmap:open')` через `handleSelect`.
5. **Звёздная карта — единственная вторая открытая** — стек видим (2 элемента), работает без особых случаев.
6. **Игрок открывает игру первый раз** — `discoveredLevels = []`, `getUnlockedLocations` возвращает `{1}`, LocationStack делает early-return null. Видна только сцена болота.

## Testing

### Unit (vitest)

`locationUnlocks.spec.ts`:
- `getUnlockedLocations([])` → `{1}`
- `getUnlockedLocations([1])` → `{1}`
- `getUnlockedLocations([1, 7])` → `{1, 2}`
- `getUnlockedLocations([1, 7, 13])` → `{1, 2, 3}`
- `getUnlockedLocations([1, 7, 13, 19])` → `{1, 2, 3, 4}`
- `getUnlockedLocations([1, 7, 13, 19, 25])` → `{1, 2, 3, 4, 6}`
- `getUnlockedLocations([1, 25])` (corrupted: космос но не Лес) → `{1, 6}` — толерантность

`UnlockComic.test.tsx`:
- Рендер первого кадра
- Кнопка «Дальше» переключает на следующий кадр
- Кнопка «Дальше» на последнем кадре → `onClose` вызван

`MergeController` (расширение существующих тестов):
- merge L6+L6 → newLevel=7 → emit `'location:unlocked'` с `locationId: 2` (первый раз)
- merge L7+L7 → newLevel=8 → emit НЕ происходит (8 не в threshold)
- merge L6+L6 второй раз → `markDiscovered(7)` returns false → emit НЕ происходит
- merge L24+L24 → обе исчезают, no L25 spawn, emit `'location:unlocked'` с `locationId: 6`

### Manual smoke (после impl)

1. Чистый сейв (`__lockAllLocations()` + reload) → LocationStack скрыт → сцена болота видна
2. `__addDevFrog(7, 'planet1')` или через мердж → доходим до L7 → комикс Леса → закрыть → видны Болото+Лес
3. До L13 → комикс Континента → видны 3 локации
4. До L19 → комикс Планеты → видны 4 локации
5. Симулировать merge L24+L24 → комикс Звёздной карты → видна 5-я иконка
6. Тап по Звёздной карте → переход в StarMap, как прежде

## Glossary impact

После реализации потребуется обновить (только подсказки автору, sub-agent не редактирует glossary):

- **Звёздная карта.md** — добавить условие unlock (merge L24+L24 на Планете) в «В коде» или новый раздел.
- **Локация.md** (если есть) — новый concept «закрытая локация», ссылка на helper `locationUnlocks.ts`.
- **Соединение.md** — упомянуть, что мерджи на L7, L13, L19, L24+L24 триггерят unlock-события (события игрового прогресса).
- **Лес.md / Континент.md / Планета.md** — если есть отдельные файлы, добавить условие unlock.

## Open questions

Для phase plan уточнить:

1. **Текущее поведение `MergeController` для L24+L24** — производит ли он L25 (которой нет в FROG_LEVELS), фейлится ли silent, или производит fallback на L24? Нужно прочитать `merge` логику и явно решить как изменить путь:
   - Вариант A: добавить early-return для `newLevel === 25` (обе лягушки уничтожаются, no spawn, emit unlock)
   - Вариант B: оставить general path, но в spawn-стадии проверка отсутствия `FROG_LEVELS[level-1]` → суппрессия + emit unlock
   - Вариант A более явный, рекомендуется.

2. **Где именно подавляется FrogUnlockModal для L25** — в trigger-источнике (там где `markDiscovered` вызывает модалку) или внутри самой модалки? Это решит plan-phase после изучения текущей trigger-логики.
