// Phase 25-02: visual restyle (dark cards + pink CTAs)
// Phase 22: CarrierInfoCard — упрощён до { element, level }.
// Удалены: rarity badge, CeilingDisplay, progress bar (stabilize/feedCount).
// Plan 22-04 расширит ссылкой на active bonuses.

import { useTranslation } from 'react-i18next'
import { ELEMENT_TINTS } from '../../game/effects/elements/elementTints'
import type { CarrierData } from '../../store/cosmic/types'
import {
  DARK_CARD_STYLE,
  PINK_CTA_MINI_STYLE,
  MINI_BADGE_STYLE,
  TEXT_DIM,
} from './_styles'

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
    <div
      className="flex flex-col gap-2"
      style={DARK_CARD_STYLE}
    >
      {/* Row 1: tint swatch + element label + level */}
      <div className="flex items-center gap-2">
        <div
          className="flex-shrink-0"
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: tintCss,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        />
        <span
          className="flex-1 truncate"
          style={{
            color: '#365314',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {t(`cosmic_hub.elements.${carrier.element}`)}
        </span>
        <span
          style={{
            ...MINI_BADGE_STYLE,
            color: TEXT_DIM,
          }}
        >
          L{level}
        </span>
        {onDispose ? (
          <button
            type="button"
            onClick={() => onDispose(carrier.frogId)}
            style={{
              ...PINK_CTA_MINI_STYLE,
              padding: '4px 10px',
              fontSize: 11,
            }}
          >
            {t('cosmic_hub.carrier.dispose_button')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
