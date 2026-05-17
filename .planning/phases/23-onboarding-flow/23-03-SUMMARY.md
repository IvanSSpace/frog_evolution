---
phase: 23-onboarding-flow
plan: 03
subsystem: ui-game-bridge
tags: [phaser, react, zustand, eventbus, onboarding, tap-hint, pulse-ring]

# Dependency graph
requires:
  - phase: 23-onboarding-flow/01
    provides: [useOnboardingStore.markFirstBoxTapSeen, onboarding.tapHint.label i18n keys, OnboardingController shell, __resetOnboarding dev helper]
  - phase: 23-onboarding-flow/02
    provides: [Beat 1 welcomeSeen=true flow; гарантирует что Beat 2 включается только после прохождения Welcome]
provides:
  - "TutorialPulseRing — reusable Phaser pulse-ring effect (alpha+scale yoyo, follow target.x/.y)"
  - "eventBus events: 'tutorial:firstBoxSpawned', 'tutorial:firstBoxTapped'"
  - "BoxController integration: spawn ring + dismiss-hook на pointerdown (любой бокс)"
  - "TapHintOverlay (DOM pill «Тапни 👆»), anchored под Phaser canvas-coords"
  - "Active conditional render для Beat 2 в OnboardingController"
affects: [23-04, 23-05, 23-06]
notes:
  - "TutorialPulseRing рассчитан на переиспользование Plan 23-04 (Beat 3 merge-hint вокруг лягушек) — БЕЗ модификаций. target: { x, y, active } API совместим с frog.container."

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "scene.registry как cross-controller storage для активного tutorial ring'а (BoxController создаёт, dismissTutorialTapHint destroy'ит; sentinel auto-dismiss проверяет actual instance через `===` чтобы не задеть последующий ring)"
    - "Phaser→DOM coord conversion: canvas.getBoundingClientRect() + scaleX/Y = rect.dim / canvas.dim. Phaser рендерится в физических pixel'ах (window*DPR), CSS-зум 1/DPR."
    - "Container target для tween'а alpha+scale, а НЕ frog/box объект напрямую — защищает chess piece от tutorial flash (memory: feedback_frog_container_alpha)"
    - "Pre-emit + post-delay re-check guard: setTimeout(300, () => recheck state && registry) — защищает от race в момент мульти-spawn'а боксов"

key-files:
  created:
    - client/src/game/effects/TutorialPulseRing.ts
    - client/src/components/Onboarding/TapHintOverlay.tsx
  modified:
    - client/src/store/eventBus.ts
    - client/src/game/scenes/main/BoxController.ts
    - client/src/game/scenes/main/types.ts
    - client/src/components/Onboarding/OnboardingController.tsx

key-decisions:
  - "Container не interactive (`setInteractive` НЕ вызывается) — без hit-area pointer events проходят сквозь ring к боксу под ним. Решает cliclability (memory: feedback_clickability) без manual depth juggling."
  - "Tween targets отдельный container (а НЕ box.img / frog.container) — alpha-tween попадает только на ring graphics, gameplay sprite не мерцает (memory: feedback_frog_container_alpha)."
  - "Dismiss-hook сидит в BoxController.spawnBox pointerdown handler (НЕ в FrogInteraction как изначально предлагал план). Frogs и boxes имеют разные tap-handlers — FrogInteraction только про лягушек. Это Rule-3 deviation: правильное место — там, где live tap-handler уже есть."
  - "BoxData получил optional `id?: string` (session-only stable identifier) для tutorial event coupling. Backward-compatible — все existing call-sites игнорируют поле."
  - "Dual dismiss path: BoxController.delayedCall(5000) destroy'ит ring + TapHintOverlay.setTimeout(5000) помечает seen=true. Каждая сторона страхует свой объект; обе idempotent, не конфликтуют."
  - "Ring radius = displayWidth * 0.7 / 2 + 6*DPR (margin), отделяет визуально от box stroke. Используем `displayWidth` (CSS px включая DPR) а не raw `width` (texture pixel size)."

patterns-established:
  - "Tutorial effects живут отдельным lifecycle от game entities; coupling через scene.registry + eventBus, без прямых ссылок controller→component"
  - "Pulse ring API (`{ scene, target, radius, color?, duration?, depth? }`) — стандарт для всех будущих tutorial highlights в Phase 23"

