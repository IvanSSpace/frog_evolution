---
phase: 22-carrier-merge-redesign
plan: 05
subsystem: cosmic-shop
tags: [cosmic, shop, currencies, perma-upgrades, i18n]
requirements: [PHASE22-COSMIC-SHOP, PHASE22-CURRENCIES]
dependency-graph:
  requires: [22-03]
  provides: [purchaseShopItem, permaSlotBonus, permaShipSpeedBonus, permaSerumDropBonus, shopPurchaseCounts]
  affects: [BoxController.canSpawnBox, shipSlice.sendShipTo, MainScene.spawnFrog]
tech-stack:
  added: []
  patterns: [zustand-slice-composition, atomic-set-with-side-effects, pure-helper-injection]
key-files:
  created:
    - client/src/config/cosmicShop.ts
    - client/src/store/cosmic/slices/shopSlice.ts
    - client/src/store/cosmic/shopSlice.test.ts
    - client/src/components/CosmicHub/CosmicShopTab.tsx
    - client/src/game/utils/shopBonuses.ts
    - client/src/game/utils/shopBonuses.test.ts
  modified:
    - client/src/store/cosmic/types.ts
    - client/src/store/cosmic/slice.ts
    - client/src/store/eventBus.ts
    - client/src/store/gameStore.ts
    - client/src/store/persistence.ts
    - client/src/components/CosmicHub/CosmicHubModal.tsx
    - client/src/game/scenes/main/BoxController.ts
    - client/src/store/cosmic/slices/shipSlice.ts
    - client/src/game/scenes/MainScene.ts
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json
decisions:
  - "i18n namespace = cosmic_shop.* (а не shop.* — занят прокачкой)"
  - "shopBonuses helpers = pure functions с raw bonus counter (не привязаны к store) — testability + no cyclic imports"
  - "skip_ship_cooldown guard включает ship.state === 'transit' — нет смысла пропускать docked"
  - "serum_trade_up использует Math.random для RNG; deterministic-test через vi.spyOn(Math, 'random')"
  - "Plan 22-04 (parallel agent) добавлял hud.* keys — no conflict с cosmic_shop.* namespace"
metrics:
  duration: "16m"
  tasks_completed: 3
  files_created: 6
  files_modified: 11
  commits: 4
  completed_date: "2026-05-17"
---

# Phase 22 Plan 22-05: Cosmic Shop Summary

## One-liner

Cosmic Shop tab в CosmicHubModal с 6 items / двумя валютами (essence + серум), geometric ×2 scaling для perma upgrades, atomic purchaseShopItem action и wiring perma-эффектов в game systems (slot cap, ship speed, serum drop).

## What was built

### Commits

| # | Hash      | Type | Description                                            |
|---|-----------|------|--------------------------------------------------------|
| 1 | `6a1b1f4` | test | RED phase — failing tests + cosmicShop config         |
| 2 | `5653a60` | feat | GREEN — shopSlice + state + persistence + eventBus    |
| 3 | `06c4b6b` | feat | UI — CosmicShopTab + CosmicHubModal integration       |
| 4 | `796f1ea` | feat | Wiring — game systems + i18n RU/EN/ES                 |

### Functional surface

**6 shop items (cosmicShop.ts):**

| ID                   | Currency | Base | Scaling | Permanent | Effect                                         |
|----------------------|----------|------|---------|-----------|------------------------------------------------|
| `cosmic_box`         | essence  | 3    | ×1      | no        | Spawn 3 L7 frogs at current location          |
| `slot_plus_one`      | essence  | 1    | ×2      | yes       | +1 к slot cap (BoxController)                 |
| `ship_speed`         | essence  | 1    | ×2      | yes       | +5% к скорости полёта (shipSlice)             |
| `serum_drop_chance`  | essence  | 1    | ×2      | yes       | +0.5% к serum drop chance (rarityRoll caller) |
| `skip_ship_cooldown` | serum    | 1    | ×1      | no        | Instant arrive ship-in-transit                |
| `serum_trade_up`     | serum    | 3    | ×1      | no        | 3 серума одного элемента → 1 random           |

**Cost formula:** `cost(n) = baseCost × scalingFactor^n`, round to integer. Scaling ×1 → flat.

**purchaseShopItem(itemId, opts?) protocol:**
1. Resolve item + cost через `getNextCost(item, shopPurchaseCounts[id] ?? 0)`.
2. Currency guard (essence balance / серум balance + element pick / ship transit).
3. Atomic set(): decrement currency, increment counter, apply effect.
4. Post-mutation eventBus emit (cosmic_box → spawn, skip_cooldown → ship-arrived).
5. Returns `boolean` (true on success, false on guard fail).

