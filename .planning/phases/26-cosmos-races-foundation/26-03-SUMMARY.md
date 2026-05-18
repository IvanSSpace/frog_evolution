---
phase: 26-cosmos-races-foundation
plan: 03
subsystem: cosmic-frogs
tags: [star-map, race-overlays, glow, phaser, cosmos-gate, popover, i18n, phase26]

# Dependency graph
requires:
  - phase: 26-01
    provides: RaceId union + RACES_BY_ID + getRaceColor + emojiIcon + nameKey i18n
  - phase: 26-02
    provides: HABITABLE_PLANET_IDS Set + getPlanetInhabitant + PlanetInhabitant type
  - phase: 22
    provides: hasCosmosUnlocked gate + useGameStore.subscribe pattern
  - phase: 20-XX
    provides: PlanetRenderer class (renderMain/renderBg) + StarMapScene.shutdown lifecycle
  - phase: 23
    provides: ConfettiBurst texture-gen pattern (radial gradient white texture reuse)
provides:
  - "RaceGlowController class (attach/detach/destroy/updatePosition methods)"
  - "installRaceGlow factory for Phaser scenes"
  - "PlanetRenderer.tryAttachRaceOverlay + attachAllHabitable (cosmos-gated overlay attach)"
  - "PlanetRenderer.destroy() with Zustand unsubscribe + RaceGlowController.destroy() chain"
  - "Reactive cosmos unlock → overlay attach без reload"
  - "StarMapScene.shutdown invokes planetRenderer.destroy() for leak-free teardown"
  - "Popover race info row (emoji + race name + role label) gated by cosmos+habitable"
  - "i18n keys cosmos.role_home + cosmos.role_colony in RU/EN/ES (parity 402/402)"
