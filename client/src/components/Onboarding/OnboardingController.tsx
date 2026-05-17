// Phase 23: Soft 4-beat onboarding coordinator.
//
// State machine (filled by Plan 23-02..05):
//   Beat 1: Welcome modal (if !welcomeSeen) — Plan 23-02
//   Beat 2: Tap-hint pulse (if welcomeSeen && !firstBoxTapSeen && box landed) — Plan 23-03
//   Beat 3: Merge demo (if firstBoxTapSeen && !firstMergeSeen && ≥2 L1 frogs) — Plan 23-04
//   Beat 4: Location celebration on 'location:unlocked' (if !locationsCelebrated[id]) — Plan 23-05
//
// Wave 1 (this plan): skeleton — subscribes to state, returns null. Beat overlays
// will be added by later plans as conditional JSX branches.
//
// IMPORTANT (memory feedback_clickability): all future beat overlays must use
//   - <button type="button"> for interactive elements
//   - z-index ≥ 100 to sit above Phaser canvas + LocationStack
//   - pointer-events handled explicitly on the overlay root
//
// IMPORTANT (memory feedback_frog_container_alpha): do NOT tween frog.container.alpha
// for any hint/highlight effect — add a separate child sprite instead.

import { useEffect } from 'react'
import { useOnboardingStore } from '../../store/onboarding/onboardingSlice'

export function OnboardingController() {
  // Subscribe to flags so this component re-renders when state changes.
  // Plan 23-02..05 will read these to drive conditional render branches.
  // Wave 1 reads them through a single combined selector to keep TS happy
  // without unused-locals; later plans will switch to per-flag selectors.
  const flags = useOnboardingStore((s) => ({
    welcomeSeen: s.welcomeSeen,
    firstBoxTapSeen: s.firstBoxTapSeen,
    firstMergeSeen: s.firstMergeSeen,
  }))
  // Plan 23-05 will subscribe to locationsCelebrated + eventBus 'location:unlocked'.

  useEffect(() => {
    // Placeholder lifecycle hook — Plan 23-03..05 will attach eventBus listeners
    // (e.g. 'box:landed', 'merge:happened', 'location:unlocked') and return their
    // cleanup tuples here.
    // Reference flags so future plans can read them inside the effect closure
    // without TS complaining about unused locals in Wave 1.
    void flags
    return () => {
      /* no-op in Wave 1 */
    }
  }, [flags])

  // Wave 1: shell render. Beat overlays added by Plan 23-02..05.
  return null
}