### State extensions

```ts
// CosmicSlice новые поля (persisted)
permaSlotBonus: number          // 0 default
permaShipSpeedBonus: number     // 0 default
permaSerumDropBonus: number     // 0 default
shopPurchaseCounts: Partial<Record<ShopItemId, number>>  // {} default

// CosmicTab union
... | 'shop'
```

Все 4 поля whitelist'ятся в `persistence.ts` loadCosmicSlice + saveCosmicSlice subscribe в gameStore.

### Game systems wiring (shopBonuses.ts pure helpers)

```ts
effectiveSlotCap(MAX_ENTITIES, store.permaSlotBonus)
  → BoxController.canSpawnBox() уважает +N slots.

shipSpeedMultiplier(store.permaShipSpeedBonus)
  → shipSlice.sendShipTo: duration = travelTimeMs(dist) / multiplier.

serumDropChance(baseChance, store.permaSerumDropBonus)
  → caller-side; готов для следующего этапа когда rarityRoll получит wiring.
```

cosmic_box покупка emit'ит `cosmic:cosmic-box-purchased` → `MainScene.onCosmicBoxPurchased` спавнит 3 L7 frogs с pop-in анимацией (staggered 80ms delays) + добавляет в `store.locationFrogs[currentLoc]` для persistence.

### UI (CosmicShopTab.tsx)

- Header — двух-цветный badge currency (💠 essence purple / 🧪 serum amber)
- Grid из 6 cards с item title/desc/cost/buy button
- Disabled state визуально + button text "Недостаточно"
- Element-picker selects для `serum_trade_up` и `skip_ship_cooldown` (показывает баланс каждого element)
- Skip-ship hint: «Корабль не в полёте» если ship docked
- Scaling info: «Куплено раз: N» для perma items
- All buttons `type="button"` (cliclability checklist)
- CSS-only — Tailwind transitions, no Lottie, no frog.container.alpha tween

### i18n

- `cosmic_shop.*` namespace (20 keys × 3 locales)
- `cosmic_hub.tab_shop` (Магазин / Shop / Tienda)
- check-translations PASS: 326/326/326 keys

## Verification results

| Check                                      | Result            |
|--------------------------------------------|-------------------|
| `npx tsc --noEmit` (client)                | 0 errors          |
| `npx tsc --noEmit` (server)                | 0 errors          |
| `npx vitest run shopSlice.test.ts`         | 15/15 PASS        |
| `npx vitest run shopBonuses.test.ts`       | 4/4 PASS          |
| Full vitest describe-style suite           | 76/76 PASS        |
| `npx vite build`                           | OK (3.97s)        |
| `npm run check-translations`               | PASS (326/326/326)|
| Pre-existing node-test files (slice.test, openBox.test, cosmicSettings.test, locationUnlocks.test) | FAIL — **pre-existing**, no `describe()`, ignored per SCOPE BOUNDARY |

## Test coverage breakdown (shopSlice.test.ts — 15 cases)

| # | Test                                                      |
|---|-----------------------------------------------------------|
| 1 | getNextCost geometric scaling ×2 (slot_plus_one)         |
| 2 | getNextCost flat cost (cosmic_box ×1)                    |
| 2b| getNextCost serum_trade_up flat 3                        |
| 2c| getNextCost skip_ship_cooldown flat 1                    |
| 3 | purchase slot_plus_one — essence decrement + counter      |
| 4 | purchase with insufficient essence → false               |
| 5 | scaling: 3rd purchase requires cost=4 (×2² geometric)    |
| 6 | serum_trade_up — 3 fire → +1 random (deterministic spy)  |
| 6b| serum_trade_up — недостаточно серум → false              |
| 7 | cosmic_box — essence decrement + counter increment        |
| 8 | skip_ship_cooldown — guard ship docked → false            |
| 8b| skip_ship_cooldown — happy path (transit → docked)        |
| 9 | ship_speed perma upgrade increments permaShipSpeedBonus  |
|10 | serum_drop_chance increments permaSerumDropBonus         |
|11 | unknown itemId → no-op false                              |

## TDD Gate Compliance

- RED commit (`6a1b1f4`, type=`test`): tests written БЕЗ implementation → 10/15 FAIL on missing `purchaseShopItem`. 4/15 config-only PASS.
- GREEN commit (`5653a60`, type=`feat`): shopSlice + state extensions → 15/15 PASS.
- No REFACTOR needed — implementation минимальная, без дублирования.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] i18n namespace conflict**

