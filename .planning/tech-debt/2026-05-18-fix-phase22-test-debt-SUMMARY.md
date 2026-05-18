---
kind: tech-debt
date: 2026-05-18
scope: vitest suite repair
files:
  - client/src/store/cosmic/slice.openBox.test.ts
  - client/src/store/cosmic/slice.test.ts
  - client/src/utils/cosmicSettings.test.ts
commits:
  - 58d52d3
  - 684d248
  - 9b2636e
tests-before: 117 PASS, 3 FAIL suites (5+11+9 missing tests inside)
tests-after: 142 PASS, 0 FAIL
---

# Tech-debt: fix 3 pre-existing Phase 22 vitest failures

## One-liner

Migrate three legacy `node:assert/strict` test files to vitest `describe/it`
and set up cosmos-gate / localStorage / saveGameState mocks they were missing.

## Problem statement

Per `.planning/phases/22-carrier-merge-redesign/deferred-items.md`, three
test suites were broken since Phase 22 finalization (commit `a2cc300`):

1. `client/src/store/cosmic/slice.openBox.test.ts` — Test 1 `0 !== 1`
   (fire serum не инкрементируется после `openBox`).
2. `client/src/store/cosmic/slice.test.ts` — Test 6 `0 !== 1`
   (fire serum не инкрементируется после `commitOpenedBox`).
3. `client/src/utils/cosmicSettings.test.ts` — vitest report:
   "No test suite found in file".

Vitest classified их как `failed (3 suites)` — `numTotalTests: 0` для каждого,
суммарно 25 невыполненных assertion'ов.

## Diagnosis

Каждый failure имел **отдельный** root cause; общим был только формат файла —
все три использовали ad-hoc `node:assert/strict` с top-level `{ ... }` блоками
и `console.log(...)` finalizer'ом. Vitest 4 не подбирает такой формат.

### Root cause A — vitest 4 collection format (все три файла)

Vitest 4 требует `describe`/`it` блоки для test collection. Top-level
`assert.equal(...)` блоки выполняются в module body, но vitest рапортует
suite как failed с `numTotalTests: 0`. Это документировано в
`deferred-items.md` (Plan 22-06/22-07 section).

### Root cause B — Phase 22 Plan 22-06 cosmos gate (slice.* tests)

`client/src/store/cosmic/slices/boxSlice.ts` теперь содержит cosmos-gate:

```ts
const cosmosUnlocked = (s as { hasCosmosUnlocked?: boolean })
  .hasCosmosUnlocked === true
const nextSerums = cosmosUnlocked
  ? { ...s.serums, [box.element]: s.serums[box.element] + 1 }
  : s.serums
```

Это **intentional** production behaviour — pre-cosmos box opens должны
дропать серум (см. comment в boxSlice.ts L52-54). Тесты должны
эмулировать unlocked state, а не обходить gate.

Harness'ы в обоих файлах создавали slice через `createCosmicSlice(set, get)`
без top-level `hasCosmosUnlocked` флага — флаг живёт на root gameStore
(`utils/cosmosGate.ts`), а harness реализует только локальный spread
state. Поэтому `set({ hasCosmosUnlocked: true } as Partial<CosmicState>)`
в makeHarness достаточно — boxSlice читает его через narrow cast.

### Root cause C — happy-dom v20 localStorage shape (cosmicSettings)

Probe показал: на Node 25 + RTK proxy happy-dom v20 выставляет
`globalThis.localStorage` как пустой Object без Storage-методов
(setItem/getItem/removeItem/clear все undefined). Тот же workaround уже
применён в `cosmosGate.test.ts` (lines 21-44) — установка in-memory polyfill
через `Object.defineProperty(globalThis, 'localStorage', ...)` ДО dynamic
import тестируемого модуля.

### Root cause D — saveGameState fan-out (cosmicSettings)

Phase 22 force-sync: каждый `setInstantBoxes(...)` вызывает
`saveGameState(true)` → реальный HTTP-вызов. Замокано через
`vi.mock('../api/gameSync', () => ({ saveGameState: vi.fn(async () => true) }))`.

## Fix approach

**No production code modified.** Все три fix'а — в test setup. Phase 22
gating-логика (boxSlice.ts) сохраняется как-есть, потому что:

- `deferred-items.md` явно классифицирует это как "pre-existing vitest 4
  incompatibility", не как regression
- Боевые тесты для cosmos-gate уже существуют:
  `cosmosGate.test.ts` (4/5 PASS), `phase22.test.ts` (10/10 PASS),
  `shopSlice.test.ts` (15/15 PASS)
- Glossary intent для openBox/commitOpenedBox: serum reward только в
  cosmos era — это design rationale, не drift.

## Per-file changes

