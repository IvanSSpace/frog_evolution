---
phase: 24-captain-creation-cinematic
plan: 02
subsystem: cinematic-effects
tags: [phaser, cinematic, particles, camera-zoom, eventBus]
requires:
  - 24-01 (captain:birth-start / captain:birth-effect-complete events)
provides:
  - CaptainBirthEffect (install/uninstall/play API)
  - eventBus emit 'captain:birth-effect-complete' (trigger for Plan 24-03 modal)
affects:
  - client/src/game/scenes/MainScene.ts (install in create, uninstall in destroy)
tech-stack:
  added: []
  patterns:
    - "ConfettiBurst.ts-style texture generation (6x6 white pixel + tint palette)"
    - "Idempotent global eventBus subscription (install/uninstall pair)"
    - "scene.time.delayedCall для self-destruct (Phaser auto-clears при scene shutdown)"
key-files:
  created:
    - client/src/game/effects/CaptainBirthEffect.ts
  modified:
    - client/src/game/scenes/MainScene.ts
decisions:
  - "Camera zoom completion детектится через scene.time.delayedCall, не через CameraZoomCallback (last срабатывает per-frame, не детерминированно в конце)"
  - "Single 6x6 white pixel texture + tint palette (golden/white/cosmic blue) — pattern из ConfettiBurst.ts, без зависимости от asset-файла"
  - "Particles depth 9000, rings DEPTH-1 (8999) — particles overlay rings"
  - "70 particles из диапазона CONTEXT 60-80 (центр)"
  - "install() идемпотентен — сначала снимает старый handler, защита от HMR/restart"
metrics:
  duration_min: ~10
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  completed: 2026-05-18
---

# Phase 24 Plan 24-02: Captain Birth Cinematic Effect Summary

**One-liner:** Phaser cinematic «cosmic growing effect» — 70 radial particles + 3 expanding rings + camera zoom 1.0→1.08→1.0, ~2.55s total, emits completion event для DOM modal Plan 24-03.

## What changed

### Created: `client/src/game/effects/CaptainBirthEffect.ts` (199 lines)

Single-shot Phaser cinematic effect, реагирующий на eventBus `'captain:birth-start': {x, y}`. Три параллельных слоя анимации:

1. **Radial particle burst (70 particles)**
   - Texture: 6x6 white pixel, генерируется один раз на scene (cached через `scene.textures.exists`)
   - Tint palette: `[0xfde047, 0xffffff, 0x67e8f9]` (golden / white / cosmic blue)
   - Speed: 80-200, angle: 0-360° (полный radial spread), gravity: 0
   - Lifespan: 2500ms, scale grow 0.5→2.0, alpha fade 1→0
   - Depth: 9000 (cinematic top layer)

2. **3 concentric expanding rings** (staggered 400ms offset)
   - Phaser Graphics с tween'ом `state = {r, a}` + per-frame redraw в `onUpdate`
   - Радиус: 20 → 200px, alpha: 0.8 → 0, ease: Sine.easeOut, duration 1500ms
   - Color: 0xfde047 (golden), stroke 4px
   - Depth: 8999 (под particles, но над всем остальным)

3. **Camera dramatic zoom**
   - Zoom in 1.0 → 1.08 за 1500ms (Sine.easeInOut)
   - Zoom out 1.08 → 1.0 за 800ms (Sine.easeInOut, force=true)
   - 200ms safety buffer перед emit completion

**Total duration ≈ 2.55s** (zoom-in 1500ms + 50ms gap + zoom-out 800ms + 200ms buffer).

### API surface

```ts
CaptainBirthEffect.install(scene)   // подписка на 'captain:birth-start', идемпотентно
CaptainBirthEffect.uninstall()      // снимает global handler
CaptainBirthEffect.play(scene, x, y) // прямой вызов для smoke tests / dev console
```

`play()` emit'ит `'captain:birth-effect-complete'` через scene.time.delayedCall — это input trigger для Plan 24-03 (CaptainBirthModal mount).

### Modified: `client/src/game/scenes/MainScene.ts` (+9 lines)

- Import: `import { CaptainBirthEffect } from '../effects/CaptainBirthEffect'`
- `create()`: `CaptainBirthEffect.install(this)` рядом с другими eventBus.on (после `cosmic:cosmic-box-purchased`)
- `destroy()`: `CaptainBirthEffect.uninstall()` рядом с другими eventBus.off

