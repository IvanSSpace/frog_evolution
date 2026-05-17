// Phase 12 + 13: dev-only helpers для smoke testing FrogElementOverlay.
// Tree-shaken в prod build (import.meta.env.DEV — статический бранч у Vite).
// Phase 22: rarity/stabilized/feedCount/ceiling removed from carrier shape.
// __forceFeed and __forceStabilize removed (feed-stabilize mechanic deleted).
// Phase 22 Plan 22-02: __giveCarrier / __listCarriers / __simulateMerge — smoke
// helpers для проверки carrier merge rules без UI.
//
// Usage в DevTools console:
//   __listFrogIds()                               // print frog ids
//   __addDevCarrier('<frogId>', 'fire')            // attach overlay
//   __addDevCarrier()                             // random element
//   __clearDevCarriers()                          // detach all
//   __listDevCarriers()                           // table of carriers
//   __testBurstEffect('<frogId>', 'fire')          // ELEMENT-10 без тапа
//   __testMergeEffect('fire')                     // ELEMENT-11 без реального мерджа
//   __bestiaryBitsSet()                           // count bestiary bits
//
// Plan 22-02 carrier merge smoke helpers:
//   __giveCarrier('fire', 5, 'frog-a')           // bind carrier to existing frog
//   __giveCarrier('fire', 5)                     // spawn new L5 frog + carrier
//   __listCarriers()                             // print [{frogId, element, level}]
//   __simulateMerge('frog-a', 'frog-b')          // call performMerge(a, b) — a=dropped
//
// Smoke flow:
//   __giveCarrier('fire', 5, 'frog-a')
//   __giveCarrier('water', 5, 'frog-b')
//   __simulateMerge('frog-a', 'frog-b')          // → carrier(water, L6) — TARGET wins
//   __listCarriers()                             // [{frogId: '<new>', element: 'water', level: 6}]

import type Phaser from 'phaser'
import { useGameStore } from '../store/gameStore'
import { ELEMENTS, type Element } from '../store/cosmic/types'
import { BESTIARY_BIT_COUNT } from '../store/cosmic/bestiary'
import { burstEffect } from '../game/effects/elements/burstEffect'
import { mergeEffect } from '../game/effects/elements/mergeEffect'

interface DevFrogInfo {
  id: string
  level: number
}

interface DevFrogLike {
  id: string
  level: number
  container?: Phaser.GameObjects.Container
}

interface DevMainScene extends Phaser.Scene {
  frogs: DevFrogLike[]
  overlayManager?: { markDirty(): void } | null
  // Plan 22-02: smoke-test helper hook (added by __simulateMerge).
  performMerge?: (
    a: DevFrogLike,
    b: DevFrogLike,
    cx: number,
    cy: number,
  ) => void
  spawnFrog?: (x: number, y: number, level?: number) => DevFrogLike
}

declare global {
  interface Window {
    __addDevCarrier?: (frogId?: string, element?: Element) => void
    __clearDevCarriers?: () => void
    __listDevCarriers?: () => void
    __listFrogIds?: () => DevFrogInfo[]
    __mainScene?: DevMainScene
    __testBurstEffect?: (frogId?: string, element?: Element) => void
    __testMergeEffect?: (element?: Element, x?: number, y?: number) => void
    __bestiaryBitsSet?: () => number
    // Plan 22-02 smoke helpers.
    __giveCarrier?: (
      element: Element,
      level: number,
      frogId?: string,
    ) => string | null
    __listCarriers?: () => void
    __simulateMerge?: (droppedFrogId: string, targetFrogId: string) => void
  }
}

