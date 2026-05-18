---
phase: 24-captain-creation-cinematic
plan: 03
subsystem: captain-cinematic-modal
tags: [phase-24, cinematic, captain, dom-modal, i18n, beat-3]
requires:
  - 24-01 (eventBus 'captain:birth-effect-complete' type)
provides:
  - CaptainBirthModal DOM component (self-mounting, listens to captain:birth-effect-complete)
  - eventBus 'captain:birth-cta' event type
  - i18n captain.birth.{title,subtitle,cta} в RU/EN/ES
affects:
  - Plan 24-04 (будет subscriber на 'captain:birth-cta' → Beat 4 spawn + Beat 5 starmap:open)
tech-stack:
  added: []
  patterns:
    - "WelcomeModal pattern: createPortal + exiting state + setTimeout(emit, FADE_OUT_MS)"
    - "Anti-pink-fullscreen CTA: inline-block + width auto + minWidth + maxWidth 100%"
    - "Inline SVG frog (zero network deps, identical paths к WelcomeModal)"
    - "CSS @keyframes only (memory feedback_animations — Lottie выпилен)"
key-files:
  created:
    - client/src/components/Captain/CaptainBirthModal.tsx
    - client/src/components/Captain/captainBirthModal.css
  modified:
    - client/src/i18n/ru.json (+7 lines: captain.birth namespace)
    - client/src/i18n/en.json (+7 lines)
    - client/src/i18n/es.json (+7 lines)
    - client/src/store/eventBus.ts (+6 lines: 'captain:birth-cta': void)
decisions:
  - "Copy/paste SVG paths из WelcomeModal — identical L1 frog (8 shapes + smile path). Не выноcim в shared component потому что 2 inline SVG ≠ shared lib (premature abstraction), и в WelcomeModal они 72x72 без glow, а здесь 120x120 + drop-shadow + pulse — параметризация увеличила бы поверхность без real reuse value."
  - "Backdrop click эмитит то же 'captain:birth-cta' (а не отдельное 'captain:birth-cancel'). Rationale: для Plan 24-04 Beat 4+5 это одно и то же намерение 'идём в космос' — независимо от того, тапнул user CTA или просто закрыл backdrop. Если позже нужно будет различать аналитикой — добавить enum payload."
  - "z-index 200 (выше HUD = 100, выше WelcomeModal = 100). Captain birth — cinematic peak, должен перекрывать всё."
  - "minWidth: 200 на CTA (vs 160 у WelcomeModal): «В космос →» с пробелами + стрелкой шире чем «Начать», нужен больший reserve чтобы текст не переносился."
metrics:
  duration_min: 12
  tasks_completed: 2
  files_created: 2
  files_modified: 4
  commits: 2
  completed_date: 2026-05-18
---

# Phase 24 Plan 24-03: Captain Birth Modal Summary

