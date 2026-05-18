// Phase 26 Plan 26-01 — DEV helpers для race / first-contact smoke testing.
//
// Installed from App.tsx DEV bootstrap useEffect (рядом с
// installBestiaryDevHelpers / installOnboardingDevHelpers / installCaptainBirthDevHelpers).
// No-op в production (early-return на !import.meta.env.DEV).
//
// Helpers exposed on window:
//   __listRaces()              — console.table из 10 рас (id, affinity, emoji).
//   __markFirstContact(id)     — помечает per-race first contact как seen.
//                                Cinematic НЕ играется — Plan 26-05 controller
//                                будет emit'ить ДО mark; этот helper аналог пост-фактум.
//   __resetFirstContacts()     — всех 10 рас обратно в false. Replay-safe — Plan 26-05
//                                controller subscribe'нется на state и переоткроет
//                                cinematic на следующем visit'е (no reload required).
//   __firstContactsState()     — console.table снапшот firstContactsSeen.
//
// Returned cleanup function симметрично deletes window props (используется
// useEffect return ветка в App.tsx).

import { useGameStore } from '../store/gameStore'
import { RACES, type RaceId } from '../game/config/races'

type FirstContactsSnapshot = Record<RaceId, boolean>

declare global {
  interface Window {
    __listRaces?: () => void
    __markFirstContact?: (raceId: RaceId) => void
    __resetFirstContacts?: () => void
    __firstContactsState?: () => FirstContactsSnapshot
  }
}

export function installRaceDevHelpers(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (!import.meta.env.DEV) return () => {}

  window.__listRaces = () => {
    console.table(
      RACES.map((r) => ({
        id: r.id,
        affinity: r.affinity,
        emoji: r.emojiIcon,
        homeColor: '#' + r.homeColor.toString(16).padStart(6, '0'),
      })),
    )
  }

  window.__markFirstContact = (raceId: RaceId) => {
    useGameStore.getState().markFirstContactSeen(raceId)
    console.info(`[devRaces] marked ${raceId} first-contact seen`)
  }

  window.__resetFirstContacts = () => {
    // Build all-false record через known RACES — НЕ через Object.keys of state,
    // чтобы reset был детерминированным и не зависел от текущего shape state'а.
    const reset = {} as Record<RaceId, boolean>
    for (const r of RACES) {
      reset[r.id] = false
    }
    useGameStore.setState({ firstContactsSeen: reset })
    console.info(
      '[devRaces] firstContactsSeen reset (10 false) — no reload required',
    )
  }

  window.__firstContactsState = (): FirstContactsSnapshot => {
    const snap = useGameStore.getState().firstContactsSeen
    console.table(snap)
    return snap
  }

  console.log(
    '[devRaces] helpers installed: __listRaces(), __markFirstContact(id), __resetFirstContacts(), __firstContactsState()',
  )

  return () => {
    delete window.__listRaces
    delete window.__markFirstContact
    delete window.__resetFirstContacts
    delete window.__firstContactsState
  }
}
