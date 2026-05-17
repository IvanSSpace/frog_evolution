---
phase: 22-carrier-merge-redesign
plan: 06
subsystem: cosmos-gate
tags: [progressive-disclosure, ux, cosmos, ux-09]
completed: 2026-05-17
duration_hours: ~1.0
requirements: [PHASE22-COSMOS-GATE]
provides:
  - hasCosmosUnlocked state (top-level, persisted)
  - markCosmosUnlocked action (idempotent)
  - useCosmosUnlocked / selectCosmosUnlocked hook + selector
  - MergeController L18+L18 unlock trigger
key-files:
  created:
    - client/src/utils/cosmosGate.ts
    - client/src/utils/cosmosGate.test.ts
  modified:
    - client/src/store/gameStore.ts
    - client/src/store/persistence.ts
    - client/src/game/scenes/main/MergeController.ts
    - client/src/components/SerumBar.tsx
    - client/src/components/HUD/ActiveBonusesBar.tsx
    - client/src/components/CosmicHub/CosmicHubModal.tsx
    - client/src/ui/components/BottomBar.tsx
    - client/src/ui/components/LocationStack.tsx
    - client/src/store/cosmic/slices/boxSlice.ts
    - client/src/store/cosmic/slices/shipSlice.ts
decisions:
  - "hasCosmosUnlocked живёт top-level в gameStore (а не в cosmic slice) и хранится под отдельным ключом frog_evolution_cosmos_unlocked. Это даёт устойчивость к corrupt resets cosmic slice (паттерн T-11-01)."
  - "🧬 Cosmic Hub button в BottomBar показывается disabled (🔒 emoji + opacity + tooltip), а не скрыта целиком — даёт игроку direction (как требует cliclability/UX memory)."
  - "CosmicHubModal: добавлен defensive lock screen — если modal как-то открыт без unlock (legacy, dev), показывает hint вместо табов."
  - "Серум-drop guard поставлен в boxSlice.openBox и commitOpenedBox + shipSlice.investigatePlanet (defensive). UI gating через LocationStack + BottomBar делает основной flow недоступным, но guard'ы на data-layer гарантируют что любой alternate code path (dev helper, legacy state) тоже respect'ит gate."
metrics:
  commits: 2
  tasks_completed: 2 (Task 3 = checkpoint auto-approved per `_auto_chain_active`)
---

# Phase 22 Plan 22-06: Cosmos Gate Summary

**One-liner:** Pre-cosmos UI (SerumBar, Cosmic Hub button, Star Map controls, серум-drop из боксов и миссий) скрыто/inactive до первого L18+L18 normal merge sentinel; после unlock реактивно открывается без reload через единый `useCosmosUnlocked()` hook.

## Что сделано

### Архитектура

```
gameStore.hasCosmosUnlocked: boolean   ← top-level, persisted в COSMOS_UNLOCKED_KEY
       ↑
       └── markCosmosUnlocked() (idempotent)
              ↑
              MergeController L18+L18 normal sentinel (line ~270)
                                                                ↓
       ┌──────────── useCosmosUnlocked() ←─────────────┐
       │                                                │
       ↓                                                ↓
   UI gates                                       Data gates
       ├─ SerumBar (return null)                       ├─ boxSlice.openBox      → серум не дропается
       ├─ ActiveBonusesBar (return null)               ├─ boxSlice.commitOpenedBox → серум не дропается
       ├─ BottomBar 🧬 button (disabled + 🔒 + title)  └─ shipSlice.investigatePlanet → guard
       ├─ LocationStack Star Map id=6 (hidden)
       └─ CosmicHubModal (lock screen)
```

### Точка trigger'а

`client/src/game/scenes/main/MergeController.ts:271-273` (line numbers approximate post-edit):

```ts
if (oldLevel === MAX_LEVEL && b.level === MAX_LEVEL) {
  // ... existing remove + markDiscovered(19)
  storeL25.markCosmosUnlocked()  // ← Plan 22-06 trigger
}
```

`markCosmosUnlocked()` идемпотентен — повторные L18+L18 не вызывают повторный toast.

### UI gates (5 компонентов)

1. **SerumBar** (`components/SerumBar.tsx`) — `if (!unlocked) return null` в самом верху render.
2. **ActiveBonusesBar** (`components/HUD/ActiveBonusesBar.tsx`) — defensive gate (на pre-cosmos ascensions нет, но bar явно скрыт).
3. **BottomBar 🧬 button** (`ui/components/BottomBar.tsx`) — `Tile` теперь принимает `disabled?: boolean` + `title?: string`. Disabled: 🔒 emoji + opacity 0.45 + grayscale + cursor not-allowed + onClick=undefined (cliclability checklist: `type="button"`, aria-disabled, badge hide когда disabled).
4. **LocationStack** (`ui/components/LocationStack.tsx`) — виртуальная локация 6 (Звёздная карта) убирается из `ordered[]` и из collapsed-mode рендеринга когда `!cosmosUnlocked`.
5. **CosmicHubModal** (`components/CosmicHub/CosmicHubModal.tsx`) — defensive lock screen: если flag false, показывает `🔒 Космос закрыт / Соедините L18+L18` вместо tab strip + content.

