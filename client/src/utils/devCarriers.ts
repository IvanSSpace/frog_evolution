// Phase 12: dev-only helpers для smoke testing FrogElementOverlay.
// Tree-shaken в prod build (import.meta.env.DEV — статический бранч у Vite).
//
// Usage в DevTools console:
//   __listFrogIds()                                    // print frog ids
//   __addDevCarrier('<frogId>', 'fire', 'common')       // attach overlay
//   __addDevCarrier()                                   // random element
//   __clearDevCarriers()                                // detach all
//   __listDevCarriers()                                 // table of carriers

import { useGameStore } from '../store/gameStore'
import { ELEMENTS, type Element, type Rarity } from '../store/cosmic/types'

interface DevFrogInfo {
  id: string
  level: number
}

interface DevMainScene {
  frogs: { id: string; level: number }[]
}

declare global {
  interface Window {
    __addDevCarrier?: (frogId?: string, element?: Element, rarity?: Rarity) => void
    __clearDevCarriers?: () => void
    __listDevCarriers?: () => void
    __listFrogIds?: () => DevFrogInfo[]
    __mainScene?: DevMainScene
  }
}

if (import.meta.env.DEV) {
  window.__addDevCarrier = (frogId, element, rarity) => {
    const e: Element = element ?? ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]
    const r: Rarity = rarity ?? 'common'
    const id = frogId ?? `dev-${Date.now()}`
    useGameStore.getState().addCarrier({
      frogId: id, element: e, rarity: r, feedCount: 0, stabilized: false,
    })
    console.log('[dev] carrier added', { frogId: id, element: e, rarity: r })
    if (!frogId) {
      console.log('[dev] tip: pass frogId to bind to a real frog. Use __listFrogIds() to get ids.')
    }
  }
  window.__clearDevCarriers = () => {
    const carriers = useGameStore.getState().carriers
    for (const c of carriers) useGameStore.getState().removeCarrier(c.frogId)
    console.log('[dev] cleared', carriers.length, 'carriers')
  }
  window.__listDevCarriers = () => {
    console.table(useGameStore.getState().carriers)
  }
  window.__listFrogIds = (): DevFrogInfo[] => {
    const ms = window.__mainScene
    const list: DevFrogInfo[] = ms?.frogs?.map((f) => ({ id: f.id, level: f.level })) ?? []
    console.table(list)
    return list
  }
}
