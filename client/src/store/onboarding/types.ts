// Phase 23 Plan 23-01: onboarding flow types.
//
// Per-device state for the soft 4-beat onboarding coordinator.
// Lives separately from cosmic slice — onboarding is a local UX feature, not
// part of meta/server-synced game state (per-device localStorage only).
//
// Flags are monotonically true — once a beat is shown, it never replays
// (apart from dev-only __reset).

export interface OnboardingState {
  /** Beat 1: welcome modal shown on first launch (Plan 23-02). */
  welcomeSeen: boolean
  /** Beat 2: first box-tap hint pulse dismissed (Plan 23-03). */
  firstBoxTapSeen: boolean
  /** Beat 3: drag-merge demo completed (Plan 23-04). */
  firstMergeSeen: boolean
  /**
   * Beat 4: per-location unlock celebration shown.
   * Keys are LOCATION ids (numbers): 2=Болото, 3=Лес, 6=Star Map (Plan 23-05).
   */
  locationsCelebrated: Record<number, boolean>
}

export interface OnboardingActions {
  markWelcomeSeen: () => void
  markFirstBoxTapSeen: () => void
  markFirstMergeSeen: () => void
  markLocationCelebrated: (locationId: number) => void
  /** Dev-only reset — used by window.__resetOnboarding. */
  __reset: () => void
}
