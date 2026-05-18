// Phase 27 Plan 27-03 — DEV helpers for contacts / relationship / chain smoke testing.
//
// Installed from App.tsx DEV bootstrap useEffect (alongside installRaceDevHelpers).
// No-op in production (early-return on !import.meta.env.DEV — Vite tree-shake).
//
// Helpers exposed on window:
//   __addPending(raceId)       — force engine pull for one race (mark firstContact if
//                                needed, then triggerPendingPull).
//   __resetRelationships()     — relationships → INITIAL_RELATIONSHIP=2, chainProgress
//                                → 0, pendingItems → []. Does NOT change firstContactsSeen.
//   __advanceChain(raceId)     — chainProgress[raceId]++ (skip without resolve, for
//                                event testing).
//   __dumpContacts()           — console.table snapshot of all 10 races.
//
// Cleanup function symmetrically deletes window props (App.tsx return-branch).

import { useGameStore } from '../store/gameStore'
import { RACES, type RaceId } from '../game/config/races'
import { INITIAL_RELATIONSHIP, RACE_CHAINS } from '../game/config/raceChains'

declare global {
  interface Window {
    __addPending?: (raceId: RaceId) => void
    __resetRelationships?: () => void
    __advanceChain?: (raceId: RaceId) => void
    __dumpContacts?: () => void
  }
}

export function installContactsDevHelpers(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (!import.meta.env.DEV) return () => {}

  window.__addPending = (raceId: RaceId) => {
    const store = useGameStore.getState()
    if (!store.firstContactsSeen[raceId]) {
      store.markFirstContactSeen(raceId)
      console.info(`[devContacts] marked firstContactsSeen[${raceId}]=true`)
    }
    store.triggerPendingPull()
    const after = useGameStore.getState()
    console.info(
      `[devContacts] after pull: pendingItems=${after.pendingItems.length}, ` +
        `${raceId} chainProgress=${after.chainProgress[raceId]}`,
    )
  }

  window.__resetRelationships = () => {
    const reset = {} as Record<RaceId, number>
    const progress = {} as Record<RaceId, number>
    for (const r of RACES) {
      reset[r.id] = INITIAL_RELATIONSHIP
      progress[r.id] = 0
    }
    useGameStore.setState({
      raceRelationships: reset,
      chainProgress: progress,
      pendingItems: [],
    })
    console.info(
      '[devContacts] reset: 10 relationships → INITIAL_RELATIONSHIP, ' +
        'chainProgress → 0, pendingItems → []',
    )
  }

  window.__advanceChain = (raceId: RaceId) => {
    const store = useGameStore.getState()
    const next = (store.chainProgress[raceId] ?? 0) + 1
    const max = RACE_CHAINS[raceId]?.length ?? 0
    if (next > max) {
      console.warn(
        `[devContacts] ${raceId} chainProgress already at end (${max})`,
      )
      return
    }
    useGameStore.setState({
      chainProgress: { ...store.chainProgress, [raceId]: next },
    })
    console.info(`[devContacts] ${raceId} chainProgress: ${next}/${max}`)
    useGameStore.getState().triggerPendingPull()
  }

  window.__dumpContacts = () => {
    const s = useGameStore.getState()
    const rows = RACES.map((r) => ({
      id: r.id,
      relationship: s.raceRelationships[r.id],
      chainProgress: s.chainProgress[r.id],
      chainMax: RACE_CHAINS[r.id]?.length ?? 0,
      firstContact: s.firstContactsSeen[r.id],
      pendingCount: s.pendingItems.filter((p) => p.raceId === r.id).length,
    }))
    console.table(rows)
    console.info(`[devContacts] total pendingItems: ${s.pendingItems.length}/3`)
  }

  console.log(
    '[devContacts] helpers installed: __addPending(id), __resetRelationships(), ' +
      '__advanceChain(id), __dumpContacts()',
  )

  return () => {
    delete window.__addPending
    delete window.__resetRelationships
    delete window.__advanceChain
    delete window.__dumpContacts
  }
}
