# Phase 9 Smoke Test (manual)

**Цель:** убедиться что 18 extracted anim primitives работают визуально идентично pre-Phase-9.

## Шаги

1. `cd client && npm run dev`
2. Открыть http://localhost:5173 (или адрес который выдал Vite).
3. Перейти на StarMap (нижняя панель → иконка планеты / звёзды).
4. Найти и тапнуть **минимум 5 случайных планет** разных архетипов:
   - **gas_giant** (большие жёлто-оранжевые)
   - **ice** (бело-голубые)
   - **ocean** (синие)
   - **lava** (красные)
   - **plasma** (огненно-фиолетовые)
   - также главные расы: home, crystal, organic, military
5. На каждой планете дотапать до анимации (требуется 2-6 нажатий — system rolls threshold).
6. Наблюдать за анимациями: должны играть круги, искры, вспышки, языки пламени, ледяные завитки и т.д.
7. Открыть DevTools → Console — **не должно быть** errors типа:
   - `Cannot read property of undefined`
   - `pickColor is not a function`
   - `compRing is not a function`
   - Phaser warnings об отсутствующих methods/contexts.

## Ожидаемый результат

Анимации **визуально неотличимы** от pre-Phase-9 build. Один и тот же seed → один и тот же набор anim'ов на planet (детерминирован). Если бы что-то поменялось в порядке rng() calls → verify-uniqueness уже бы упало (1000/1000 unique signatures), а оно сейчас зелёное.

## Если что-то не играет

1. `cd client && npm run verify-uniqueness` — должно быть `1000/1000`, `984/984`, `1000/1000`. Если упало — какой-то primitive имеет `rng()` drift.
2. `cd client && npx tsc --noEmit` — должна быть чистая.
3. Проверить console на runtime errors. Скорее всего что-то с wiring (импорт пропущен, switch case забыт).
4. Сверить с git diff Phase 9: `git diff main..HEAD -- client/src/game/scenes/StarMapScene.ts | grep '^+.*case'`.

## Verification metrics (зафиксировано на момент завершения Phase 9)

- TypeScript: clean (npx tsc --noEmit, exit 0).
- Build: 681,472 bytes gzipped JS (vs baseline 681,474 → delta **-2 bytes**, well within +5 KB budget).
- verify-anim-uniqueness-strict: **1000/1000** unique.
- verify-texture-uniqueness: **984/984** unique.
- verify-sound-uniqueness: **1000/1000** unique.
- 18/18 primitives extracted в `client/src/game/effects/anim/shared/`.
- 0 inline target private comp methods в StarMapScene.
- 18 switch cases используют imported funcs.
