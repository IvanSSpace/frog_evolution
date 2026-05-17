# Phase 23 Onboarding — Deferred Items

Out-of-scope issues discovered during plan execution that belong to other plans
or are pre-existing.

---

## From Plan 23-02 execution (2026-05-18)

### TS6133 unused imports in `client/src/game/scenes/main/BoxController.ts`

Discovered during `npm run build` sanity check after WelcomeModal integration.

```
src/game/scenes/main/BoxController.ts(51,1): error TS6133: 'useOnboardingStore' is declared but its value is never read.
src/game/scenes/main/BoxController.ts(52,1): error TS6133: 'TutorialPulseRing' is declared but its value is never read.
src/game/scenes/main/BoxController.ts(56,7): error TS6133: 'TUTORIAL_RING_REGISTRY_KEY' is declared but its value is never read.
src/game/scenes/main/BoxController.ts(58,7): error TS6133: 'TUTORIAL_RING_AUTO_DISMISS_MS' is declared but its value is never read.
src/game/scenes/main/BoxController.ts(60,7): error TS6133: 'TUTORIAL_RING_DELAY_MS' is declared but its value is never read.
```

**Owner:** Plan 23-03 (TutorialPulseRing integration into BoxController).
A parallel agent is wiring those imports — once they're consumed by the actual
ring spawn logic, the errors will resolve.

**Why not fixed here:** scope boundary — files belong to Plan 23-03's surface,
not Plan 23-02 (Welcome modal). `tsc --noEmit` for Plan 23-02's own files
(WelcomeModal.tsx, welcomeModal.css, OnboardingController.tsx) is clean.

**Verification when Plan 23-03 lands:**
```
cd client && npm run build
```
Expected: build PASS, bundle emitted.