# Metrics
metrics:
  duration: "~20m"
  completed: "2026-05-17T21:19Z"
  tasks_completed: 3 / 4 (Task 4 checkpoint:human-verify auto-approved per workflow.auto_advance=true)
  files_created: 2
  files_modified: 4
  commits: 2
---

# Phase 23 Plan 23-03: Beat 2 Tap-Hint Summary

**One-liner:** Reusable Phaser `TutorialPulseRing` (pulse + follow) + DOM «Тапни 👆» pill вокруг первого упавшего бокса, dismiss по tap'у или 5с auto-fade.

## Что реализовано

### TutorialPulseRing (`client/src/game/effects/TutorialPulseRing.ts`)

Standalone class — reusable Phaser pulse-ring effect:
- `alpha: 0.4 → 0.9`, `scale: 1.0 → 1.15`, `duration: 800ms`, `yoyo: true`, `repeat: -1`, `ease: 'Sine.easeInOut'`
- Container НЕ interactive — pointer events проходят сквозь
- Tween targets container (отдельный объект) — alpha-flash не задевает frog/box
- Follow target.x/.y каждый frame через `scene.events.on('update', ...)`
- `worldPosition` getter для DOM-anchor расчёта
- `destroy(fadeMs = 300)` — idempotent fade-out + cleanup
- Stop guard'ы для scene-shutdown edge case

**Reusability note (Plan 23-04):** API специально спроектирован — `target: { x, y, active }` — для приёма frog.container в Beat 3 merge-hint без модификаций.

### eventBus extension (`client/src/store/eventBus.ts`)

```ts
'tutorial:firstBoxSpawned': { x: number; y: number; boxId: string; width: number }
'tutorial:firstBoxTapped': { boxId: string }
```

(Parallel agent 23-05 параллельно добавил `onboarding:locationCelebration*` — coexist без conflict'а, разные namespaces.)

### BoxController integration (`client/src/game/scenes/main/BoxController.ts`)

- `BoxData.id?: string` — session-only stable id, генерится в `spawnBox` для tutorial coupling
- `maybeSpawnTutorialTapHint(box)` — вызывается в landing onComplete:
  - Quick reject если `!welcomeSeen || firstBoxTapSeen || registry-already-has-ring`
  - `scene.time.delayedCall(300, ...)` — re-check state, spawn `TutorialPulseRing`, emit `'tutorial:firstBoxSpawned'`
  - Sentinel: `scene.time.delayedCall(5000, ...)` destroy'ит ring если `cur === ring` (защита от destroy'а наследника)
- `dismissTutorialTapHint(boxId)` — вызывается в pointerdown handler:
  - Helper: проверяет state, `markFirstBoxTapSeen()`, emit `'tutorial:firstBoxTapped'`, destroy ring из registry

### TapHintOverlay (`client/src/components/Onboarding/TapHintOverlay.tsx`)

