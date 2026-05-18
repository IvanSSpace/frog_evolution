---
phase: 26-cosmos-races-foundation
plan: 05
subsystem: cosmic-frogs
tags: [first-contact, cinematic, dom-modal, controller, eventbus, race-lore, phase26]

# Dependency graph
requires:
  - phase: 26-01
    provides: RaceId union + RACES_BY_ID + markFirstContactSeen action + firstContactsSeen state + 'cosmos:first-contact' eventBus + races.* i18n keys + cosmos.first_contact.* i18n keys
  - phase: 26-02
    provides: getPlanetInhabitant(planetId) → {raceId, role} runtime API
  - phase: 24
    provides: CaptainBirthEffect Phaser cinematic pattern (texture-gen + ring-via-state tween) + CaptainBirthModal DOM modal pattern + captainBirthController coordinator pattern
  - phase: 25
    provides: _styles.ts shared design tokens (PINK / GOLD)
  - phase: 23
    provides: WelcomeModal DOM modal pattern (centered card + createPortal + cliclability checklist)
provides:
  - "FirstContactEffect Phaser cinematic (~35 particles + 1 ring, race-color tinted, ~2s)"
  - "FirstContactModal DOM component (race emoji+name+personality+lore+CTA)"
  - "FirstContactController App-level event-flow coordinator"
  - "StarMapScene.getPlanetWorldCoords(planetId) helper + window.__starMapScene exposure"
  - "eventBus 'cosmos:first-contact-effect-complete' typed event"
  - "DEV helper __triggerFirstContact(raceId)"
affects: [26-06 finalize smoke test + ROADMAP/STATE update]

# Tech tracking
tech-stack:
  added: []  # No new libraries — reuse Phaser 4 + React 19 + mitt
  patterns:
    - "Lightweight cinematic via texture-gen + state-object-tween (mirror CaptainBirthEffect, lighter scale)"
    - "Lazy scene resolution in handler (window.__starMapScene → window.__mainScene fallback) — first-contact работает на любой scene"
    - "useRef для capturing event payload «в полёте» между emit и downstream complete (mitt не кеширует last)"
    - "Defensive emit-complete next-tick для unknown raceId / no-scene paths — controller не залипает в pending state"
    - "Window scene exposure с `if (... === this) delete` cleanup pattern (T-26-05-05 ownership mitigation, mirror MainScene)"
    - "useEffect ДО early-return для соблюдения React rules-of-hooks (Rule 1 — fixed plan-text bug в FirstContactModal)"

key-files:
  created:
    - client/src/game/effects/FirstContactEffect.ts
    - client/src/components/FirstContact/FirstContactModal.tsx
    - client/src/components/FirstContact/firstContactController.tsx
  modified:
    - client/src/store/eventBus.ts
    - client/src/game/scenes/StarMapScene.ts
    - client/src/App.tsx
    - client/src/utils/devRaces.ts

key-decisions:
  - "2s total duration (vs 3s CaptainBirth) — first-contact event частый (до 10 раз за progression: 10 races); 3-сек cinematic утомит. Particles 35 + 1 ring (vs 70+3) — same rationale."
  - "Race-color tint (mixed с white) для particles + ring — visual race identity hook, distinct от gold/cyan CaptainBirth palette."
  - "Backdrop click closes modal (vs WelcomeModal который ignores) — narrative event, не critical decision (per CONTEXT D-Cliclability)."
  - "markFirstContactSeen вызывается ПОСЛЕ fade-out 300ms (в setTimeout callback) — гарантирует animation completion даже если markSeen state mutation вызовет re-render."
  - "useRef для pendingRaceIdInFlightRef вместо closure object — idiomatic React + synchronous read/write без re-render (mitt не кеширует last payload, нужен outer ref)."
  - "useEffect ДО early-return для !race case — React rules-of-hooks compliance (plan-text имел баг с useEffect после early-return)."
  - "Replay-safe DEV testing: __triggerFirstContact НЕ markSeen, для full replay нужен __resetFirstContacts() first; задокументировано в JSDoc + console.info hint."
  - "window.__starMapScene exposure pattern mirror MainScene (Phase 23 Plan 23-05) — bridge React↔Phaser для cinematic anchor coords + scene resolution в FirstContactEffect."
  - "getPlanetWorldCoords helper использует existing allSystems collection — не требует отдельного indexed Map; для 451 planets linear scan приемлем (rare event, не render-loop)."
  - "Coordinate fallback chain: getPlanetWorldCoords → cameras.main.center → hardcoded (200, 300) — gracefully degrades если scene не доступен."

