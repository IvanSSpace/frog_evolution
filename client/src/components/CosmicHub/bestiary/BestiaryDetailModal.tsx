// Phase 18 stub — Plan 18-04 заменит на full implementation с preview.
import type { Element, Rarity } from '../../../store/cosmic/types'

interface Props {
  element: Element
  rarity: Rarity
  level: number
  unlocked: boolean
  onClose: () => void
}

export function BestiaryDetailModal({ element, rarity, level, unlocked, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-lg p-4 max-w-sm w-full text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm text-white/60 mb-1">{rarity} · L{level}</div>
        <div className="text-lg font-bold mb-2">{element}</div>
        <div className="text-xs text-white/40">{unlocked ? 'Unlocked' : 'Locked'}</div>
        <button
          onClick={onClose}
          className="mt-3 px-3 py-1 rounded bg-emerald-500 text-white text-sm"
        >
          Close
        </button>
      </div>
    </div>
  )
}