if (import.meta.env.DEV) {
  // ============== Phase 12 helpers ==============

  window.__addDevCarrier = (frogId, element) => {
    const e: Element =
      element ?? ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]
    const id = frogId ?? `dev-${Date.now()}`
    useGameStore.getState().addCarrier({
      frogId: id,
      element: e,
      level: 1,
    })
    console.log('[dev] carrier added', { frogId: id, element: e })
    if (!frogId) {
      console.log(
        '[dev] tip: pass frogId to bind to a real frog. Use __listFrogIds() to get ids.',
      )
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
    const list: DevFrogInfo[] =
      ms?.frogs?.map((f) => ({ id: f.id, level: f.level })) ?? []
    console.table(list)
    return list
  }

  // ============== Phase 13 helpers ==============

  window.__testBurstEffect = (frogId, element) => {
    const ms = window.__mainScene
    if (!ms) {
      console.warn('[dev] no __mainScene — open game first')
      return
    }

    const frog = ms.frogs.find((f) =>
      frogId ? f.id === frogId : !!f.container,
    )
    const el: Element =
      element ??
      (frog
        ? ((useGameStore.getState().carriers.find((c) => c.frogId === frog.id)
            ?.element as Element | undefined) ?? 'fire')
        : 'fire')

    if (frog?.container) {
      burstEffect(ms, frog.container, el)
      console.log('[dev] burstEffect on frog', frog.id, '→', el)
      return
    }

    const cam = ms.cameras?.main
    const x = cam ? cam.scrollX + cam.width / 2 : 200
    const y = cam ? cam.scrollY + cam.height / 2 : 300
    const tmp = ms.add.container(x, y)
    burstEffect(ms, tmp, el)
    ms.time.delayedCall(500, () => {
      if (tmp.active) tmp.destroy(true)
    })
    console.log('[dev] burstEffect (no frog) →', el, 'at', { x, y })
  }

  window.__testMergeEffect = (element, x, y) => {
    const ms = window.__mainScene
    if (!ms) {
      console.warn('[dev] no __mainScene — open game first')
      return
    }
    const cam = ms.cameras?.main
    const cx = x ?? (cam ? cam.scrollX + cam.width / 2 : 200)
    const cy = y ?? (cam ? cam.scrollY + cam.height / 2 : 300)
    const el: Element = element ?? 'fire'
    mergeEffect(ms, cx, cy, el)
    console.log('[dev] mergeEffect fired:', { element: el, cx, cy })
  }

  // ============== Phase 18 helpers ==============

  window.__bestiaryBitsSet = (): number => {
    const bitset = useGameStore.getState().bestiaryBitset
    let count = 0
    for (const byte of bitset) {
      let b = byte | 0
      while (b) {
        count += b & 1
        b >>>= 1
      }
    }
    console.log(
      '[dev] bestiary bits set:',
      count,
      '/',
      BESTIARY_BIT_COUNT,
      '(',
      ((count / BESTIARY_BIT_COUNT) * 100).toFixed(2),
      '%)',
    )
    return count
  }

  // ============== Phase 22 Plan 22-02 helpers ==============

  /**
   * __giveCarrier(element, level, frogId?) — bind carrier to an existing frog,
   * or spawn a fresh frog of the requested level and bind to that.
   * Returns the resolved frogId, or null if no MainScene available for spawn.
   */
  window.__giveCarrier = (element, level, frogId) => {
    const store = useGameStore.getState()

    if (frogId) {
      store.addCarrier({ frogId, element, level })
      console.log('[dev] carrier bound to existing frog', { frogId, element, level })
      return frogId
    }

    const ms = window.__mainScene
    if (!ms?.spawnFrog) {
      console.warn(
        '[dev] no __mainScene.spawnFrog — open game first or pass frogId arg',
      )
      return null
    }
    const cam = ms.cameras?.main
    const x = cam ? cam.scrollX + cam.width / 2 : 200
    const y = cam ? cam.scrollY + cam.height / 2 : 300
    const newFrog = ms.spawnFrog(x, y, level)
    store.addCarrier({ frogId: newFrog.id, element, level })
    ms.overlayManager?.markDirty()
    console.log('[dev] spawned frog + carrier', {
      frogId: newFrog.id,
      element,
      level,
    })
    return newFrog.id
  }

  /** Print current carrier list (frogId, element, level). */
  window.__listCarriers = () => {
    console.table(useGameStore.getState().carriers)
  }

  /**
   * __simulateMerge(droppedFrogId, targetFrogId) — call MainScene.performMerge
   * directly so that the dragged=dropped, dragged-onto=target orientation
   * is preserved (target-wins rule depends on this).
   */
  window.__simulateMerge = (droppedFrogId, targetFrogId) => {
    const ms = window.__mainScene
    if (!ms?.performMerge) {
      console.warn('[dev] no __mainScene.performMerge — open game first')
      return
    }
    const dropped = ms.frogs.find((f) => f.id === droppedFrogId)
    const target = ms.frogs.find((f) => f.id === targetFrogId)
    if (!dropped || !target) {
      console.warn('[dev] could not find one of the frogs', {
        droppedFrogId,
        targetFrogId,
      })
      return
    }
    const tc = target.container
    const cx = tc?.x ?? 0
    const cy = tc?.y ?? 0
    ms.performMerge(dropped, target, cx, cy)
    console.log('[dev] simulated merge', { droppedFrogId, targetFrogId })
  }

  console.log(
    '[dev Phase 12+13 / Phase 22] helpers: __addDevCarrier(frogId?, element?), ' +
      '__testBurstEffect(frogId?, element?), __testMergeEffect(element?, x?, y?), ' +
      '__clearDevCarriers, __listDevCarriers, __listFrogIds, __bestiaryBitsSet, ' +
      '__giveCarrier(element, level, frogId?), __listCarriers(), ' +
      '__simulateMerge(droppedFrogId, targetFrogId)',
  )
}
