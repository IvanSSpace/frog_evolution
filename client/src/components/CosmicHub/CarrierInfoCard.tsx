// Phase 22: CarrierInfoCard — упрощён до { element, level }.
// Удалены: rarity badge, CeilingDisplay, progress bar (stabilize/feedCount).
// Plan 22-04 расширит ссылкой на active bonuses.

import { useTranslation } from 'react-i18next'
import { ELEMENT_TINTS } from '../../game/effects/elements/elementTints'
import type { CarrierData } from '../../store/cosmic/types'

interface Props {
  carrier: CarrierData
  onDispose?: (frogId: string) => void
}

export function CarrierInfoCard({ carrier, onDispose }: Props) {
  const { t } = useTranslation()
  const tintHex = ELEMENT_TINTS[carrier.element]
  const tintCss = `#${tintHex.toString(16).padStart(6, '0')}`

  const level = carrier.level ?? 1

  return (
    <div className="rounded-md border border-white/10 bg-gray-900/60 p-3 flex flex-col gap-2">
      {/* Row 1: tint swatch + element label + level */}
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: tintCss }}
        />
        <span className="text-white/90 text-sm font-semibold flex-1 truncate">
          {t(`cosmic_hub.elements.${carrier.element}`)}
        </span>
        <span className="text-white/70 text-xs font-medium">L{level}</span>
        {onDispose ? (
          <button
            type="button"
            onClick={() => onDispose(carrier.frogId)}
            className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 rounded border border-rose-400/30 hover:bg-rose-400/10 transition-colors"
          >
            {t('cosmic_hub.carrier.dispose_button')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
