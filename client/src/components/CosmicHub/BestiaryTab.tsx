// Phase 18: бестиарий 2.0 — 4 location tabs (rarity-based) × 384 cells virtualized.
// REQ BESTIARY-01..09.

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import type { Element, Rarity } from '../../store/cosmic/types'
import {
  countUnlocked, unlockedInLocation, readBit, bestiaryIndex,
} from '../../store/cosmic/bestiary'
import {
  BestiaryGrid, FilterPills, useBestiaryView, BestiaryDetailModal,
} from './bestiary'

interface LocationTab {
  rarity: Rarity
  labelKey: string  // i18n key
  icon: string
}

const LOCATION_TABS: readonly LocationTab[] = [
  { rarity: 'common', labelKey: 'cosmic_hub.bestiary.location_swamp', icon: '🌿' },
  { rarity: 'rare', labelKey: 'cosmic_hub.bestiary.location_forest', icon: '🌲' },
  { rarity: 'epic', labelKey: 'cosmic_hub.bestiary.location_continent', icon: '🏔️' },
  { rarity: 'legendary', labelKey: 'cosmic_hub.bestiary.location_planet', icon: '🪐' },
] as const

interface SelectedCell {
  element: Element
  rarity: Rarity
  level: number
}

export function BestiaryTab() {
  const { t } = useTranslation()
  const bitset = useGameStore((s) => s.bestiaryBitset)
  const [activeLocation, setActiveLocation] = useState<Rarity>('common')
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)

  const totalUnlocked = useMemo(() => countUnlocked(bitset), [bitset])

  const view = useBestiaryView({ location: activeLocation, bitset })

  // Per-tab unlocked count map (memoized)
  const perLocationCounts = useMemo(() => {
    const result: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 }
    for (const r of ['common', 'rare', 'epic', 'legendary'] as const) {
      result[r] = unlockedInLocation(bitset, r)
    }
    return result
  }, [bitset])

  const handleCellTap = (element: Element, rarity: Rarity, level: number) => {
    setSelectedCell({ element, rarity, level })
  }

  const selectedUnlocked = useMemo(() => {
    if (!selectedCell) return false
    const idx = bestiaryIndex(selectedCell.element, selectedCell.rarity, selectedCell.level)
    return readBit(bitset, idx)
  }, [selectedCell, bitset])

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Global counter */}
      <div className="px-3 py-2 text-xs text-white/60 border-b border-white/10 flex justify-between items-center">
        <span>
          {t('cosmic_hub.bestiary.discovered_total', { count: totalUnlocked, total: 1536 })}
        </span>
        <span className="text-white/40 tabular-nums">
          {Math.round((totalUnlocked / 1536) * 100)}%
        </span>
      </div>

      {/* Location tabs row */}
      <div className="flex border-b border-white/10 flex-shrink-0">
        {LOCATION_TABS.map((loc) => {
          const isActive = activeLocation === loc.rarity
          const locUnlocked = perLocationCounts[loc.rarity]
          return (
            <button
              key={loc.rarity}
              type="button"
              onClick={() => setActiveLocation(loc.rarity)}
              className={[
                'flex-1 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'text-white border-b-2 border-emerald-400'
                  : 'text-white/40 hover:text-white/60',
              ].join(' ')}
            >
              <span className="block text-base">{loc.icon}</span>
              <span>{t(loc.labelKey)}</span>
              <span className="block text-[10px] text-white/50 tabular-nums">
                {locUnlocked}/384
              </span>
            </button>
          )
        })}
      </div>

      {/* Filter bar */}
      <FilterPills
        rarityFilter={view.rarityFilter}
        onRarityFilter={view.setRarityFilter}
        elementSearch={view.elementSearch}
        onElementSearch={view.setElementSearch}
        showLocked={view.showLocked}
        onToggleLocked={view.setShowLocked}
        sortBy={view.sortBy}
        onSortBy={view.setSortBy}
      />

      {/* Grid */}
      <BestiaryGrid cells={view.cells} onCellTap={handleCellTap} />

      {/* Detail modal */}
      {selectedCell && (
        <BestiaryDetailModal
          element={selectedCell.element}
          rarity={selectedCell.rarity}
          level={selectedCell.level}
          unlocked={selectedUnlocked}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  )
}
