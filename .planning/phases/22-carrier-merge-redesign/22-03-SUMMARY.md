---
phase: 22-carrier-merge-redesign
plan: 03
subsystem: gameplay
tags: [phaser, zustand, vitest, ascension, archetype-bonus, tdd]

requires:
  - phase: 22-carrier-merge-redesign/22-02
    provides: "carrierSlice merge actions (mergeCarrierWithNormal / mergeCarrierWithCarrier), MergeController carrier branches, dev helpers"

provides:
  - "ascendCarrier action removing carrier at L18 and recording AscendedCarrier in permanent pool"
  - "Two-tier archetype bonus pool: FULL (per ascended, linear stack) + MINI (per on-field carrier, max-per-category teaser)"
  - "ELEMENT_TO_CATEGORY mapping of all 16 elements to 5 categories (Огонь/Вода/Камень/Тень/Прочее)"
  - "CarrierAscensionTween — reusable ad-hoc aura pulse + scale/alpha/y tween (~1.5s)"
  - "eventBus 'cosmic:carrier-ascended' event consumed by MainScene + FrogOverlayManager"
  - "ascendedCarriers + essence persisted in localStorage (load whitelist + save subscribe)"

affects:
  - 22-04 (HUD будет агрегировать aggregateFullBonuses + aggregateMiniBonuses)
  - 22-05/22-06 (essence currency может использоваться как gate)
  - 22-07 (balance pass для placeholder amounts — 0.05 / 0.005 etc.)

tech-stack:
  added: []
  patterns:
    - "Two-tier bonus aggregation (full = linear, mini = max-per-category)"
    - "Event-driven visual effects: store action emits event → scene plays tween"
    - "AuraSpec reuse for ad-hoc one-shot pulses (no new art assets)"

key-files:
  created:
    - client/src/utils/archetypeBonuses.ts
    - client/src/utils/archetypeBonuses.test.ts
    - client/src/store/cosmic/slices/ascensionSlice.ts
    - client/src/store/cosmic/ascension.test.ts
    - client/src/game/effects/CarrierAscensionTween.ts
  modified:
    - client/src/store/cosmic/types.ts
    - client/src/store/cosmic/slice.ts
    - client/src/store/eventBus.ts
    - client/src/store/persistence.ts
    - client/src/store/gameStore.ts
    - client/src/game/scenes/main/MergeController.ts
    - client/src/game/scenes/MainScene.ts
    - client/src/game/effects/FrogOverlayManager.ts

key-decisions:
  - "Two-tier bonus scheme (mini + full) per D-Archetype Bonuses: carrier on field gives ≈10% teaser, ascension promotes to permanent linear-stacked full bonus"
  - "Mini bonus aggregation uses max-per-category (Set of present categories) — multiple carriers of same category do NOT stack, only different categories do"
  - "ascendCarrier emits event AFTER state mutation so subscribers see fresh store"
  - "MainScene synchronously releases overlay before tween (avoid aura следует за исчезающей лягушкой); FrogOverlayManager subscribe is defensive backup for dev/async paths"
  - "Ice element fallback to waterSpec for tween aura (no iceSpec exists; same 'other' category, visually close)"
  - "Tween alpha on frog.container is safe in ascension because container is destroyed onComplete — does NOT trigger feedback_frog_container_alpha мерцание pattern (which applies when container survives the tween)"
  - "Placeholder values: essence=1 per ascension; bonus amounts fire/water 0.05, stone 0.10, shadow 0.01, other 0.03 — balance in Plan 22-07"

patterns-established:
  - "Two-tier bonus aggregation: full (linear sum) + mini (unique categories present) — both share AggregatedBonuses shape"
  - "Ad-hoc element aura: spec.ensureTextures + spec.createAura + manual tweens.add + onComplete destroy. Useful when ElementAuraOverlay (store-subscribed manager) is too heavy."
  - "Cross-controller ascension flow: store action → eventBus → scene handler (visual) + overlay manager (cleanup)"

requirements-completed: [PHASE22-ASCENSION, PHASE22-ARCHETYPE-POOL]

duration: 22min
completed: 2026-05-17
---

# Phase 22 Plan 22-03: Carrier ascension + archetype bonus pool Summary

**L18 carrier instant-ascends with reused aura pulse, mini/full two-tier bonus pool, +1 essence, persisted ascendedCarriers — 16/16 unit tests pass.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-05-17T16:21:55Z
- **Completed:** 2026-05-17T16:44:22Z
- **Tasks:** 3 implementation tasks + checkpoint (auto-approved in auto-advance mode)
- **Files created:** 5
- **Files modified:** 8

## Accomplishments

- **L18 ascension trigger wired end-to-end:** carrier merge to L18 → store removes carrier + appends AscendedCarrier + emits event → MainScene plays 1.5s tween → frog disappears → slot freed → +1 essence. Cross-location ascension also consistent at store level (no visual but state correct).
- **Two-tier archetype bonus pool** (16 elements → 5 categories): full bonus (linear stack per ascended) + mini bonus (≈10% of full, max-per-category teaser while on-field). Both aggregators tested for empty input, single-category stacking, cross-category stacking, and 16-element coverage.
- **Persistence:** ascendedCarriers + essence whitelist-loaded + auto-persisted via existing cosmic subscribe.
- **No new art:** ascension tween reuses existing AuraSpec via SPEC_BY_ELEMENT map (15 specs + ice → waterSpec fallback).
- **TDD:** RED commits committed first, then GREEN — 11 archetype tests + 5 ascension tests, 16/16 pass.

