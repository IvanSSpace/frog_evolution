import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/gameStore'
import {
  ELEMENTS,
  type Element,
} from '../../store/cosmic/types'
import { bestiaryIndex, readBit, LEGACY_RARITIES, type LegacyRarity } from '../../store/cosmic/bestiary'
import { GalleryCard } from './GalleryCard'
import { ARCHETYPE_EMOJI, ARCHETYPE_NAME_RU } from './types'

interface GalleryModalProps {
  onClose: () => void
}

function isArchetypeRarityUnlocked(
  bitset: ReadonlyArray<number>,
  archetype: Element,
  rarity: LegacyRarity,
): boolean {
  for (let level = 1; level <= 18; level++) {
    const idx = bestiaryIndex(archetype, rarity, level)
    if (idx >= 0 && readBit(bitset, idx)) return true
  }
  return false
}

export function GalleryModal({ onClose }: GalleryModalProps) {
  const bitset = useGameStore((s) => s.bestiaryBitset)

  const sections = useMemo(
    () =>
      ELEMENTS.map((archetype) => ({
        archetype,
        rarities: LEGACY_RARITIES.map((rarity) => ({
          rarity,
          unlocked: isArchetypeRarityUnlocked(bitset, archetype, rarity),
        })),
      })),
    [bitset],
  )

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99,
        pointerEvents: 'auto',
        background: 'transparent',
      }}
      onPointerDownCapture={(e) => e.stopPropagation()}
      onTouchStartCapture={(e) => e.stopPropagation()}
      onMouseDownCapture={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '12%',
          bottom: '13%',
          left: 0,
          right: 0,
          zIndex: 100,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #f5fbe9 0%, #d9eeb6 100%)',
          border: '4px solid #4d6b1f',
          borderRadius: 0,
          boxShadow: '0 0 0 3px #f7ffe0 inset',
        }}
        className="ff-fade"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0"
          style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-3xl"
            style={{ color: '#15803d', letterSpacing: 1.5 }}
          >
            Коллекция
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="ff-tile w-10 h-10 text-xl flex-shrink-0"
            style={{
              ['--ff-tile-from' as never]: '#fca5a5',
              ['--ff-tile-to' as never]: '#dc2626',
              ['--ff-tile-border' as never]: '#7f1d1d',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
          {sections.map((section) => (
            <div key={section.archetype}>
              <div
                className="flex items-center gap-2 mb-2"
                style={{ color: '#365314' }}
              >
                <span className="text-2xl">
                  {ARCHETYPE_EMOJI[section.archetype]}
                </span>
                <span className="text-lg font-bold">
                  {ARCHETYPE_NAME_RU[section.archetype]}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {section.rarities.map((r) => (
                  <GalleryCard
                    key={r.rarity}
                    archetype={section.archetype}
                    rarity={r.rarity}
                    unlocked={r.unlocked}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
