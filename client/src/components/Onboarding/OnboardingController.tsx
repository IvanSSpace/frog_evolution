// Phase 23: Soft 4-beat onboarding coordinator.
//
// State machine:
//   Beat 1: Welcome modal (if !welcomeSeen) — Plan 23-02 ✓ integrated below
//   Beat 2: Tap-hint pulse (if welcomeSeen && !firstBoxTapSeen && box landed) — Plan 23-03 ✓
//   Beat 3: Merge demo (if firstBoxTapSeen && !firstMergeSeen && ≥2 L1 frogs) — Plan 23-04
//   Beat 4: Location celebration on 'location:unlocked' (if !locationsCelebrated[id]) — Plan 23-05 ✓
//
// Plan 23-05 (this update): Beat 4 — subscribes на eventBus 'location:unlocked':
//   - При первом unlock для известного locationId (2, 3, 6):
//     1. markLocationCelebrated(id) — idempotent guard, persist в localStorage.
//     2. Fire Phaser ConfettiBurst в центре canvas (palette per location).
//     3. Emit 'onboarding:locationCelebrationStart' → LocationStack показывает
//        pulse + glow на новой button; LocationUnlockCelebration показывает toast.
//   - Per-location flag: повторный unlock этой же location → no-op.
//
// IMPORTANT (memory feedback_clickability): all future beat overlays must use
//   - <button type="button"> for interactive elements
//   - z-index ≥ 100 to sit above Phaser canvas + LocationStack
//   - pointer-events handled explicitly on the overlay root
//
// IMPORTANT (memory feedback_frog_container_alpha): do NOT tween frog.container.alpha
// for any hint/highlight effect — add a separate child sprite instead.

import { useEffect } from 'react'
import type Phaser from 'phaser'
import { useOnboardingStore } from '../../store/onboarding/onboardingSlice'
import { eventBus } from '../../store/eventBus'
import { ConfettiBurst } from '../../game/effects/ConfettiBurst'
import { WelcomeModal } from './WelcomeModal'
import { TapHintOverlay } from './TapHintOverlay'
import { LocationUnlockCelebration } from './LocationUnlockCelebration'

// Confetti palettes per location (per CONTEXT.md):
//   2 — Болото: green/yellow swamp
//   3 — Лес:    green/brown forest
//   6 — Star Map (cosmos): cyan/violet
const CONFETTI_PALETTES: Record<number, number[]> = {
  2: [0xbef264, 0xfdd87a, 0x65a30d, 0xfacc15],
  3: [0x86efac, 0x15803d, 0xa16207, 0x854d0e],
  6: [0x67e8f9, 0x0e7490, 0xa78bfa, 0x6d28d9],
}

export function OnboardingController() {
  // Per-flag selectors — каждый render зависит только от своего флага,
  // никаких лишних re-render'ов когда меняется чужой флаг.
  const welcomeSeen = useOnboardingStore((s) => s.welcomeSeen)
  // Plan 23-03: Beat 2 mount-условие — Welcome пройден, но Beat 2 ещё не seen.
  const firstBoxTapSeen = useOnboardingStore((s) => s.firstBoxTapSeen)
  // firstMergeSeen будет добавлен Plan 23-04.
  // locationsCelebrated НЕ селекторим в render — Beat 4 чисто event-driven,
  // нет JSX-условия завязанного на эту карту (toast/pulse активируются по событиям).

  // Beat 4: подписываемся на 'location:unlocked' и инициируем celebration.
  // Один раз на mount — store читаем snapshot'ом в обработчике, иначе useEffect
  // re-attach'ился бы при каждом mark и могли бы лишний раз re-bind listener
  // (или хуже — потерять in-flight event между cleanup и re-subscribe).
  useEffect(() => {
    const onUnlock = ({ locationId }: { locationId: number }) => {
      const palette = CONFETTI_PALETTES[locationId]
      if (!palette) return // unknown locationId — нет celebration assets
      const store = useOnboardingStore.getState()
      if (store.locationsCelebrated[locationId]) return // already celebrated
      store.markLocationCelebrated(locationId)

      // Phaser confetti — в центре canvas (если scene доступна).
      // MainScene exposes window.__mainScene (см. MainScene.create() Plan 23-05).
      const w = window as unknown as { __mainScene?: Phaser.Scene }
      const scene = w.__mainScene
      if (scene) {
        const canvas = scene.sys.game.canvas
        ConfettiBurst.fire({
          scene,
          x: canvas.width / 2,
          y: canvas.height / 2,
          palette,
        })
      }
      // DOM toast + LocationStack pulse — оба подписаны на этот event.
      eventBus.emit('onboarding:locationCelebrationStart', { locationId })
    }
    eventBus.on('location:unlocked', onUnlock)
    return () => {
      eventBus.off('location:unlocked', onUnlock)
    }
  }, [])

  // WelcomeModal сам вызывает markWelcomeSeen() в конце своей fade-out animation;
  // как только store mutates, этот компонент re-render'ится с welcomeSeen=true
  // → WelcomeModal unmount'ится автоматически.
  //
  // LocationUnlockCelebration mount'ится unconditionally — сам управляет
  // visibility через event subscription. Это исключает race window между
  // 'location:unlocked' и conditional mount по store-флагу.
  return (
    <>
      {!welcomeSeen && <WelcomeModal />}
      {welcomeSeen && !firstBoxTapSeen && <TapHintOverlay />}
      <LocationUnlockCelebration />
    </>
  )
}
