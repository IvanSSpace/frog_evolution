import { useEffect, useState } from 'react'
import type { Element, Rarity } from '../../store/cosmic/types'
import { eventBus } from '../../store/eventBus'
import {
  ARCHETYPE_EMOJI,
  ARCHETYPE_NAME_RU,
  RARITY_COLOR,
  RARITY_LABEL,
} from './types'
import { GalleryDetailPreview } from './GalleryDetailPreview'

export function GalleryDetailModal() {
  const [open, setOpen] = useState<{
    archetype: Element
    rarity: Rarity
  } | null>(null)

  useEffect(() => {
    const onOpen = ({
      archetype,
      rarity,
    }: {
      archetype: Element
      rarity: Rarity
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
  const color = RARITY_COLOR[rarity]

  return (
    <div className="fixed inset-0 z-[9500] bg-black/95 flex flex-col items-center justify-center p-4">
      <button
        onClick={() => setOpen(null)}
        className="absolute top-4 right-4 px-3 py-1 bg-neutral-700 text-white rounded"
      >
        Назад
      </button>

      <div className="text-3xl mb-4 text-white flex items-center gap-2">
        <span>{ARCHETYPE_EMOJI[archetype]}</span>
        <span>{ARCHETYPE_NAME_RU[archetype]}</span>
        <span style={{ color }}>× {RARITY_LABEL[rarity]}</span>
      </div>

      <GalleryDetailPreview archetype={archetype} rarity={rarity} />

      <div className="mt-6 text-center text-white max-w-md">
        <div className="text-lg font-semibold mb-1">Эффект</div>
        <div className="text-sm text-neutral-300">
          (Механический эффект будет добавлен позже. Сейчас — preview анимации.)
        </div>
      </div>
    </div>
  )
}