DOM pill «Тапни 👆»:
- Subscribe на `eventBus 'tutorial:firstBoxSpawned'` / `'tutorial:firstBoxTapped'`
- Phaser→DOM coord conversion через `canvas.getBoundingClientRect()` + `scaleX/Y`
- Anchored под боксом: `spawn.y + spawn.width * 0.7` (центр ring'а в game coords) + 12 CSS px gap
- `pointer-events: none`, `z-index: 100`, semi-transparent pill design
- Auto-fade: 5000ms → `markFirstBoxTapSeen()` (sentinel при afk)
- i18n key `onboarding.tapHint.label` — RU/EN/ES уже в i18n/*.json (Plan 23-01 положил skeleton, у меня no edit)

### OnboardingController integration (`client/src/components/Onboarding/OnboardingController.tsx`)

- Добавлен per-flag selector `firstBoxTapSeen`
- JSX: `{welcomeSeen && !firstBoxTapSeen && <TapHintOverlay />}`
- Не реорганизую existing WelcomeModal branch (parallel agent 23-02 уже его подключил) — только добавил свою line

## Commits

| Hash      | Message                                                                |
| --------- | ---------------------------------------------------------------------- |
| `bd24f77` | feat(23-03): TutorialPulseRing reusable Phaser effect + eventBus events |
| `3999ead` | feat(23-03): Beat 2 tap-hint — pulse ring + DOM label + dismiss        |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dismiss-hook размещён в BoxController, не FrogInteraction**

- **Found during:** Task 2 prep, чтение FrogInteraction.ts
- **Issue:** Plan указывал добавить dismiss-hook в FrogInteraction.ts «(OR BoxController tap handler)». Но FrogInteraction обрабатывает ТОЛЬКО тапы по лягушкам (через `onFrogTapped`), а bокс-тап целиком живёт в BoxController.spawnBox pointerdown closure. Если положить hook в FrogInteraction, он никогда не вызовется при тапе бокса.
- **Fix:** Реализован метод `BoxController.dismissTutorialTapHint(boxId)`, вызывается из existing pointerdown handler внутри spawnBox.
- **Files modified:** `client/src/game/scenes/main/BoxController.ts`
- **Commit:** `3999ead`

**2. [Rule 3 - Blocking] BoxData не имел `boxId` поля — добавлено optional id**

- **Found during:** Task 2 typecheck
- **Issue:** Plan ссылался на `box.boxId ?? box.id`, но в `BoxData` interface (`client/src/game/scenes/main/types.ts`) нет ни одного из этих полей.
- **Fix:** Добавлено `id?: string` в BoxData (optional, backward-compatible). Generated в `spawnBox` как `box_${Date.now()_${random}}` (session-only).
- **Files modified:** `client/src/game/scenes/main/types.ts`, `client/src/game/scenes/main/BoxController.ts`
- **Commit:** `3999ead`

**3. [Rule 1 - Bug] Radius `box.width * 0.7` некорректен — нужен displayWidth/2 + margin**

- **Found during:** Task 1 → 2 integration
- **Issue:** `box.img.width` возвращает texture pixel size (без учёта setDisplaySize и DPR scale). Plan диктовал `radius = box.width * 0.7`, что дало бы огромный ring (за пределами CSS-pixel бокса).
- **Fix:** `radius = (box.img.displayWidth * 0.7) / 2 + 6 * DPR` — половина displayWidth (правильная семантика «радиус» для circle around центр) + margin DPR-aware.
- **Files modified:** `client/src/game/scenes/main/BoxController.ts`
- **Commit:** `3999ead`

### Architectural choices (no Rule 4 escalation needed)

- **No new tables / schema changes**
- **No new dependencies**
- **No CLAUDE.md violation** — все правила соблюдены: сub-agent territory соблюдён, frog.container.alpha не tween'ится, cliclability через pointer-events: none + container без hit-area

## Authentication gates

None.

## Self-Check: PASSED

```bash
[ -f client/src/game/effects/TutorialPulseRing.ts ] && echo FOUND  # FOUND
[ -f client/src/components/Onboarding/TapHintOverlay.tsx ] && echo FOUND  # FOUND
git log --oneline | grep bd24f77  # FOUND
git log --oneline | grep 3999ead  # FOUND
```

- TutorialPulseRing.ts — 140 строк (≥30 требование) ✓
- vite build OK (1 chunk warning preexisting, не from моих изменений) ✓
- tsc --noEmit clean (по моим файлам — нет ошибок) ✓
- 2 atomic commits ✓

## Known Stubs

None. Реализация полностью wired:
- Ring spawn рулится actual onboarding state (не hardcoded)
- DOM label получает реальные {x,y,width} из event payload
- Dismiss обновляет реальный store flag

## Verification status

- **Task 1 (TutorialPulseRing + eventBus):** ✓ tsc + build OK
- **Task 2 (BoxController + emit):** ✓ tsc + build OK
- **Task 3 (TapHintOverlay + OnboardingController):** ✓ tsc + build OK
- **Task 4 (manual UX checkpoint):** ⚡ Auto-approved (workflow.auto_advance=true). Manual verification отложена — пользователь сможет проверить в dev-сессии через `__resetOnboarding()` + ожидание первого бокс-дропа.

## Files reference (absolute paths)

- `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/game/effects/TutorialPulseRing.ts` (создан)
- `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/components/Onboarding/TapHintOverlay.tsx` (создан)
- `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/store/eventBus.ts` (модифицирован — +2 event types)
- `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/game/scenes/main/BoxController.ts` (модифицирован — +85 lines integration)
- `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/game/scenes/main/types.ts` (модифицирован — +1 optional field)
- `/Users/shar/Documents/frog_evolution/frog_evolution_code/client/src/components/Onboarding/OnboardingController.tsx` (модифицирован — +1 JSX branch)
