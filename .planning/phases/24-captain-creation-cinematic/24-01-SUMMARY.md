---
phase: 24-captain-creation-cinematic
plan: 01
subsystem: state-foundation
tags: [foundation, state, persistence, server-sync, events]
requires: [phase-22-cosmos-gate, phase-23-eventbus-pattern]
provides:
  - captainBirthSeen-state
  - markCaptainBirthSeen-action
  - cross-device-sync-of-captain-birth
  - captain-birth-events
  - legacy-save-migration
affects: []
tech-stack:
  added: []
  patterns:
    - "separate localStorage key + cosmic-blob server sync (hybrid pattern, новый — отличается от Phase 22 hasCosmosUnlocked который НЕ ходит в cosmic blob)"
    - "single-shot inference migration (см. loadCosmosUnlocked)"
key-files:
  created: []
  modified:
    - client/src/store/persistence.ts
    - client/src/store/gameStore.ts
    - client/src/api/gameSync.ts
    - client/src/store/eventBus.ts
decisions:
  - "captainBirthSeen — toplevel store field + отдельный localStorage key (pattern из Phase 22 hasCosmosUnlocked), но синкается через cosmic JSON blob (отличие — Phase 24 milestone имеет смысл синкать между устройствами)"
  - "Migration legacy сейвов через loadCaptainBirthSeen single-shot inference: discoveredLevels[19] → mark seen, чтобы НЕ играть cinematic для uplifted cosmos-unlocked игроков"
  - "Dynamic import('../store/persistence') в gameSync.ts.loadGameState для localStorage sync после server hydration — следует существующей pattern (gameSync.ts уже динамически грузит persistence в других путях)"
  - "markCaptainBirthSeen не эмитит cosmic:toast — сам cinematic (Plan 24-02/03) и есть «toast»; дублирование UI feedback не нужно"
metrics:
  duration_minutes: 8
  completed: 2026-05-18
  tasks: 2
  files: 4
  commits: 1
---

# Phase 24 Plan 24-01: Foundation Summary

State + persistence + server sync + migration + eventBus events для cinematic «Рождение капитана» — инфраструктурный fundament, на который опираются 4 следующих plan'а (Phaser effect 24-02, DOM modal 24-03, MergeController hook 24-04, finalize 24-05).

## What was built

1. **`captainBirthSeen: boolean`** — новое toplevel поле в `useGameStore`. `false` до первого L18+L18 normal merge → cinematic играется один раз. `true` → cinematic skipped.

2. **`markCaptainBirthSeen()`** — idempotent action. Повторный вызов — no-op (early-return). Синхронно пишет в localStorage через `saveCaptainBirthSeen()`, потом `set({ captainBirthSeen: true })`.

3. **`loadCaptainBirthSeen()` / `saveCaptainBirthSeen()`** — localStorage helpers под отдельным ключом `frog_evolution_captain_birth_seen`. Load имеет 3-уровневый fallback:
   - Прямое значение под ключом → return.
   - Legacy inference: `discoveredLevels[19]` присутствует → save seen, return true.
   - Cosmic blob fallback: `cosmic.captainBirthSeen === true` → save seen, return true.

4. **Server sync через cosmic JSON blob**:
   - `snapshotForSave().cosmic.captainBirthSeen` — отправляется на сервер.
   - `loadGameState()` гидратирует флаг + если server вернул `true` синхронно записывает в localStorage (next boot не покажет cinematic до server response).

5. **Два новых eventBus события**:
   - `'captain:birth-start': { x: number; y: number }` — эмитит MergeController после первого L18+L18 normal merge; подписчик — CaptainBirthEffect (Plan 24-02).
   - `'captain:birth-effect-complete': void` — эмитит CaptainBirthEffect; подписчик — CaptainBirthModal (Plan 24-03).

## Files modified

| File                                 | Change                                                                                                                                                                                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/src/store/persistence.ts`    | +`CAPTAIN_BIRTH_SEEN_KEY` const + `loadCaptainBirthSeen()` + `saveCaptainBirthSeen()`. Не трогает `loadCosmosUnlocked` — параллельный helper.                                                                                                                          |
| `client/src/store/gameStore.ts`      | +import helpers; +`captainBirthSeen: boolean` и `markCaptainBirthSeen()` в interface GameStateBase; init из `loadCaptainBirthSeen()` + idempotent action. НЕ добавлен в auto-persist subscribe (persist синхронный внутри action — pattern из `markCosmosUnlocked`). |
| `client/src/api/gameSync.ts`         | +`cosmic.captainBirthSeen` в `snapshotForSave()`; +hydration в `loadGameState()` + dynamic import `saveCaptainBirthSeen` для localStorage sync если server принёс true.                                                                                              |
| `client/src/store/eventBus.ts`       | +2 события в `type Events` map после Phase 23 блока.                                                                                                                                                                                                                  |

## State shape

```ts
// gameStore
{
  // ...existing
  captainBirthSeen: false,              // default; loadCaptainBirthSeen() при init
  markCaptainBirthSeen: () => void,     // idempotent
}

// gameSync snapshot (cosmic blob)
{
  cosmic: {
    // ...existing fields
    captainBirthSeen: boolean,          // отправляется на сервер
    preferences: { ... },
  }
}

// localStorage
'frog_evolution_captain_birth_seen' → 'true' | 'false' | (missing → inference)

// eventBus
'captain:birth-start': { x: number; y: number }
'captain:birth-effect-complete': void
```

## Migration coverage

Legacy сейвы (игроки, которые уже unlock'нули космос ДО введения cinematic) обрабатываются автоматически через `loadCaptainBirthSeen()`:

1. **Чистая установка (новый игрок)**: ключа нет, `discovered` нет/без 19, cosmic blob пустой → return `false`. Cinematic играется при первом L18+L18 merge.

2. **Uplifted save (cosmos уже открыт ранее)**: `localStorage.frog_evolution_discovered` содержит `19` → `loadCaptainBirthSeen()` записывает `'true'` и возвращает `true`. Cinematic skipped — single-shot inference, последующие boot'ы читают напрямую.

3. **Cross-device login (server уже знает о просмотре)**: server возвращает `cosmic.captainBirthSeen=true` → `loadGameState` hydrates store + sync'ает localStorage. Боковая мера: даже до server response `loadCaptainBirthSeen()` смотрит cosmic blob fallback (если он cached в localStorage с прошлой сессии).

4. **Корруптный JSON / пустой localStorage**: try/catch на каждом read, graceful return false (cinematic-показ — приемлемая деградация, hide cinematic было бы хуже UX).

## Decisions logged

Никаких отклонений от плана. Все 2 task'а выполнены ровно как specified в PLAN. Тестируемая verification из `<verification>` секции:

- `tsc --noEmit` clean (client + server)
- `vite build` clean (новые warnings отсутствуют — только pre-existing dynamic/static dual-import warnings)
- `eventBus.emit('captain:birth-start', { x: 0, y: 0 })` и `eventBus.emit('captain:birth-effect-complete')` компилируются
- `snapshotForSave().cosmic.captainBirthSeen` присутствует
- Idempotency `markCaptainBirthSeen()` — guaranteed early-return

## Self-Check: PASSED

Verification:
- `client/src/store/persistence.ts`: FOUND (modified)
- `client/src/store/gameStore.ts`: FOUND (modified)
- `client/src/api/gameSync.ts`: FOUND (modified)
- `client/src/store/eventBus.ts`: FOUND (modified)
- Commit `c6d825f`: FOUND in git log
- tsc client: 0 errors
- tsc server: 0 errors
- vite build: succeeded