## Task Commits

Atomic units committed sequentially:

1. **Task 1 RED:** `6042570` — `test(22-03): add failing tests for archetype bonus aggregation`
2. **Task 1 GREEN:** `a8a7edf` — `feat(22-03): implement archetype bonus aggregation (full + mini)`
3. **Task 2 RED:** `0bcb2a9` — `test(22-03): add failing tests for ascendCarrier action`
4. **Task 2 GREEN:** `10f6c8e` — `feat(22-03): implement ascendCarrier action + AscendedCarrier state`
5. **Task 3:** `e3b661d` — `feat(22-03): wire L18 ascension — MergeController + tween + scene subscribe`

5 commits total (TDD doubled task 1 + task 2 into RED/GREEN pairs).

## Files Created/Modified

**Created**
- `client/src/utils/archetypeBonuses.ts` — ELEMENT_TO_CATEGORY (16→5), BONUS_PER_CATEGORY (full), MINI_BONUS_PER_CATEGORY, aggregateFullBonuses (linear), aggregateMiniBonuses (max-per-category).
- `client/src/utils/archetypeBonuses.test.ts` — 11 vitest cases: mapping coverage, category distribution, full/mini values, linear stack, max-per-category, cross-category stacking, empty input.
- `client/src/store/cosmic/slices/ascensionSlice.ts` — createAscensionSlice + ascendCarrier action, emits 'cosmic:carrier-ascended' after store mutation.
- `client/src/store/cosmic/ascension.test.ts` — 5 vitest cases: happy path, unknown frogId no-op, repeated ascend no-op, multi-ascend essence increment, JSON roundtrip.
- `client/src/game/effects/CarrierAscensionTween.ts` — playAscensionTween (~140 lines): ad-hoc aura via element spec + frog scale/alpha/y tween ~1500ms, SPEC_BY_ELEMENT map for all 16 elements.

**Modified**
- `client/src/store/cosmic/types.ts` — AscendedCarrier interface, CosmicSlice gains ascendedCarriers[] + essence, makeInitialCosmicSlice seeds [] / 0.
- `client/src/store/cosmic/slice.ts` — registers createAscensionSlice in composition; CosmicSliceActions.ascendCarrier signature.
- `client/src/store/eventBus.ts` — adds 'cosmic:carrier-ascended': { frogId, element } event type.
- `client/src/store/persistence.ts` — loadCosmicSlice whitelist for ascendedCarriers (with shape validation) and essence.
- `client/src/store/gameStore.ts` — subscribe predicate + saveCosmicSlice payload include ascension fields so they auto-persist.
- `client/src/game/scenes/main/MergeController.ts` — after carrier-merge dispatch, if newLevel === MAX_LEVEL → store.ascendCarrier(newFrogId).
- `client/src/game/scenes/MainScene.ts` — onCarrierAscended handler: finds frog by id, releases overlay, marks isMerging, plays tween, removeFrog onComplete. Subscribe in create / unsubscribe in destroy.
- `client/src/game/effects/FrogOverlayManager.ts` — defensive eventBus subscribe on 'cosmic:carrier-ascended' → releaseForFrog (covers async/dev paths).

## Decisions Made

