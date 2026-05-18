# Phase 24: Captain creation cinematic — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Source:** PRD Express Path (`frog_obsidian/Design Notes/2026-05-18-captain-creation-cinematic.md`)

<domain>
## Phase Boundary

5-beat cinematic sequence при **первом** L18+L18 normal merge (рождение Капитана + переход в космос):

1. **Beat 1 — Merge flash** (existing `flashAt` в MergeController, no change)
2. **Beat 2 — Cosmic growing effect** (NEW Phaser): радиальные particles + concentric rings + camera zoom, ~3 сек
3. **Beat 3 — Captain Birth modal** (NEW DOM): centered modal с L1 frog SVG + gold glow + title «Вы создали Капитана» + CTA «В космос»
4. **Beat 4 — Spawn L1 frog**: после dismiss модалки символично появляется L1 frog (captain reborn)
5. **Beat 5 — Star Map transition**: при tap CTA автоматически открывается Star Map через `eventBus.emit('starmap:open')`

**Trigger:** только первый L18+L18 normal merge (gate'нут флагом `captainBirthSeen` в gameStore). Повторные merges — markCosmosUnlocked idempotent БЕЗ повтора cinematic.

**Scope target:** ~18 часов. Demo-build качество.

**Out of scope:** voice over, новые arts/sprite assets, captain skin variation, skip-cinematic button, multiple captain births, сложный narrative arc.

</domain>

<decisions>
## Implementation Decisions

### State Management
- **New flag** `captainBirthSeen: boolean` в **gameStore** (НЕ onboarding slice — это game milestone, server-syncable через gameSync.ts)
- Persistence: server-primary через `gameSync.snapshotForSave` + `loadGameState` rehydration. localStorage emergency fallback.
- Default: `false`
- Set'ится при первом L18+L18 normal merge перед emit'ом cinematic event
- Идемпотентный setter: `markCaptainBirthSeen()` — повторный call no-op

### Trigger Flow
```
MergeController.handleL18L18(cx, cy)
  → markCosmosUnlocked()  (existing)
  → if (!captainBirthSeen) {
       markCaptainBirthSeen()  // NEW
       eventBus.emit('captain:birth-start', { x: cx, y: cy })  // NEW
     }
```

### Beat 2: Phaser Cosmic Growing Effect

**New file:** `client/src/game/effects/CaptainBirthEffect.ts`

- **Light burst particles**: 60-80 particles, lifespan 2500ms, palette `[0xfde047, 0xffffff, 0x67e8f9]` (golden/white/cosmic blue), speed 80-200 px/s, gravity 0 (radial), scale 0.5→2.0, alpha 1→0
- **Concentric rings**: 3 rings, Phaser.Graphics strokeCircle, radius 20→200 px, stroke 4px golden `#fde047` (0xfde047), alpha 0.8→0, duration 1500ms each, offset 400ms каждый
- **Camera zoom**: `scene.cameras.main.zoomTo(1.08, 1500, 'Sine.easeInOut')` затем `zoomTo(1.0, 800)`
- **Total duration**: ~3 секунды
- **Завершение**: emit `'captain:birth-effect-complete'` event
- Reuse approach из `ConfettiBurst.ts` (Phaser particles pattern)

### Beat 3: Captain Birth Modal

**New file:** `client/src/components/Captain/CaptainBirthModal.tsx`

- Mount при `'captain:birth-effect-complete'`
- DOM modal через `createPortal(document.body)`
- Background: `radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 70%)` (deep dark)
- Modal card:
  - Centered via flex (как WelcomeModal pattern)
  - max-width 320, padding 28px 20px
  - background `#1a2e1a` (solid dark)
  - border `2px solid rgba(255,255,255,0.15)`
  - borderRadius 16
- L1 frog SVG (inline, same as WelcomeModal):
  - 120×120 px
  - Pulse scale 1.0 ↔ 1.05, 1.5s CSS keyframes
  - Gold glow: `filter: drop-shadow(0 0 24px #fde047)`
- Title: «Вы создали Капитана» (font 26px, fontWeight 900, color `#fde047`)
- Subtitle: «Космос открыт. Готовы исследовать?» (font 14px, color `#d4d4d8`)
- CTA: pink gradient `#ec4899` solid color (not gradient — match WelcomeModal CTA pattern), display: inline-block, width: auto, minWidth: 200, padding 14px 32px, text «В космос →»
- Backdrop click → dismiss (per DiscoveryModal pattern)
- CTA tap → dismiss + emit `'starmap:open'`
- z-index 200 (above HUD elements)

### Beat 4: Spawn L1 frog

После modal dismiss:
- `useGameStore.getState().addFrogToLocation(currentLocation, 1)` — добавить L1 frog на ТЕКУЩУЮ локацию (где произошёл merge — обычно Лес где были L18s; но как fallback Лужа)
- FrogSpawner подхватит store update через existing spawn flow
- Frog появится с обычной spawn animation (no new code needed)

### Beat 5: Star Map transition

CTA tap triggers:
- emit `eventBus.emit('starmap:open')` (existing event)
- LocationStack subscribes → `setStarMapActive(true)` → Phaser StarMapScene opens
- Modal unmounts через 400ms fade-out (matches WelcomeModal pattern)

### EventBus Events (NEW)

Add к `client/src/store/eventBus.ts`:
- `'captain:birth-start': { x: number, y: number }` — Phaser cosmic effect trigger
- `'captain:birth-effect-complete': void` — DOM modal mount trigger

### i18n Keys (RU/EN/ES)

Namespace `captain.birth.*`:
- `title` — «Вы создали Капитана» / «You Created the Captain» / «Has Creado al Capitán»
- `subtitle` — «Космос открыт. Готовы исследовать?» / «Cosmos is open. Ready to explore?» / «El cosmos está abierto. ¿Listo para explorar?»
- `cta` — «В космос →» / «To Cosmos →» / «Al Cosmos →»

### Dev Helpers

Add к `client/src/utils/onboardingDevHelpers.ts` (или новый `client/src/utils/captainBirthDevHelpers.ts`):
- `window.__triggerCaptainBirth()` — force trigger cinematic + modal для smoke testing
- `window.__resetCaptainBirth()` — clear captainBirthSeen flag + state reload

### Visual Language Reuse
- Pink `#ec4899` для CTA solid color
- Gold `#fde047` для cosmic accents (title, particles, glow)
- Cosmic blue `#67e8f9` для particles
- Deep dark backgrounds `rgba(0,0,0,0.85+)`
- Rounded 16px modal, inline-block CTA (per WelcomeModal pattern)
- CSS keyframes + Phaser tweens (memory `feedback_animations`, no Lottie)
- НЕ tween `frog.container.alpha` (memory `feedback_frog_container_alpha`) — particles и rings отдельные Phaser GameObjects

### Cliclability (memory `feedback_clickability`)
- CTA `type="button"`
- z-index modal 200 (above HUD)
- Phaser cinematic depth 9000 (above всего)
- Backdrop click dismisses (как DiscoveryModal)
- stopPropagation на inner modal card
- touchAction: manipulation

### Claude's Discretion
- Точный timing cinematic (3s buildup vs 2.5s vs 4s — A/B позже)
- Camera zoom intensity (1.05 vs 1.08 vs 1.1)
- Exact particle count (60 vs 80)
- L1 frog spawn location — на текущей локации или forced на Лужу (TBD per playtest)
- Audio cues (использовать ли existing sfx или skip — TBD)
- Modal fade-out animation curve

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Spec (Source of Truth)
- `frog_obsidian/Design Notes/2026-05-18-captain-creation-cinematic.md` — Полный design 5 beats, все timings, visual specs, state flow

### Related Glossary
- `frog_obsidian/Glossary/Капитан.md` — текущий концепт sentinel L18+L18, нужно обновить «В коде» после реализации
- `frog_obsidian/Glossary/Открытие космоса.md` — Phase 22 cosmos gate, нужно обновить «В коде» (теперь triggers cinematic)
- `frog_obsidian/Glossary/Звёздная карта.md` — Star Map activation flow
- `frog_obsidian/Glossary/Соединение.md` — merge mechanic context

### Codebase Touchpoints
- `frog_evolution_code/client/src/game/scenes/main/MergeController.ts` — L18+L18 normal merge branch (line ~278: markCosmosUnlocked); hook cinematic trigger
- `frog_evolution_code/client/src/store/gameStore.ts` — add `captainBirthSeen`, `markCaptainBirthSeen`
- `frog_evolution_code/client/src/store/persistence.ts` — persist captainBirthSeen (через cosmic slice или separate key)
- `frog_evolution_code/client/src/api/gameSync.ts` — sync captainBirthSeen с сервером (snapshotForSave + loadGameState)
- `frog_evolution_code/server/prisma/schema.prisma` — может потребоваться field в GameState (TBD)
- `frog_evolution_code/client/src/store/eventBus.ts` — 2 new event types
- `frog_evolution_code/client/src/game/effects/ConfettiBurst.ts` — reference для Phaser particle patterns
- `frog_evolution_code/client/src/game/effects/CarrierAscensionTween.ts` — reference для Phaser tween patterns
- `frog_evolution_code/client/src/components/Onboarding/WelcomeModal.tsx` — reference для modal centering + frog SVG + CTA pattern
- `frog_evolution_code/client/src/ui/components/DiscoveryModal.tsx` — reference для radial-gradient bg + drama
- `frog_evolution_code/client/src/App.tsx` — mount CaptainBirthModal
- `frog_evolution_code/client/src/ui/components/LocationStack.tsx` — Star Map activation via eventBus 'starmap:open'
- `frog_evolution_code/client/src/i18n/{ru,en,es}.json` — `captain.birth.*` keys

### Planning Context
- `.planning/STATE.md` — текущее состояние проекта
- `.planning/ROADMAP.md` — Phase 24 entry, deps on Phase 23
- `.planning/phases/22-carrier-merge-redesign/22-06-SUMMARY.md` — Phase 22 cosmos gate (`markCosmosUnlocked`, `useCosmosUnlocked`)
- `.planning/phases/23-onboarding-flow/23-05-SUMMARY.md` — Phase 23 ConfettiBurst + LocationCelebration paths

</canonical_refs>

<specifics>
## Specific Ideas

- **Phaser particle pattern**: reuse `ConfettiBurst.ts` подход (generated 4×4 white texture, tint applied per-particle). Для cosmic burst нужен бOlee dramatic profile — larger particles, slower decay, wider spread.
- **Rings via Phaser.Graphics**: separate Graphics object per ring (3 total), Phaser tween на `radius` (via redraw в onUpdate) или scale на container с predrawn circle.
- **Camera zoom**: `cameras.main.zoomTo` built-in Phaser API. Return-zoom (back to 1.0) — на complete callback.
- **Modal frog SVG**: inline SVG как в WelcomeModal (avoid asset dep). Add gold glow через `filter: drop-shadow`. Pulse via CSS keyframes (existing pattern).
- **State migration**: existing saves без `captainBirthSeen` — initialize as `false`. Если discovered `19` уже в discoveredLevels — assume already born, mark seen на migration (skip cinematic на uplifted сейвах).
- **MergeController hook**: после existing `markCosmosUnlocked()` call, проверить `gameStore.getState().captainBirthSeen` — если false, set flag и emit event.

</specifics>

<deferred>
## Deferred Ideas

- Audio/SFX для cinematic (если есть подходящие existing assets — добавить, иначе skip)
- Skip cinematic button (3s short enough, нет нужды)
- Multiple captain births / re-trigger (Phase 22 design: idempotent, intentional)
- Captain skin variation / unique sprite (использует обычный L1)
- Narrative arc / cutscene с multiple slides
- Phaser scene transition animation (просто eventBus.emit('starmap:open') existing flow)
- Cinematic-replay viewer (если игрок захочет пересмотреть — отдельная фича)
- Server-side analytics на captain birth event

</deferred>

---

*Phase: 24-captain-creation-cinematic*
*Context gathered: 2026-05-18 via PRD Express Path*
