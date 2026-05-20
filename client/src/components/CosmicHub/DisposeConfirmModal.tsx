// Phase 22: DisposeConfirmModal — stub без rarity/feedCount.
// Dispose = просто удалить carrier (serum recovery TBD в Plan 22-03).

import { useTranslation } from 'react-i18next'
import { ELEMENT_TINTS } from '../../game/effects/elements/elementTints'
import type { CarrierData } from '../../store/cosmic/types'
import { useModalLock } from '../../utils/modalLock'

interface Props {
  carrier: CarrierData
  onConfirm: () => void
  onCancel: () => void
}

export function DisposeConfirmModal({ carrier, onConfirm, onCancel }: Props) {
  useModalLock()
  const { t } = useTranslation()
  const tintHex = ELEMENT_TINTS[carrier.element]
  const tintCss = `#${tintHex.toString(16).padStart(6, '0')}`
  const elementName = t(`cosmic_hub.elements.${carrier.element}`)

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-label={t('cosmic_hub.carrier.dispose.modal_label')}
    >
      <div
        className="rounded-xl border-2 px-6 py-5 flex flex-col gap-4 bg-gray-900/95 max-w-xs"
        style={{ borderColor: tintCss }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: tintCss }}
          />
          <span className="text-white font-semibold text-base">
            {t('cosmic_hub.carrier.dispose.title')}
          </span>
        </div>
        <p className="text-white/80 text-sm">
          {elementName} L{carrier.level}
        </p>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-2 rounded border border-white/20 text-white/70 text-sm hover:bg-white/5 transition-colors"
          >
            {t('cosmic_hub.carrier.dispose.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-3 py-2 rounded bg-rose-600 text-white text-sm hover:bg-rose-500 transition-colors font-medium"
          >
            {t('cosmic_hub.carrier.dispose.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
