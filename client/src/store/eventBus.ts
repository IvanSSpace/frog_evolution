import mitt from 'mitt'

type Events = {
  'poop:collected': { value: number }
  'frog:tapped': { frogId: string }
  'merge:happened': { level: number }
  'frog:pickup': { level: number }
  'frog:drop': { level: number; merged: boolean }
  'frog:purchased': { level: number }
  'frog:discovered': { level: number }
  'location:changed': { id: number }
  'location:transitionStart': { from: number; to: number }
  'location:transitionEnd': { id: number }
  'rareCrate:opened': { x: number; y: number; minLevel: number; maxLevel: number }
  'rareCrate:claim': { level: number }
  'starmap:open': void
  'starmap:close': void
  'starmap:planet-selected': { raceId: string; raceName: string; raceType: string; domX: number; domY: number; placement: 'below' | 'above' }
  'starmap:planet-tapped': { id: string; type: string; archetype?: string; durationMs: number; seed: number }
  'starmap:planet-moved': { raceId: string; bottomX: number; bottomY: number; topX: number; topY: number }
  'starmap:popover-close': void
  'starmap:centerHome': void
  'dev:clearAllFrogs': void
}

export const eventBus = mitt<Events>()
