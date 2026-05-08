// Phase 12 + 13: dev-only helpers для smoke testing FrogElementOverlay (all 5 tiers).
// Tree-shaken в prod build (import.meta.env.DEV — статический бранч у Vite).
//
// Usage в DevTools console:
//   __listFrogIds()                                     // print frog ids
//   __addDevCarrier('<frogId>', 'fire', 'common')        // attach overlay
//   __addDevCarrier()                                    // random element
//   __setCarrierTier('<frogId>', 'legendary')            // мгновенная смена tier
//   __testBurstEffect('<frogId>', 'fire')                // ELEMENT-10 без тапа
//   __testMergeEffect('fire')                            // ELEMENT-11 без реального мерджа
//   __clearDevCarriers()                                 // detach all
//   __listDevCarriers()                                  // table of carriers

import type Phaser from 'phaser'
import { useGameStore } from '../store/gameStore'
import { ELEMENTS, type Element, type Rarity } from '../store/cosmic/types'
import { burstEffect } from '../game/effects/elements/burstEffect'
import { mergeEffect } from '../game/effects/elements/mergeEffect'

interface DevFrogInfo {
  id: string
  level: number
}

// Phase 13: extended interface — нужен container для burst, scene access, overlayManager.
interface DevFrogLike {
  id: string
  level: number
  container?: Phaser.GameObjects.Container
}

interface DevMainScene extends Phaser.Scene {
  frogs: DevFrogLike[]
  overlayManager?: { markDirty(): void } | null
}

declare global {
  interface Window {
    // Phase 12:
    __addDevCarrier?: (frogId?: string, element?: Element, rarity?: Rarity) => void
    __clearDevCarriers?: () => void
    __listDevCarriers?: () => void
    __listFrogIds?: () => DevFrogInfo[]
    __mainScene?: DevMainScene
    // Phase 13 NEW:
    __setCarrierTier?: (frogId: string, tier: Rarity) => void
    __testBurstEffect?: (frogId?: string, element?: Element) => void
    __testMergeEffect?: (element?: Element, x?: number, y?: number) => void
    // Phase 17 NEW:
    __forceFeed?: (frogId: string, count?: number) => void
    __forceStabilize?: (frogId: string) => void
    __bestiaryBitsSet?: () => number
  }
}

