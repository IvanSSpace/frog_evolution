# Progressive Location Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Скрыть фарм-локации в `LocationStack` до достижения соответствующего уровня лягушки. Космос (Звёздная карта) открывается только после мерджа L24+L24 на Планете. Каждый анлок проигрывает placeholder-комикс.

**Architecture:** Derived state — анлок-флаги выводятся из существующего `discoveredLevels: number[]`. Добавляется один pure-helper модуль (`locationUnlocks.ts`), один React-компонент-плеер (`UnlockComic`), правки в `LocationStack` / `MergeController` / `App.tsx`. Никаких новых persisted-полей.

**Tech Stack:** TypeScript, React 19, Zustand, Vitest, Phaser 3 (только событийная шина).

**Spec reference:** `frog_evolution_code/docs/superpowers/specs/2026-05-11-progressive-location-unlock-design.md`

---

## File Structure

### Создаются
- `client/src/game/config/locationUnlocks.ts` — pure helpers (constant + 2 functions)
- `client/src/game/config/locationUnlocks.test.ts` — vitest юнит-тесты
- `client/src/ui/components/UnlockComic/UnlockComic.tsx` — модальный плеер комикса
- `client/src/ui/components/UnlockComic/frames.ts` — placeholder-кадры

### Изменяются
- `client/src/ui/components/LocationStack.tsx` — фильтр locations + early-return при <2 разблокированных
- `client/src/game/scenes/main/MergeController.ts` — emit `'location:unlocked'` после `markDiscovered` + новый кейс L24+L24
- `client/src/App.tsx` — слушатель `'location:unlocked'`, рендер `<UnlockComic>`, подавление DiscoveryModal для L25, dev-helpers `__unlockAllLocations` / `__lockAllLocations`
- `client/src/store/eventBus.ts` — регистрация нового события (только если bus типизирован)

---

## Task 1 — Pure helper `locationUnlocks.ts`

**Files:**
- Create: `client/src/game/config/locationUnlocks.ts`
- Test: `client/src/game/config/locationUnlocks.test.ts`

- [ ] **Step 1: Write failing test**

Create `client/src/game/config/locationUnlocks.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  getUnlockedLocations,
  isLocationUnlocked,
  getLocationUnlockedByLevel,
  LOCATION_UNLOCK_THRESHOLD,
  LOCATION_BY_TRIGGER_LEVEL,
} from './locationUnlocks'

describe('LOCATION_UNLOCK_THRESHOLD', () => {
  it('defines threshold for all 5 locations', () => {
    expect(LOCATION_UNLOCK_THRESHOLD).toEqual({
      1: 0,
      2: 7,
      3: 13,
      4: 19,
      6: 25,
    })
  })
})

describe('LOCATION_BY_TRIGGER_LEVEL', () => {
  it('reverse maps trigger levels to location ids', () => {
    expect(LOCATION_BY_TRIGGER_LEVEL).toEqual({
      7: 2,
      13: 3,
      19: 4,
      25: 6,
    })
  })
})

describe('getUnlockedLocations', () => {
  it('returns only Болото on empty discovered', () => {
    expect(getUnlockedLocations([])).toEqual(new Set([1]))
  })

  it('Лес opens when L7 discovered', () => {
    expect(getUnlockedLocations([1, 7])).toEqual(new Set([1, 2]))
  })

  it('Континент opens when L13 discovered', () => {
    expect(getUnlockedLocations([1, 7, 13])).toEqual(new Set([1, 2, 3]))
  })

  it('Планета opens when L19 discovered', () => {
    expect(getUnlockedLocations([1, 7, 13, 19])).toEqual(new Set([1, 2, 3, 4]))
  })

  it('Звёздная карта opens when L25 sentinel discovered', () => {
    expect(getUnlockedLocations([1, 7, 13, 19, 25])).toEqual(
      new Set([1, 2, 3, 4, 6]),
    )
  })

  it('tolerates non-contiguous discovery (corrupted save)', () => {
    expect(getUnlockedLocations([1, 25])).toEqual(new Set([1, 6]))
  })

  it('intermediate levels do not unlock locations', () => {
    expect(getUnlockedLocations([1, 2, 3, 4, 5, 6])).toEqual(new Set([1]))
  })
})

describe('isLocationUnlocked', () => {
  it('returns true for Болото always', () => {
    expect(isLocationUnlocked(1, [])).toBe(true)
  })

  it('returns false for Лес when L7 not discovered', () => {
    expect(isLocationUnlocked(2, [1, 6])).toBe(false)
  })

  it('returns true for Лес when L7 discovered', () => {
    expect(isLocationUnlocked(2, [7])).toBe(true)
  })

  it('returns false for unknown location id', () => {
    expect(isLocationUnlocked(99, [1, 7, 13, 19, 25])).toBe(false)
  })
})

describe('getLocationUnlockedByLevel', () => {
  it('returns location id for trigger levels', () => {
    expect(getLocationUnlockedByLevel(7)).toBe(2)
    expect(getLocationUnlockedByLevel(13)).toBe(3)
    expect(getLocationUnlockedByLevel(19)).toBe(4)
    expect(getLocationUnlockedByLevel(25)).toBe(6)
  })

  it('returns null for non-trigger levels', () => {
    expect(getLocationUnlockedByLevel(1)).toBe(null)
    expect(getLocationUnlockedByLevel(8)).toBe(null)
    expect(getLocationUnlockedByLevel(24)).toBe(null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```