patterns-established:
  - "Lightweight cinematic via reuse: install handler subscribe → run particles+ring → delayedCall emit complete. Pattern for future small bursts (3-tier merge complete, achievement burst, etc.)."
  - "Controller → emit cosmos:* → handler runs effect → emit *-complete → controller setState → mount DOM modal. Three-step coordinator flow scalable для других narrative beats."
  - "Window-exposed scene refs (`window.__sceneName`) — bridge React↔Phaser для one-off cross-context calls (coords lookups, dev helpers). Use sparingly; production-OK если используется в narrow code path."

requirements-completed:
  - PHASE26-FIRSTCONTACT-EFFECT
  - PHASE26-FIRSTCONTACT-MODAL
  - PHASE26-FIRSTCONTACT-WIRING
  - PHASE26-FIRSTCONTACT-IDEMPOTENT

# Metrics
duration: ~30min
completed: 2026-05-18
---

# Phase 26 Plan 26-05: First contact cinematic + modal Summary

**Когда player впервые tap'ает habitable planet — играется Phaser cosmic burst (~2s, race-color tinted) → DOM modal с race emoji + name + personality + lore + pink CTA. Per-race idempotent flag (firstContactsSeen[raceId]) гарантирует один-shot. Controller координирует event-flow через 3-step pipeline (planet-tapped → cosmos:first-contact → cosmos:first-contact-effect-complete).**

## Objective recap

Plan 26-05 — финальный gameplay-facing piece Phase 26. Plans 26-01/02/03/04 заложили данные (race config + 30 habitable planets) / state (firstContactsSeen) / визуалы (race glow on Star Map) / UI (Inventory tab). Без этого plan'а Phase 26 deliverable неполный — нет narrative event при first habitable planet visit.

## What was built

### `client/src/game/effects/FirstContactEffect.ts` (new, ~205 lines)

Lighter-scale Phaser cinematic, reuse CaptainBirthEffect.ts texture-gen + state-object-tween pattern:

- **35 particles** (vs 70 у CaptainBirth) — radial 360° burst, race.homeColor + white mixed tint, lifespan 1.8s, scale 0.4→1.6, alpha 1→0
- **1 expanding ring** (vs 3 cascade) — race.homeColor, radius 12→140, alpha 0.8→0, duration 1.5s, Quad.easeOut
- **No camera zoom** (vs CaptainBirth zoom 1.0→1.08→1.0) — first-contact event частый, без камер-effects чтобы не утомлять
- **~2s total duration** — emit 'cosmos:first-contact-effect-complete' через TOTAL_DURATION_MS
- **Lazy scene resolution** — `window.__starMapScene → window.__mainScene` fallback
- **Defensive paths**: unknown raceId → queueMicrotask emit-complete; no scene → setTimeout 0 emit-complete (controller не залипает в pending state — T-26-05-01 mitigation)
- **Idempotent install/uninstall** — activeHandler swap (T-26-05-04 HMR-safe)
- **НЕ trogает frog.container.alpha** — все GameObjects independent depth 9000

### `client/src/components/FirstContact/FirstContactModal.tsx` (new, ~205 lines)

