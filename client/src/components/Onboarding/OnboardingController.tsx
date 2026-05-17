// Phase 23: Soft 4-beat onboarding coordinator.
//
// State machine:
//   Beat 1: Welcome modal (if !welcomeSeen) — Plan 23-02 ✓ integrated below
//   Beat 2: Tap-hint pulse (if welcomeSeen && !firstBoxTapSeen && box landed) — Plan 23-03
//   Beat 3: Merge demo (if firstBoxTapSeen && !firstMergeSeen && ≥2 L1 frogs) — Plan 23-04
//   Beat 4: Location celebration on 'location:unlocked' (if !locationsCelebrated[id]) — Plan 23-05
//
// Plan 23-02 (this update): adds Beat 1 conditional render. Other beats остаются
// placeholder'ами — будут добавлены последующими планами как новые JSX branches
// рядом с WelcomeModal.
//
// IMPORTANT (memory feedback_clickability): all future beat overlays must use
//   - <button type="button"> for interactive elements
//   - z-index ≥ 100 to sit above Phaser canvas + LocationStack
//   - pointer-events handled explicitly on the overlay root
//
// IMPORTANT (memory feedback_frog_container_alpha): do NOT tween frog.container.alpha
// for any hint/highlight effect — add a separate child sprite instead.

import { useOnboardingStore } from '../../store/onboarding/onboardingSlice'
import { WelcomeModal } from './WelcomeModal'

export function OnboardingController() {
  // Per-flag selectors — каждый render зависит только от своего флага,
  // никаких лишних re-render'ов когда меняется чужой флаг.
  const welcomeSeen = useOnboardingStore((s) => s.welcomeSeen)
  // firstBoxTapSeen / firstMergeSeen / locationsCelebrated будут добавлены
  // Plan 23-03..05 как новые селекторы рядом.

  // WelcomeModal сам вызывает markWelcomeSeen() в конце своей fade-out animation;
  // как только store mutates, этот компонент re-render'ится с welcomeSeen=true
  // → WelcomeModal unmount'ится автоматически.
  return <>{!welcomeSeen && <WelcomeModal />}</>
}
