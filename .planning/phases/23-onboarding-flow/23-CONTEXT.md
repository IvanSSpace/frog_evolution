# Phase 23: Onboarding flow — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Source:** PRD Express Path (`frog_obsidian/Design Notes/2026-05-18-onboarding-flow.md`)

<domain>
## Phase Boundary

Soft 4-beat onboarding для нового игрока. Беаты:
1. **Welcome modal** при первом входе (blocking single-step с CTA «Начать»)
2. **Tap-hint pulse** на первый бокс (Phaser ring, fade 5с)
3. **Merge interactive demo** — ghost-frog drag-trail показывает как мерджить (fade 8с)
4. **Location-unlock celebration** — Phaser confetti burst + DOM LocationStack pulse + DOM toast при каждом unlock (Болото L7, Лес L13, cosmos L18+L18)

**Все hints soft:** auto-dismiss через 5-8с, не блокируют игру. Только welcome — blocking single-step с явной CTA.

**Visual reuse:** existing pink `#ec4899` accents, pastel gradients, rounded buttons, existing LOCATION_VISUAL palette, CSS keyframes + Phaser tweens (без Lottie).

**State:** per-device localStorage (`frog_evolution_onboarding` JSON), без server sync.

**Scope target:** ~25 часов. Demo-build качество.

**Out of scope:** skip button, replayable tutorial menu, achievement system, server-side state, voice/sound effects beyond existing SFX.

</domain>

<decisions>
## Implementation Decisions