affects: [26-05 first-contact-controller (popover уже знает race; controller использует тот же getPlanetInhabitant)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phaser texture-gen reuse от ConfettiBurst (radial gradient via concentric circles, quadratic alpha falloff, 32 steps, 256px texture)"
    - "Cosmos gate в Phaser-side: useGameStore.getState().hasCosmosUnlocked для one-shot, useGameStore.subscribe для reactive (plain subscribe + manual diff через lastCosmosUnlocked field; project НЕ использует subscribeWithSelector middleware)"
    - "3-GameObject overlay group per planet (glow Image, icon Text, optional homeHalo Image+Tween) tracked в Map<planetId, OverlayGroup>"
    - "Layered depth relative to planet container (depth -2 / -1 / +1)"

key-files:
  created:
    - client/src/game/scenes/starmap/effects/raceGlow.ts
  modified:
    - client/src/game/scenes/starmap/rendering/planetRenderer.ts
    - client/src/game/scenes/StarMapScene.ts
    - client/src/game/scenes/starmap/popovers.ts
    - client/src/i18n/ru.json
    - client/src/i18n/en.json
    - client/src/i18n/es.json

key-decisions:
  - "Phaser-native rendering vs CSS overlay поверх canvas — выбрали Phaser-native: single rendering layer, simpler depth management, синхронно с camera pan/zoom, нет DOM↔Phaser layout cost"
  - "Texture-gen radial gradient via concentric circles (32 steps + quadratic alpha falloff) вместо WebGL shader — works on all Phaser builds, no GPU feature dependency, runs один раз per scene (cached в textures.exists(GLOW_TEX_KEY))"
  - "Visual stack: home gold halo (depth-2) → race color glow (depth-1) → planet (depth 0) → race emoji icon (depth+1). Стекинг даёт правильный read: pulse halo за всем, glow подсвечивает planet, emoji читается поверх"
  - "ADD blend mode на glow + halo — соответствует bright soft glow поверх nebula bg, не делает картинку грязной как multiply"
  - "Sine.easeInOut yoyo 1500ms для home pulse — гладкий, не агрессивный (плеер не отвлекается)"
  - "Subscribe pattern: plain useGameStore.subscribe + manual diff (lastCosmosUnlocked field) — project НЕ использует subscribeWithSelector middleware (verified в gameStore.ts:449); pattern consistent с COSMIC AUTO-PERSIST subscribe там"
  - "Single tryAttachRaceOverlay() helper для обоих renderMain/renderBg — DRY, defensive guards (cosmos + HABITABLE_PLANET_IDS + id !== 'home') в одном месте"
  - "attachAllHabitable() для reactive case использует scene.systemSprites map (already-rendered containers) + scene.allSystems lookup для размера; defensive: planet не в systemSprites → skip (мог быть LOD-culled)"
  - "Popover race info row — встроен в existing capsule, не отдельный modal: low cognitive load, consistent с existing «name / type» visual language"
  - "i18n role_home/role_colony — gold color (#fde047 design token) + bold для подчёркивания role significance; emoji-prefixed для quick scan"
  - "PlanetRenderer.destroy() в shutdown() идёт ДО tweens.killAll() — controller сам останавливает home-halo tween'ы (explicit cleanup лучше чем relying на killAll cascade)"

patterns-established:
  - "Race-overlay pattern: один controller per scene с Map<planetId, GroupOfGameObjects>, idempotent attach/detach, destroy()-on-shutdown ensures leak-free teardown"
  - "Cosmos-gated rendering: gate check на одной точке attach (tryAttachRaceOverlay) + reactive subscribe для unlock-mid-session; pre-cosmos visual идентичен uninhabited"
  - "i18n keys для UI labels с emoji-prefix (cosmos.role_*): pattern для future role/status badges (Phase 28/29 communications/relationships)"

requirements-completed:
  - PHASE26-STARMAP-GLOW
  - PHASE26-STARMAP-ICONS
  - PHASE26-COSMOS-GATE-INHABITANTS
  - PHASE26-POPOVER-RACE-INFO

# Metrics
duration: ~10min (исключая context loading)
completed: 2026-05-18
---

# Phase 26 Plan 26-03: Star Map race overlays + popover race info + cosmos gate Summary

**Visual race indicators на Star Map активируются после cosmos unlock: каждая из 30 habitable planets получает race-color glow halo (ADD blend) + emoji icon overlay, 10 home planets дополнительно — gold pulsing halo (1.5s yoyo). Player home (id='home') защищён от overlay attach. Reactive subscribe на hasCosmosUnlocked — overlays appear без reload. Popover при tap на habitable planet (post-cosmos) показывает «{emoji} {race name} {role}» с gold accent.**

## Objective recap

Plans 26-01/26-02 заложили данные (RaceId, RACES config, HABITABLE_PLANET_IDS, planetMap.json inhabitant entries) — но без 26-03 игрок их «не видит». Этот plan превращает данные в visual feedback: glow halos + icons + popover race info. Также — first plan, который применяет cosmos gate к visual layer (Plan 26-02 не gating рендер, только данные).

## What was built

### `client/src/game/scenes/starmap/effects/raceGlow.ts` (new, 231 lines)

Modular Phaser-native overlay controller.

**Exports:**
- `RaceGlowController` class
  - `constructor(scene)` — ensures texture
  - `attach(input: RaceGlowAttachInput)` — idempotent attach; defensive unknown raceId
  - `detach(planetId)` — destroys 3 GameObjects + stops/removes tween
  - `updatePosition(planetId, x, y)` — для будущего camera panning support
  - `destroy()` — cleanup всех entries
  - `attachedCount` (getter) — diagnostic
- `installRaceGlow(scene)` — factory function

**Implementation details:**
- Texture-gen: `ensureGlowTexture()` создаёт 256×256 white radial gradient (32 concentric circles, quadratic alpha falloff `(1 - i/steps)²`) один раз per scene. Cached через `scene.textures.exists(GLOW_TEX_KEY)`. Pattern reuse от ConfettiBurst.
- Glow Image: tinted race color, alpha 0.5 (colony) / 0.65 (home), `displaySize = (size+8)*2 × (size+8)*2`, depth = `planet.depth - 1`, `BlendModes.ADD`.
- Icon Text: race.emojiIcon, fontSize 14px (colony) / 18px bold (home), origin centered, depth = `planet.depth + 1`.
- Home extras: gold (#fde047) halo Image, alpha tween 0.2 ↔ 0.6, 1500ms yoyo Sine.easeInOut, infinite repeat, depth = `planet.depth - 2`. Tween reference хранится в OverlayGroup для cleanup.

**Threat mitigations:**
- T-26-03-02 (corrupt planetMap unknown raceId): `if (!race) return` defensive.
- T-26-03-03 (GameObject + tween leak): `destroy()` iterate'ит overlays, вызывает `detach()` для каждого → destroy + stop+remove tween.
- T-26-03-05 (frog.container alpha tween): все overlays — отдельные GameObjects, никогда не tween'им planet container.

### `client/src/game/scenes/starmap/rendering/planetRenderer.ts` (modified, +120 lines)

**New private fields on PlanetRenderer:**
- `raceGlow: RaceGlowController` — instantiated в constructor.
- `cosmosUnsubscribe?: () => void` — Zustand unsubscribe handle (returned by `useGameStore.subscribe`).
- `lastCosmosUnlocked: boolean` — diff state для manual change detection (project pattern: plain subscribe, не subscribeWithSelector).

**New private methods:**
- `tryAttachRaceOverlay(sys, container)` — gate: cosmos unlocked AND `HABITABLE_PLANET_IDS.has(sys.id)` AND `sys.id !== 'home'`. Вызывает `getPlanetInhabitant()`, передаёт x/y/size/depth в `raceGlow.attach()`.
- `attachAllHabitable()` — reactive re-attach loop при cosmos unlock mid-session. Итерирует HABITABLE_PLANET_IDS, lookup container в `scene.systemSprites`, lookup size через `scene.allSystems.find(s => s.id === id)` (fallback `14 * DPR`).
- `resolvePlanetSize(planetId)` — helper для attachAllHabitable.
- `destroy()` — unsubscribe + raceGlow.destroy().

**Integration points:**
- В конце `renderMain()` (после `scene.systemSprites.set` и `mainPlanetHits.push` + `bgInteractiveContainers.push`) — `this.tryAttachRaceOverlay(sys, container)`.
- В конце `renderBg()` (после аналогичных регистраций) — `this.tryAttachRaceOverlay(sys, container)`.

**Subscribe behavior:**
- Constructor invoke: `lastCosmosUnlocked = useGameStore.getState().hasCosmosUnlocked === true` (snapshot для initial gate).
- `useGameStore.subscribe((state) => ...)` listener реагирует на любой state change, diff'ит next vs `this.lastCosmosUnlocked`. false → true: `attachAllHabitable()`. true → false (defensive): `raceGlow.destroy()`.

### `client/src/game/scenes/StarMapScene.ts` (modified, +3 lines)

`shutdown()` теперь вызывает `this.planetRenderer?.destroy()` перед `time.removeAllEvents()` + `tweens.killAll()`. T-26-03-03 + T-26-03-04 mitigation (RaceGlow + Zustand subscription leak).

### `client/src/game/scenes/starmap/popovers.ts` (modified, +29 / -5 lines net effective)

**openBgNamePopup() расширен:**
- Новые imports: `getPlanetInhabitant`, `RACES_BY_ID`, `RaceId` type, `i18n` (i18next instance).
- После создания `subText` — cosmos-gated inhabitant lookup:
  ```ts
  const cosmosUnlocked = useGameStore.getState().hasCosmosUnlocked === true
  const inhabitant = cosmosUnlocked ? getPlanetInhabitant(sys.id) : undefined
  ```
- Если inhabitant найден И raceId валиден (defensive `if (race)`) — создаётся `raceText: Phaser.GameObjects.Text` со строкой `{emojiIcon} {raceName} {roleLabel}`, fontSize 9*DPR, fontStyle bold, color #fde047 (gold accent).
- Capsule sizing: `widthCandidates` массив (nameText/subText/raceText widths), max + padding для w; h += raceText.height + 4 spacing. BTN_Y автоматически смещается вниз.
- raceText добавляется в container через `container.add(raceText)` после name/sub.

**Pre-cosmos behavior:** cosmosUnlocked === false → inhabitant === undefined → raceText НЕ создаётся → capsule выглядит как до Plan 26-03 для всех planets. D-CosmosGate intent preserved.

### `client/src/i18n/{ru,en,es}.json` (modified, +2 keys × 3 locales)

Inside existing `cosmos` namespace (sibling to `first_contact`):
```json
"role_home": "⭐ Главный мир"  / "⭐ Capital"  / "⭐ Mundo Capital"
"role_colony": "· Колония"     / "· Colony"   / "· Colonia"
```

Parity: `check-translations.cjs` → **OK: all 402 keys present in RU/EN/ES**.

## Interfaces exported (downstream plans consume)

| Export | From | Used by |
|--------|------|---------|
| `RaceGlowController` (class) | `starmap/effects/raceGlow` | Plan 26-05 (если cinematic захочет attach/detach poll) |
| `installRaceGlow` (factory) | `starmap/effects/raceGlow` | (internal — PlanetRenderer instantiate напрямую через `new`) |
| `RaceGlowAttachInput` (interface) | `starmap/effects/raceGlow` | Public API shape для будущих attach callers |
| `cosmos.role_home` / `cosmos.role_colony` (i18n) | `i18n/{ru,en,es}.json` | UI компоненты, которые показывают role badge (Inventory tab возможно в будущем, Plan 26-05 cinematic subtitle если расширится) |

## Validation results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS (clean across all touched files + existing 350-tile codebase) |
| `npm run check-translations` | PASS (**402 keys × 3 locales**, 0 missing) |
| ESLint на touched files (raceGlow.ts, planetRenderer.ts, StarMapScene.ts, popovers.ts) | PASS (0 errors after prettier autofix) |
| `npx vitest run` | 104 PASS / 0 FAIL / 1 skip / **3 pre-existing FAIL suites** (slice.test, slice.openBox.test, cosmicSettings.test — same профиль как post-Plan 26-01, документировано в deferred-items.md) |
| RaceGlowController API surface | verified — attach/detach/destroy/updatePosition + attachedCount |
| Cosmos gate behavior | code-verified: tryAttachRaceOverlay early-returns on `!lastCosmosUnlocked`; popovers — `cosmosUnlocked ? getPlanetInhabitant(...) : undefined` |
| Player home protection | code-verified в обоих local paths (planetRenderer `sys.id === 'home'` early-return + attachAllHabitable `id === 'home'` skip) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Code style] Prettier autofix on Task 2 + Task 3 files**
- **Found during:** Task 2 lint + Task 3 lint
- **Issue:** Project ESLint config `prettier/prettier: 'error'`. After my edits в `planetRenderer.ts` + `popovers.ts` prettier flagged 2 issues (Task 2) + ~30 issues (Task 3 — большинство были в dead-code branch `if (false as boolean)` который автофикс re-indented под новые правила).
- **Fix:** `npx eslint --fix` на touched files. Cosmetic-only (whitespace, indentation). Re-running tsc после autofix — clean.
- **Files modified:** `client/src/game/scenes/starmap/rendering/planetRenderer.ts`, `client/src/game/scenes/starmap/popovers.ts`
- **Commits:** bundled into Task 2 (`743f54e`) and Task 3 (`d5b314b`) commits.

### Acknowledged behavior (NOT a deviation)

**Subscribe pattern adjusted from plan text:** Plan task 2 mentioned `useGameStore.subscribe(selector, listener)` (Zustand `subscribeWithSelector` middleware signature). I verified — project НЕ enables этот middleware (grep'нул gameStore.ts: единственный subscribe — plain `useGameStore.subscribe((state, prev) => {...})` на строке 449). Реализовал fallback: plain subscribe + manual diff через `this.lastCosmosUnlocked` field. Consistent с existing COSMIC AUTO-PERSIST subscribe pattern. Plan этот fallback явно разрешал («Если NOT enabled — fallback: subscribe без selector + manual diff в listener»).

**Planet container depth is 0 (Phaser default):** Plan говорил «depth = planet depth - 1». Я passing `container.depth` (= 0 для main/bg planets, поскольку renderMain/renderBg НЕ вызывают `container.setDepth()`). Overlays получают depth -2 / -1 / +1 = -2 / -1 / 1 в worst case. Это работает (Phaser допускает negative depths), и относительное упорядочение сохранено. Если в будущем PlanetRenderer начнёт явно setDepth — overlays последуют автоматически.

## Threat Flags

(empty — все 5 STRIDE threats из plan'а замитигированы; no new surface introduced beyond what's documented в plan threat register)

## Self-Check: PASSED

- `client/src/game/scenes/starmap/effects/raceGlow.ts` — exists ✓
- `client/src/game/scenes/starmap/rendering/planetRenderer.ts` — modified (raceGlow + tryAttachRaceOverlay + attachAllHabitable + destroy) ✓
- `client/src/game/scenes/StarMapScene.ts` — modified (shutdown calls planetRenderer.destroy()) ✓
- `client/src/game/scenes/starmap/popovers.ts` — modified (race info row in openBgNamePopup) ✓
- `client/src/i18n/{ru,en,es}.json` — modified (cosmos.role_home + cosmos.role_colony) ✓
- Commit `d2f038b` (Task 1 raceGlow.ts) — found in git log ✓
- Commit `743f54e` (Task 2 planetRenderer + StarMapScene integration) — found in git log ✓
- Commit `d5b314b` (Task 3 popover + i18n) — found in git log ✓
- `npx tsc --noEmit` clean — verified ✓
- `npm run check-translations` 402/402 parity — verified ✓
- ESLint clean — verified ✓
- `npx vitest run` 104 pass / 0 fail / 1 skip (3 pre-existing suite failures unrelated) — verified ✓

## Downstream blockers cleared

- **Plan 26-05 (FirstContactController):** Star Map уже умеет визуализировать habitable planets. Tap on habitable planet (post-cosmos) показывает race info в popover. Controller просто слушает `starmap:planet-tapped` event (already emitted в planetRenderer pointerup), resolves `getPlanetInhabitant(planetId)`, checks `firstContactsSeen[raceId]`, triggers cinematic. Visual feedback готов — controller только добавляет cinematic trigger + modal.

## Commits (in order)

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | d2f038b | feat | add RaceGlowController for star map race overlays |
| 2 | 743f54e | feat | integrate RaceGlowController into PlanetRenderer + cosmos gate |
| 3 | d5b314b | feat | popover race info badge + role indicator + i18n keys |

## Success criteria checklist

- [x] `raceGlow.ts` модуль с RaceGlowController class (attach/detach/destroy/updatePosition)
- [x] PlanetRenderer интегрирует controller, attach'ит при render habitable planet (cosmos-gated)
- [x] Reactive subscribe на cosmos unlock — overlays appear/disappear без reload
- [x] Home planets: gold pulsing halo + bold 18px emoji icon
- [x] Colony planets: race-colored glow + 14px emoji icon
- [x] Player's home (id='home') НИКОГДА не получает overlay (защищено в tryAttachRaceOverlay + attachAllHabitable)
- [x] Popover при tap показывает race name + role badge (post-cosmos)
- [x] i18n parity preserved + 2 new keys (cosmos.role_home/colony × 3 locales)
- [x] Cleanup: scene shutdown → controller.destroy() → no Phaser GameObject leak, no tween leak, no Zustand subscribe leak
- [x] tsc clean + existing tests green (modulo 3 pre-existing failures from Plan 26-01)
