import mitt from 'mitt'
import type { CosmicToastPayload, Element, Rarity } from './cosmic/types'
import type { Bucket } from '../utils/carrierEvolution'

type Events = {
  'goo:collected': { value: number }
  'frog:tapped': { frogId: string }
  'merge:happened': { level: number }
  'frog:pickup': { level: number }
  'frog:drop': { level: number; merged: boolean }
  'frog:purchased': { level: number }
  'frog:discovered': { level: number }
  'location:unlocked': { locationId: number }
  'location:changed': { id: number }
  'location:transitionStart': { from: number; to: number }
  'location:transitionEnd': { id: number }
  'rareCrate:opened': {
    x: number
    y: number
    minLevel: number
    maxLevel: number
  }
  'rareCrate:claim': { level: number }
  'starmap:open': void
  'starmap:close': void
  'starmap:planet-selected': {
    raceId: string
    raceName: string
    raceType: string
    domX: number
    domY: number
    placement: 'below' | 'above'
  }
  'starmap:planet-select': { planetId: string; name: string; archetype: string }
  'starmap:request-fly': { planetId: string }
  'starmap:planet-tapped': {
    id: string
    type: string
    archetype?: string
    durationMs: number
    seed: number
  }
  'starmap:planet-moved': {
    raceId: string
    bottomX: number
    bottomY: number
    topX: number
    topY: number
  }
  'starmap:popover-close': void
  'starmap:centerHome': void
  'starmap:follow-ship': { enable: boolean }
  'starmap:follow-changed': { following: boolean }
  'dev:clearAllFrogs': void
  // Cosmic Frogs System (Phase 11+)
  'cosmic:toast': CosmicToastPayload
  // Phase 14 — serum tap-to-select / drag-DnD
  'cosmic:select-serum': { element: Element; rarity: Rarity }
  'cosmic:cancel-serum': void
  'cosmic:serum-pointer-move': { x: number; y: number }
  'cosmic:serum-pointer-up': { x: number; y: number }
  // Phase 16 — ship + mission events
  'cosmic:request-flight': { planetId: string }
  'cosmic:flight-confirm': { planetId: string }
  'cosmic:flight-cancel': void
  'cosmic:ship-arrived': { planetId: string }
  // Phase 17 — carrier evolution
  'cosmic:carrier-stabilized': {
    frogId: string
    element: Element
    rarity: Rarity
    ceiling: number
    bucket: Bucket
  }
  // Phase 19-01 — box-opened event (BALANCE-01..07 wiring).
  // Emitted by cosmicSlice.openBox после rollRarity/updatePity.
  'cosmic:box-opened': { boxId: string; rarity: Rarity; element: Element }
  // Offline box drops (boot-time): сколько боксов «упало» пока игрок был away.
  'box:offline-pending': { count: number }
  // Phase 18 — bestiary milestone (REQ BESTIARY-07)
  'cosmic:bestiary-milestone': {
    threshold: 10 | 24 | 96 | 576
    reward:
      | { readonly type: 'coins'; readonly amount: number }
      | { readonly type: 'serum'; readonly rarity: 'epic' | 'legendary' }
      | { readonly type: 'frog-exclusive' }
  }
}

export const eventBus = mitt<Events>()
