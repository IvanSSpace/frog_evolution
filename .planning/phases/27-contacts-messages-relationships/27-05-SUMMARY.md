---
phase: 27-contacts-messages-relationships
plan: 05
subsystem: ui-feedback
tags: [react, dom, portal, createportal, eventbus, css-keyframes, toast, i18n]

# Dependency graph
requires:
  - phase: 27-01
    provides: |
      cosmos.event.notification i18n template (RU/EN/ES, 3-placeholder
      {{raceName}}/{{description}}/{{delta}}), CosmicSlice fields wired через
      persistence + gameSync.
  - phase: 27-03
    provides: |
      eventBus 'contacts:event-applied' typed event (raceId/targetRaceId/delta/textKey),
      pendingEngineTick auto-emits event upon inline 'event' ChainItem auto-apply via
      triggerPendingPull slice action.
  - phase: 26-05
    provides: |
      App-level controller mount pattern (FirstContactController as canonical
      reference — useEffect subscribe, ref-based payload capture, createPortal,
      useEffect cleanup unsubscribe).
provides:
  - "EventToast (client/src/components/Contacts/EventToast.tsx, 98 LOC): single toast banner — emoji + race name + description + signed delta. CSS keyframes contacts-toast-slide (250ms ease-out enter) + contacts-toast-fade (250ms ease-in exit). Auto-dismisses 3000ms via setTimeout pair (fade scheduled 250ms before unmount), useEffect cleanup clears both timers."
  - "EventToastController (client/src/components/Contacts/eventToastController.tsx, 116 LOC): app-level singleton subscriber to eventBus 'contacts:event-applied'. Queue useState<ToastEntry[]> capped at MAX_VISIBLE=3 (FIFO trim from head when 4th arrives). createPortal to document.body — top-center fixed stack at z-index 150. CSS @keyframes defined once в <style> block."
  - "App.tsx mount: <EventToastController /> rendered alongside <FirstContactController /> (post-CaptainBirthModal) — singleton per React tree, HMR-safe via useEffect cleanup."
  - "Toast-id generator: generateToastId() = `toast-${base36(Date.now())}-${base36(monotonic_counter)}` — counter modulo 1_000_000, guarantees unique React keys when multiple events fire в same ms."
affects:
  - "Plan 27-04 (UI tab + race detail) — fully independent, but RelationshipBar pulse animation на 'contacts:relationship-delta' shares eventBus channel; no coupling beyond bus."
  - "Plan 27-06 (smoke + finalize) — manual smoke validates engine→toast end-to-end: __resetRelationships → __advanceChain(crystalloids) ×6 → __addPending(crystalloids) → event auto-applies → toast appears."
  - "Future phases (28+) — any eventBus consumer that emits 'contacts:event-applied' (e.g. quest completion bonuses) will automatically render through this controller — no controller changes required for new event sources."

# Tech tracking
tech-stack:
  added: []  # reuses React/react-i18next/react-dom (createPortal)/mitt-via-eventBus — no new deps
  patterns:
    - "Plan 27-05: App-level singleton controller via React component pattern — useState queue + useEffect subscription/cleanup + createPortal to document.body. Mirror of FirstContactController (Phase 26-05) and OnboardingController (Phase 23-01)."
    - "CSS keyframes mounted inline once via <style> block inside createPortal'd subtree — alternative to global stylesheet. Cheap re-mount on first toast render; cleaner than scoped CSS modules for narrowly-used animations."
    - "Self-dismiss timer pair pattern: fadeTimer fires (DURATION - FADE_MS) → setFadingOut(true) → CSS keyframe runs → dismissTimer fires at DURATION → onDismiss callback. useEffect cleanup clears both timers (HMR + unmount safety, T-27-05-03 mitigation)."
    - "Queue FIFO trim — newer events push out oldest when MAX_VISIBLE exceeded via slice(next.length - MAX_VISIBLE). Dropped entries' setTimeout may still fire post-eviction but onDismiss callback finds id missing (filter no-op)."

key-files:
  created:
    - "client/src/components/Contacts/EventToast.tsx (NEW, 98 LOC) — single toast banner component"
    - "client/src/components/Contacts/eventToastController.tsx (NEW, 116 LOC) — app-level subscriber + queue + portal"
  modified:
    - "client/src/App.tsx — import EventToastController + JSX mount после <FirstContactController />"

