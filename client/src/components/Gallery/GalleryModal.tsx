import { useMemo } from 'react'
import { useGameStore } from '../../store/gameStore'
import {
  ELEMENTS,
  RARITIES,
  type Element,
  type Rarity,
} from '../../store/cosmic/types'
import { bestiaryIndex, readBit } from '../../store/cosmic/bestiary'
import { GalleryCard } from './GalleryCard'
import { ARCHETYPE_EMOJI, ARCHETYPE_NAME_RU } from './types'

interface GalleryModalProps {
  onClose: () => void
}

function isArchetypeRarityUnlocked(
  bitset: ReadonlyArray<number>,
  archetype: Element,
  rarity: Rarity,
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
        rarities: RARITIES.map((rarity) => ({
          rarity,
          unlocked: isArchetypeRarityUnlocked(bitset, archetype, rarity),
        })),
      })),
    [bitset],
  )

  return (
    <div className="fixed inset-0 z-[9000] bg-black/85 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-neutral-700">
        <h2 className="text-xl font-bold text-white">Коллекция архетипов</h2>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded"
        >
          Закрыть
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {sections.map((section) => (
          <div key={section.archetype}>
            <div className="flex items-center gap-2 mb-2 text-white">
              <span className="text-2xl">
                {ARCHETYPE_EMOJI[section.archetype]}
              </span>
              <span className="text-lg font-semibold">
                {ARCHETYPE_NAME_RU[section.archetype]}
              </span>
            </div>
            <div className="flex gap-2">
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
  )
}