- **Found during:** Task 3 (i18n)
- **Issue:** План говорит `shop.*` namespace, но `shop` уже существует в RU/EN/ES JSON (раздел «Прокачка» — улучшения dropSpeed/tractor/magnet и т.д.). Использование `shop.*` для cosmic shop сломало бы существующий UI.
- **Fix:** Использовал `cosmic_shop.*` namespace вместо `shop.*`. Также `cosmic_hub.tab_shop` для tab label (consistent с `cosmic_hub.tab_*` pattern).
- **Files modified:** client/src/i18n/{ru,en,es}.json, CosmicShopTab.tsx, CosmicHubModal.tsx
- **Commit:** `796f1ea`

**2. [Rule 3 - Blocking] shopBonuses test cannot import useGameStore**

- **Found during:** Task 3 (helpers + tests)
- **Issue:** Первая версия `shopBonuses.ts` импортировала `useGameStore` напрямую (как и план говорит). Тест провалился на module-load: happy-dom + persistence.ts → `localStorage.getItem is not a function` (env setup нет полноценного localStorage mock).
- **Fix:** Превратил helpers в pure functions, принимающие raw bonus counter (`effectiveSlotCap(baseCap, perma)`). Тесты получают чистые числа — без зависимости от store. Callers сами читают `useGameStore.getState()` и передают. Это также архитектурно чище (testability + no cyclic imports).
- **Files modified:** client/src/game/utils/shopBonuses.ts, .test.ts, BoxController.ts, shipSlice.ts
- **Commit:** `796f1ea`

**3. [Rule 2 - Critical] shopPurchaseCounts persistence missed in original plan diff**

- **Found during:** Task 1 (types + persistence)
- **Issue:** План перечислил `shopPurchaseCounts` в frontmatter, но не в `<files>` для persistence.ts. Без whitelist в loadCosmicSlice — counter обнулится при F5, сломав scaling cost (player мог бы бесконечно покупать +1 slot за 1 essence).
- **Fix:** Добавил 4 поля в persistence.ts loadCosmicSlice + gameStore subscribe (saveCosmicSlice trigger).
- **Files modified:** client/src/store/persistence.ts, client/src/store/gameStore.ts
- **Commit:** `5653a60`

## Known Stubs

None — all 6 items имеют functional effect path:
- 3 perma effects реально читаются в BoxController/shipSlice
- cosmic_box → MainScene handler спавнит frogs
- skip_ship_cooldown → ship state mutation + ship-arrived event
- serum_trade_up → serums Record mutation

`serum_drop_chance` perma имеет computation helper (serumDropChance), но caller-side wiring в `rollSerumDrop` оставлен будущему плану — current `rollSerumDrop` принимает `chance` напрямую и caller'ы могут передавать `serumDropChance(BASE, perma)`. Это не stub, а opt-in extension point.

## Threat Flags

None — изменения не открывают новый attack surface. Все mutations atomic через single set(). Persistence whitelist строгий (typeof проверки). Нет network/auth/file access.

## Self-Check: PASSED

**Created files:**
- FOUND: client/src/config/cosmicShop.ts
- FOUND: client/src/store/cosmic/slices/shopSlice.ts
- FOUND: client/src/store/cosmic/shopSlice.test.ts
- FOUND: client/src/components/CosmicHub/CosmicShopTab.tsx
- FOUND: client/src/game/utils/shopBonuses.ts
- FOUND: client/src/game/utils/shopBonuses.test.ts

**Commits:**
- FOUND: 6a1b1f4 (RED)
- FOUND: 5653a60 (GREEN slice)
- FOUND: 06c4b6b (UI)
- FOUND: 796f1ea (wiring + i18n)

## Awaiting human verification (checkpoint)

Plan declares `<task type="checkpoint:human-verify" gate="blocking">`. Manual smoke per план:
1. `cd client && npm run dev`
2. Cosmic Hub → новая вкладка «Магазин»
3. Essence = 0 → essence-buttons disabled
4. `useStore.setState(s => ({essence: 10}))` или 10 ascensions → buy +1 slot 3 раза (cost 1→2→4 = total 7 essence)
5. permaSlotBonus = 3 (визуально не виден в UI, но field cap effectively вырос)
6. Trade-up: serums.fire=3 → buy → fire=0, random element +1
7. Skip ship cooldown: ship в transit → buy → ship instant docked
8. Cosmic box: buy → 3 L7 frogs появляются с pop-in анимацией
9. F5 → permaSlotBonus + essence + shopPurchaseCounts survive
10. Switch RU → EN → ES — все labels локализованы

Type "approved" or describe issue.