### Beat 1: Welcome Modal
- Centered modal max-width 320px (mobile-first)
- Pastel gradient bg (lake-blue → swamp-green)
- Title «Frog Evolution» (font-weight 900, textShadow)
- Subtitle 1-2 строки: «Тапай лягушек. Соединяй одинаковых. Открывай мир.»
- Cute L1 frog SVG bobbing center (CSS keyframes scale 1.0↔1.05, 1.5s)
- Pink CTA «Начать» (existing #ec4899 button style)
- Backdrop dim rgba(0,0,0,0.6), backdrop click НЕ закрывает (single-action)
- CTA tap → fade-out 400ms → flag set → trigger Beat 2 если бокс уже упал

### Beat 2: Tap-hint pulse (Phaser)
- Pulsing ring вокруг бокса — circle radius = box.width * 0.7, stroke 3px #ec4899
- Tween: alpha 0.4→0.9, scale 1.0→1.15, duration 800ms, yoyo repeat -1
- Маленький label под рингом «Тапни 👆» (DOM overlay tied to box world pos, OR Phaser BitmapText)
- Появление: 300ms после landing бокса
- Dismiss: первый tap ЛЮБОГО бокса ИЛИ fade-out 5с
- Ring tracking: следует за box transform (бокс может двигаться)

### Beat 3: Merge interactive demo
- 2 pulsing rings вокруг обеих L1 frogs (same style as Beat 2, frog-sized)
- Ghost-frog drag-trail:
  - Spawn semi-transparent (alpha 0.5) копия source frog
  - Tween position source → target по smooth curve, duration 1200ms
  - Fade-out + small burst при arrival
  - Loop 3 раза с pause 800ms
- Текст под frogs: «Перетащи одну на другую»
- Dismiss: первый merge ЛЮБЫХ frogs ИЛИ fade-out 8с
- При merge → success-burst + one-time toast «Готово! Дальше мерджи всё подряд» (auto 3s)
- Cancel gracefully если player начал drag во время demo

### Beat 4: Location unlock celebration
- **Phaser confetti burst в центре**: 30-50 particles, location-color palette (Болото green/yellow, Лес green/brown, Star Map cyan/violet), gravity decay, 1.2s
- **LocationStack pulse (DOM)**: pulsing ring на new location button + glow box-shadow #ec4899 + bobbing 1.0↔1.1
- **Toast banner внизу (DOM)**: «🌿 Болото открыто! Тапни иконку чтобы перейти», slide-up, fade-out 7s
- Pulse persists до первого tap на new location button → fade
- Toast: 7s auto OR tap dismiss
- Per-location flag `onboarding_loc_celebrated_${id}`

### Onboarding State
```ts
interface OnboardingState {
  welcomeSeen: boolean
  firstBoxTapSeen: boolean
  firstMergeSeen: boolean
  locationsCelebrated: Record<number, boolean>  // {2: true, 3: false, 6: false}
}
```

- Actions: `markWelcomeSeen`, `markFirstBoxTapSeen`, `markFirstMergeSeen`, `markLocationCelebrated(id)`
- Persistence: localStorage `frog_evolution_onboarding` (JSON), без server sync
- Per-device — другое устройство = новое onboarding (acceptable)

### Visual Language (Reuse)
- Colors: pink `#ec4899` (CTA, pulse rings), location palettes from `LOCATION_VISUAL` map
- Radii: 8-16px cards, 999px pills
- Shadows: `inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 0 rgba(0,0,0,0.25)`
- Typography: font-weight 900 titles, 600 body, textShadow `0 1px 0 rgba(0,0,0,0.4)`
- Animations: CSS keyframes (Beat 1 DOM), Phaser tweens (Beats 2-4 in-game)
- Без Lottie (memory `feedback_animations`)
- Без tween на `frog.container.alpha` (memory `feedback_frog_container_alpha`) — flash на child sprite

### Dev Helpers
- `window.__resetOnboarding()` — clear localStorage flag + reload
- `window.__skipOnboarding()` — set all true (for smoke tests)

### Cliclability
- Все buttons `type="button"`
- z-index 100+ для tutorial overlays поверх Phaser canvas
- Welcome backdrop click ignored (single-action)
- Toast/celebration backdrop transparent (don't block gameplay)

### Claude's Discretion
- Welcome copy precise wording (subtitle: 1-2 строки — exact text design call)
- Confetti particle palette per location (3-4 palettes acceptable)
- Pulse ring intensity / softness (#ec4899 может быть aggressive — попробовать softer alternative)
- Fade-out timings (5s/7s/8s placeholder — A/B позже)
- Welcome modal exit animation curve

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Spec (Source of Truth)
- `frog_obsidian/Design Notes/2026-05-18-onboarding-flow.md` — Полный дизайн 4 beats, все mechanics, scope, visual language

### Related Glossary
- `frog_obsidian/Glossary/Лягушка.md` — starting state 1 L1 frog (Phase 22 context)
- `frog_obsidian/Glossary/Бокс.md` — box spawning, ENTITY_CAP
- `frog_obsidian/Glossary/Локация.md` — LocationStack filter logic, hide-when-1
- `frog_obsidian/Glossary/Соединение.md` — merge mechanic игроку explanation
- `frog_obsidian/Glossary/Открытие космоса.md` — cosmos gate (Beat 4 cosmos celebration trigger)

### Codebase Touchpoints
- `frog_evolution_code/client/src/store/gameStore.ts` — currentLocation, locationFrogs, discoveredLevels
- `frog_evolution_code/client/src/store/persistence.ts` — localStorage key conventions
- `frog_evolution_code/client/src/store/eventBus.ts` — existing `'location:unlocked'`, `'tutorial:*'` events
- `frog_evolution_code/client/src/game/scenes/main/BoxController.ts` — emit `'tutorial:firstBoxSpawned'` trigger
- `frog_evolution_code/client/src/game/scenes/main/MergeController.ts` — emit `'tutorial:firstMerge'`, `markCosmosUnlocked` already wired
- `frog_evolution_code/client/src/game/scenes/MainScene.ts` — register Phaser tutorial effects (pulse ring, ghost frog, confetti burst)
- `frog_evolution_code/client/src/ui/components/LocationStack.tsx` — add pulse-on-new mechanic (subscribe to event OR lift state)
- `frog_evolution_code/client/src/App.tsx` — mount `OnboardingController.tsx`
- `frog_evolution_code/client/src/i18n/{ru,en,es}.json` — копии для всех 4 beats

### Planning Context
- `.planning/STATE.md` — текущее состояние проекта
- `.planning/ROADMAP.md` — Phase 23 entry, depends on Phase 22
- `.planning/REQUIREMENTS.md` — milestone requirements
- `.planning/phases/22-carrier-merge-redesign/22-07-SUMMARY.md` — Phase 22 final state (start state 1 L1 frog, cosmos gate, etc.)

</canonical_refs>

<specifics>
## Specific Ideas

- **Existing pulse pattern reuse:** ElementAuraOverlay (Phase 22) shows Phaser aura pattern что можно референсить для TutorialPulseRing design.
- **Existing toast pattern:** `eventBus.emit('cosmic:toast', { type, msg, duration })` уже работает — можно reuse для onboarding toasts с separate event type `'onboarding:toast'` или extend.
- **Ghost-frog trail:** semi-transparent (alpha 0.5) copy of source frog sprite, moving via Phaser tween на smooth quadratic curve, fade-out при arrival. Без полноценной CarrierAscensionTween-like complexity.
- **Confetti burst:** Phaser particle emitter (built-in) с location-color palette. Без custom shader.
- **OnboardingController как state machine:** beats 1→2→3 sequential, beat 4 reactive on `'location:unlocked'` event. State в Zustand slice OR plain useReducer.
- **Welcome modal mount timing:** App.tsx после i18n init, перед MainScene render. Backdrop full-screen.

</specifics>

<deferred>
## Deferred Ideas

- **Skip tutorial button** — не нужен (soft hints auto-dismiss)
- **Replayable tutorial menu** — отдельная фаза если игроки попросят
- **Achievement system** для onboarding completion — отдельная меньшая фича
- **Voice/sound effects** — beyond existing SFX, отдельная аудио-фаза
- **Multi-step swipeable welcome carousel** — overkill для idle
- **A/B testing onboarding variants** — после baseline pilots
- **Difficulty-adaptive hints** — нет данных для модели
- **Server-side onboarding state / cross-device sync** — per-device acceptable trade-off

</deferred>

---

*Phase: 23-onboarding-flow*
*Context gathered: 2026-05-18 via PRD Express Path*