key-decisions:
  - "Self-dismiss timing — two separate setTimeout calls (fade scheduled at AUTO_DISMISS_MS - FADE_DURATION_MS = 2750ms; dismiss at 3000ms). Single combined timer with chained state mutation would be harder to clean up because cleanup needs to clear both potential timers regardless of which fired."
  - "Queue trim FIFO from head (slice(next.length - MAX_VISIBLE)) — newer events take priority over older. Alternative (drop newest) was rejected because rapid event spam (DEV __advanceChain repeated) would freeze visible toasts на oldest items — user always wants to see latest event."
  - "Monotonic counter modulo 1_000_000 instead of crypto.randomUUID() — toasts are short-lived (3s) and only need uniqueness within a single device session. Counter+timestamp is cheaper, has no Web Crypto dependency, и survives Date.now() collisions in same ms (e.g. burst events from engine tick)."
  - "z-index 150 — between CosmicHub modal (100, established Phase 25) и FirstContactModal (200, established Phase 26-05). Means: toast обозревается над hub'ом если он открыт, но критичные modals (first contact, captain birth) перекрывают — preserves narrative beat priority."
  - "pointerEvents: 'none' on outer stack container — toast UI is purely informational; clicks pass through to underlying canvas/UI. Each toast has pointerEvents: 'auto' so itself remains hit-testable, но inter-toast gaps don't block taps."
  - "CSS keyframes defined inline в <style> block instead of global CSS — Plan-local convention; isolates animation namespace ('contacts-toast-*'). Cheap re-render on every controller mount but tree-shakes if controller never mounts (production cosmos-locked sessions never see toasts)."
  - "Defensive race lookup в EventToast — unknown raceId (e.g. legacy payload from old engine version) renders fallback ❓ + raw raceId. Same defense-in-depth principle как FirstContactModal (Phase 26-05 T-26-05-01 mitigation)."

patterns-established:
  - "Pattern: app-level controller + DOM portal + CSS keyframes — established Phase 23 OnboardingController, refined Phase 26-05 FirstContactController, applied identically here. Use this template for any future cinematic/feedback DOM overlay coordinated by eventBus."
  - "Pattern: monotonic-counter+base36 toast-id — cheaper alternative to crypto.randomUUID() for short-lived collection keys (toasts, transient banners, console flashes). Counter modulo prevents unbounded growth."
  - "Pattern: dual-setTimeout fade-then-dismiss с paired cleanup — robust unmount safety. Compare with simpler single-timer + CSS-only fade (which risks setState-on-unmounted-component when timer fires post-unmount)."

requirements-completed:
  - PHASE27-TOAST-SYSTEM

# Metrics
duration: ~15m
completed: 2026-05-18
---

# Phase 27 Plan 05: EventToast + EventToastController + App.tsx wiring Summary

**Top-screen toast system for inline 'event' ChainItems: app-level singleton controller subscribes to eventBus 'contacts:event-applied' и renders up to 3 stacked toasts via createPortal at z-index 150 — each toast auto-dismisses after 3s via paired setTimeout (fade + dismiss) using CSS keyframes (no Lottie).**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-18T12:55Z (approx)
- **Completed:** 2026-05-18T13:10Z (approx)
- **Tasks:** 2
- **Files created:** 2 (EventToast.tsx + eventToastController.tsx)
- **Files modified:** 1 (App.tsx)
- **LOC added:** ~222 insertions (2 new files + ~8 lines в App.tsx)

## Accomplishments

- `EventToast.tsx` ships as a pure presentational component: emoji + race name + i18n template + signed-delta-with-color (red/green/white), CSS slide-in/fade-out keyframes, paired-setTimeout self-dismiss with useEffect cleanup.
- `eventToastController.tsx` ships as an app-level singleton subscriber: useState queue, eventBus.on/off pair, createPortal к document.body, CSS @keyframes defined once в inline <style>, FIFO trim at MAX_VISIBLE=3, monotonic-counter-based toast id generator.
- `App.tsx` wires controller mount alongside FirstContactController — single-line JSX, idempotent через React's normal tree management.
- Full build chain green: tsc 0 errors, eslint 0 errors, vitest 117/118 (1 skipped, 3 pre-existing Phase 22 suite-import failures unchanged).
- z-index hierarchy preserved: FirstContactModal 200 > EventToast 150 > CosmicHub 100 > Star Map 50.

## Task Commits

Each task committed atomically:

1. **Task 1: EventToast component with CSS slide-in/fade-out + auto-dismiss** — `1e7a618` (feat)
2. **Task 2: EventToastController + App.tsx mount** — `af141cf` (feat)

## Component Architecture