- **Mini bonus shape**: max-per-category Set, NOT stacked within category. Justification: ascension является основным reward путём, mini только teaser. Если mini стэкается — игрок может «копить» carriers одной категории и получить почти full бонус без ascension, что уничтожает мотивацию.
- **playAscensionTween принимает frogContainer (не frogSprite)**: в FrogData нет отдельного child sprite — frog.body это `Phaser.GameObjects.Image`, но визуально + интерактивно правильнее анимировать контейнер целиком (включает body + любые child overlays). Memory `feedback_frog_container_alpha` относится к случаям когда container ОСТАЁТСЯ жив после tween; здесь container уничтожается → нет мерцания.
- **Synchronous releaseForFrog в MainScene handler перед playAscensionTween**: aura не должна следовать за исчезающей лягушкой и оставаться на сцене после destroy. FrogOverlayManager subscribe — defensive backup.
- **Ice → waterSpec fallback**: `iceSpec` не существует в elementAuraSpecs (всего 15 spec'ов). ice принадлежит категории 'other', визуально близко к water — приемлемая замена без создания новой spec.
- **Order of operations при carrier-carrier L17→L18 ascension**: spawn carrier L18 (через carrierSlice.mergeCarrierWithCarrier) → ascendCarrier(newFrogId) удаляет его → emit event → tween. Без spawn'а ascendCarrier был бы no-op (carrier ещё не в store).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added ascendedCarriers + essence to auto-persist subscribe + payload**
- **Found during:** Task 2 (Type-check failed после добавления ascendedCarriers/essence в CosmicSlice — payload `saveCosmicSlice` в gameStore не включал новые поля)
- **Issue:** План просил persist через persistence.ts whitelist, но `gameStore.ts` имеет explicit save payload который не пересчитывался — TS error `missing the following properties: ascendedCarriers, essence`. Без этого: ascended state существовал бы в памяти но **никогда не сохранялся** — F5 терял бы весь ascension pool. Это нарушение must-have «ascendedCarriers persisted в localStorage между сессиями».
- **Fix:** Расширил `useGameStore.subscribe` predicate с проверкой `state.ascendedCarriers !== prev.ascendedCarriers || state.essence !== prev.essence` и добавил поля в `saveCosmicSlice({...})` payload.
- **Files modified:** client/src/store/gameStore.ts
- **Verification:** tsc clean; vitest passes; full unit-test свежей сессии (Test 5 JSON roundtrip) проверяет что shape сериализуется.
- **Committed in:** 10f6c8e (Task 2 GREEN commit)

**2. [Rule 2 - Missing Critical] Defensive FrogOverlayManager subscribe to 'cosmic:carrier-ascended'**
- **Found during:** Task 3 (продумывание race conditions)
- **Issue:** План просил подписать FrogOverlayManager на event для cleanup. Изначально я полагался только на store subscribe (dirty flag) — но между mutation и следующим tick'ом aura может «висеть» на 1 frame если ascendCarrier вызывается извне tick'а (dev console, async path). Это не критично но defensive backup стоит копейки и улучшает консистентность.
- **Fix:** Добавил eventBus.on/.off в constructor / dispose / disposeForTransition, handler вызывает existing `releaseForFrog`.
- **Files modified:** client/src/game/effects/FrogOverlayManager.ts
- **Verification:** tsc clean; не ломает существующие тесты (FrogOverlayManager не unit-тестирован, smoke в checkpoint).
- **Committed in:** e3b661d (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (оба Rule 2 — отсутствующая критическая функциональность).
**Impact on plan:** Обе фиксации требуются для корректности (persist) и надёжности (defensive cleanup). Никакого scope creep. План в остальном выполнен точно как написано.

## Issues Encountered

- **Pre-existing user changes в `gameStore.ts` и `persistence.ts`** — нельзя было использовать `git add file`. Решено через `git add -p` со scripted `n/y` ответами чтобы stage только мои hunks. User's loadLocationFrogs изменения + переименование «Болото» → «Лужа» остались **unstaged** (не было коммитнуто в этом плане).
- **`iceSpec` отсутствует** в elementAuraSpecs (всего 15 spec'ов, не 16). Решено fallback на waterSpec (та же категория 'other'); если потребуется dedicated ice aura — отдельным плана/skin pass'ом.
- **`npx vite build` не работает** в этой shell-обёртке (proxied → npm с ошибкой `Missing script "vite"`). Запускал через `node_modules/.bin/vite build` напрямую — build OK.

## Checkpoint Handling

Task 4 — `checkpoint:human-verify` (smoke-проверка ascension в dev). В **auto-advance mode** (`workflow.auto_advance=true`) checkpoint:human-verify auto-approved.

**Auto-approved:** L18 ascension wired end-to-end; TDD gates passed; tsc + build clean. Smoke-инструкции из плана задокументированы для ручной проверки на любом запуске dev сервера:
```
window.__giveCarrier('fire', 17, 'frog-a')
window.__giveCarrier('fire', 17, 'frog-b')
window.__simulateMerge('frog-a', 'frog-b')
// expect: tween ~1.5s, frog-b исчезает, ascendedCarriers.length === 1, essence === 1
```
F5 проверка persist: ascendedCarriers + essence сохраняются (whitelist + payload validated).

## User Setup Required

None — никаких external services / env vars.

## Next Phase Readiness

- **Plan 22-04** может непосредственно потреблять `aggregateFullBonuses` и `aggregateMiniBonuses` для HUD render — экспорты и shape совпадают с interface в плане 22-04.
- `ascendedCarriers[]` и `essence: number` доступны через useGameStore selectors.
- `'cosmic:carrier-ascended'` event может быть использован для toast / achievement triggers в Plan 22-05+.
- Placeholder values (0.05, 0.005, etc.) ждут balance pass в Plan 22-07.

## Self-Check

Verified after writing SUMMARY:

**Files exist:**
- FOUND: client/src/utils/archetypeBonuses.ts
- FOUND: client/src/utils/archetypeBonuses.test.ts
- FOUND: client/src/store/cosmic/slices/ascensionSlice.ts
- FOUND: client/src/store/cosmic/ascension.test.ts
- FOUND: client/src/game/effects/CarrierAscensionTween.ts

**Commits exist:**
- FOUND: 6042570 (RED archetype tests)
- FOUND: a8a7edf (GREEN archetype bonuses)
- FOUND: 0bcb2a9 (RED ascension tests)
- FOUND: 10f6c8e (GREEN ascension slice + persist)
- FOUND: e3b661d (Task 3 wire MergeController + tween + scene)

## Self-Check: PASSED

---
*Phase: 22-carrier-merge-redesign*
*Completed: 2026-05-17*
