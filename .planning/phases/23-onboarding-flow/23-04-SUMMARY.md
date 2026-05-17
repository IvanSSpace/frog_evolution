---
phase: 23-onboarding-flow
plan: 04
subsystem: ui-game-bridge
tags: [phaser, react, zustand, eventbus, onboarding, merge-demo, ghost-trail, pulse-ring]

# Dependency graph
requires:
  - phase: 23-onboarding-flow/01
    provides: [useOnboardingStore.markFirstMergeSeen + firstMergeSeen flag, onboarding.mergeHint.* i18n keys (RU/EN/ES), OnboardingController shell]
  - phase: 23-onboarding-flow/03
    provides: [TutorialPulseRing reusable Phaser ring (frog-sized radius), Phaser→DOM coord conversion pattern]
  - phase: 23-onboarding-flow/05
    provides: [window.__mainScene exposure (Plan 23-05 уже сделал) — React/Phaser bridge для OnboardingController]
provides:
  - "GhostFrogTrail — reusable Phaser effect (alpha 0.5 frog clone, QuadraticBezier arc, burst+fade at arrival, N loops с pauses)"
  - "eventBus events: 'tutorial:mergeDemoStart' (anchor coords для DOM overlay), 'tutorial:firstMerge' (idempotent dismiss signal)"
  - "MergeHintOverlay (DOM pill «Перетащи одну на другую») + MergeSuccessToast (always-mounted one-shot pink toast)"
  - "MergeController integration: первый успешный merge ЛЮБЫХ frogs → markFirstMergeSeen + emit"
  - "OnboardingController Beat 3 coordinator: ring + ghost + listeners + 8с auto-fade + cleanup"
affects: [23-06]
notes:
  - "GhostFrogTrail спроектирован как general-purpose (не «merge demo» в имени) — может использоваться для других hint-демонстраций в будущих фазах (например, carrier feeding)."
  - "MergeSuccessToast вынесен в отдельный always-mounted listener потому что MergeHintOverlay unmount'ится сразу после markFirstMergeSeen — иначе toast не успел бы отрендериться 3с."

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phaser.Curves.QuadraticBezier + `targets: { t: 0 }` tween pattern для arc-motion (control point поднят на 50px вверх от min(srcY, tgtY) — стабильная дуга для близких frogs)"
    - "Per-loop spawn/destroy ghost: каждый loop пересоздаёт Image объект — упрощает state machine (нет need в reset position/alpha между loops)"
    - "useRef-based idempotency guard в useEffect: demoStartedRef.current блокирует повторный старт даже когда effect re-run'ется при изменении deps (locationFrogs/carriers меняются часто)"
    - "Always-mounted toast listener (MergeSuccessToast) вместо conditional render — позволяет toast'у пережить unmount родительского hint overlay'я"
    - "Read scene.frogs из window.__mainScene в React useEffect — авторитативный источник x/y координат (gameStore.locationFrogs хранит только levels)"
    - "Capture coords в момент demo start (а не follow): label остаётся над starting mid-point — нет jitter'а pill'а когда frogs wander'ятся idle anim'ой"

key-files:
  created:
    - client/src/game/effects/GhostFrogTrail.ts
    - client/src/components/Onboarding/MergeHintOverlay.tsx
  modified:
    - client/src/store/eventBus.ts
    - client/src/game/scenes/main/MergeController.ts
    - client/src/components/Onboarding/OnboardingController.tsx

key-decisions:
  - "Ghost — отдельный Phaser.Image clone через textureKeyForLevel(level), НЕ модификация frog.container — соблюдает memory:feedback_frog_container_alpha (никакого alpha-tween'а на оригинальной лягушке)."
  - "MergeController emit'ит 'tutorial:firstMerge' внутри performMerge ПОСЛЕ classify'я (нормал/carrier-normal/carrier-carrier — все ветки попадают сюда). markFirstMergeSeen idempotent → повторные merges no-op. Это покрывает 100% случаев первого мерджа без дублирования логики."
  - "Auto-fade ОДНОВРЕМЕННО в OnboardingController (Phaser side: rings+ghost) + НЕТ в MergeHintOverlay — controller solo управляет lifecycle. Overlay просто реагирует на 'tutorial:firstMerge'/'mergeDemoStart' events. Это избавило от double-timer проблемы которая была в первом наброске плана (label мог fade'нуть раньше rings)."
  - "GhostFrogTrail.destroy() возвращает ghost через 200ms fade-out (визуально приятнее чем instant remove), но cancellation pauseTimer'а и tween'ов — мгновенное. Это разделяет «гасим в memory» (мгновенно) vs «гасим визуально» (fade-out)."
  - "Ring radius = 38px (frog-sized) против Plan 23-03 box ring ~50px. Меньшее значение чтобы ring не выходил далеко за пределы frog body — frog меньше чем box (BASE_SCALE ≈ 0.67)."
  - "useRef-guard вместо state-flag — re-render не нужен (lifecycle полностью внутри Phaser side), exhaustive-deps satisfied только реальными зависимостями (welcomeSeen/firstBoxTapSeen/firstMergeSeen/locationFrogs/currentLocation/carriers)."
  - "MergeSuccessToast — отдельный компонент в том же файле (а не отдельный файл): связан семантически (оба про merge hint), но имеет независимый lifecycle. Co-location уменьшает import noise."
  - "Coords для ghost trail capture'ятся в момент старта demo (sourceX/sourceY const). Frogs могут wander'иться idle anim'ой — ghost трэйл будет ходить по fixed path. Это сознательно: ghost — демонстрация intent'а («с какого места до какого»), а не follow-real-time. Меньше визуальный jitter."

