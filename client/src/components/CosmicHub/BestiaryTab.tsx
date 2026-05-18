// Phase 25-02: light pass restyle (только top-level BestiaryTab; bestiary/ subdir НЕ trogается)
// Phase 18: бестиарий 2.0 — 4 location tabs (rarity-based) × 384 cells virtualized.
// REQ BESTIARY-01..09.

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import type { Element } from '../../store/cosmic/types'
import {
  countUnlocked,
  unlockedInLocation,
  readBit,
  bestiaryIndex,
  BESTIARY_BIT_COUNT,
  type LegacyRarity,
  LEGACY_RARITIES,
} from '../../store/cosmic/bestiary'
import {
  BestiaryGrid,
  FilterPills,
  useBestiaryView,
  BestiaryDetailModal,
} from './bestiary'
import { PINK, TEXT_DIM, TEXT_VERY_DIM } from './_styles'

interface LocationTab {
  rarity: LegacyRarity
  labelKey: string // i18n key
  icon: string
}

const LOCATION_TABS: readonly LocationTab[] = [
  {
    rarity: 'common',
    labelKey: 'cosmic_hub.bestiary.location_puddle',
    icon: '💧',
  },
  {
    rarity: 'rare',
    labelKey: 'cosmic_hub.bestiary.location_swamp',
    icon: '🌿',
  },
  {
    rarity: 'epic',
    labelKey: 'cosmic_hub.bestiary.location_forest',
    icon: '🌲',
  },
  {
    rarity: 'legendary',
    labelKey: 'cosmic_hub.bestiary.location_continent',
    icon: '🏔️',
  },
] as const

interface SelectedCell {
  element: Element
  rarity: LegacyRarity
  level: number
}

export function BestiaryTab() {
  const { t } = useTranslation()
  const bitset = useGameStore((s) => s.bestiaryBitset)
  const [activeLocation, setActiveLocation] = useState<LegacyRarity>('common')
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)

  const totalUnlocked = useMemo(() => countUnlocked(bitset), [bitset])

  const view = useBestiaryView({ location: activeLocation, bitset })

  // Per-tab unlocked count map (memoized)
  const perLocationCounts = useMemo(() => {
    const result: Record<LegacyRarity, number> = {
      common: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    }
    for (const r of LEGACY_RARITIES) {
      result[r] = unlockedInLocation(bitset, r)
    }
    return result
  }, [bitset])

  const handleCellTap = (element: Element, rarity: LegacyRarity, level: number) => {
    setSelectedCell({ element, rarity, level })
  }

  const selectedUnlocked = useMemo(() => {
    if (!selectedCell) return false
    const idx = bestiaryIndex(
      selectedCell.element,
      selectedCell.rarity,
      selectedCell.level,
    )
    return readBit(bitset, idx)
  }, [selectedCell, bitset])

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'transparent' }}
    >
      {/* Global counter */}
      <div
        className="px-3 py-2 flex justify-between items-center"
        style={{
          fontSize: 12,
          color: TEXT_DIM,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <span>
          {t('cosmic_hub.bestiary.discovered_total', {
            count: totalUnlocked,
            total: BESTIARY_BIT_COUNT,
          })}
        </span>
        <span
          className="tabular-nums"
          style={{ color: TEXT_VERY_DIM }}
        >
          {Math.round((totalUnlocked / BESTIARY_BIT_COUNT) * 100)}%
        </span>
      </div>

      {/* Location tabs row */}
      <div
        className="flex flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        {LOCATION_TABS.map((loc) => {
          const isActive = activeLocation === loc.rarity
          const locUnlocked = perLocationCounts[loc.rarity]
          return (
            <button
              key={loc.rarity}
              type="button"
              onClick={() => setActiveLocation(loc.rarity)}
              className="flex-1 py-1.5"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: isActive ? '#fff' : TEXT_VERY_DIM,
                borderBottom: isActive ? `2px solid ${PINK}` : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                touchAction: 'manipulation',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              <span style={{ display: 'block', fontSize: 16, lineHeight: 1.2 }}>
                {loc.icon}
              </span>
              <span>{t(loc.labelKey)}</span>
              <span
                className="block tabular-nums"
                style={{ fontSize: 10, color: TEXT_VERY_DIM }}
              >
                {locUnlocked}/288
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
