// Phase 18: filter/sort/search state machine для одного location-tab.
// Возвращает memoized список cells для рендеринга.
//
// Layout decision (D-04 в master PLAN.md):
//   6 columns × 48 rows = 288 cells (1 rarity × 16 elements × 18 levels).
//   Order по умолчанию: level ascending, затем element order (ELEMENTS array).

import { useMemo, useState } from 'react'
import {
  ELEMENTS,
  RARITIES,
  type Element,
  type Rarity,
} from '../../../store/cosmic/types'
import { bestiaryIndex, readBit } from '../../../store/cosmic/bestiary'
import { MAX_LEVEL } from '../../../game/config/frogs'

export type SortKey = 'level-asc' | 'level-desc' | 'element' | 'rarity'

export interface BestiaryCellRef {
  element: Element
  rarity: Rarity
  level: number
  unlocked: boolean
  /** stable key для virtualizer */
  key: string
}

export interface BestiaryViewFilters {
  /** 'all' = показывать все, 'common'/'rare'/etc = только эту rarity */
  rarityFilter: Rarity | 'all'
  /** Substring поиск по element name (lowercase) */
  elementSearch: string
  /** Если true → показывать locked cells; если false → только unlocked */
  showLocked: boolean
  /** Сортировка cells */
  sortBy: SortKey
}

export interface UseBestiaryViewArgs {
  /** Активная локация (= rarity). Внутри hook фильтрует bitset по этой rarity. */
  location: Rarity
  /** bitset из store */
  bitset: ReadonlyArray<number>
}

export interface UseBestiaryViewResult extends BestiaryViewFilters {
  cells: BestiaryCellRef[]
  totalInLocation: number
  unlockedInLocation: number
  setRarityFilter: (r: Rarity | 'all') => void
  setElementSearch: (s: string) => void
  setShowLocked: (v: boolean) => void
  setSortBy: (k: SortKey) => void
}

const COLS = 6
export const BESTIARY_GRID_COLS = COLS

export function useBestiaryView({
  location,
  bitset,
}: UseBestiaryViewArgs): UseBestiaryViewResult {
  // Default: showLocked=true если в этой локации НЕТ unlocked (empty state — показать все locked).
  // showLocked=false если уже есть прогресс (REQ BESTIARY-05 «Discovered only» по умолчанию).
  const initialUnlocked = useMemo(() => {
    let count = 0
    for (let level = 1; level <= MAX_LEVEL; level++) {
      for (let e = 0; e < ELEMENTS.length; e++) {
        const idx = bestiaryIndex(ELEMENTS[e], location, level)
        if (readBit(bitset, idx)) count++
      }
    }
    return count
    // Initial — only re-evaluate при смене location, не при изменении bitset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all')
  const [elementSearch, setElementSearch] = useState('')
  const [showLocked, setShowLocked] = useState(initialUnlocked === 0)
  const [sortBy, setSortBy] = useState<SortKey>('level-asc')

  // Build cells list.
  const cells = useMemo<BestiaryCellRef[]>(() => {
    const out: BestiaryCellRef[] = []
    const search = elementSearch.trim().toLowerCase()

    for (let level = 1; level <= MAX_LEVEL; level++) {
      for (let e = 0; e < ELEMENTS.length; e++) {
        const element = ELEMENTS[e]
        const rarity = location // tab = rarity

        // Filter: rarityFilter
        if (rarityFilter !== 'all' && rarityFilter !== rarity) continue

        // Filter: element search (substring match по element id)
        if (search && !element.toLowerCase().includes(search)) continue

        const idx = bestiaryIndex(element, rarity, level)
        const unlocked = readBit(bitset, idx)

        // Filter: showLocked toggle
        if (!showLocked && !unlocked) continue

        out.push({
          element,
          rarity,
          level,
          unlocked,
          key: `${element}|${rarity}|${level}`,
        })
      }
    }

    // Sort
    switch (sortBy) {
      case 'level-asc':
        // Already in level-asc order (insertion order)
        break
      case 'level-desc':
        out.sort(
          (a, b) =>
            b.level - a.level ||
            ELEMENTS.indexOf(a.element) - ELEMENTS.indexOf(b.element),
        )
        break
      case 'element':
        out.sort(
          (a, b) =>
            ELEMENTS.indexOf(a.element) - ELEMENTS.indexOf(b.element) ||
            a.level - b.level,
        )
        break
      case 'rarity':
        // В single-location tab все cells имеют одну rarity → fallback на element/level
        out.sort(
          (a, b) =>
            RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) ||
            a.level - b.level ||
            ELEMENTS.indexOf(a.element) - ELEMENTS.indexOf(b.element),
        )
        break
    }

    return out
  }, [bitset, location, rarityFilter, elementSearch, showLocked, sortBy])

  // Totals (для badge)
  const totalInLocation = ELEMENTS.length * MAX_LEVEL // 288
  const unlockedInLocationVal = useMemo(() => {
    let count = 0
    for (let level = 1; level <= MAX_LEVEL; level++) {
      for (let e = 0; e < ELEMENTS.length; e++) {
        const idx = bestiaryIndex(ELEMENTS[e], location, level)
        if (readBit(bitset, idx)) count++
      }
    }
    return count
  }, [bitset, location])

  return {
    cells,
    totalInLocation,
    unlockedInLocation: unlockedInLocationVal,
    rarityFilter,
    setRarityFilter,
    elementSearch,
    setElementSearch,
    showLocked,
    setShowLocked,
    sortBy,
    setSortBy,
  }
}
