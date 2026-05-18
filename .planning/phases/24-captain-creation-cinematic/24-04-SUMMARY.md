---
phase: 24-captain-creation-cinematic
plan: 04
subsystem: captain-birth-cinematic
tags: [cinematic, merge, starmap, captain, wave3]
provides:
  - "captain-birth-cinematic-trigger"
  - "captain-birth-beat4-spawn"
  - "captain-birth-beat5-starmap-open"
  - "captain-birth-modal-mount"
requires:
  - "24-01-foundation (captainBirthSeen, markCaptainBirthSeen, eventBus events)"
  - "24-02-phaser-effect (listens 'captain:birth-start', emits 'captain:birth-effect-complete')"
  - "24-03-dom-modal (listens 'captain:birth-effect-complete', emits 'captain:birth-cta')"
affects:
  - "MergeController L18+L18 normal branch"
  - "App.tsx render tree + bootstrap useEffect"
tech-stack:
  added: []
  patterns:
    - "install-once-on-boot coordinator (как installBestiaryDevHelpers / installOnboardingDevHelpers)"
    - "module-level idempotency guard (uninstall closure) — НЕ React lifecycle"
key-files:
  created:
    - "client/src/components/Captain/captainBirthController.ts"
  modified:
    - "client/src/game/scenes/main/MergeController.ts"
    - "client/src/App.tsx"
decisions:
  - "Beat 4 spawn — на currentLocation, НЕ форсированно на Лужу (1) — per CONTEXT Claude's Discretion. Игрок видит спавн там, где только что произошёл merge, без неожиданного телепорта."
  - "Coordinator handler установлен через top-level useEffect в App.tsx без DEV gate — production-critical путь."
  - "Idempotency через module-level closure (uninstall) — устойчиво к React StrictMode двойному mount и HMR."
metrics:
  duration: "~7min"
  completed: "2026-05-18"
  tasks: 3
  files: 3
  commits: 3
---

# Phase 24 Plan 04: Captain Birth End-to-End Wiring Summary

## One-liner

Связал MergeController (Beat 1→2 trigger) + new captainBirthController (Beat 4 spawn + Beat 5 starmap open) + App.tsx modal mount → cinematic Plans 24-01..03 теперь работает end-to-end на L18+L18 merge.

## What was built

### 1. `client/src/components/Captain/captainBirthController.ts` (NEW)

Plain JS install-once coordinator (37 строк). Подписан на `'captain:birth-cta'`:

- **Beat 4:** `useGameStore.getState().addFrogToLocation(currentLocation, 1)` — символический L1 spawn на текущей локации.
- **Beat 5:** `eventBus.emit('starmap:open')` — LocationStack уже subscribed (existing Plan 22-06 wiring), переключает StarMapScene активной.

Idempotency: module-level `uninstall` closure. Повторный `installCaptainBirthController()` снимает старый handler перед регистрацией нового — устойчиво к HMR / restart / React StrictMode двойному mount.

### 2. `client/src/game/scenes/main/MergeController.ts` (MODIFIED, +8 строк)

