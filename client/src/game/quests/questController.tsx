// Phase 28 Plan 28-03: quest progress eventBus → slice action wiring.
//
// Mounted in App.tsx alongside FirstContactController + EventToastController.
// Renders null (no DOM); subscribes to 5 progress events on mount, unsubscribes
// on unmount. HMR-safe (cleanup symmetric).
//
// Why React component vs imperative installer:
//   Phase 27 chose installer pattern for captainBirthController (production-
//   critical, idempotent guard internal). Phase 28 chose React-component
//   pattern (mirror FirstContactController) because:
//     1. Cleanup is automatic via useEffect return — no leaked subscriptions
//        on React fast-refresh / StrictMode double-invoke.
//     2. Re-renders trigger by store selector are bounded — only
//        markQuestProgress / reconcileQuestProgress identities (stable Zustand
//        actions). No state-pull means component never re-renders after mount.
//     3. Test-friendly — can stub useGameStore in a future test.
//
// Boot-time reconcile fires once on mount — picks up gold_amount + polling-
// only progress (raise_relationship, merge_to_level via discoveredLevels) that
// happened while the game was closed (cross-device sync hydrated activeQuests
// but missed the polling-only target types).

import { useEffect } from 'react'
import { eventBus } from '../../store/eventBus'
import { useGameStore } from '../../store/gameStore'
import type { Element } from '../../store/cosmic/types'
import type { RaceId } from '../config/races'

export function QuestController() {
  const markQuestProgress = useGameStore((s) => s.markQuestProgress)
  const reconcileQuestProgress = useGameStore((s) => s.reconcileQuestProgress)

  useEffect(() => {
    const onMerge = (e: { level: number }) =>
      markQuestProgress({ kind: 'merge', level: e.level })
    const onBoxOpened = (e: { boxId: string; element: Element }) =>
      markQuestProgress({ kind: 'box-opened', element: e.element })
    const onPlanetSelect = (e: { planetId: string }) =>
      markQuestProgress({ kind: 'planet-select', planetId: e.planetId })
    const onShipArrived = (e: { planetId: string }) =>
      markQuestProgress({ kind: 'ship-arrived', planetId: e.planetId })
    const onRelDelta = (e: { raceId: string; newValue: number }) => {
      // raceId from eventBus is `string`; narrow-cast to RaceId at consumption.
      // Mirror Phase 27 pattern — eventBus is RaceId-agnostic to avoid cycles.
      markQuestProgress({
        kind: 'relationship-delta',
        raceId: e.raceId as RaceId,
        newValue: e.newValue,
      })
    }

    eventBus.on('merge:happened', onMerge)
    eventBus.on('cosmic:box-opened', onBoxOpened)
    eventBus.on('starmap:planet-select', onPlanetSelect)
    eventBus.on('cosmic:ship-arrived', onShipArrived)
    eventBus.on('contacts:relationship-delta', onRelDelta)

    // Boot-time reconcile: pick up polling-only progress that happened while
    // the game was closed (gold/relationship/discoveredLevels at startup).
    reconcileQuestProgress()

    return () => {
      eventBus.off('merge:happened', onMerge)
      eventBus.off('cosmic:box-opened', onBoxOpened)
      eventBus.off('starmap:planet-select', onPlanetSelect)
      eventBus.off('cosmic:ship-arrived', onShipArrived)
      eventBus.off('contacts:relationship-delta', onRelDelta)
    }
  }, [markQuestProgress, reconcileQuestProgress])

  return null
}
