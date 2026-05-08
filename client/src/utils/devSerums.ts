// Phase 14: dev-only helpers для smoke testing serum apply flow.
// Tree-shaken в prod build (import.meta.env.DEV — статический бранч у Vite).
//
// Usage в DevTools console:
//   __addSerum('fire', 'common', 2)
//   __addSerum()                          // random element + common rarity
//   __listSerums()
//   __clearSerums()

import { useGameStore } from '../store/gameStore'
import { ELEMENTS, RARITIES, type Element, type Rarity } from '../store/cosmic/types'

declare global {
  interface Window {
    __addSerum?: (element?: Element, rarity?: Rarity, count?: number) => void
    __clearSerums?: () => void
    __listSerums?: () => void
  }
}

if (import.meta.env.DEV) {
  window.__addSerum = (element, rarity, count = 1) => {
    const e: Element = element ?? ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]
    const r: Rarity = rarity ?? 'common'
    useGameStore.getState().addSerum(e, r, count)
    console.log('[dev] serum added', { element: e, rarity: r, count })
  }

  window.__clearSerums = () => {
    const state = useGameStore.getState()
    let total = 0
    for (const e of ELEMENTS) {
      for (const r of RARITIES) {
        const cur = state.serums[e][r]
        if (cur > 0) {
          state.removeSerum(e, r, cur)
          total += cur
        }
      }
    }
    console.log('[dev] cleared', total, 'serums')
  }

  window.__listSerums = () => {
    const state = useGameStore.getState()
    const rows: Array<{ element: string; rarity: string; count: number }> = []
    for (const e of ELEMENTS) {
      for (const r of RARITIES) {
        const c = state.serums[e][r]
        if (c > 0) rows.push({ element: e, rarity: r, count: c })
      }
    }
    if (rows.length === 0) console.log('[dev] serum inventory empty')
    else console.table(rows)
  }

  console.log('[dev Phase 14] helpers: __addSerum(element?, rarity?, count?), __clearSerums, __listSerums')
}