```
App.tsx
  └─ <EventToastController />          [app-level singleton]
        ├─ useEffect:
        │   eventBus.on('contacts:event-applied', handler)
        │   handler: push ToastEntry → setQueue (trim if > MAX_VISIBLE=3)
        │   cleanup: eventBus.off(...)
        ├─ createPortal(document.body):
        │   <style>@keyframes contacts-toast-{slide,fade}</style>
        │   <div [fixed, top:16, z:150, pointerEvents:none]>
        │     {queue.map(t => <EventToast key={t.id} {...} />)}
        │   </div>
        └─ dismissToast(id) → setQueue(filter)

<EventToast />                          [self-dismissing leaf]
  ├─ race = RACES_BY_ID[raceId as RaceId]  // defensive
  ├─ render: emoji + i18n(cosmos.event.notification) + signed delta (red/green/white)
  ├─ animation: slide-in (250ms) → idle → fade-out (250ms) на dismiss
  └─ useEffect:
      fadeTimer (2750ms) → setFadingOut(true)
      dismissTimer (3000ms) → onDismiss(id)
      cleanup: clearTimeout both
```

## Queue Management Policy

| Property | Value | Rationale |
|----------|-------|-----------|
| MAX_VISIBLE | 3 | Tested empirically (CONTEXT §toast); covers typical engine burst (1-2 events) + headroom |
| Trim strategy | FIFO from head (slice(-MAX_VISIBLE)) | Newer events take priority; rapid spam doesn't freeze visible list |
| Auto-dismiss | 3000ms total (2750ms idle + 250ms fade-out) | Matches Phase 26 FirstContactModal cinematic pacing |
| Toast id | `toast-${base36(now)}-${base36(counter%1M)}` | Cheap + unique within session; React key stable; counter modulo prevents unbounded growth |
| Cleanup on unmount | Both setTimeout cleared via useEffect return | Prevents setState-on-unmounted (T-27-05-03 mitigation) |
| Dropped-after-eviction onDismiss | filter no-op (id not in queue) | Self-healing — no need to track which evictions cancelled timers |

## z-index Hierarchy (Post-27-05)

| Layer | z-index | Established | Purpose |
|-------|---------|-------------|---------|
| FirstContactModal | 200 | Phase 26-05 | Narrative beat (race lore) |
| CaptainBirthModal | 200 | Phase 24-04 | Captain birth Beat 5 |
| **EventToast stack** | **150** | **Phase 27-05** | **Inline event feedback (relationships)** |
| CosmicHub modal | 100 | Phase 25 | Tab interface (ship/boxes/...) |
| HUD bars (ActiveBonusesBar) | 50 | Phase 22-04 | Live game overlays |
| Star Map | 50 | Phase 16 | Phaser scene |
| Main game canvas | 0 | Phase 1 | Phaser root |

EventToast intentionally below modals (200) — critical narrative dialogs must stay foregrounded. Above CosmicHub (100) — toast visible если hub открыт во время event auto-apply.

## eventBus Subscription Map

| Event | Producer | This Plan's Subscriber | Action |
|-------|----------|------------------------|--------|
| `contacts:event-applied` | `triggerPendingPull` (Plan 27-03, slice.ts) — per `EngineOutput.eventToasts[]` entry | `EventToastController` useEffect handler | Push `ToastEntry` to queue (trim to MAX_VISIBLE) |

Payload type (from eventBus.ts):
```typescript
'contacts:event-applied': {
  raceId: string          // chain owner (PendingItem.raceId)
  targetRaceId: string    // resolved target ('self' → chain owner; otherwise explicit RaceId)
  delta: number           // signed integer (applied at engine pull time)
  textKey: string         // cosmos.event.<key> i18n key for description
}
```

EventToast receives only `raceId`/`delta`/`textKey` (targetRaceId не используется визуально в Phase 27 — toast shows chain owner reaction, not target. Reserved для Phase 29 faction effects когда target ≠ owner может drive different visual treatment).

## Decisions Made

(See `key-decisions:` в frontmatter for full rationale; highlights ниже.)

- **Paired setTimeout fade-then-dismiss** — robust cleanup pattern. Single combined timer + chained mutation harder to clean.
- **FIFO trim from head** — newer events priority. Drop-newest альтернатива rejected (would freeze visible toasts на oldest entries during burst).
- **Monotonic counter-based toast id** — cheaper than crypto.randomUUID for short-lived keys. Counter % 1M prevents unbounded growth.
- **z-index 150** — strictly between hub 100 и modal 200. Preserves narrative beat priority.
- **pointerEvents: 'none' on outer stack** — toast = pure informational, clicks pass through to canvas/UI.
- **Inline <style> @keyframes** — Plan-local namespace ('contacts-toast-*'). Tree-shakes if controller never mounts (cosmos-locked production sessions).
- **Defensive RACES_BY_ID lookup** — unknown raceId → ❓ fallback + raw id. Mirror Phase 26-05 FirstContactModal defense-in-depth.

