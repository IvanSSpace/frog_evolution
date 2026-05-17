// Phase 23 Plan 23-01: dev-only window helpers for onboarding flow.
// Phase 23 Plan 23-06: extended with beat-specific triggers + state inspector.
//
// Installed from App.tsx DEV bootstrap useEffect, alongside
// installBestiaryDevHelpers(). No-ops in production builds.
//
// Helpers exposed on window:
//   __resetOnboarding()       — wipe localStorage + state, reload page so Welcome
//                               modal (Plan 23-02) re-appears on next boot.
//   __skipOnboarding()        — mark every flag as seen + every known location
//                               celebrated, so QA can skip the flow without
//                               playing through it. Does NOT reload.
//   __triggerBeat2()          — Beat 2 manual trigger (DOM label test).
//                               Resets firstBoxTapSeen and emits a fake
//                               tutorial:firstBoxSpawned event. NB: Phaser
//                               pulse-ring will not appear without a real
//                               box; this is primarily для DOM overlay test.
//   __triggerBeat4(locationId) — Beat 4 manual trigger для конкретной локации.
//                               locationId ∈ {2, 3, 6} (Болото / Лес / Star Map).
//                               Resets celebration flag и эмитит
//                               location:unlocked. OnboardingController далее
//                               сам gate'ит через locationsCelebrated и
//                               эмитит onboarding:locationCelebrationStart.
//   __onboardingState()       — print + return current onboarding state snapshot
//                               (welcomeSeen / firstBoxTapSeen / firstMergeSeen /
//                                locationsCelebrated).
//
// Beat 3 не имеет dedicated trigger'а — он требует ≥2 реальных L1 frogs на
// поле, поэтому SMOKE_TEST_23.md описывает workaround через existing
// devCarriers/devBoxes helpers.

import { useOnboardingStore } from '../store/onboarding/onboardingSlice'
import { eventBus } from '../store/eventBus'

type OnboardingSnapshot = {
  welcomeSeen: boolean
  firstBoxTapSeen: boolean
  firstMergeSeen: boolean
  locationsCelebrated: Record<number, boolean>
}

declare global {
  interface Window {
    __resetOnboarding?: () => void
    __skipOnboarding?: () => void
    __triggerBeat2?: () => void
    __triggerBeat4?: (locationId: number) => void
    __onboardingState?: () => OnboardingSnapshot
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

  // ---- Plan 23-06: extended beat-specific helpers --------------------------

  window.__triggerBeat2 = () => {
    const s = useOnboardingStore.getState()
    if (!s.welcomeSeen) s.markWelcomeSeen()
    // Force-reset firstBoxTapSeen чтобы subscribers (TapHintOverlay) opened.
    useOnboardingStore.setState({ firstBoxTapSeen: false })
    eventBus.emit('tutorial:firstBoxSpawned', {
      x: 200,
      y: 300,
      boxId: 'dev-fake',
      width: 80,
    })
    console.info(
      '[onboarding-dev] Beat 2 triggered (fake box at 200,300; ring won’t appear without real box)',
    )
  }

  window.__triggerBeat4 = (locationId: number) => {
    if (![2, 3, 6].includes(locationId)) {
      console.error(
        '[onboarding-dev] __triggerBeat4: locationId must be 2, 3 or 6',
      )
      return
    }
    // Reset celebration flag чтобы OnboardingController пропустил event.
    const s = useOnboardingStore.getState()
    const next = { ...s.locationsCelebrated }
    delete next[locationId]
    useOnboardingStore.setState({ locationsCelebrated: next })
    eventBus.emit('location:unlocked', { locationId })
    console.info(`[onboarding-dev] Beat 4 triggered for locationId=${locationId}`)
  }

  window.__onboardingState = () => {
    const s = useOnboardingStore.getState()
    const snap: OnboardingSnapshot = {
      welcomeSeen: s.welcomeSeen,
      firstBoxTapSeen: s.firstBoxTapSeen,
      firstMergeSeen: s.firstMergeSeen,
      locationsCelebrated: { ...s.locationsCelebrated },
    }
    // console.table красивее для inspecting flat fields; nested
    // locationsCelebrated печатается отдельно ниже.
    console.table({
      welcomeSeen: snap.welcomeSeen,
      firstBoxTapSeen: snap.firstBoxTapSeen,
      firstMergeSeen: snap.firstMergeSeen,
    })
    console.info('[onboarding-dev] locationsCelebrated:', snap.locationsCelebrated)
    return snap
  }

  console.log(
    '[onboarding-dev] helpers installed: __resetOnboarding(), __skipOnboarding(), __triggerBeat2(), __triggerBeat4(id), __onboardingState()',
  )
}
