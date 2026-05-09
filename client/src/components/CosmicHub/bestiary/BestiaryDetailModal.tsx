// Phase 18: cell detail modal (REQ BESTIARY-09).
// Tap по cell → modal с CSS preview, sound-style label, lore placeholder.
// Locked variant: ??? + hint, без preview.

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Element, Rarity } from '../../../store/cosmic/types'
import { AwakenedPreviewCanvas } from './AwakenedPreviewCanvas'
import { RARITY_LABEL_KEY, RARITY_BORDER } from './rarityStyles'

interface Props {
  element: Element
  rarity: Rarity
  level: number
  unlocked: boolean
  onClose: () => void
}

export function BestiaryDetailModal({
  element,
  rarity,
  level,
  unlocked,
  onClose,
}: Props) {
  const { t } = useTranslation()

  // Escape key closes
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Element label key — `cosmic_hub.elements.{element}` (existing namespace).
  const elementLabel = t(`cosmic_hub.elements.${element}`, {
    defaultValue: element,
  })

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('cosmic_hub.bestiary.detail_modal_aria')}
    >
      <div
        className={`relative bg-gray-900 rounded-xl p-5 max-w-sm w-full text-white ${RARITY_BORDER[rarity]}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 text-white/60 hover:text-white text-xl leading-none px-2"
          aria-label={t('cosmic_hub.bestiary.close')}
        >
          ×
        </button>

        {unlocked ? (
          <>
            {/* Preview canvas */}
            <div className="flex justify-center mb-4 mt-2">
              <AwakenedPreviewCanvas
                element={element}
                rarity={rarity}
                size={160}
              />
            </div>

            {/* Element + rarity + level header */}
            <div className="text-center mb-3">
              <div className="text-xs uppercase tracking-wide text-white/50">
                {t(RARITY_LABEL_KEY[rarity])} ·{' '}
                {t('cosmic_hub.bestiary.level_label', { level })}
              </div>
              <div className="text-xl font-bold mt-1">{elementLabel}</div>
            </div>

            {/* Sound-style label (REQ BESTIARY-09) */}
            <div className="bg-white/5 rounded p-2 mb-3 text-xs text-white/70">
              <div className="font-semibold text-white/50 mb-0.5">
                {t('cosmic_hub.bestiary.sound_label')}
              </div>
              <div className="italic">
                {t(`cosmic_hub.bestiary.sound_style_${rarity}`, {
                  defaultValue: t('cosmic_hub.bestiary.sound_style_fallback'),
                })}
              </div>
            </div>

            {/* Lore placeholder */}
            <div className="bg-white/5 rounded p-2 text-xs text-white/60 leading-relaxed">
              <div className="font-semibold text-white/50 mb-0.5">
                {t('cosmic_hub.bestiary.lore_label')}
              </div>
              <div>
                {t('cosmic_hub.bestiary.lore_placeholder', {
                  element: elementLabel,
                  level,
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Locked variant */}
            <div className="flex justify-center mb-4 mt-2">
              <div
                className="rounded-full bg-slate-700 flex items-center justify-center"
                style={{ width: 160, height: 160 }}
              >
                <span className="text-6xl text-slate-500 font-bold">???</span>
              </div>
            </div>

            <div className="text-center mb-2">
              <div className="text-xs uppercase tracking-wide text-white/40">
                {t(RARITY_LABEL_KEY[rarity])} ·{' '}
                {t('cosmic_hub.bestiary.level_label', { level })}
              </div>
              <div className="text-lg font-bold mt-1 text-white/50">
                {t('cosmic_hub.bestiary.locked_title')}
              </div>
            </div>

            <p className="text-xs text-white/50 text-center leading-relaxed">
              {t('cosmic_hub.bestiary.locked_hint')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
