import mitt from 'mitt'
import type { CosmicToastPayload, Element } from './cosmic/types'

// Phase 22: Rarity removed from cosmic types. Legacy rarity strings kept only
// in Gallery/Bestiary where they are UI-only (not serum/carrier state).
type LegacyRarity = 'common' | 'rare' | 'epic' | 'legendary'

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
  'starmap:goto-ship': void
  'starmap:follow-ship': { enable: boolean }
  'starmap:follow-changed': { following: boolean }
  'dev:clearAllFrogs': void
  // Cosmic Frogs System (Phase 11+)
  'cosmic:toast': CosmicToastPayload
  // Phase 14 — serum tap-to-select / drag-DnD
  // Phase 22: rarity removed from select-serum payload
  'cosmic:select-serum': { element: Element }
  'cosmic:cancel-serum': void
  'cosmic:serum-pointer-move': { x: number; y: number }
  'cosmic:serum-pointer-up': { x: number; y: number }
  // Phase 16 — ship + mission events
  'cosmic:request-flight': { planetId: string }
  'cosmic:flight-confirm': { planetId: string }
  'cosmic:flight-cancel': void
  'cosmic:ship-arrived': { planetId: string }
  // Phase 17 — carrier evolution (Phase 22: carrier-stabilized removed)
  // Phase 22 Plan 22-03 — carrier ascension event.
  // Emitted by ascendCarrier action after store mutation.
  // Subscribers: MainScene (play ascension tween), FrogOverlayManager (cleanup overlay).
  'cosmic:carrier-ascended': { frogId: string; element: Element }
  // Phase 22 Plan 22-05 — cosmic box purchased (shop).
  // Subscribers: MainScene spawn'ит 3 L7+ frogs на текущей локации.
  'cosmic:cosmic-box-purchased': Record<string, never>
  // Phase 19-01 — box-opened event.
  // Phase 22: rarity removed from box-opened payload.
  'cosmic:box-opened': { boxId: string; element: Element }
  // Offline box drops (boot-time): сколько боксов «упало» пока игрок был away.
  'box:offline-pending': { count: number }
  // Server-authoritative tractor offline income (boot-time).
  'server:welcome-back': { earned: number; durationMs: number }
  // Gallery — open detail panel for a specific archetype/rarity (UI-only, legacy rarity)
  'gallery:open-detail': { archetype: Element; rarity: LegacyRarity }
  // Phase 18 — bestiary milestone (REQ BESTIARY-07)
  'cosmic:bestiary-milestone': {
    threshold: 10 | 24 | 96 | 576
    reward:
      | { readonly type: 'coins'; readonly amount: number }
      | { readonly type: 'serum' }
      | { readonly type: 'frog-exclusive' }
  }
}

export const eventBus = mitt<Events>()
