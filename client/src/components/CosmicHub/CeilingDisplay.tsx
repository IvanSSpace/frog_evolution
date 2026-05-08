// Phase 17 (CARRIER-07): progressive ceiling reveal.
//   0-2 feeds: ??? (text-white/40)
//   3-4 feeds: color hint label (Высокий/Средний/Низкий) per bucket
//   5+ feeds:  exact L{ceiling} с element tint color
//
// Pure presentational — accepts CarrierData, derives bucket из ceiling/rarity.

import { useTranslation } from 'react-i18next'
import { bucketOfCeiling } from '../../utils/carrierEvolution'
import { ELEMENT_TINTS } from '../../game/effects/elements/elementTints'
import type { CarrierData } from '../../store/cosmic/types'

interface Props {
  carrier: CarrierData
}

export function CeilingDisplay({ carrier }: Props) {
  const { t } = useTranslation()

  // Phase 1: 0-2 feeds OR ceiling undefined → ???
  if (carrier.feedCount < 3 || carrier.ceiling === undefined) {
    return <span className="text-sm font-medium text-white/40">???</span>
  }

  const bucket = bucketOfCeiling(carrier.rarity, carrier.ceiling)

  // Phase 2: 3-4 feeds → color hint label
  if (carrier.feedCount < 5) {
    if (bucket === 'S' || bucket === 'A') {
      return (
        <span className="text-sm font-medium text-emerald-400">
          {t('cosmic_hub.carrier.ceiling_high')}
        </span>
      )
    }
    if (bucket === 'B') {
      return (
        <span className="text-sm font-medium text-amber-400">
          {t('cosmic_hub.carrier.ceiling_mid')}
        </span>
      )
    }
    return (
      <span className="text-sm font-medium text-rose-400">
        {t('cosmic_hub.carrier.ceiling_low')}
      </span>
    )
  }

  // Phase 3: 5+ feeds → exact L{ceiling} в element tint
  const tintHex = ELEMENT_TINTS[carrier.element]
  const tintCss = `#${tintHex.toString(16).padStart(6, '0')}`
  return (
    <span
      className="text-sm font-bold"
      style={{ color: tintCss }}
    >
      L{carrier.ceiling}
    </span>
  )
}
