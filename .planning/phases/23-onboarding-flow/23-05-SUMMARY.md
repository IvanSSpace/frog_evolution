---
phase: 23-onboarding-flow
plan: 05
subsystem: onboarding
tags: [onboarding, beat-4, location-celebration, phaser-particles, dom-toast]
requires:
  - 23-01 # onboarding store + slice + i18n bootstrap
provides:
  - location-unlock-confetti # Phaser particle burst (palette per location)
  - location-unlock-toast # DOM slide-up banner
  - location-stack-pulse # ring + glow + bobble на new unlocked button
  - react-phaser-scene-bridge # window.__mainScene available in production
affects:
  - client/src/store/eventBus.ts # 2 new celebration events
  - client/src/game/scenes/MainScene.ts # __mainScene exposure
  - client/src/ui/components/LocationStack.tsx # pulse subscribe + isPulsing styling
  - client/src/components/Onboarding/OnboardingController.tsx # Beat 4 wiring
  - client/src/i18n/{ru,en,es}.json # locations.6 key
tech-stack:
  added:
    - 'Phaser 3.60+ particle emitter API (scene.add.particles + .explode)'
  patterns:
    - 'CSS @keyframes for DOM animations (no Lottie per memory feedback_animations)'
    - 'React→Phaser bridge via window.__mainScene (typed unknown cast)'
    - 'mitt eventBus for cross-layer coordination (HUD ↔ Phaser)'
key-files:
  created:
    - client/src/game/effects/ConfettiBurst.ts
    - client/src/components/Onboarding/LocationUnlockCelebration.tsx
    - client/src/components/Onboarding/locationCelebration.css
  modified:
    - client/src/store/eventBus.ts
    - client/src/game/scenes/MainScene.ts
    - client/src/components/Onboarding/OnboardingController.tsx
    - client/src/ui/components/LocationStack.tsx
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json
decisions:
  - 'pulse persists ДО tap на button — toast auto-fade его НЕ гасит (per CONTEXT design)'
  - 'window.__mainScene exposed в production (не только DEV) — нужен React-bridge'
  - 'pulse style > current style — pink glow (16px) перебивает current ring (2px solid)'
  - 'LocationUnlockCelebration mount unconditionally — event-driven visibility избегает race с store hydration'
metrics:
  duration: ~35 минут (3 tasks atomic commits)
  completed: 2026-05-17
  tasks_completed: 3
  files_created: 3
  files_modified: 7
---

# Phase 23 Plan 05: Beat 4 Location Celebration Summary

Beat 4 onboarding — celebration на каждый первый `location:unlocked` event для
`{2, 3, 6}`: Phaser confetti burst в центре canvas + DOM toast slide-up снизу +
LocationStack pulse/glow/bobble на новой location button. Per-location flag
обеспечивает idempotency (повторный unlock = no-op).

## What was built

### ConfettiBurst (`game/effects/ConfettiBurst.ts`)

Single-shot static API: `ConfettiBurst.fire({ scene, x, y, palette, count?, lifespanMs?, depth? })`.

- **Texture**: генерируется один раз на scene — 4x4 white pixel chunk (`onb-confetti-pixel`).
  Tint накладывается per-particle через emitter `tint: palette`.
- **Particle config**: speed 200..450, angle 200..340 (верхняя полусфера),
  gravityY 700, lifespan 1200ms, scale 1.5→0.3, alpha 1→0, rotate 0..360.
- **Self-destruct**: `scene.time.delayedCall(lifespan + 300, …)` — emitter
  уничтожается через timeline scene'ы, никаких leaks при shutdown.
- **Depth**: 6000 default (выше TutorialPulseRing 5000).

Palettes per location (per CONTEXT.md):
- 2 Болото: `[0xbef264, 0xfdd87a, 0x65a30d, 0xfacc15]` (green/yellow)
- 3 Лес:    `[0x86efac, 0x15803d, 0xa16207, 0x854d0e]` (green/brown)
- 6 Cosmos: `[0x67e8f9, 0x0e7490, 0xa78bfa, 0x6d28d9]` (cyan/violet)

### LocationUnlockCelebration (`components/Onboarding/LocationUnlockCelebration.tsx`)

DOM toast banner, subscribed на `onboarding:locationCelebrationStart` /
`Dismiss`. Single instance — никакой очереди, в нормальном gameplay два разных
unlock'а не сработают одним кадром.

- **Animation**: CSS keyframes `onb-toast-slide-up` (350ms ease-out) на mount,
  `onb-toast-fade-out` (300ms ease-in) на exit. Файл `locationCelebration.css`.
- **Lifecycle**: visible до `TOAST_VISIBLE_MS=7000` → `beginExit()` → unmount
  после `TOAST_EXIT_MS=300`. Tap по тосту тоже триггерит `beginExit()`.
- **Styling**: pill `#ec4899` gradient, `bottom: 120`, `z-index: 101`, role=status
  aria-live=polite. NEVER блокирует gameplay — pointer events только на самом
  тосте, не full-screen.
- **i18n**: `t('onboarding.location.unlocked', { name: 'emoji + locName' })` →
  «🌿 Болото открыто! Тапни иконку чтобы перейти».

### LocationStack pulse (`ui/components/LocationStack.tsx`)

- `pulsingLocationId` локальный state — set на `celebrationStart`, clear на
  `celebrationDismiss`. **Pulse persists ДО tap на button** — toast auto-fade
  pulse НЕ гасит (per CONTEXT design «положительное приглашение, а не таймер»).
- `handleSelect`: первым делом если `id === pulsingLocationId` → emit
  `Dismiss` (даже если transition заблокирован, pulse-state снимается).