L18+L18 normal branch (внутри `scene.time.delayedCall(VORTEX_DURATION, ...)` callback'а), сразу после `storeL25.markCosmosUnlocked()` и ПЕРЕД `mergeApi(...)`:

```typescript
// Lines 290-297 в финальной версии:
storeL25.markCosmosUnlocked()
// Phase 24 Plan 24-04: cinematic trigger.
if (!storeL25.captainBirthSeen) {
  storeL25.markCaptainBirthSeen()
  eventBus.emit('captain:birth-start', { x: cx, y: cy })
}
mergeApi(MAX_LEVEL, currentLocId)
```

- `cx`, `cy` — midpoint merge'а (доступны в closure параметров `performMerge`).
- `storeL25` — взят выше единым `useGameStore.getState()` (line 279); повторно не вызывается.
- Hook стоит ПОСЛЕ `markCosmosUnlocked` чтобы реактивные UI-элементы (SerumBar, Cosmic Hub) уже были unlock'нуты к моменту открытия Star Map в Beat 5.
- Carrier merge branch НЕ затронут — cinematic только для normal+normal.
- Idempotent через `markCaptainBirthSeen` (sets `captainBirthSeen=true`, early return на повторе).

### 3. `client/src/App.tsx` (MODIFIED, +13 строк)

- 2 import'а (`CaptainBirthModal`, `installCaptainBirthController`).
- Новый top-level `useEffect(() => { installCaptainBirthController() }, [])` — отдельно от DEV bootstrap useEffect (тот защищён `if (!import.meta.env.DEV) return`), production-critical.
- `<CaptainBirthModal />` mount рядом с `<OnboardingController />` (render tree, line 345). Modal сам управляет visibility через internal state + eventBus subscription — никакого conditional render не нужно.

## Insertion line numbers (final state)

- `MergeController.ts:289` → `storeL25.markCosmosUnlocked()`
- `MergeController.ts:290-297` → Phase 24 hook (8 lines)
- `MergeController.ts:298` → `mergeApi(MAX_LEVEL, currentLocId)`
- `App.tsx:28-29` → imports
- `App.tsx:180-185` → install useEffect
- `App.tsx:345-348` → `<CaptainBirthModal />` mount

## Decisions Made

### D1: Beat 4 spawn — currentLocation vs forced Лужа?

CONTEXT.md явно оставил решение на Claude's Discretion. Выбран **currentLocation**.

Rationale:
- Игрок только что сделал L18+L18 merge на текущей локации (Лес/Континент/Космос). Внезапный телепорт лягушки в Лужу — disorienting и breaks "physical" continuity.
- L1 frog spawn — символический жест ("капитан родился, новое начало"). Контекст локации не имеет gameplay-значения (L1 везде L1, no element).
- Сразу после spawn'а открывается Star Map (Beat 5) → игрок переключается на космическую metaplay, физическое место spawn'а становится неважным.
- Если future user feedback покажет, что игроки хотят возврат к началу (Лужа = "новое путешествие"), это thin change в captainBirthController.

### D2: Top-level useEffect vs DEV bootstrap useEffect

DEV bootstrap useEffect (line 187) защищён `if (!import.meta.env.DEV) return`. captainBirthController — production-critical → создан **отдельный top-level useEffect** без gate.

Idempotency guard (closure `uninstall`) гарантирует, что повторный mount (StrictMode dev / HMR) не задублирует listener.

### D3: НЕ модификация carrier merge ветки

Carrier+carrier на L18 имеет отдельный путь (`ascendCarrier` в спавн delayedCall, line 388-390 финального). Этот сценарий не тригерит cinematic — это design intent (cinematic событие — рождение Капитана через normal merge L18+L18 — это первое появление Космической карты).

Если позже окажется, что carrier-ascension на L18 тоже должен играть cinematic, отдельный hook добавится в plan 24+ (вне scope этого плана).

## Deviations from Plan

None — план выполнен точно как описано. tsc + vite build clean (нет deferred items).

## Verification

### Automated

- `npx tsc --noEmit` → 0 errors (`TypeScript compilation completed`)
- `npm run build` → `✓ built in 4.46s` (pre-existing dynamic-vs-static import warnings — не связаны с Plan 24-04)
- `grep -nE "captainBirthSeen|captain:birth-start" src/game/scenes/main/MergeController.ts` → 2 строки (только в L18+L18 normal branch, как ожидалось)
- `grep -nE "CaptainBirthModal|installCaptainBirthController" src/App.tsx` → 4 строки (2 import + 1 install + 1 mount)

### Manual smoke testing (рекомендации для пользователя)

Браузерная консоль для отслеживания всех 5 beats:

```js
eventBus.on('captain:birth-start', p => console.log('[Beat 2] start at', p))
eventBus.on('captain:birth-effect-complete', () => console.log('[Beat 3] modal mount'))
eventBus.on('captain:birth-cta', () => console.log('[Beat 4+5] trigger'))
eventBus.on('starmap:open', () => console.log('[Beat 5] Star Map opens'))
```

Quick state reset для re-test:
```js
useGameStore.setState({ captainBirthSeen: false })
localStorage.removeItem('frog_evolution_captain_birth_seen')
```

End-to-end test:
1. `localStorage.clear(); location.reload()` — fresh save.
2. DEV: `__unlockAllLocations()` + multiple `useGameStore.getState().addFrogToLocation(currentLoc, 18)`.
3. Drag L18 на L18 → merge.
4. Должна сработать вся последовательность: flashAt → Phaser cinematic ~3s → modal → tap CTA → L1 frog spawn → Star Map opens.
5. Повторный L18+L18 merge → cinematic НЕ играет (idempotent flag, как и должно быть).
6. `localStorage.getItem('frog_evolution_captain_birth_seen')` → `"true"`.
7. После ~5s save throttle: `GET /game/state` → `cosmic.captainBirthSeen === true`.

## Commits

| Hash       | Message                                                        |
| ---------- | -------------------------------------------------------------- |
| `a2b9bb9`  | feat(24-04): captainBirthController (Beat 4 spawn + Beat 5 starmap) |
| `3b2eb19`  | feat(24-04): MergeController L18+L18 cinematic hook            |
| `2742ea5`  | feat(24-04): mount CaptainBirthModal + install Beat 4/5 controller in App |

## Self-Check: PASSED

- FOUND: `client/src/components/Captain/captainBirthController.ts`
- FOUND: `client/src/game/scenes/main/MergeController.ts` (modified, 8 lines added)
- FOUND: `client/src/App.tsx` (modified, 13 lines added)
- FOUND commits: a2b9bb9, 3b2eb19, 2742ea5