### `client/src/store/cosmic/slice.openBox.test.ts` (commit `58d52d3`)

- Wrap 9 top-level test blocks in single `describe(... openBox action
  (cosmos-unlocked) ...) { it(...) }`
- Switch from `assert.equal/notEqual` to `expect(...).toBe/.not.toBeNull`
- Add `set({ hasCosmosUnlocked: true } as Partial<CosmicState>)` in
  `makeHarness()` so boxSlice's narrow cast reads `true`
- Replace global crypto polyfill (`globalThis.crypto = ...`) with
  `Object.defineProperty(globalThis, 'crypto', ...)` — same shape as
  existing `ascension.test.ts`

Result: 9/9 PASS.

### `client/src/store/cosmic/slice.test.ts` (commit `684d248`)

- Wrap 11 top-level test blocks in single `describe(... box actions
  (cosmos-unlocked) ...) { it(...) }`
- `assert.* → expect.*` migration
- Same `hasCosmosUnlocked` harness flag for commitOpenedBox tests
  (Test 4, 6, 8, 11 — все полагаются на serum increment / boxes mutation)

Result: 11/11 PASS.

### `client/src/utils/cosmicSettings.test.ts` (commit `9b2636e`)

- Replace bespoke localStorage/window/CustomEvent polyfills (lines 8-46
  старого файла) с `installLocalStoragePolyfill()` — точная копия
  паттерна из `cosmosGate.test.ts`
- `vi.mock('../api/gameSync', () => ({ saveGameState: vi.fn() }))` чтобы
  setters не делали реальный HTTP
- Dynamic `import('./cosmicSettings')` в `beforeAll` — гарантирует, что
  polyfill стоит ДО module-init side-effects
- Wrap в `describe('cosmicSettings — instantBoxes')` с 5 `it(...)` тестами
- `beforeEach(() => localStorage.removeItem(KEY))` — детерминистичный
  default state на каждом тесте

Result: 5/5 PASS.

## Verification

```bash
# Targeted run (the 3 fixed files):
cd client && npx vitest run \
  src/store/cosmic/slice.openBox.test.ts \
  src/store/cosmic/slice.test.ts \
  src/utils/cosmicSettings.test.ts
# → 25 passed, 0 failed

# Full suite — no regression check:
cd client && npx vitest run
# → 142 passed, 0 failed (was 117 PASS / 3 FAIL suites = 25 invisible tests)

# Typecheck (sanity):
cd client && npx tsc --noEmit
# → 0 errors
```

## Deviations from plan

None. Plan was diagnosed accurately:

- Hypothesis "openBox cosmos-gated" — **confirmed** (boxSlice.ts L51-69).
- Fix strategy "set hasCosmosUnlocked in test setup" — **applied as-is**.
- cosmicSettings "wrap in it() block" — **applied + добавил необходимые
  mock'и для localStorage и saveGameState** (Rule 2: missing critical
  test infrastructure).

Rule 2 auto-fix отмечен в коммит-message каждого test файла.

## Decisions

- **Не переписывали** production cosmos-gate в boxSlice — gating
  intentional per Phase 22 Plan 22-06 design.
- **Не делали** workspace-wide test setup file для localStorage polyfill —
  выбрана per-file установка по образцу `cosmosGate.test.ts` (уже принятый
  паттерн в проекте). Когда таких файлов станет >3 — consolidate в
  `vitest.setup.ts` через `setupFiles` config.
- **Не консолидировали** обе slice-test harness в shared helper — каждая
  имеет subtle различия (slice.openBox.test.ts экспонирует `.set` для
  in-test mutation, slice.test.ts не использует). Premature DRY.

## Files modified

- `client/src/store/cosmic/slice.openBox.test.ts` (rewrite test runner)
- `client/src/store/cosmic/slice.test.ts` (rewrite test runner)
- `client/src/utils/cosmicSettings.test.ts` (rewrite test runner + polyfill)

## Files created

None.

## Commits

- `58d52d3` test(tech-debt): wrap slice.openBox in vitest describe/it + set cosmos gate
- `684d248` test(tech-debt): wrap slice.test.ts in vitest describe/it + set cosmos gate
- `9b2636e` test(tech-debt): migrate cosmicSettings.test.ts to vitest + install localStorage polyfill

## Self-Check: PASSED

- File `client/src/store/cosmic/slice.openBox.test.ts`: FOUND
- File `client/src/store/cosmic/slice.test.ts`: FOUND
- File `client/src/utils/cosmicSettings.test.ts`: FOUND
- Commit `58d52d3`: FOUND
- Commit `684d248`: FOUND
- Commit `9b2636e`: FOUND
- Vitest full suite: 142 PASS / 0 FAIL (target: 120+ / 0)
- Typecheck: clean
