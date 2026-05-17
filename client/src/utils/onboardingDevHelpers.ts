// Phase 23 Plan 23-01: dev-only window helpers for onboarding flow.
//
// Installed from App.tsx DEV bootstrap useEffect, alongside
// installBestiaryDevHelpers(). No-ops in production builds.
//
// Helpers exposed on window:
//   __resetOnboarding() — wipe localStorage + state, reload page so Welcome
//                         modal (Plan 23-02) re-appears on next boot.
//   __skipOnboarding()  — mark every flag as seen + every known location
//                         celebrated, so QA can skip the flow without playing
//                         through it. Does NOT reload.

import { useOnboardingStore } from '../store/onboarding/onboardingSlice'

declare global {
  interface Window {
    __resetOnboarding?: () => void
    __skipOnboarding?: () => void
  }
}

export function installOnboardingDevHelpers(): void {
  if (typeof window === 'undefined') return
  if (!import.meta.env.DEV) return

  window.__resetOnboarding = () => {
    useOnboardingStore.getState().__reset()
    console.info('[onboarding-dev] state reset — reloading')
    // Reload so Welcome modal re-shows on next boot (Plan 23-02 trigger).
    window.location.reload()
  }

  window.__skipOnboarding = () => {
    const s = useOnboardingStore.getState()
    s.markWelcomeSeen()
    s.markFirstBoxTapSeen()
    s.markFirstMergeSeen()
    // Known location ids triggering Beat 4 (Plan 23-05):
    //   2 = Болото, 3 = Лес, 6 = Star Map sentinel.
    ;[2, 3, 6].forEach((id) => s.markLocationCelebrated(id))
    console.info('[onboarding-dev] all flags set true')
  }

  console.log(
    '[onboarding-dev] helpers installed: __resetOnboarding(), __skipOnboarding()',
  )
}
