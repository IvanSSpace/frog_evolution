// Phase 23 Plan 23-01: onboarding Zustand store.
//
// Separate, isolated slice — does NOT live inside gameStore/cosmic, because:
//   1. Per-device only (no server sync) → must not be in any persisted slice
//      that ships to server (cosmic does ship).
//   2. UX-only state — keeping it out of gameStore avoids accidental couplings
//      with merge/box gameplay (which Phase 22 carrier migration touched).
//
// subscribeWithSelector middleware enabled so Plan 23-02..05 effects can
// subscribe to individual flags (e.g. `s => s.welcomeSeen`) without re-firing
// on unrelated changes.
//
// Each mark-action calls saveOnboarding(get()) synchronously so localStorage
// stays in sync without any debounce — these are infrequent one-shot events.

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { OnboardingActions, OnboardingState } from './types'
import { loadOnboarding, saveOnboarding } from '../persistence'

type Store = OnboardingState & OnboardingActions

const initial = loadOnboarding()

// Inline-extended action type: `hydrateFromServer` not yet added to
// OnboardingActions in types.ts (scope limit). Cast keeps the public store
// типизированным, server-sync usage в gameSync.ts достаёт action через
// getState() so внешний consumer doesn't trip on missing prop in OnboardingActions.
type StoreExt = Store & {
  hydrateFromServer: (incoming: Partial<OnboardingState>) => void
}

export const useOnboardingStore = create<StoreExt>()(
  subscribeWithSelector((set, get) => ({
    ...initial,

    markWelcomeSeen: () => {
      if (get().welcomeSeen) return
      set({ welcomeSeen: true })
      saveOnboarding(snapshot(get()))
    },

    markFirstBoxTapSeen: () => {
      if (get().firstBoxTapSeen) return
      set({ firstBoxTapSeen: true })
      saveOnboarding(snapshot(get()))
    },

    markFirstMergeSeen: () => {
      if (get().firstMergeSeen) return
      set({ firstMergeSeen: true })
      saveOnboarding(snapshot(get()))
    },

    markLocationCelebrated: (locationId: number) => {
      const s = get()
      if (s.locationsCelebrated[locationId]) return
      set({
        locationsCelebrated: {
          ...s.locationsCelebrated,
          [locationId]: true,
        },
      })
      saveOnboarding(snapshot(get()))
    },

    __reset: () => {
      set({
        welcomeSeen: false,
        firstBoxTapSeen: false,
        firstMergeSeen: false,
        locationsCelebrated: {},
      })
      saveOnboarding(snapshot(get()))
    },

    hydrateFromServer: (incoming: Partial<OnboardingState>) => {
      // Merge: ANY true wins (monotonic seen flags). Прохождение онбординга
      // нельзя отменить — если хоть один источник (local или server) сказал
      // что юзер прошёл beat, не показываем повторно.
      const cur = get()
      const next: OnboardingState = {
        welcomeSeen: cur.welcomeSeen || incoming.welcomeSeen === true,
        firstBoxTapSeen:
          cur.firstBoxTapSeen || incoming.firstBoxTapSeen === true,
        firstMergeSeen: cur.firstMergeSeen || incoming.firstMergeSeen === true,
        locationsCelebrated: { ...cur.locationsCelebrated },
      }
      if (
        incoming.locationsCelebrated &&
        typeof incoming.locationsCelebrated === 'object'
      ) {
        for (const [k, v] of Object.entries(incoming.locationsCelebrated)) {
          const id = Number(k)
          if (!isNaN(id) && v === true) {
            next.locationsCelebrated[id] = true
          }
        }
      }
      set(next)
      saveOnboarding(snapshot(get()))
    },
  })),
)

// Extract persisted shape (strips actions) from the live store.
function snapshot(s: Store): OnboardingState {
  return {
    welcomeSeen: s.welcomeSeen,
    firstBoxTapSeen: s.firstBoxTapSeen,
    firstMergeSeen: s.firstMergeSeen,
    locationsCelebrated: { ...s.locationsCelebrated },
  }
}