DOM modal с race info, reuse WelcomeModal centered-card pattern + Phase 25 design tokens:

- `createPortal` к document.body (above Phaser canvas)
- Backdrop rgba(0,0,0,0.6) + backdropFilter blur(3px), z-index 200
- Dark card `#1a2e1a` + 2px rgba(255,255,255,0.15) border, max-width 340
- **Content sections**:
  - Gold uppercase title «Первый контакт» (`cosmos.first_contact.title`)
  - Race emoji 56px с `drop-shadow(0 0 16px race.homeColor)` — visual identity hook
  - Race name (`races.{id}.name`) — 22px white, bold
  - Personality italic (`races.{id}.personality`) — 12px dim
  - Lore short body (`races.{id}.lore_short`) — 14px, left-aligned, 1.5 line-height
  - Pink CTA «Понятно» (`cosmos.first_contact.cta`) — width:auto inline-block, min-width 140
- **Cliclability**: type=button, touchAction:manipulation, stopPropagation на inner card, backdrop click closes (narrative — D-Cliclability per CONTEXT)
- **Fade-out 300ms** перед `markFirstContactSeen(raceId) + onClose()` — гарантирует animation completion до state mutation
- **Defensive**: invalid raceId → useEffect→onClose() без mark (T-26-05-01); useEffect ДО early-return (Rule 1 — plan-text имел rules-of-hooks баг)

### `client/src/components/FirstContact/firstContactController.tsx` (new, ~115 lines)

App-level React component-coordinator, mount'нут один раз в App.tsx:

```
StarMapScene 'starmap:planet-tapped' (popovers.ts emit)
  ↓ controller checks getPlanetInhabitant(id) + firstContactsSeen[raceId]
  ↓ resolve planet world coords via window.__starMapScene.getPlanetWorldCoords
  ↓ emit 'cosmos:first-contact' {raceId, x, y}
FirstContactEffect handler runs Phaser cinematic ~2s
  ↓ emit 'cosmos:first-contact-effect-complete'
Controller setState(pendingRaceId) → mount FirstContactModal
  ↓ user CTA / backdrop click → fade-out 300ms → markFirstContactSeen → onClose
Controller setState(null) → modal unmount
```

- **pendingRaceIdInFlightRef** (useRef) захватывает raceId между emit и effect-complete (mitt не кеширует last payload)
- **Coordinate fallback chain**: getPlanetWorldCoords helper → cameras.main center → hardcoded (200, 300) — gracefully degrades если scene не доступен
- **useEffect cleanup** снимает все 3 eventBus handlers + Phaser effect handler (HMR-safe)
- **Per-race idempotent** — short-circuit на firstContactsSeen[raceId] === true

### `client/src/game/scenes/StarMapScene.ts` (modified, +27 lines)

- **`window.__starMapScene = this`** в `create()` — bridge для FirstContactController coords lookup + FirstContactEffect scene resolution (pattern mirror MainScene Phase 23 Plan 23-05)
- **Cleanup `if (w.__starMapScene === this) delete`** в `shutdown()` — T-26-05-05 ownership conflict mitigation
- **`getPlanetWorldCoords(planetId): {x, y} | null`** — public method, lookup через existing `allSystems` collection, returns null если planet не найдена

### `client/src/store/eventBus.ts` (modified, +9 lines)

- New typed event `'cosmos:first-contact-effect-complete': void` — сигнал controller'у что Phaser cinematic закончился, можно mount'ить DOM modal
- Inline JSDoc объясняет lifecycle + defensive emit fallback (T-26-05-04)

### `client/src/App.tsx` (modified, +6 lines)

- Import `FirstContactController` from `./components/FirstContact/firstContactController`
- JSX mount `<FirstContactController />` рядом с `<CaptainBirthModal />` — один раз App-level

### `client/src/utils/devRaces.ts` (modified, +35 lines)

