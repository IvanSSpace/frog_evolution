# Smoke Test — Phase 31: Universe Restart

**Date:** 2026-06-11
**Version:** b7612be (plan 31-06 complete)

---

## Быстрая проверка (без рестарта)

В DevTools Console:

```js
// l19Count начинается с 0
useGameStore.getState().l19Count   // → 0

// LocationStack: иконка ♻️ видна (если cosmos unlocked)
// FrogShopModal: нет вкладки "Эволюция"
```

---

## Сценарий A: Счётчик L19 растёт

**Предусловие:** cosmos unlocked (`useGameStore.getState().hasCosmosUnlocked === true`)

1. DevTools: `useGameStore.getState().l19Count` — должен быть 0
2. Произвести merge L18+L18 на поле (или DevTools: `useGameStore.getState().incrementL19Count()`)
3. **Ожидание:** `l19Count` стал 1 в store
4. Повторить 4 раза итого → `l19Count === 5`
5. DevTools: `useGameStore.getState().l19Count` — должен показывать 5

- [ ] PASS / FAIL: ___

---

## Сценарий B: Новая локация ♻️ в LocationStack

**Предусловие:** `hasCosmosUnlocked === true`

1. В панели локаций (LocationStack) должна появиться иконка ♻️
2. Клик на иконку открывает overlay «Перезапуск вселенной» (Universe Progress Screen)
3. Overlay показывает прогресс-бар l19Count / 5
4. При l19Count < 5 кнопка «Перезапустить» — disabled (неактивна)
5. DevTools для быстрой проверки: `useGameStore.setState({l19Count:5})` → кнопка становится активной

- [ ] PASS / FAIL: ___

---

## Сценарий C: Рестарт вайпает прогресс и поднимает baseTier

> **ВНИМАНИЕ: Рестарт необратим. Делать на тестовом аккаунте!**

1. Выставить l19Count >= 5: `useGameStore.setState({l19Count:5})`
2. Открыть Universe Progress Screen — кнопка «Перезапустить вселенную» должна стать активной
3. Нажать кнопку → появляется confirm modal
4. Нажать «Перезапустить» в confirm → страница перезагружается
5. **После reload проверить в DevTools:**

```js
useGameStore.getState().gold            // → 0
useGameStore.getState().locationFrogs   // → [[1], [], []]
useGameStore.getState().discoveredLevels // → [1]
useGameStore.getState().baseTier        // → 1 (первый рестарт)
useGameStore.getState().universeRestartCount // → 1
useGameStore.getState().l19Count        // → 0
useGameStore.getState().hasCosmosUnlocked   // → true (сохранилось)
useGameStore.getState().l18MergesCount  // → 0
useGameStore.getState().l18AbsoluteBonusPerSec // → 0
```

6. Космос, бестиарий, носители — должны сохраниться

- [ ] PASS / FAIL: ___

---

## Сценарий D: baseTier влияет на доход (income multiplier)

1. После первого рестарта `baseTier === 1`
2. Подождать накопление золота — доход должен быть на 10% выше чем в новой вселенной
3. DevTools: `useGameStore.getState().baseTier` → 1
4. Tooltip в Header или GalleryModal должен показывать бонус от baseTier

Альтернативная проверка без рестарта:
```js
// Выставить baseTier вручную
useGameStore.setState({baseTier: 2})
// addGold вызовет income с multiplier = 1 + 0.10*2 = 1.20 (+20%)
```

- [ ] PASS / FAIL: ___

---

## Сценарий E: Старая эволюция отсутствует

1. Открыть FrogShopModal (кнопка ПРОКАЧКА / магазин)
2. **Ожидание:** нет вкладки «Эволюция»; только вкладки «Купить» (и другие)
3. Нет EvolutionCeremony анимации при любых действиях
4. DevTools: нет полей frogTiers/frogTierCooldowns/upgradeFrogTier в store

```js
useGameStore.getState().frogTiers   // → undefined
```

- [ ] PASS / FAIL: ___

---

## Сценарий F: Старый сейв мигрирует (backward compat)

1. DevTools → Application → Local Storage
2. Найти ключи `frog_evolution_l19_count`, `frog_evolution_base_tier`, `frog_evolution_restart_count`
3. Удалить эти ключи (или весь localStorage)
4. Перезагрузить страницу
5. **Ожидание:** приложение загружается без краша
6. DevTools проверить:

```js
useGameStore.getState().l19Count            // → 0
useGameStore.getState().baseTier            // → 0
useGameStore.getState().universeRestartCount // → 0
```

- [ ] PASS / FAIL: ___

---

## Сценарий G: baseTier cap (максимум 2)

1. После 2-х рестартов: `baseTier === 2`
2. Нажать кнопку 3-го рестарта
3. **Ожидание:** baseTier остаётся 2 (не становится 3)
4. `universeRestartCount` продолжает расти (3, 4, ...)

DevTools быстрая проверка:
```js
// Симуляция ответа сервера с base_tier=99
useGameStore.getState().applyRestartState({base_tier:99, universe_restart_count:3, l19_count:0, version:10})
useGameStore.getState().baseTier  // → 2 (не 99)
```

- [ ] PASS / FAIL: ___

---

## Сценарий H: Нет 409 reload-loop после рестарта

1. Выполнить рестарт (Сценарий C)
2. После reload страницы наблюдать за Network в DevTools
3. **Ожидание:** нет повторных запросов `/game/restart` в loop
4. Нет бесконечного обновления страницы
5. Игра нормально загружается и сохраняет состояние

- [ ] PASS / FAIL: ___

---

## Final Checklist (автоматические гейты)

- [ ] `npx tsc --noEmit` (в client/): 0 ошибок
- [ ] `npx vitest run` (в client/): все тесты зелёные (9 pre-existing cosmic failures — допустимы)
- [ ] `./node_modules/.bin/vite build` (в client/): успешен, нет build errors
- [ ] Нет console errors в браузере при нормальной игре (до рестарта)
- [ ] Нет 409 reload loop после рестарта (Сценарий H)

---

## Pre-existing vitest failures (задокументированы, не блокеры)

Следующие 9 тестов падают до Phase 31 и НЕ вызваны этой фазой:

| Файл | Тест | Причина drift |
|------|------|---------------|
| `archetypeBonuses.test.ts` | Tests 2, 7, 9 | Логика aggregateFullBonuses/aggregateMiniBonuses изменилась; тест не обновлён |
| `shopSlice.test.ts` | Tests 2b, 2c | Costs конфига cosmic shop изменились; тест ожидает старые значения |
| `slice.openBox.test.ts` | Tests 5, 6, и другие | NaN в serum count — drift в openBox action |

Эти failures существуют с Phase 22/25 и дожны быть исправлены отдельно.
