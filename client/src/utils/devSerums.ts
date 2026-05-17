// Phase 14: dev-only helpers для smoke testing serum apply flow.
// Tree-shaken в prod build (import.meta.env.DEV — статический бранч у Vite).
// Phase 22: rarity removed. Serum — single flat Record<Element, number>.
//
// Usage в DevTools console:
//   __addSerum('fire', 2)
//   __addSerum()          // random element, count=1
//   __listSerums()
//   __clearSerums()

import { useGameStore } from '../store/gameStore'
import { ELEMENTS, type Element } from '../store/cosmic/types'

declare global {
  interface Window {
    __addSerum?: (element?: Element, count?: number) => void
    __clearSerums?: () => void
    __listSerums?: () => void
  }
}

if (import.meta.env.DEV) {
  window.__addSerum = (element, count = 1) => {
    const e: Element =
      element ?? ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]
    useGameStore.getState().addSerum(e, count)
    console.log('[dev] serum added', { element: e, count })
  }

  window.__clearSerums = () => {
    const state = useGameStore.getState()
    let total = 0
    for (const e of ELEMENTS) {
      const cur = state.serums[e]
      if (cur > 0) {
        state.removeSerum(e, cur)
        total += cur
      }
    }
    console.log('[dev] cleared', total, 'serums')
  }

  window.__listSerums = () => {
    const state = useGameStore.getState()
    const rows: Array<{ element: string; count: number }> = []
    for (const e of ELEMENTS) {
      const c = state.serums[e]
      if (c > 0) rows.push({ element: e, count: c })
    }
    if (rows.length === 0) console.log('[dev] serum inventory empty')
    else console.table(rows)
  }

  console.log(
    '[dev Phase 14 / Phase 22] helpers: __addSerum(element?, count?), __clearSerums, __listSerums',
  )
}