- `LocationButton` получает `isPulsing` prop. Pulse styling:
  - `boxShadow`: `${baseShadow}, 0 0 16px 4px #ec4899` — pink glow поверх обычной тени.
  - `animation: onb-loc-bobble 1200ms ease-in-out infinite` — scale 1.0↔1.1.
  - CSS keyframe inline в `<style>` блоке на root JSX (один раз).
- Cliclability: добавлен `type="button"` к collapse-toggle + LocationButton.

### OnboardingController Beat 4 (`components/Onboarding/OnboardingController.tsx`)

- Single `useEffect` подписка на `eventBus.on('location:unlocked', …)`.
- Snapshot чтение `useOnboardingStore.getState()` внутри handler'а (не из render
  selector) — избегает re-attach listener'а на каждый mark.
- Per-location guard: `if (store.locationsCelebrated[id]) return`. Иначе
  `markLocationCelebrated(id)` + `ConfettiBurst.fire(...)` + emit Start.
- `<LocationUnlockCelebration />` mount unconditional — event-driven visibility.

### React→Phaser bridge

`MainScene.create()` теперь exposes `window.__mainScene` в **production**
(было только DEV). Cleanup в `destroy()` через ownership check
(`if (w.__mainScene === this) delete w.__mainScene`). Plan 23-05 — первое
production-bridge использование, документирован inline comment'ом.

### eventBus (`store/eventBus.ts`)

Два новых event'а:
- `onboarding:locationCelebrationStart { locationId }` — emit'ит Controller.
- `onboarding:locationCelebrationDismiss { locationId }` — emit'ит LocationStack
  по button tap.

### i18n

Добавлен ключ `locations.6` во все 3 locale'а (`ru.json`, `en.json`, `es.json`):
- ru: «Звёздная карта»
- en: «Star Map»
- es: «Mapa Estelar»

Существующий `onboarding.location.unlocked` (Plan 23-01) использован как есть.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] План использовал nameKey `locations.swamp`/`locations.forest`/`locations.starMap`**

- **Found during**: Task 2 — изучение i18n структуры.
- **Issue**: В i18n у нас ключи `locations.1/2/3/4` (numeric), а не `swamp/forest/starMap`. Если использовать план дословно — `t('locations.swamp')` вернул бы ключ как строку.
- **Fix**: В `LocationUnlockCelebration.tsx` LOC_INFO использует `nameKey: 'locations.{id}'`. Добавлен `locations.6` во все 3 locale'а (его не было ранее).
- **Files modified**: `client/src/components/Onboarding/LocationUnlockCelebration.tsx`, `client/src/i18n/{ru,en,es}.json`.
- **Commit**: 79545f1.

**2. [Rule 2 - Critical] `window.__mainScene` не было в production**

- **Found during**: Task 1 — план референсирует `(window as any).__phaserMainScene`, такого export'а не существовало.
- **Issue**: `MainScene.create()` exposes `window.__mainScene` только в `import.meta.env.DEV` блоке (Phase 12 smoke-helpers). Если оставить так — Beat 4 confetti НЕ будет работать в production build, только в DEV.
- **Fix**: Убран `if (DEV)` guard, exposing сделан unconditional. Добавлен cleanup в `destroy()` с ownership check.
- **Files modified**: `client/src/game/scenes/MainScene.ts`.
- **Commit**: fb1b50a.

**3. [Rule 1 - Bug] План имел inconsistent dismiss flow**

- **Found during**: Task 2/3 alignment.
- **Issue**: План в одном месте говорил «dismiss event emit'ится button tap'ом» (для LocationStack), а в Task 2 — что toast onClick тоже emit'ил dismiss. Это бы гасило pulse на LocationStack при tap на toast — нарушение «Pulse persists до первого tap на location button».
- **Fix**: Toast `beginExit()` НЕ emit'ит eventBus dismiss — только локальный unmount. LocationStack emit'ит Dismiss только при tap на pulsing button. Это сохраняет независимость двух жизненных циклов: toast 7s auto-fade ИЛИ tap, pulse — только button tap.
- **Files modified**: `client/src/components/Onboarding/LocationUnlockCelebration.tsx`.
- **Commit**: 79545f1.

## Verification

- `npx tsc --noEmit` — clean ✓
- `npm run build` — successful (4.04s, no errors, only pre-existing chunk warnings) ✓
- Manual UX — auto-approved (workflow.auto_advance=true; checkpoint Task 4 пропущен).

## Auth Gates

Не возникали.

## Notes for Plan 23-06

- `window.__mainScene` теперь production-exposed — Plan 23-06 smoke-test может
  использовать. Документировать в smoke checklist.
- `LOC_INFO` карта (locationId → emoji+nameKey) — пока внутри `LocationUnlockCelebration.tsx`.
  Если Plan 23-06 захочет reuse (smoke-test эмулирует unlock через
  `eventBus.emit('location:unlocked', {locationId: 2})`), извлечь в shared util.
- LocationStack pulse — visible только когда location button mounted в stack.
  Star Map (id=6) появляется после `cosmosUnlocked === true` (cosmos gate), поэтому
  `markCosmosUnlocked()` должен сработать **до** `location:unlocked` emit для
  locationId=6 — иначе pulse fall'нет в void (button not yet rendered).
  В Phase 22 MergeController порядок правильный (cosmos unlock сначала), но
  Plan 23-06 smoke должен это проверить.

## Self-Check: PASSED

Files: ConfettiBurst.ts, LocationUnlockCelebration.tsx, locationCelebration.css — FOUND.
Commits: fb1b50a, 79545f1, fc5f256 — FOUND.