patterns-established:
  - "Phaser-side effects с React-side mount lifecycle: useEffect в OnboardingController orchestrates Phaser objects (TutorialPulseRing/GhostFrogTrail) через window.__mainScene — clean separation (React owns lifecycle, Phaser owns rendering)."
  - "Multi-source dismiss: store-flag (firstMergeSeen via React useEffect re-run) + immediate event (tutorial:firstMerge listener) → каждый источник идемпотентно гасит свою половину. Race-safe."

# Metrics
metrics:
  duration: 1h_10m
  completed: 2026-05-17T22:00:00Z
  files_created: 2
  files_modified: 3
  tasks_completed: 3
  commits:
    - hash: "0a210d3"
      msg: "feat(23-04): GhostFrogTrail effect + tutorial:mergeDemoStart/firstMerge events"
    - hash: "a23672d"
      msg: "feat(23-04): MergeController emits tutorial:firstMerge on first merge"
    - hash: "f4efa94"
      msg: "feat(23-04): Beat 3 merge demo — rings + ghost trail + hint overlay + toast"
    - hash: "3ddb212"
      msg: "style(23-04): prettier-format Beat 3 onboarding files"
---

# Phase 23 Plan 04: Beat 3 — Merge Demo Summary

**Beat 3 онбординга: интерактивная demo merge через ghost-frog drag-animation +
два pulsing rings вокруг участвующих L1 frogs.** Player видит «как мерджить»
без текстовой инструкции, dismiss на первом реальном merge или 8с auto-fade.

## Что сделано

### `client/src/game/effects/GhostFrogTrail.ts` (new, ~180 lines)

Reusable Phaser effect:
- Semi-transparent frog clone (alpha 0.5) — отдельный `Phaser.GameObjects.Image`
  через `textureKey` + опциональный `tint`. Никакой мутации оригинальной frog'и.
- Tween по `Phaser.Curves.QuadraticBezier` с control point поднятым на 50px
  вверх — стабильная арка даже для близко расположенных frogs.
- По прибытии: burst (alpha→0 + scale×1.3) за 300ms, destroy.
- Loop N раз (default 3) с pause между (default 800ms).
- `destroy()` идемпотентен: kill tween, pause timer remove, fade-out ghost 200ms.

### `client/src/components/Onboarding/MergeHintOverlay.tsx` (new)

Два компонента:
- **`MergeHintOverlay`** — pill «Перетащи одну на другую» под mid-point двух frogs.
  Conditional mount controller'ом. Subscribe на `tutorial:mergeDemoStart` для
  anchor coords, fade-out на `tutorial:firstMerge`.
- **`MergeSuccessToast`** — always-mounted listener. Pink slide-up toast «Готово!
  Дальше мерджи всё подряд» на 3с при `tutorial:firstMerge`. Вынесен отдельно
  потому что `MergeHintOverlay` unmount'ится сразу после mark'а.

### `client/src/components/Onboarding/OnboardingController.tsx` (modified)

Beat 3 coordinator useEffect:
- Trigger guard: `welcomeSeen && firstBoxTapSeen && !firstMergeSeen` + ≥2 L1
  carrier-free frogs в `scene.frogs` (читает через `window.__mainScene`).
- `useRef` guard для идемпотентности.
- Создаёт 2 `TutorialPulseRing` (frog-sized radius=38px), эмитит
  `tutorial:mergeDemoStart`, запускает `GhostFrogTrail(loops=3)`.
- Listeners: `tutorial:firstMerge` → ghost+rings destroy; `frog:pickup` → ghost
  cancel (rings остаются помогать визуально).
- 8с auto-fade timer → cleanup + `markFirstMergeSeen()`.
- Cleanup в useEffect return — гасит всё при unmount.

### `client/src/game/scenes/main/MergeController.ts` (modified)

В `performMerge` после `hapticImpact('medium')` — guard'нутый блок:
```typescript
const onb = useOnboardingStore.getState()
if (onb.firstBoxTapSeen && !onb.firstMergeSeen) {
  onb.markFirstMergeSeen()
  eventBus.emit('tutorial:firstMerge')
}
```
Покрывает все варианты merge (normal+normal, carrier+normal, carrier+carrier).
`markFirstMergeSeen` idempotent — повторные merges no-op.