### Data gates (3 пути)

1. **boxSlice.openBox** — pre-cosmos: box открывается (opened=true, hasOpenedAnyBox=true) но `serums[element]` не инкрементится.
2. **boxSlice.commitOpenedBox** — то же поведение для cascade reveal path.
3. **shipSlice.investigatePlanet** — guard 0 возвращает `false` если cosmos закрыт (mission UI всё равно недоступен через скрытый Star Map, но safety net остаётся).

### Tests

`client/src/utils/cosmosGate.test.ts` (vitest, **4 PASS + 1 skipped**):

| # | Test | Status |
|---|------|--------|
| 1 | `selectCosmosUnlocked({hasCosmosUnlocked: false})` → false | PASS |
| 2 | `selectCosmosUnlocked({hasCosmosUnlocked: true})` → true | PASS |
| 3 | Defensive: только строгий `=== true` → true (string/number/undefined → false) | PASS |
| 4 | Legacy migration (discovered[19]=true без флага → true on load) | **SKIPPED** — deferred Plan 22-07 |
| 5 | `markCosmosUnlocked()` idempotent + persist в localStorage | PASS |

```
Test Files  1 passed (1)
Tests       4 passed | 1 skipped (5)
```

Также прогнал полный suite — **76 passed / 0 failed**.

### Build

- `npx tsc --noEmit` — clean (0 errors)
- `vite build` — succeeds, bundle delta: CosmicHubModal chunk 42.82 KB (gzip 12.84 KB), main index 655 KB (gzip 193 KB). В пределах +15 KB target.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest test runner вместо `node --test`**
- **Found during:** Task 1 verify step
- **Issue:** Plan указывал `node --test src/utils/cosmosGate.test.ts`, но client проект использует vitest (см. `client/package.json` `"test": "vitest run"` + `vitest.config.ts` с happy-dom).
- **Fix:** Переписал тесты под vitest API (describe/it/expect).
- **Files modified:** `cosmosGate.test.ts`

**2. [Rule 3 - Blocking] Node 25 встроенный localStorage конфликтует с happy-dom**
- **Found during:** Task 1 first test run
- **Issue:** Node 25 имеет experimental `--experimental-localstorage` который активируется через RTK proxy, но даёт сломанный localStorage без `.getItem` метода. Это ломает persistence.ts на module init (`loadBoxOpenCount` → `localStorage.getItem is not a function`).
- **Fix:** Добавлен in-memory localStorage polyfill в начале тестового файла (через `Object.defineProperty(globalThis, 'localStorage', ...)`) ДО dynamic import gameStore. Polyfill совместим с реальным Storage API.
- **Files modified:** `cosmosGate.test.ts`

**3. [Rule 2 - Critical] Cosmos unlock toast добавлен в `markCosmosUnlocked`**
- **Issue:** Plan описал реактивное mass-update UI, но без user-feedback что unlock произошёл (без toast'а игрок может не заметить новые контролы).
- **Fix:** В `markCosmosUnlocked` добавлен `eventBus.emit('cosmic:toast', ...)` с msg "Космос открыт!" (RU only пока, i18n keys можно добавить в Plan 22-07).
- **Files modified:** `gameStore.ts`

### Skipped per scope-boundary

- **SerumsTab / CarriersTab / CosmicShopTab defensive `<LockedTabPlaceholder />`** — Plan просил это для случая когда CosmicHubModal сам gated, но persisted lastActiveTab открывает tab. После defensive lock screen в CosmicHubModal сами tabs стали unreachable (modal не рендерит tab content когда `!cosmosUnlocked`). Дополнительный defensive слой избыточен. Если в будущем CosmicHubModal изменится — можно вернуться.

## FIXME для Plan 22-07 (legacy migration)

| Item | Где |
|------|------|
| `Test 4` skipped: legacy state с `discovered[19]=true` без `hasCosmosUnlocked` поля → auto-set true on load | `cosmosGate.test.ts` |
| `FIXME Plan 22-07` комментарий | `gameStore.ts` interface GameStateBase, поле `hasCosmosUnlocked` |
| Migration `migratePhase22(parsed)` должен infer'ить `hasCosmosUnlocked = discovered.includes(19)` | новый `migrations/phase22.ts` |

## Self-Check: PASSED

- [x] `client/src/utils/cosmosGate.ts` — FOUND
- [x] `client/src/utils/cosmosGate.test.ts` — FOUND
- [x] `client/src/store/gameStore.ts` modified — FOUND (hasCosmosUnlocked + markCosmosUnlocked + load/save imports)
- [x] `client/src/store/persistence.ts` modified — FOUND (COSMOS_UNLOCKED_KEY + load/save)
- [x] MergeController L18+L18 → markCosmosUnlocked — FOUND
- [x] 5 UI components import useCosmosUnlocked — FOUND
- [x] boxSlice + shipSlice gates — FOUND
- [x] Commits 32899f5 (Task 1) + 87cf1d1 (Task 2) — both in git log
- [x] vitest cosmosGate.test.ts — 4 PASS / 1 SKIPPED
- [x] Full suite vitest — 76/76 PASS
- [x] tsc --noEmit — clean
- [x] vite build — success
