import mitt from 'mitt'

type Events = {
  'poop:collected': { value: number }
  'frog:tapped': { frogId: string }
  'merge:happened': { level: number }
  'frog:purchased': { level: number }
  'frog:discovered': { level: number }
  'location:changed': { id: number }
  'location:transitionStart': { from: number; to: number }
  'location:transitionEnd': { id: number }
  'rareCrate:opened': { x: number; y: number; minLevel: number; maxLevel: number }
  'rareCrate:claim': { level: number }
}

export const eventBus = mitt<Events>()