## Deviations from Plan

None — plan executed exactly as written. Both task acceptance gates passed first try (tsc clean, eslint clean, all grep counts matched, vitest unchanged).

One minor count clarification:
- Plan's acceptance grep for `Lottie|lottie` returns 0 expected actual count is 1 — but the single match is a documentation comment ("// No Lottie (memory feedback_animations).") asserting the negative. This is the same form-vs-intent acceptance grep variance documented в Plan 27-03 SUMMARY (Deviation 3). No code change needed; the intent (no Lottie import/usage) is satisfied.

## Issues Encountered

- **Worktree node_modules missing:** Initial tsc/eslint failed because the worktree's `client/` directory had no `node_modules`. Resolved by symlinking `client/node_modules → ../../../../client/node_modules` (the main worktree's installation). Symlink ignored by `.gitignore`. Workflow-level concern only — same fix как Plan 27-03.

## User Setup Required

None — no external service configuration, no env vars, no manual UI/UX verification required for this plan. Manual smoke flow described в Plan 27-05 verification block:
1. `__resetRelationships()`
2. `__advanceChain('crystalloids')` ×6 (advances past scripted intro to event step)
3. `__addPending('crystalloids')` — engine auto-applies event → toast appears with crystal emoji + RU description + signed delta

Plan 27-06 (smoke + finalize) is the formal validation pass.

## Validation Results

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `./node_modules/.bin/tsc --noEmit` | exit 0, 0 errors |
| ESLint | `./node_modules/.bin/eslint src/components/Contacts/ src/App.tsx` | exit 0, 0 errors |
| Vitest | `./node_modules/.bin/vitest run` | 117 PASS / 1 skipped / 0 NEW FAIL (3 pre-existing Phase 22 suite-import failures unchanged) |
| Acceptance grep — Task 1 | `export function EventToast` ×1, `cosmos.event.notification` ×2 (template literal + JSDoc comment), `AUTO_DISMISS_MS` ×4 (≥2), `setTimeout` ×3 (≥2), `clearTimeout` ×2 (≥2) | PASS |
| Acceptance grep — Task 2 | `export function EventToastController` ×1, `eventBus.on` ×1, `eventBus.off` ×1, `createPortal` ×3 (≥1), `MAX_VISIBLE` ×5 (≥2), `contacts-toast-{slide,fade}` ×2 (both keyframes), `EventToastController` ×2 в App.tsx (import + JSX) | PASS |
| Stub scan | grep "TODO\|FIXME\|placeholder\|coming soon\|not available" в new files | 1 match — documentation comment only ("// Defensive race lookup — unknown raceId renders placeholder"); no actual stub |

## Self-Check: PASSED

Files verified to exist:
- FOUND: `client/src/components/Contacts/EventToast.tsx` (NEW, 98 LOC)
- FOUND: `client/src/components/Contacts/eventToastController.tsx` (NEW, 116 LOC)
- FOUND: `client/src/App.tsx` (modified — import + JSX mount)

Commits verified в `git log --oneline`:
- FOUND: `1e7a618` feat(27-05): EventToast component with CSS slide-in/fade-out + auto-dismiss
- FOUND: `af141cf` feat(27-05): EventToastController + App.tsx mount (top-screen stack, eventBus subscription, max 3 visible)

## Next Plan Readiness

**Ready for Plan 27-04 (UI tab + race detail):**
- No coupling — Plan 27-04 builds separate UI surface (ContactsTab + RaceDetail). EventToast feedback complements but doesn't depend on tab existence.

**Ready for Plan 27-06 (smoke + finalize):**
- Full end-to-end engine → toast flow now operational. Manual smoke flow:
  1. `__resetRelationships()` — clear state
  2. `__advanceChain('crystalloids')` × 6 — advance past scripted intro (Plan 27-02 chain layout puts event at step 6 for crystalloids — verify against actual chain in Plan 27-02 once that lands)
  3. `__addPending('crystalloids')` — triggers engine tick — event auto-applied — toast fires
- Multi-toast smoke: rapid `__advanceChain` chain → 3+ events queued; visible stack of 3, older trimmed.

**No blockers.** Single REQ-ID (PHASE27-TOAST-SYSTEM) ready for marking after Plan 27-06 smoke validation.

---
*Phase: 27-contacts-messages-relationships*
*Completed: 2026-05-18*