Реализован Beat 3 cinematic — DOM modal «Вы создали Капитана» с self-mount по eventBus и pink CTA `«В космос →»`, dismiss → emit `captain:birth-cta` (для Plan 24-04 hook'а).

## Tasks Completed

### Task 1: i18n + eventBus event type
**Commit:** `dedfaa8` (feat(24-03): captain.birth i18n + eventBus captain:birth-cta)

- Добавлен top-level namespace `captain.birth.{title, subtitle, cta}` в `ru.json` / `en.json` / `es.json`
- В `eventBus.ts`: добавлен новый event `'captain:birth-cta': void` (после existing 'captain:birth-effect-complete' из Plan 24-01)
- `check-translations.cjs` PASS: 337 keys × 3 локали, 0 missing
- tsc clean

**i18n strings (final):**

| Lang | title | subtitle | cta |
|------|-------|----------|-----|
| RU | Вы создали Капитана | Космос открыт. Готовы исследовать? | В космос → |
| EN | You Created the Captain | The cosmos is open. Ready to explore? | To Cosmos → |
| ES | Has Creado al Capitán | El cosmos está abierto. ¿Listo para explorar? | Al Cosmos → |

### Task 2: CaptainBirthModal.tsx + captainBirthModal.css
**Commit:** `9c928ee` (feat(24-03): CaptainBirthModal DOM (Beat 3, frog + gold glow + CTA))

- `client/src/components/Captain/CaptainBirthModal.tsx` (180 lines) — self-mounting modal через `createPortal(node, document.body)`
- `client/src/components/Captain/captainBirthModal.css` (32 lines) — 3 keyframes (fade-in, fade-out, pulse) + 3 classes
- Subscribes к `eventBus.on('captain:birth-effect-complete')` в `useEffect`, `setVisible(true)`
- Dismiss flow: CTA tap ИЛИ backdrop click → `setExiting(true)` → `setTimeout(unmount + emit('captain:birth-cta'), 400ms)`
- tsc clean, vite build OK (5.2s)

## Inline SVG Paths (L1 Frog)

Copy/paste из `WelcomeModal.tsx` без модификаций (8 shapes + smile path) — identical L1 frog, отличия только в обёртке (120x120 vs 72x72) и filter (gold drop-shadow):

```jsx
<svg viewBox="0 0 100 100" width="120" height="120">
  <ellipse cx="50" cy="60" rx="34" ry="28" fill="#65a30d" />   {/* body back */}
  <ellipse cx="50" cy="58" rx="28" ry="20" fill="#a3e635" />   {/* body front */}
  <circle cx="36" cy="36" r="12" fill="#65a30d" />             {/* eye-bumps */}
  <circle cx="64" cy="36" r="12" fill="#65a30d" />
  <circle cx="36" cy="36" r="9" fill="#fff" />                 {/* sclera */}
  <circle cx="64" cy="36" r="9" fill="#fff" />
  <circle cx="38" cy="38" r="5" fill="#000" />                 {/* pupils */}
  <circle cx="66" cy="38" r="5" fill="#000" />
  <path d="M 38 64 Q 50 74 62 64" stroke="#365314" strokeWidth="3" fill="none" strokeLinecap="round" />
</svg>
```

## Visual Tokens (final, frozen)

- **Backdrop:** `radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 70%)` — deep cinematic vignette
- **Card:** max-width 320 / padding `28px 20px 22px` / bg `#1a2e1a` / border `2px solid rgba(255,255,255,0.15)` / radius 16
- **Frog wrapper class `.captain-birth-frog`:** width/height 120 / filter `drop-shadow(0 0 24px #fde047)` / `animation: captain-birth-pulse 1500ms ease-in-out infinite` (scale 1.0 ↔ 1.05)
- **Title:** 26px / fontWeight 900 / `#fde047` / textShadow `0 2px 12px rgba(253, 224, 71, 0.4)`
- **Subtitle:** 14px / fontWeight 500 / `#d4d4d8` / lineHeight 1.4 / margin 12 top / 20 bottom
- **CTA:** `#ec4899` solid (не gradient) / inline-block / width auto / minWidth 200 / padding `14px 32px` / radius 12 / fontSize 16 / fontWeight 700
- **z-index:** 200 (выше HUD=100, выше Onboarding modals=100)
- **FADE_OUT_MS:** 400

## Cliclability Checklist (memory feedback_clickability)

- [x] `type="button"` на CTA
- [x] `z-index: 200` (overlay выше всего)
- [x] backdrop `onClick={handleDismiss}` — клик по тёмному фону dismisses
- [x] inner card `onClick={(e) => e.stopPropagation()}` — клик по frog/title/subtitle НЕ закрывает
- [x] `touchAction: 'manipulation'` на backdrop И на CTA (300ms tap-delay убран)
- [x] CTA `display: 'inline-block'` + `width: 'auto'` + `maxWidth: '100%'` — НЕ растягивается на весь экран (anti-bug pattern из WelcomeModal rewrite 2026-05-18)
- [x] `role="dialog"` + `aria-modal="true"` + `aria-labelledby="captain-birth-title"`

## Animation Rules Compliance

- 0 импортов из `lottie-web` / `@lottiefiles/*` (memory feedback_animations — Lottie выпилен)
- 0 ссылок на `frog.container.alpha` (memory feedback_frog_container_alpha — DOM SVG, не Phaser sprite)
- 3 CSS keyframes (`captain-birth-fade-in/out/pulse`) — все scale/opacity only, GPU-friendly
- `will-change: transform` на frog wrapper для smooth pulse

## DEV Smoke Test Snippet

Чтобы убедиться визуально БЕЗ Plan 24-04 (когда mount component уже будет в App.tsx):

1. Временно вставить в `App.tsx`:
   ```tsx
   import { CaptainBirthModal } from './components/Captain/CaptainBirthModal'
   // в JSX где-нибудь корневой уровень:
   <CaptainBirthModal />
   ```
2. В DevTools console:
   ```js
   eventBus.emit('captain:birth-effect-complete')
   ```
3. Должен появиться dark backdrop + centered card с pulsing gold-glowing frog + gold title + subtitle + pink CTA
4. Кликнуть CTA или backdrop → fade-out 400ms → modal unmount → в console emit'тся `captain:birth-cta` (можно подписаться `eventBus.on('captain:birth-cta', console.log)` чтобы проверить)
5. УБРАТЬ временный mount перед commit (Plan 24-04 сделает это правильно — рядом с MergeController hook'ом в одном атомарном commit)

## Deviations from Plan

**None** — plan executed exactly as written. Все must_haves соблюдены, все cliclability points присутствуют, никаких auto-fixes (Rule 1-3) не потребовалось.

## Coordination with Parallel Agent (Plan 24-02)

Parallel agent работал над Plan 24-02 (Phaser CaptainBirthEffect):

- Их commits: `12cae56` (effect), `4a1f3cc` (MainScene wire) — landed между моими `dedfaa8` (Task 1) и `9c928ee` (Task 2)
- **Conflict-free:** parallel agent НЕ трогал `eventBus.ts` (как обещано briefing'ом), я НЕ трогал `MainScene.ts` / `CaptainBirthEffect.ts`
- Один transient git error при моём втором commit'е (вероятно race condition между concurrent `git add`/`git commit` процессами) — fixed retry'ем (re-add + re-commit), без data loss и без duplicate коммитов
- Финальный tsc после ВСЕХ commits (24-02 + 24-03 совместно): clean — 0 errors

## End-to-End Flow Status (после Plan 24-03)

```
[L18+L18 merge - Plan 24-04 future]
    ↓ emits 'captain:birth-start' {x,y}
[CaptainBirthEffect Phaser - Plan 24-02 DONE]
    ↓ ~3s cinematic, emits 'captain:birth-effect-complete'
[CaptainBirthModal DOM - Plan 24-03 DONE  ← мы здесь]
    ↓ CTA/backdrop dismiss, emits 'captain:birth-cta'
[Plan 24-04 hook (TODO)]
    ↓ spawn L1 frog + eventBus.emit('starmap:open')
[Beat 5: Star Map opens]
```

Beat 3 готов, ждёт mount в App.tsx (Plan 24-04) и emit upstream от Plan 24-02.

## Self-Check: PASSED

- `client/src/components/Captain/CaptainBirthModal.tsx` — FOUND
- `client/src/components/Captain/captainBirthModal.css` — FOUND
- Commit `dedfaa8` — FOUND in git log
- Commit `9c928ee` — FOUND in git log
- `captain.birth.title/subtitle/cta` keys present in ru/en/es — verified via node JSON.parse
- `'captain:birth-cta': void` in eventBus.ts Events type — verified via grep
- tsc clean (combined with parallel agent's 24-02 changes) — 0 errors
- vite build OK — `./node_modules/.bin/vite build` exited 0
- check-translations PASS — 337 keys × 3 locales, 0 missing