if (import.meta.env.DEV) {
  // ============== Phase 12 helpers (unchanged) ==============

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

  // ============== Phase 13 helpers ==============

  /**
   * Поменять tier живого carrier мгновенно. Patch'аем carriers через setState
   * (immutable map → reference change → cosmicSlice subscriber пробудит manager).
   */
  window.__setCarrierTier = (frogId: string, tier: Rarity) => {
    const store = useGameStore.getState()
    const carriers = store.carriers
    const idx = carriers.findIndex((c) => c.frogId === frogId)
    if (idx === -1) {
      console.warn('[dev] carrier not found:', frogId, '— use __listDevCarriers()')
      return
    }
    const updated = carriers.map((c, i) => (i === idx ? { ...c, rarity: tier } : c))
    useGameStore.setState({ carriers: updated })
    // markDirty — на случай если subscription по reference сработала, но
    // syncCarriers пропустит из-за timing (frame ordering).
    const ms = window.__mainScene
    if (ms?.overlayManager) ms.overlayManager.markDirty()
    console.log('[dev] tier set:', { frogId, tier })
  }

  /**
   * Воспроизвести element-burst в указанной лягушке. Если carrier не привязан —
   * burst по element аргументу или 'fire' по умолчанию.
   */
  window.__testBurstEffect = (frogId, element) => {
    const ms = window.__mainScene
    if (!ms) { console.warn('[dev] no __mainScene — open game first'); return }

    // Найти лягушку (если frogId передан) или взять первую с container.
    const frog = ms.frogs.find((f) => (frogId ? f.id === frogId : !!f.container))
    const el: Element = element ?? (
      frog
        ? (useGameStore.getState().carriers.find((c) => c.frogId === frog.id)?.element as Element | undefined) ?? 'fire'
        : 'fire'
    )

    if (frog?.container) {
      burstEffect(ms, frog.container, el)
      console.log('[dev] burstEffect on frog', frog.id, '→', el)
      return
    }

    // Fallback: tmp container в центре экрана (когда frogId не нашёлся).
    const cam = ms.cameras?.main
    const x = cam ? cam.scrollX + cam.width / 2 : 200
    const y = cam ? cam.scrollY + cam.height / 2 : 300
    const tmp = ms.add.container(x, y)
    burstEffect(ms, tmp, el)
    ms.time.delayedCall(500, () => { if (tmp.active) tmp.destroy(true) })
    console.log('[dev] burstEffect (no frog) →', el, 'at', { x, y })
  }

  /**
   * Воспроизвести merge anim в (x,y) или в центре камеры.
   */
  window.__testMergeEffect = (element, x, y) => {
    const ms = window.__mainScene
    if (!ms) { console.warn('[dev] no __mainScene — open game first'); return }
    const cam = ms.cameras?.main
    const cx = x ?? (cam ? cam.scrollX + cam.width / 2 : 200)
    const cy = y ?? (cam ? cam.scrollY + cam.height / 2 : 300)
    const el: Element = element ?? 'fire'
    mergeEffect(ms, cx, cy, el)
    console.log('[dev] mergeEffect fired:', { element: el, cx, cy })
  }

  // ============== Phase 17 helpers ==============

  /**
   * Прогнать N feeds последовательно (через store.feedCarrier). Останавливается
   * на 'stabilize'. Используется для smoke-test'а ceiling reveal + StabilizationModal.
   */
  window.__forceFeed = (frogId: string, count = 8) => {
    for (let i = 0; i < count; i++) {
      const result = useGameStore.getState().feedCarrier(frogId)
      console.log(`[dev] forceFeed ${i + 1}/${count}:`, result)
      if (!result || result.result === 'stabilize') {
        console.log('[dev] feed stopped (stabilize or null)')
        break
      }
    }
  }

  /**
   * Принудительно стабилизировать carrier на текущем уровне (или ceiling если задан).
   * НЕ эмитит cosmic:carrier-stabilized event — просто mutates state.
   */
  window.__forceStabilize = (frogId: string) => {
    const state = useGameStore.getState()
    const idx = state.carriers.findIndex((c) => c.frogId === frogId)
    if (idx === -1) {
      console.warn('[dev] carrier not found:', frogId)
      return
    }
    const carrier = state.carriers[idx]
    const ceiling = carrier.ceiling ?? carrier.level ?? 1
    const updated = state.carriers.map((c, i) =>
      i === idx ? { ...c, stabilized: true, ceiling, level: ceiling } : c,
    )
    useGameStore.setState({ carriers: updated })
    console.log('[dev] carrier force-stabilized:', frogId, 'at L', ceiling)
  }

  /**
   * Подсчитать число установленных бит в bestiaryBitset (для верификации
   * Bestiary write-through через feedCarrier/mergeCarriers).
   */
  window.__bestiaryBitsSet = (): number => {
    const bitset = useGameStore.getState().bestiaryBitset
    let count = 0
    for (const byte of bitset) {
      let b = byte | 0
      while (b) { count += b & 1; b >>>= 1 }
    }
    console.log('[dev] bestiary bits set:',
      count, '/ 1536 (', (count / 1536 * 100).toFixed(2), '%)')
    return count
  }

  console.log(
    '[dev Phase 12+13+17] helpers: __addDevCarrier, __setCarrierTier(frogId, tier), ' +
    '__testBurstEffect(frogId?, element?), __testMergeEffect(element?, x?, y?), ' +
    '__clearDevCarriers, __listDevCarriers, __listFrogIds, ' +
    '__forceFeed(frogId, count?), __forceStabilize(frogId), __bestiaryBitsSet',
  )
}