- New `window.__triggerFirstContact(raceId: RaceId)` — эмитит `cosmos:first-contact` напрямую с camera center coords (StarMapScene → MainScene fallback)
- **Replay caveat documented**: helper НЕ markSeen; для full-replay testing нужно вызвать `__resetFirstContacts()` first (controller mount'ит modal независимо от seen state, но markSeen idempotent — no effect если already true)
- Console hint в info log

## Interfaces exported (consumed by 26-06 finalize)

| Export | From | Purpose |
|--------|------|---------|
| `installFirstContactEffect()` | `game/effects/FirstContactEffect` | Subscribe Phaser handler (currently called from controller's useEffect) |
| `uninstallFirstContactEffect()` | `game/effects/FirstContactEffect` | Manual cleanup (not currently used; available для smoke tests) |
| `FirstContactModal` | `components/FirstContact/FirstContactModal` | Reusable component для downstream если modal нужно показать вне controller flow |
| `FirstContactController` | `components/FirstContact/firstContactController` | App-mounted coordinator |
| `'cosmos:first-contact-effect-complete'` event | `store/eventBus` | Future hooks if нужно subscribe к completion (e.g. analytics) |
| `StarMapScene.getPlanetWorldCoords(id)` | `game/scenes/StarMapScene` | Public helper, coords lookup для anchor'ов |
| `window.__starMapScene` | runtime DOM | Bridge React↔Phaser для cross-context calls |
| `window.__triggerFirstContact(raceId)` | DEV console | Smoke test trigger |

## Validation results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS (clean across all touched files) |
| ESLint на touched files (--fix applied) | PASS (0 errors, 0 warnings) |
| `npx vitest run` full suite | PASS (104 tests) |
| `node scripts/check-translations.cjs` | PASS (400/400 keys × 3 locales) |
| `./node_modules/.bin/vite build` production | PASS (built in ~4s, chunks within Phase 26 budget) |
| Manual: window.__starMapScene exposure | Confirmed via Read of StarMapScene.create / shutdown |
| Manual: i18n keys present (cosmos.first_contact.title / cta) | Confirmed from 26-01-SUMMARY (3 keys × 3 locales, 50 race keys × 3 locales) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] FirstContactModal `useEffect` after early-return**
- **Found during:** Task 2 implementation
- **Issue:** Plan-text имел паттерн:
  ```tsx
  if (!race) {
    useEffect(() => { onClose() }, [onClose])
    return null
  }
  ```
  Это нарушает React rules-of-hooks (hooks must be called в одном order в каждом render).
- **Fix:** Перенёс `useEffect(() => { if (!race) onClose() }, [race, onClose])` ДО `if (!race) return null` early-return. Hook всегда вызывается, side-effect conditional внутри callback.
- **Files modified:** `client/src/components/FirstContact/FirstContactModal.tsx`
- **Commit:** 8b9528a

**2. [Rule 1 — Bug] Tween.getValue() / closure ref → use useRef + state-object pattern**
- **Found during:** Task 1 + Task 3 design
- **Issue:** Plan task 1 spawnRing использовал `tween.getValue('r')` — Phaser 4 tween API не имеет такого метода (deprecated в Phaser 3). Plan task 3 controller использовал outer `const pendingRaceIdInFlightRef = { current: ... }` объявленный inside useEffect — recreated на каждом render с empty deps array (works case-by-case, но не idiomatic React).
- **Fix:**
  - FirstContactEffect: переписал spawnRing на state-object-tween pattern (mirror CaptainBirthEffect.spawnRings — tween targets mutable plain object, onUpdate reads из state).
  - firstContactController: использовал `useRef<RaceId | null>(null)` — idiomatic React, synchronous read/write без re-render.
- **Files modified:** `client/src/game/effects/FirstContactEffect.ts`, `client/src/components/FirstContact/firstContactController.tsx`
- **Commits:** f99c3f6, 6687839

**3. [Rule 2 — Code style consistency] Prettier autofix**
- **Found during:** Task 4 lint step
- **Issue:** 3 prettier errors (cosmetic — multi-line interface wrap + setTimeout single-line).
- **Fix:** `npx eslint --fix` на новых файлах. 3 errors → 0.
- **Files modified:** `client/src/game/effects/FirstContactEffect.ts`, `client/src/utils/devRaces.ts`
- **Commit:** b4b7801

### Acknowledged: No threat-model surprises

All STRIDE entries (T-26-05-01..06) либо mitigated в коде, либо accepted (T-26-05-03 narrative event без gameplay impact). См. plan section для full disposition table.

## Authentication gates

None. Plan не требует auth.

## Threat Flags

(empty — no new security surface; existing window.__* pattern continues established Phase 23/24 convention)

## Downstream blockers cleared

- **Plan 26-06 (finalize)**: smoke test scenarios (tap habitable planet → cinematic + modal → CTA close → re-tap idempotent → different race → re-plays) можно валидировать. ROADMAP/STATE update готов.

## Commits (in order)

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | f99c3f6 | feat | FirstContactEffect Phaser cinematic + StarMapScene wiring (window.__starMapScene + getPlanetWorldCoords) + eventBus 'cosmos:first-contact-effect-complete' |
| 2 | 8b9528a | feat | FirstContactModal DOM component with race lore (emoji + name + personality + lore + pink CTA, cliclability checklist) |
| 3 | 6687839 | feat | FirstContactController + App mount (3-handler event-flow coordinator + useEffect cleanup) |
| 4 | b4b7801 | feat | __triggerFirstContact dev helper + prettier autofix |

## Success criteria checklist

- [x] FirstContactEffect.ts Phaser cinematic (~35 particles + 1 ring, ~2s, race-color tinted)
- [x] FirstContactModal.tsx DOM modal с race emoji/name/personality/lore/CTA
- [x] firstContactController.tsx App-level coordinator mount'нут в App.tsx
- [x] StarMapScene expose'ит window.__starMapScene + getPlanetWorldCoords()
- [x] Idempotent per-race flag (Plan 26-01 markFirstContactSeen — controller проверяет ДО emit)
- [x] Cliclability: type=button, z-index 200, touchAction:manipulation, stopPropagation, backdrop closes
- [x] НЕ trogает frog.container.alpha (только independent GameObjects + DOM portal)
- [x] DEV helper `__triggerFirstContact(raceId)` + replay caveat documented
- [x] tsc clean + lint clean (0 errors) + 104 vitest tests pass + i18n parity 400/400 + production build succeeds
- [x] Per-task atomic commits (4 commits, conventional commit format)

## Self-Check: PASSED

- `client/src/game/effects/FirstContactEffect.ts` — exists ✓
- `client/src/components/FirstContact/FirstContactModal.tsx` — exists ✓
- `client/src/components/FirstContact/firstContactController.tsx` — exists ✓
- `client/src/store/eventBus.ts` modified ('cosmos:first-contact-effect-complete' typed) — verified ✓
- `client/src/game/scenes/StarMapScene.ts` modified (window exposure + getPlanetWorldCoords) — verified ✓
- `client/src/App.tsx` modified (FirstContactController import + mount) — verified ✓
- `client/src/utils/devRaces.ts` modified (__triggerFirstContact + window declaration) — verified ✓
- Commit f99c3f6 (FirstContactEffect + StarMapScene wiring) — found in git log ✓
- Commit 8b9528a (FirstContactModal) — found in git log ✓
- Commit 6687839 (FirstContactController + App mount) — found in git log ✓
- Commit b4b7801 (dev helper + prettier autofix) — found in git log ✓
- `npx tsc --noEmit` clean — verified ✓
- `npx vitest run` 104 tests pass — verified ✓
- `check-translations` 400/400 parity — verified ✓
- `vite build` production succeeds — verified ✓
