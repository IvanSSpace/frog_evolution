import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Element } from '../../store/cosmic/types'
import type { LegacyRarity } from '../../store/cosmic/bestiary'
import { eventBus } from '../../store/eventBus'
import {
  ARCHETYPE_EMOJI,
  ARCHETYPE_NAME_RU,
  RARITY_COLOR,
  RARITY_LABEL,
} from './types'
import { GalleryDetailPreview } from './GalleryDetailPreview'
import { useModalLock } from '../../utils/modalLock'

export function GalleryDetailModal() {
  const [open, setOpen] = useState<{
    archetype: Element
    rarity: LegacyRarity
  } | null>(null)
  useModalLock(open !== null)

  useEffect(() => {
    const onOpen = ({
      archetype,
      rarity,
    }: {
      archetype: Element
      rarity: LegacyRarity
    }) => {
      setOpen({ archetype, rarity })
    }
    eventBus.on('gallery:open-detail', onOpen)
    return () => {
      eventBus.off('gallery:open-detail', onOpen)
    }
  }, [])

  if (!open) return null

  const { archetype, rarity } = open
  const rarityColor = RARITY_COLOR[rarity]

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 149,
        pointerEvents: 'auto',
        background: 'transparent',
      }}
      onPointerDownCapture={(e) => e.stopPropagation()}
      onTouchStartCapture={(e) => e.stopPropagation()}
      onMouseDownCapture={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(null)
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--ui-top-offset) + var(--tg-chrome-pad))',
          bottom: '13%',
          left: 0,
          right: 0,
          zIndex: 150,
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
            className="ff-display ff-stroke-white text-3xl flex items-center gap-2"
            style={{ color: '#15803d', letterSpacing: 1.5 }}
          >
            <span>{ARCHETYPE_EMOJI[archetype]}</span>
            <span>{ARCHETYPE_NAME_RU[archetype]}</span>
            <span style={{ color: rarityColor }}>× {RARITY_LABEL[rarity]}</span>
          </h2>
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Закрыть"
            className="ff-tile w-10 h-10 text-xl flex-shrink-0"
            style={{
              ['--ff-tile-from' as never]: '#fca5a5',
              ['--ff-tile-to' as never]: '#dc2626',
              ['--ff-tile-border' as never]: '#7f1d1d',
              pointerEvents: 'auto',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-3">
          <GalleryDetailPreview archetype={archetype} rarity={rarity} />

          <div
            className="mt-6 text-center max-w-md"
            style={{ color: '#365314' }}
          >
            <div className="text-lg font-bold mb-1">Эффект</div>
            <div className="text-sm">
              Сдесь будет описание что делает эта лягушка
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
