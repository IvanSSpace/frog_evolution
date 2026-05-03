import mitt from 'mitt'

type Events = {
  'poop:collected': { value: number }
  'frog:tapped': { frogId: string }
  'merge:happened': { level: number }
}

export const eventBus = mitt<Events>()
