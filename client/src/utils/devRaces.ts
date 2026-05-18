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
//   __triggerFirstContact(id)  — Phase 26 Plan 26-05: эмитит cosmos:first-contact
//                                напрямую (bypass'ит per-planet gate). НЕ markSeen
//                                — для replay testing нужно вызвать
//                                __resetFirstContacts() заранее (controller подписан
//                                на cosmos:first-contact-effect-complete и mount'ит
//                                modal независимо от firstContactsSeen state).
//
// Returned cleanup function симметрично deletes window props (используется
// useEffect return ветка в App.tsx).

import { useGameStore } from '../store/gameStore'
import { eventBus } from '../store/eventBus'
import { RACES, type RaceId } from '../game/config/races'

type FirstContactsSnapshot = Record<RaceId, boolean>

declare global {
  interface Window {
    __listRaces?: () => void
    __markFirstContact?: (raceId: RaceId) => void
    __resetFirstContacts?: () => void
    __firstContactsState?: () => FirstContactsSnapshot
    /** Phase 26 Plan 26-05: эмитит cosmos:first-contact напрямую. */
    __triggerFirstContact?: (raceId: RaceId) => void
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

  // Phase 26 Plan 26-05: trigger cosmos:first-contact event напрямую.
  // Caveat (per Plan 26-05 Task 4): controller (App.tsx) подписан на
  // 'cosmos:first-contact' (capture raceId) И на effect-complete (mount modal),
  // НЕ зависит от firstContactsSeen state — modal будет показан даже если
  // race уже seen. Для full-replay testing сначала вызови
  // __resetFirstContacts() (опционально) — иначе modal закроется без эффекта
  // на state (markSeen idempotent: уже true → no-op).
  // Coords: camera center StarMapScene/MainScene если доступна, иначе fallback.
  window.__triggerFirstContact = (raceId: RaceId) => {
    const w = window as unknown as {
      __starMapScene?: {
        cameras?: { main?: { centerX: number; centerY: number } }
      }
      __mainScene?: {
        cameras?: { main?: { centerX: number; centerY: number } }
      }
    }
    const scene = w.__starMapScene ?? w.__mainScene
    const cam = scene?.cameras?.main
    const x = cam?.centerX ?? 200
    const y = cam?.centerY ?? 300

    eventBus.emit('cosmos:first-contact', { raceId, x, y })
    console.info(
      `[devRaces] triggered first-contact для '${raceId}' at (${x}, ${y}). ` +
        `Tip: вызови __resetFirstContacts() заранее если хочешь replay.`,
    )
  }

  console.log(
    '[devRaces] helpers installed: __listRaces(), __markFirstContact(id), __resetFirstContacts(), __firstContactsState(), __triggerFirstContact(id)',
  )

  return () => {
    delete window.__listRaces
    delete window.__markFirstContact
    delete window.__resetFirstContacts
    delete window.__firstContactsState
    delete window.__triggerFirstContact
  }
}