cd frog_evolution_code/client && npx vitest run src/game/config/locationUnlocks.test.ts
```
Expected: FAIL with "Cannot find module './locationUnlocks'"

- [ ] **Step 3: Write minimal implementation**

Create `client/src/game/config/locationUnlocks.ts`:

```typescript
// Progressive location unlock — derived state from discoveredLevels.
//
// Болото (id=1) — всегда открыто.
// Остальные локации открываются когда соответствующий уровень лягушки
// впервые регистрируется в discoveredLevels. L25 — sentinel
// (см. MergeController: при merge L24+L24 вызывается markDiscovered(25)
// без материализации L25).
//
// См. spec: docs/superpowers/specs/2026-05-11-progressive-location-unlock-design.md

export const LOCATION_UNLOCK_THRESHOLD: Readonly<Record<number, number>> = {
  1: 0, // Болото — всегда открыто (0 = no threshold)
  2: 7, // Лес
  3: 13, // Континент
  4: 19, // Планета
  6: 25, // Звёздная карта (sentinel, merge L24+L24)
} as const

export const LOCATION_BY_TRIGGER_LEVEL: Readonly<Record<number, number>> = {
  7: 2,
  13: 3,
  19: 4,
  25: 6,
} as const

export function getUnlockedLocations(discovered: number[]): Set<number> {
  const unlocked = new Set<number>()
  for (const [locId, threshold] of Object.entries(LOCATION_UNLOCK_THRESHOLD)) {
    if (threshold === 0 || discovered.includes(threshold)) {
      unlocked.add(Number(locId))
    }
  }
  return unlocked
}

export function isLocationUnlocked(
  id: number,
  discovered: number[],
): boolean {
  return getUnlockedLocations(discovered).has(id)
}

