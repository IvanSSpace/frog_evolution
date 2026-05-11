import type { Element, Rarity } from '../../store/cosmic/types'
import { eventBus } from '../../store/eventBus'
import { ARCHETYPE_EMOJI, RARITY_COLOR, RARITY_LABEL } from './types'

interface GalleryCardProps {
  archetype: Element
  rarity: Rarity
  unlocked: boolean
}

export function GalleryCard({ archetype, rarity, unlocked }: GalleryCardProps) {
  const borderColor = RARITY_COLOR[rarity]
  const handleClick = () => {
    if (!unlocked) return
    eventBus.emit('gallery:open-detail', { archetype, rarity })
  }

  return (
    <button
      onClick={handleClick}
      disabled={!unlocked}
      className="relative flex flex-col items-center justify-center rounded-lg p-2 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        width: 80,
        height: 100,
        backgroundColor: 'rgba(20, 20, 30, 0.8)',
        border: `2px solid ${borderColor}`,
      }}
    >
      <div className="text-3xl mb-1">
        {unlocked ? ARCHETYPE_EMOJI[archetype] : '?'}
      </div>
      <div className="text-xs font-bold" style={{ color: borderColor }}>
        {RARITY_LABEL[rarity]}
      </div>
    </button>
  )
}
