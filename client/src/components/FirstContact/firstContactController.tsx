// Phase 26 Plan 26-05 — First contact coordinator.
//
// Lifecycle:
//   1. StarMapScene emits 'starmap:planet-tapped' {id, type, ...} (popovers.ts).
//   2. Controller checks getPlanetInhabitant(id) → если inhabitant AND
//      !firstContactsSeen[inhabitant.raceId] → emit 'cosmos:first-contact'
//      {raceId, x, y} (x,y из StarMapScene.getPlanetWorldCoords).
//   3. FirstContactEffect (FirstContactEffect.ts) обрабатывает 'cosmos:first-contact':
//      запускает Phaser cinematic ~2s → emit 'cosmos:first-contact-effect-complete'.
//   4. Controller подписан на 'cosmos:first-contact-effect-complete' → setState
//      pendingRaceId → mount FirstContactModal.
//   5. Modal CTA/backdrop click → markFirstContactSeen + onClose → state cleared.
//
// raceId «в полёте» (между emit 'cosmos:first-contact' и effect-complete) хранится
// в useRef — mitt не кеширует last payload, поэтому захватываем сами через outer
// ref. Pattern: emit-handler пишет в ref, complete-handler читает + clears + setState.
//
// Mount: один раз в App.tsx (рядом с CaptainBirthController / OnboardingController).
// Subscriptions через useEffect — auto-cleanup на unmount (HMR-safe, T-26-05-04).

import { useEffect, useRef, useState } from 'react'
import { eventBus } from '../../store/eventBus'
import { useGameStore } from '../../store/gameStore'
import { getPlanetInhabitant } from '../../game/data/habitablePlanets'
import { installFirstContactEffect } from '../../game/effects/FirstContactEffect'
import { FirstContactModal } from './FirstContactModal'
import type { RaceId } from '../../game/config/races'

interface StarMapSceneAPI {
  getPlanetWorldCoords?: (id: string) => { x: number; y: number } | null
  cameras?: { main?: { centerX: number; centerY: number } }
}

export function FirstContactController() {
  const [pendingRaceId, setPendingRaceId] = useState<RaceId | null>(null)
  // raceId «в полёте» между cosmic:first-contact emit и effect-complete.
  // useRef → синхронный read/write в event handlers без re-render.
  const pendingRaceIdInFlightRef = useRef<RaceId | null>(null)

  useEffect(() => {
    // Install Phaser effect handler (returns cleanup function).
    const cleanupEffect = installFirstContactEffect()

    // Handler 1: planet-tapped → maybe emit cosmos:first-contact.
    const onPlanetTapped = (p: {
      id: string
      type: string
      durationMs: number
      seed: number
    }) => {
      const inhabitant = getPlanetInhabitant(p.id)
      if (!inhabitant) return

      const seen =
        useGameStore.getState().firstContactsSeen[inhabitant.raceId as RaceId]
      if (seen === true) return // idempotent — per-race flag.

      // Resolve planet world coords для cinematic anchor.
      // StarMapScene exposes getPlanetWorldCoords helper (Task 1).
      // Fallback к camera center если scene недоступен.
      let x = 200
      let y = 300
      if (typeof window !== 'undefined') {
        const w = window as unknown as { __starMapScene?: StarMapSceneAPI }
        const scene = w.__starMapScene
        if (scene) {
          const fromHelper = scene.getPlanetWorldCoords?.(p.id)
          if (fromHelper) {
            x = fromHelper.x
            y = fromHelper.y
          } else {
            const cam = scene.cameras?.main
            if (cam) {
              x = cam.centerX
              y = cam.centerY
            }
          }
        }
      }

      eventBus.emit('cosmos:first-contact', {
        raceId: inhabitant.raceId,
        x,
        y,
      })
    }

    // Handler 2: захватываем raceId из emit payload (mitt не кеширует last).
    const onFirstContactEmit = (p: {
      raceId: string
      x: number
      y: number
    }) => {
      pendingRaceIdInFlightRef.current = p.raceId as RaceId
    }

    // Handler 3: effect-complete → mount DOM modal.
    const onEffectComplete = () => {
      const raceId = pendingRaceIdInFlightRef.current
      if (raceId) {
        setPendingRaceId(raceId)
        pendingRaceIdInFlightRef.current = null
      }
    }

    eventBus.on('starmap:planet-tapped', onPlanetTapped)
    eventBus.on('cosmos:first-contact', onFirstContactEmit)
    eventBus.on('cosmos:first-contact-effect-complete', onEffectComplete)

    return () => {
      eventBus.off('starmap:planet-tapped', onPlanetTapped)
      eventBus.off('cosmos:first-contact', onFirstContactEmit)
      eventBus.off('cosmos:first-contact-effect-complete', onEffectComplete)
      cleanupEffect()
    }
  }, [])

  const handleClose = () => setPendingRaceId(null)

  if (!pendingRaceId) return null
  return <FirstContactModal raceId={pendingRaceId} onClose={handleClose} />
}