### `client/src/store/eventBus.ts` (modified)

Добавлены 2 events с подробными comment'ами:
- `'tutorial:mergeDemoStart'` — anchor coords (sourceX/Y, targetX/Y) для DOM overlay.
- `'tutorial:firstMerge'` — void, idempotent dismiss signal.

## Гейты (passed)

- `cd client && npx tsc --noEmit` — 0 errors.
- `cd client && npm run build` — OK (existing warnings pre-existing, не от 23-04).
- `npx eslint <files-23-04>` — 0 errors / 0 warnings (после `npx prettier --write`).
- `npx prettier --check <files-23-04>` — passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] MergeSuccessToast как отдельный always-mounted listener**
- **Found during:** Task 2 (написание MergeHintOverlay)
- **Issue:** Plan'овский набросок предлагал toast внутри `MergeHintOverlay`, но
  overlay unmount'ится сразу после `markFirstMergeSeen` — `setState` после
  unmount = no-op, toast не отрендерился бы. Race window: 0ms.
- **Fix:** Вынес `MergeSuccessToast` в отдельный always-mounted компонент в том
  же файле. Слушает `tutorial:firstMerge` независимо.
- **Files modified:** `MergeHintOverlay.tsx`, `OnboardingController.tsx` (mount).
- **Commit:** `f4efa94`

**2. [Rule 3 - Blocking] Скип window.__phaserMainScene global — реюз window.__mainScene от Plan 23-05**
- **Found during:** Task 2 (план просил `window.__phaserMainScene`)
- **Issue:** Plan ожидал что я создам новый global, но `window.__mainScene` уже
  выставлен `MainScene.create()` (Plan 23-05). Создание второго global = дубль.
- **Fix:** Реюз существующего `window.__mainScene` с тайпом `MainScene` (вместо
  generic `Phaser.Scene`) — даёт прямой доступ к `scene.frogs` без any-cast'а.
- **Files modified:** только `OnboardingController.tsx`.
- **Commit:** `f4efa94`

**3. [Rule 1 - Bug] Capture coords вместо runtime-follow**
- **Found during:** Task 2 (design review)
- **Issue:** Plan предлагал `eventBus.emit('mergeDemoStart', { sourceX: src.x, ... })`
  + label «follows» frogs. Но frogs мутируются idle wander'ом ~каждые 2-4с —
  label дрожал бы. Pulse ring follow'ит target.x/.y каждый frame, но DOM-pill
  пересчитываемый на каждый event = постоянные re-render'ы.
- **Fix:** Capture coords в const'ах в момент start'а, передаём snapshot в event.
  Label остаётся над starting mid-point. Trade-off: если frogs ушли далеко за 8с,
  label «отстаёт» — acceptable (демонстрация intent'а, а не GPS-tracker).
- **Commit:** `f4efa94`

**4. [Rule 1 - Bug] `Set` для carrier lookup вместо array `.some()`**
- **Found during:** Task 2 (perf review)
- **Issue:** План предлагал `carriers.some(c => c.frogId === f.id)` внутри
  `scene.frogs.filter(...)` — O(n*m) на каждом effect re-run (а effects бегут
  часто при spawn).
- **Fix:** `const carrierIds = new Set(carriers.map(c => c.frogId))` → O(n+m)
  с O(1) lookup.
- **Commit:** `f4efa94`

### Auth Gates: None.

## Что НЕ сделано (out of scope для Plan 23-04)

- `success-burst` на target после реального merge (план упоминал «success-burst
  Phaser tween на target») — НЕ реализован. MergeController уже emit'ит
  `mergeEffect` + `flashAt` + vortex particles, дублировать не имеет смысла —
  визуальный success-feedback уже богатый. Toast («Готово!») и есть Plan 23-04
  success-signal на UI layer.
- Edge case: если 2 L1 frogs spawn'ятся пока demo уже сыграл и тут же merge'нули,
  но юзер не успел увидеть demo — `firstMergeSeen=true` уже выставлен (от auto-fade
  или реального merge). Acceptable, в onboarding это норма.

## Self-Check: PASSED

Files verified:
- `client/src/game/effects/GhostFrogTrail.ts` — FOUND
- `client/src/components/Onboarding/MergeHintOverlay.tsx` — FOUND
- `client/src/store/eventBus.ts` — modified (verified diff)
- `client/src/game/scenes/main/MergeController.ts` — modified (verified diff)
- `client/src/components/Onboarding/OnboardingController.tsx` — modified (verified diff)

Commits verified (`git log --oneline -5`):
- `3ddb212` — style(23-04): prettier-format
- `f4efa94` — feat(23-04): Beat 3 merge demo
- `a23672d` — feat(23-04): MergeController emits tutorial:firstMerge
- `0a210d3` — feat(23-04): GhostFrogTrail + events

Manual verification (Task 4) — оставлен пользователю как `checkpoint:human-verify`.