## Phaser API quirks (важно для будущих эффектов)

**`scene.cameras.main.zoomTo(zoom, duration, ease, force, callback, context)`**

Сигнатура callback — `(camera, progress, zoom) => void` — это **per-frame onUpdate**, не финальный onComplete. Если нужен deterministic emit «когда эффект кончился», использовать `scene.time.delayedCall(totalDuration + buffer, fn)`. Иначе emit будет срабатывать каждый кадр (60+ раз/сек).

Проверено на Phaser 4.1 (`client/node_modules/phaser/types/phaser.d.ts`).

## How to test

### Manual smoke test (DEV console)

После загрузки игры (когда MainScene активна и `window.__mainScene` доступен) выполни в DevTools console:

```js
// Импортируй eventBus через window if exposed, иначе через dynamic import
import('/src/store/eventBus.ts').then(({ eventBus }) => {
  const scene = window.__mainScene
  const cam = scene.cameras.main
  eventBus.emit('captain:birth-start', { x: cam.centerX, y: cam.centerY })
  // Подписка на completion для подтверждения
  eventBus.on('captain:birth-effect-complete', () => {
    console.log('[CaptainBirthEffect] complete ✓')
  })
})
```

Ожидаемое:
- 70 partilces разлетаются радиально из центра canvas, palette golden/white/cyan
- 3 кольца расходятся с offset 400ms (видно как «волны»)
- Camera plавно zoom-in за 1.5s, потом zoom-out за 0.8s
- Через ~2.55s в консоль: `[CaptainBirthEffect] complete ✓`
- Frogs не «мерцают прозрачностью» (alpha frog.container не трогается)

### Direct play (без emit)

```js
window.__mainScene && (async () => {
  const m = await import('/src/game/effects/CaptainBirthEffect.ts')
  const cam = window.__mainScene.cameras.main
  m.CaptainBirthEffect.play(window.__mainScene, cam.centerX, cam.centerY)
})()
```

## Verification results

| Gate | Result |
| --- | --- |
| `cd client && npx tsc --noEmit` | ✓ 0 errors (TypeScript compilation completed) |
| `cd client && npm run build` (vite) | ✓ built in 4.18s |
| `grep "container.alpha" CaptainBirthEffect.ts` | 0 операций (только комментарий с warning) |
| Done criteria Task 1 (export class + tsc clean + Phaser/eventBus imports) | ✓ |
| Done criteria Task 2 (install + uninstall в lifecycle, tsc clean) | ✓ |

## Deviations from Plan

None — plan executed exactly as written. Все таймиги/константы взяты прямо из PLAN section. Camera completion callback использует delayedCall как описано в plan comments-for-executor (предусмотрен fallback).

## Commits

| Hash | Files | Message |
| --- | --- | --- |
| `12cae56` | `client/src/game/effects/CaptainBirthEffect.ts` (new) | `feat(24-02): CaptainBirthEffect cinematic (particles + 3 rings + camera zoom)` |
| `4a1f3cc` | `client/src/game/scenes/MainScene.ts` | `feat(24-02): wire CaptainBirthEffect install/uninstall in MainScene` |

## What's next (Plan 24-03 / 24-04)

- **Plan 24-03** (parallel — уже started): DOM `CaptainBirthModal.tsx` subscribe'тся на `'captain:birth-effect-complete'` для mount. Mod не должен flicker через alpha frog.
- **Plan 24-04**: `MergeController` emit'ит `'captain:birth-start'` после первого L18+L18 normal merge (guard'нутый `captainBirthSeen` из 24-01).
- **Plan 24-05**: end-to-end integration + dev trigger `window.__triggerCaptainBirth()`.

## Self-Check: PASSED

- `client/src/game/effects/CaptainBirthEffect.ts` exists (199 lines, exports `CaptainBirthEffect` class)
- `client/src/game/scenes/MainScene.ts` modified (import + install + uninstall — 3 точки изменений, +9 lines)
- Commit `12cae56` exists (verified via `git log`)
- Commit `4a1f3cc` exists (verified via `git log`)
- tsc clean (full project, не только grep по нашим файлам)
- vite build OK
- 0 файлов deleted в обоих коммитах
