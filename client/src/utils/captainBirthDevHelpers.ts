// Phase 24 Plan 24-05 — dev helpers для captain birth cinematic smoke testing.
//
// Installed from App.tsx DEV bootstrap useEffect, рядом с
// installBestiaryDevHelpers() / installOnboardingDevHelpers().
// No-op в production builds.
//
// Helpers exposed on window:
//   __triggerCaptainBirth()   — force-играет cinematic даже если captainBirthSeen=true.
//                               Эмитит 'captain:birth-start' в центре canvas (через
//                               window.__mainScene если доступен, иначе в (200, 300) fallback).
//                               НЕ модифицирует state — следующий реальный L18+L18 всё
//                               равно НЕ сыграет cinematic если captainBirthSeen уже true.
//                               Для full reset → __resetCaptainBirth().
//   __resetCaptainBirth()     — clear captainBirthSeen flag + saveCaptainBirthSeen(false)
//                               + reload. Cinematic снова сыграет на следующем L18+L18
//                               (или __triggerCaptainBirth() instant test).
//   __captainBirthState()     — print + return snapshot
//                               {captainBirthSeen, hasCosmosUnlocked, currentLocation,
//                                discoveredLevels} для QA.

import { useGameStore } from '../store/gameStore'
import { eventBus } from '../store/eventBus'
import { saveCaptainBirthSeen } from '../store/persistence'

type CaptainBirthSnapshot = {
  captainBirthSeen: boolean
  hasCosmosUnlocked: boolean
  currentLocation: number
  discoveredLevels: number[]
}

declare global {
  interface Window {
    __triggerCaptainBirth?: () => void
    __resetCaptainBirth?: () => void
    __captainBirthState?: () => CaptainBirthSnapshot
  }
}

// MainScene exposes window.__mainScene (см. MainScene.create() Plan 23-05).
// Read через local cast как и в OnboardingController/devCarriers — нет глобального
// `declare`, иначе конфликтует с более узкими типами в других модулях.
type MainSceneCameraRef = {
  cameras?: { main?: { centerX: number; centerY: number } }
}

export function installCaptainBirthDevHelpers(): void {
  if (typeof window === 'undefined') return
  if (!import.meta.env.DEV) return

  window.__triggerCaptainBirth = () => {
    // Try получить cam center из MainScene; fallback to fixed coords.
    let x = 200
    let y = 300
    try {
      const w = window as unknown as { __mainScene?: MainSceneCameraRef }
      const scene = w.__mainScene
      if (scene?.cameras?.main) {
        x = scene.cameras.main.centerX
        y = scene.cameras.main.centerY
      }
    } catch {
      /* ignore */
    }
    eventBus.emit('captain:birth-start', { x, y })
    console.info(
      `[captain-dev] triggered cinematic at (${x}, ${y}); modal mount через ~3s`,
    )
  }

  window.__resetCaptainBirth = () => {
    saveCaptainBirthSeen(false)
    useGameStore.setState({ captainBirthSeen: false })
    console.info('[captain-dev] reset captainBirthSeen — reloading')
    window.location.reload()
  }

  window.__captainBirthState = () => {
    const s = useGameStore.getState()
    const snap: CaptainBirthSnapshot = {
      captainBirthSeen: s.captainBirthSeen,
      hasCosmosUnlocked: s.hasCosmosUnlocked,
      currentLocation: s.currentLocation,
      discoveredLevels: [...s.discoveredLevels],
    }
    console.table({
      captainBirthSeen: snap.captainBirthSeen,
      hasCosmosUnlocked: snap.hasCosmosUnlocked,
      currentLocation: snap.currentLocation,
    })
    console.info('[captain-dev] discoveredLevels:', snap.discoveredLevels)
    return snap
  }

  console.log(
    '[captain-dev] helpers installed: __triggerCaptainBirth(), __resetCaptainBirth(), __captainBirthState()',
  )
}
