// Phase 15: dev-only helpers для smoke testing box flow.
// Tree-shaken в prod build (import.meta.env.DEV — статический бранч у Vite).
//
// Usage в DevTools console:
//   __addBox()                              // random archetype 'lava' + no bonus
//   __addBox('lava')                        // fire box
//   __addBox('mystic')                      // arcane box (main race)
//   __addBox('lava', 'epic')                // fire box с epic bonus floor
//   __addBox('ice', undefined, 5)           // 5 ice boxes (для bulk-open testing)
//   __listBoxes()
//   __clearBoxes()

import { useGameStore } from '../store/gameStore'
import {
  ARCHETYPE_TO_ELEMENT,
  MAIN_RACE_TO_ELEMENT,
} from '../game/effects/elements/elementMapping'
import type { Element } from '../store/cosmic/types'

declare global {
  interface Window {
    __addBox?: (
      archetype?: string,
      bonusRarity?: 'rare' | 'epic' | 'legendary',
      count?: number,
    ) => void
    __listBoxes?: () => void
    __clearBoxes?: () => void
  }
}

if (import.meta.env.DEV) {
  window.__addBox = (archetype = 'lava', bonusRarity, count = 1) => {
    const element: Element =
      ARCHETYPE_TO_ELEMENT[archetype] ??
      MAIN_RACE_TO_ELEMENT[archetype] ??
      'fire'
    const store = useGameStore.getState()
    for (let i = 0; i < count; i++) {
      store.addBox({
        planetId: `dev-${Date.now()}-${i}`,
        planetName: `DEV-${archetype.toUpperCase()}`,
        archetype,
        element,
        bonusRarity,
      })
    }
    console.log(
      '[dev Phase 15]',
      count,
      'box(es) added of element',
      element,
      'archetype',
      archetype,
    )
  }

  window.__listBoxes = () => {
    const boxes = useGameStore.getState().boxes
    if (boxes.length === 0) {
      console.log('[dev] inventory empty')
      return
    }
    console.table(
      boxes.map((b) => ({
        id: b.id.slice(0, 8),
        element: b.element,
        archetype: b.archetype,
        planetName: b.planetName,
        bonus: b.bonusRarity ?? '-',
        opened: b.opened,
      })),
    )
  }

  window.__clearBoxes = () => {
    const store = useGameStore.getState()
    const ids = store.boxes.map((b) => b.id)
    for (const id of ids) store.removeBox(id)
    console.log('[dev] cleared', ids.length, 'box(es)')
  }

  console.log(
    '[dev Phase 15] helpers: __addBox(archetype?, bonusRarity?, count?), __listBoxes, __clearBoxes',
  )
}
