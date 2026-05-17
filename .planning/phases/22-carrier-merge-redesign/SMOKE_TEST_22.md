# Phase 22 — Manual Smoke Test Checklist

Дата: 2026-05-17
Phase: 22-carrier-merge-redesign (7 plans complete)

## Preconditions

```bash
cd client && npm run dev
```

DevTools открыть → Application → Local Storage → подготовить два сценария:

- **Fresh:** Clear all `frog_evolution_*` keys
- **Legacy:** Заранее подготовленный сейв с rarity-carrier и nested serums (для Scenario G)

---

## Scenario A: New player flow (pre-cosmos)

- [ ] SerumBar (нижняя полоса) НЕ виден
- [ ] 🧬 Cosmic Hub button в нижнем баре отображается как 🔒 (locked), opacity ~0.45, hover показывает title «Откройте космос — соедините L18 + L18»
- [ ] Star Map (✨ Звёздная карта) — кнопка локации id=6 ОТСУТСТВУЕТ в LocationStack (и в expanded, и в collapsed mode)
- [ ] Mega-box при auto-spawn (рандомно) — открывается, но **серум не добавляется** в инвентарь
- [ ] Click 🧬 button — onClick disabled, modal НЕ открывается
- [ ] Merge L1+L1 ... L17+L17 работает как раньше (no regression)
- [ ] HUD ActiveBonusesBar НЕ виден (cosmos gate + нет ascensions)

## Scenario B: Cosmos unlock trigger

- [ ] Force L18+L18 normal merge (через `__forceMerge` если есть, иначе grind через `__giveFrog(18)` x2 → drag)
- [ ] При завершении sentinel:
  - Toast «Космос открыт!» появляется (3 сек)
  - SerumBar появляется БЕЗ reload (если есть серум в inventory) — пусто, но bar готов
  - 🧬 button становится active (🧬 emoji, full opacity, clickable)
  - Star Map (id=6) появляется в LocationStack expanded view
  - `discoveredLevels` содержит 19 (`useGameStore.getState().discoveredLevels`)
  - `hasCosmosUnlocked === true` в gameStore
  - `frog_evolution_cosmos_unlocked === 'true'` в localStorage

## Scenario C: Carrier merge progression

- [ ] `__giveSerum('fire')` → apply на frog L5 → carrier fire L5 с aura
- [ ] `__giveCarrier('fire', 5, 'a')` + `__giveCarrier('fire', 5, 'b')` → drag onto → carrier L6 (element=fire)
- [ ] Target-wins проверка: carrier fire L7 (dragged) onto carrier water L7 (target) → carrier water L8

## Scenario D: Ascension

- [ ] Carrier reach L18 (через carrier+normal merge на L18) → instant ascension tween (~1.5s)
- [ ] `ascendedCarriers.length` увеличилось на 1
- [ ] `essence` += 1
- [ ] HUD ActiveBonusesBar появляется и показывает корректный bonus (one item depending on archetype)

## Scenario E: Shop purchases

- [ ] Open Cosmic Hub → Shop tab (🛒)
- [ ] Buy «+1 slot» (cost=1 essence) → `permaSlotBonus = 1`
- [ ] Buy «+1 slot» повторно (cost=2) → `permaSlotBonus = 2` (scaling x2 works)
- [ ] Buy `cosmic_box` (3 essence) → 3 frogs L7 spawned на текущей локации
- [ ] Buy `serum_trade_up`: 3 fire → 1 random — fire count -3, новый серум добавлен
- [ ] Buy `skip_ship_cooldown` (если ship в transit): ship становится docked мгновенно

## Scenario F: Persistence

- [ ] Сделай ascension, buy slot+1, открой shop tab
- [ ] F5 → ascendedCarriers, essence, permaSlotBonus, hasCosmosUnlocked — все preserved
- [ ] SerumBar остаётся виден (если был unlocked)
- [ ] 🧬 button остаётся active

## Scenario G: Legacy migration (если есть old playtest save)

Подготовка: вставить в Local Storage `frog_evolution_cosmic`:
```json
{
  "carriers": [{"frogId":"f1","element":"fire","rarity":"epic","feedCount":3,"stabilized":true,"level":5}],
  "serums": {"fire":{"common":5,"rare":2,"epic":0,"legendary":0},"water":{"common":1,"rare":0,"epic":0,"legendary":0}},
  "boxes": [],
  "discovered": [1,2,3,4,5,18,19]
}
```

- [ ] Load page → console без errors
- [ ] `gameStore.carriers` сконвертированы в `[{frogId:'f1', element:'fire', level:5}]` (rarity/feedCount/stabilized strip)
- [ ] `gameStore.serums` flat: `{fire: 7, water: 1, ...}` (sum across rarities)
- [ ] `discovered.includes(19)` → `hasCosmosUnlocked === true` (inferred + saved)
- [ ] SerumBar виден, 🧬 button active
- [ ] essence === 0, ascendedCarriers === [], permaSlotBonus === 0 (defaults applied)

## Scenario H: i18n

- [ ] RU → EN → ES — все HUD/shop labels переведены, нет fallback'ов на key strings
- [ ] `npm run check-translations` — PASS (326/326 × 3 locales)
- [ ] Cosmic Hub modal labels (Корабль/Станция/Бестиарий/Carriers/Shop) — все локализованы
- [ ] CosmicShopTab item names + descriptions переведены

## Scenario I: Build chain

- [ ] `cd client && npx tsc --noEmit` — clean (0 errors)
- [ ] `cd server && npx tsc --noEmit` — clean
- [ ] `cd client && ./node_modules/.bin/vite build` — succeeds
- [ ] Bundle size: main index gzip ≤ 200 KB, CosmicHubModal chunk gzip ≤ 15 KB (demo target — не strict cap)
- [ ] `cd client && npx vitest run src/store/migrations/phase22.test.ts` → 10/10 PASS
- [ ] `cd client && npx vitest run src/utils/cosmosGate.test.ts` → 4 PASS + 1 SKIPPED
- [ ] `cd client && npx vitest run src/store/cosmic/shopSlice.test.ts` → 15/15 PASS

## Known pre-existing failures (NOT regressions — out of scope)

См. `.planning/phases/22-carrier-merge-redesign/deferred-items.md`:

- `client/src/utils/cosmicSettings.test.ts` — vitest 4 incompatibility
- `client/src/store/cosmic/slice.test.ts` — vitest 4 incompatibility
- `client/src/store/cosmic/slice.openBox.test.ts` — vitest 4 incompatibility

Все три используют top-level `node:assert/strict` без `describe/it` обёрток.
Логика тестов покрыта alternative vitest-style test файлами.