export function getLocationUnlockedByLevel(level: number): number | null {
  return LOCATION_BY_TRIGGER_LEVEL[level] ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```
cd frog_evolution_code/client && npx vitest run src/game/config/locationUnlocks.test.ts
```
Expected: PASS all tests (16 assertions)

- [ ] **Step 5: Targeted ESLint**

Run:
```
cd frog_evolution_code/client && npx eslint src/game/config/locationUnlocks.ts src/game/config/locationUnlocks.test.ts
```
Expected: no errors

- [ ] **Step 6: Commit**

```
cd frog_evolution_code && git add client/src/game/config/locationUnlocks.ts client/src/game/config/locationUnlocks.test.ts
git commit -m "feat(unlock): pure helper for location-unlock derivation from discoveredLevels"
```

---

## Task 2 — Placeholder frames

**Files:**
- Create: `client/src/ui/components/UnlockComic/frames.ts`

- [ ] **Step 1: Write the content file**

Create `client/src/ui/components/UnlockComic/frames.ts`:

```typescript
// Placeholder контент для UnlockComic. Финальные кадры (текст + картинки)
// будут добавлены автором отдельной задачей; сейчас один кадр на локацию.

export type ComicFrame = {
  text: string
  imageUrl?: string // зарезервировано для будущих финальных кадров
}

export const COMIC_FRAMES: Readonly<Record<number, ComicFrame[]>> = {
  2: [{ text: 'Лес открыт' }],
  3: [{ text: 'Континент открыт' }],
  4: [{ text: 'Планета открыта' }],
  6: [{ text: 'Звёздная карта открыта' }],
} as const
```

- [ ] **Step 2: Targeted ESLint**

Run:
```
cd frog_evolution_code/client && npx eslint src/ui/components/UnlockComic/frames.ts
```
Expected: no errors

- [ ] **Step 3: Commit**

```
cd frog_evolution_code && git add client/src/ui/components/UnlockComic/frames.ts
git commit -m "feat(unlock): placeholder comic frames for new-location reveal"
```

---

## Task 3 — `UnlockComic` React component

**Files:**
- Create: `client/src/ui/components/UnlockComic/UnlockComic.tsx`

Note: проект не использует @testing-library/react. React-рендеринг проверяется только manual smoke. Внутренняя логика state-перехода кадров достаточно проста (useState index), unit-тест не оправдывает добавление RTL.

- [ ] **Step 1: Implement the component**

Create `client/src/ui/components/UnlockComic/UnlockComic.tsx`:

```tsx
import { useState } from 'react'
import { COMIC_FRAMES } from './frames'

interface UnlockComicProps {
  locationId: number
  onClose: () => void
}

export function UnlockComic({ locationId, onClose }: UnlockComicProps) {
  const frames = COMIC_FRAMES[locationId]
  const [index, setIndex] = useState(0)

  if (!frames || frames.length === 0) {
    // Защита от вызова с неизвестным locationId — закрываем сразу.
    // Не должно случаться при штатном emit из MergeController.
    queueMicrotask(onClose)
    return null
  }

  const isLast = index >= frames.length - 1
  const handleNext = () => {
    if (isLast) onClose()
    else setIndex((i) => i + 1)
  }

  const frame = frames[index]

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center"
      onClick={handleNext}
    >
      <div className="bg-neutral-900 rounded-2xl p-8 max-w-md mx-4 text-center">
        <div className="text-white text-2xl font-bold mb-6">{frame.text}</div>
        <button
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
          onClick={(e) => {
            e.stopPropagation()
            handleNext()
          }}
        >
          {isLast ? 'Готово' : 'Дальше'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Targeted ESLint**

Run:
```
cd frog_evolution_code/client && npx eslint src/ui/components/UnlockComic/UnlockComic.tsx
```
Expected: no errors

- [ ] **Step 3: Commit**

```
cd frog_evolution_code && git add client/src/ui/components/UnlockComic/UnlockComic.tsx
git commit -m "feat(unlock): UnlockComic modal player component"
```

---

## Task 4 — Filter LocationStack by unlocked

**Files:**
- Modify: `client/src/ui/components/LocationStack.tsx`

- [ ] **Step 1: Read current file to find exact substring**

Run:
```
cd frog_evolution_code && cat client/src/ui/components/LocationStack.tsx | head -80
```

Identify these regions (line numbers from current HEAD before edits):
- Line 9: `import { eventBus } ...` — добавить импорт `getUnlockedLocations` рядом
- Lines 36-37: `useGameStore` selectors — добавить `discoveredLevels`
- Lines 73-77: `const ordered: LocationConfig[] = [...]` — добавить фильтр и early-return

- [ ] **Step 2: Apply edits**

Add import after line 9 (existing imports):

```typescript
import { getUnlockedLocations } from '../../game/config/locationUnlocks'
```

Replace the `const currentLocation = useGameStore(...)` / `setCurrentLocation` block (lines 36-37):

```typescript
  const currentLocation = useGameStore((s) => s.currentLocation)
  const setCurrentLocation = useGameStore((s) => s.setCurrentLocation)
  const discoveredLevels = useGameStore((s) => s.discoveredLevels)
```

Replace the `ordered` definition (lines 73-77):

```typescript
  // Сверху вниз: 6 (Звёздная карта) → 4 → 3 → 2 → 1
  const unlocked = getUnlockedLocations(discoveredLevels)
  const ordered: LocationConfig[] = [
    STAR_MAP_PROTOTYPE_LOC,
    ...[...LOCATIONS].slice().reverse(),
  ].filter((loc) => unlocked.has(loc.id))

  // Скрываем весь стек когда открыта только одна локация (Болото)
  if (ordered.length < 2) return null
```

- [ ] **Step 3: Targeted ESLint**

Run:
```
cd frog_evolution_code/client && npx eslint src/ui/components/LocationStack.tsx
```
Expected: no errors

- [ ] **Step 4: Manual sanity (DevTools)**

Открой игру, в Console:
```js
const s = (await import('/src/store/gameStore.ts')).useGameStore
s.setState({ discoveredLevels: [] })
// должен исчезнуть LocationStack целиком
s.setState({ discoveredLevels: [1, 7] })
// должны появиться Болото + Лес
```

(Это smoke-проверка по месту; не обязательно блокирует commit, но прогоняется перед коммитом.)

- [ ] **Step 5: Commit**

```
cd frog_evolution_code && git add client/src/ui/components/LocationStack.tsx
git commit -m "feat(unlock): hide locked locations + early-return when only Болото"
```

---

## Task 5 — Emit `'location:unlocked'` event from MergeController

**Files:**
- Modify: `client/src/game/scenes/main/MergeController.ts`

⚠️ **Danger zone:** `client/src/game/scenes/main/*` входит в danger-zone согласно safe-editor.md. Этот task **требует явного подтверждения orchestrator/user перед редактированием**. План протокола:
- Изменяем 3 места где `markDiscovered(newLevel)` уже вызывается (строки 268-269, 390-391, 523-524 в текущем HEAD)
- Добавляем новый ветвь для L24+L24 → suppress L24 spawn, markDiscovered(25), emit
- Гейты: vitest для cosmic-store, targeted eslint для самого файла
- Возврат с планом, ожидание подтверждения, только потом edit

- [ ] **Step 1: Locate and read current emit points**

Run:
```
cd frog_evolution_code && grep -n "markDiscovered(newLevel)" client/src/game/scenes/main/MergeController.ts
```

Expected: 3 строки (приблизительно 268, 390, 523).

- [ ] **Step 2: Import helper**

Add to imports at top of `MergeController.ts`:

```typescript
import { getLocationUnlockedByLevel } from '../../config/locationUnlocks'
```

- [ ] **Step 3: Update each of 3 emit sites**

В каждом из 3 мест замени:

```typescript
const wasNew = store.markDiscovered(newLevel)
if (wasNew) eventBus.emit('frog:discovered', { level: newLevel })
```

на:

```typescript
const wasNew = store.markDiscovered(newLevel)
if (wasNew) {
  eventBus.emit('frog:discovered', { level: newLevel })
  const unlockedLocId = getLocationUnlockedByLevel(newLevel)
  if (unlockedLocId !== null) {
    eventBus.emit('location:unlocked', { locationId: unlockedLocId })
  }
}
```

⚠️ В одном из 3 мест переменная названа `storeS` (не `store`) — используй ту переменную, которая в локальном scope. Проверь grep'ом перед каждой заменой.

- [ ] **Step 4: Add L24+L24 special path**

Найди в `performMerge` строку (~225):
```typescript
const newLevel = Math.min(a.level + 1, MAX_LEVEL)
```

Замени блок начиная с этой строки на:

```typescript
// L24+L24 — special path: лягушки сгорают, L25 не материализуется,
// триггерится unlock Звёздной карты.
if (a.level === MAX_LEVEL && b.level === MAX_LEVEL) {
  const store = useGameStore.getState()
  const currentLocId = store.currentLocation
  store.removeFrogFromLocation(currentLocId, MAX_LEVEL)
  store.removeFrogFromLocation(currentLocId, MAX_LEVEL)
  this.spawner.destroyFrog(a)
  this.spawner.destroyFrog(b)
  const wasNew = store.markDiscovered(25)
  if (wasNew) {
    eventBus.emit('location:unlocked', { locationId: 6 })
  }
  return
}

const newLevel = Math.min(a.level + 1, MAX_LEVEL)
```

⚠️ Проверь имя метода `destroyFrog` — если в spawner нет такого, используй `a.container.destroy()` напрямую (читай FrogSpawner.ts перед этим step'ом). Адаптируй под реальный API.

- [ ] **Step 5: Type-augment eventBus (если нужно)**

Run:
```
cd frog_evolution_code && grep -n "frog:discovered\|location:unlocked\|EventMap\|type.*Event" client/src/store/eventBus.ts
```

Если `eventBus.ts` строго типизирован через EventMap — добавь:
```typescript
'location:unlocked': { locationId: number }
```
к карте типов. Если bus untyped (any payload) — пропусти этот step.

- [ ] **Step 6: Run targeted vitest for cosmic store**

Run:
```
cd frog_evolution_code/client && npx vitest run src/store/cosmic --reporter=verbose
```
Expected: все существующие тесты проходят без регрессии.

- [ ] **Step 7: Targeted ESLint**

Run:
```
cd frog_evolution_code/client && npx eslint src/game/scenes/main/MergeController.ts
```
Expected: no errors

- [ ] **Step 8: Manual smoke (DevTools)**

В Console:
```js
const s = (await import('/src/store/gameStore.ts')).useGameStore
s.setState({ discoveredLevels: [] })
// слей две L6 на Болоте → newLevel=7 → должен попасть в network tab event 'location:unlocked'
// (или просто проверь что useGameStore.getState().discoveredLevels.includes(7))
```

- [ ] **Step 9: Commit**

```
cd frog_evolution_code && git add client/src/game/scenes/main/MergeController.ts client/src/store/eventBus.ts
git commit -m "feat(unlock): emit 'location:unlocked' on threshold merges + L24×2 sentinel"
```

---

## Task 6 — Wire UnlockComic + suppress DiscoveryModal for L25 + dev helpers

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add UnlockComic import + state**

В App.tsx, рядом с другими top-level импортами:
```typescript
import { UnlockComic } from './ui/components/UnlockComic/UnlockComic'
```

В функции компонента (рядом с `const [discovered, setDiscovered] = useState<number | null>(null)`):
```typescript
const [unlockedLocation, setUnlockedLocation] = useState<number | null>(null)
```

- [ ] **Step 2: Add event listener в useEffect**

В useEffect где уже подписан `'frog:discovered'`, добавь после него:
```typescript
const onLocationUnlocked = ({ locationId }: { locationId: number }) => {
  setUnlockedLocation(locationId)
}
eventBus.on('location:unlocked', onLocationUnlocked)
```

И в cleanup-return:
```typescript
eventBus.off('location:unlocked', onLocationUnlocked)
```

- [ ] **Step 3: Suppress DiscoveryModal for L25**

Найди существующий блок:
```typescript
const onDiscovered = ({ level }: { level: number }) => {
  devLog('[discovery] new level:', level)
  setTimeout(() => setDiscovered(level), 250)
}
```

Замени на:
```typescript
const onDiscovered = ({ level }: { level: number }) => {
  // L25 — sentinel для unlock Звёздной карты, не лягушка.
  // Подавляем DiscoveryModal — играется UnlockComic вместо.
  if (level === 25) return
  devLog('[discovery] new level:', level)
  setTimeout(() => setDiscovered(level), 250)
}
```

- [ ] **Step 4: Render UnlockComic**

Найди существующий блок `{discovered !== null && (<DiscoveryModal .../>)}`. Сразу под ним добавь:

```tsx
{unlockedLocation !== null && (
  <UnlockComic
    locationId={unlockedLocation}
    onClose={() => setUnlockedLocation(null)}
  />
)}
```

- [ ] **Step 5: Add dev helpers**

В DEV-блоке useEffect (где уже определены `__unlockAllTabs` и т.п.), добавь:

```typescript
w.__unlockAllLocations = () => {
  useGameStore.setState({ discoveredLevels: [1, 7, 13, 19, 25] })
  devLog('[dev] all locations unlocked')
}

w.__lockAllLocations = () => {
  useGameStore.setState({ discoveredLevels: [] })
  devLog('[dev] all locations locked (back to start)')
}
```

И в cleanup-return добавь:
```typescript
delete w.__unlockAllLocations
delete w.__lockAllLocations
```

- [ ] **Step 6: Targeted ESLint**

Run:
```
cd frog_evolution_code/client && npx eslint src/App.tsx
```
Expected: no errors

- [ ] **Step 7: Commit**

```
cd frog_evolution_code && git add client/src/App.tsx
git commit -m "feat(unlock): wire UnlockComic, suppress L25 DiscoveryModal, dev helpers"
```

---

## Task 7 — Full manual smoke test

**Files:** (none — testing only)

- [ ] **Step 1: Run full client typecheck**

Run:
```
cd frog_evolution_code/client && npx tsc --noEmit
```
Expected: exit 0, no errors.

- [ ] **Step 2: Run all unit tests**

Run:
```
cd frog_evolution_code/client && npx vitest run --reporter=default
```
Expected: PASS (включая новый `locationUnlocks.test.ts`).

- [ ] **Step 3: Manual smoke checklist**

Open browser DevTools Console:

1. `__lockAllLocations()` then `location.reload()`
   → LocationStack скрыт, только сцена Болота с лягушками

2. Купи/слей до L7 (или в Console: `useGameStore.setState({ discoveredLevels: [1, 7] })`)
   → На emit'е появляется UnlockComic «Лес открыт» → клик «Готово» → закрывается
   → LocationStack виден: Болото + Лес

3. До L13 → комикс Континента → 3 локации
4. До L19 → комикс Планеты → 4 локации
5. Слей две L24 на Планете (или `setState({ discoveredLevels: [1, 7, 13, 19, 25] })`)
   → Комикс Звёздной карты → 5 иконок в стеке
   → Тап по ✨ → открывается StarMapScene как прежде

6. `__lockAllLocations()` + reload → возврат к стартовому экрану

Если все 6 пунктов проходят — фича готова.

- [ ] **Step 4: Final commit (если в Task 6 что-то осталось)**

Если manual smoke выявил мелкий fix — fix + commit отдельно. Если всё чисто — никакого finalize-commit не нужно.

---

## Glossary impact (для автора)

После merge — обновить (orchestrator делает или флажит):

- `frog_obsidian/Glossary/Звёздная карта.md` — добавить в «В коде» условие unlock: «merge L24+L24 на Планете → markDiscovered(25) sentinel». Файл: `client/src/game/config/locationUnlocks.ts`.
- `frog_obsidian/Glossary/Соединение.md` — упомянуть, что мерджи на L7, L13, L19, L24+L24 триггерят `'location:unlocked'` события.
- При наличии: `Лес.md` / `Континент.md` / `Планета.md` — добавить условие появления локации в LocationStack.

---

## Self-review

- **Spec coverage:** все 5 целей spec'а покрыты (Task 4 = goal 1+4, Task 5 = goals 2+3, Task 6 = goal 5, миграция goal 6 derived-from-discovered — Task 1 helper). 5 файлов из spec — Tasks 1-6.
- **Placeholder scan:** нет TBD/TODO. Все шаги содержат конкретный код или конкретную команду.
- **Type consistency:** `LOCATION_UNLOCK_THRESHOLD` / `LOCATION_BY_TRIGGER_LEVEL` / `getLocationUnlockedByLevel` / `getUnlockedLocations` — одинаковые имена в Tasks 1, 4, 5.
- **Edge case L25 не материализуется:** покрыт явным early-return в Task 5 Step 4 (before `Math.min`).
- **Danger zone флаг:** Task 5 явно помечен — agent должен paused-confirm перед edit.
- **Open questions из spec:** оба пункта (текущее merge L24+L24, место подавления DiscoveryModal) приняты — `Math.min(level+1, MAX_LEVEL)` clamping → конкретный special-case ветвь; suppression в App.tsx `onDiscovered` callback.
