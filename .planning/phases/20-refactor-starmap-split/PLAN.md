---
phase: 20-refactor-starmap-split
plan: master
type: overview
status: pending
depends_on: [19-balance-tutorial-i18n-polish]
total_plans: 5
total_waves: 5
goal: Разбить StarMapScene.ts (8347 строк / 296KB) на 5-7 модулей по доменам; ничего не сломать в gameplay.
---

# Phase 20 — Refactor StarMapScene Split

## Контекст

`src/game/scenes/StarMapScene.ts` достиг **8347 строк / 296KB** и стал критическим монолитом:

- **78+ анимационных `comp*` методов** (часть из них уже вынесена в Phase 9 — паттерн установлен)
- **12 setup-методов** для ambient effects (BlackHole, Cosmic Dust, Signals, TorRing, VeranLightning, RelictMourning, HomeOrbiter, Starfield, и т.д.)
- **Ship lifecycle** (setupShipSprite, applyShipState, follow logic)
- **Popovers + HUD** (Phaser DOM bridge)
- **Controls + Camera** (drag/inertia/wheel/pinch)

Файл нереально протестировать или изменить безопасно — каждое касание риск регрессии.

## Goal

Разбить монолит на 5-7 модулей по доменам. **Поведение игры не должно измениться** — это чистый структурный рефакторинг.

После завершения:
- `StarMapScene.ts` → 400-600 строк orchestrator'а
- 5-7 controllers/модулей с явными интерфейсами
- TypeScript строгий, ESLint чистый, существующие тесты зелёные

## Strategy

Идём по возрастающей сложности и риска. **5 волн**, каждая — отдельный sub-plan, отдельные коммиты.

| Wave | Sub-plan | Что | Риск | LOC reduction |
|---|---|---|---|---|
| 1 | [20-01](20-01-PLAN.md) | **Foundation** — types + pure helpers | 🟢 0 | ~150 |
| 2 | [20-02](20-02-PLAN.md) | **Comp methods** — оставшиеся ~60 анимаций | 🟢 низкий | ~3500-4000 |
| 3 | [20-03](20-03-PLAN.md) | **Ambient effects** — BlackHole/Dust/Signals/etc. | 🟢 низкий | ~600 |
| 4 | [20-04](20-04-PLAN.md) | **Bridges** — Starfield/Popovers/Ship/HUD | 🟡 средний | ~1500 |
| 5 | [20-05](20-05-PLAN.md) | **Controls** — pointer/wheel/camera/drag/inertia | 🔴 высокий | ~700 |

Каждая волна:
1. Extract → новый файл/модуль
2. `npx tsc --noEmit` → 0 ошибок
3. `npm run lint` → 0 ошибок
4. Ручная проверка StarMap в браузере (drag, click planet, fly, popover)
5. `npm test -- --run` → существующие тесты зелёные
6. Atomic git commit

## Acceptance criteria

- [ ] `StarMapScene.ts` ≤ 700 строк
- [ ] Все 5 sub-plans complete
- [ ] TypeScript `--noEmit` без ошибок
- [ ] ESLint без ошибок
- [ ] Существующие тесты (carriers, slice, rarityRoll, carrierEvolution, cosmicSettings, elementOverlayPool) зелёные
- [ ] Ручная QA пройдена: открытие starmap, drag по карте, pinch zoom, click planet, popover, fly to planet, follow ship, return to home
- [ ] Никаких изменений в gameplay (regression-free)

## Risk mitigation

- **Atomic commits** — каждая sub-plan = отдельный коммит, легко откатить
- **Existing precedent** (Phase 9) — pattern для comp-методов уже валидирован на 18 файлах
- **TS-driven** — TypeScript ловит большинство сломов сразу
- **Manual smoke test** после каждой волны
- **No behavior change** — только move code, никаких рефакторингов логики

## Out of scope

- Изменение gameplay (другая фаза)
- Splitting MainScene.ts (другая фаза, не сейчас)
- Тесты на новые модули (welcome, но не блокирует)
- Удаление dead code (если найдём — отдельная фаза)

## References

- Existing extracted primitives: `src/game/effects/anim/shared/` (Phase 9)
- StarMapScene: `src/game/scenes/StarMapScene.ts`
- Code-smell аудит: см. обсуждение 2026-05-09
