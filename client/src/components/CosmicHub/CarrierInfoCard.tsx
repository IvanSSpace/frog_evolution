// Phase 17: info row для одного carrier.
// Содержит: tint swatch + element label + rarity badge + level + CeilingDisplay
// + progress bar (UX-10) + dispose stub (Plan 17-05 wires onDispose).

import { useTranslation } from 'react-i18next'
import { CeilingDisplay } from './CeilingDisplay'
import { ELEMENT_TINTS } from '../../game/effects/elements/elementTints'
import type { CarrierData, Rarity } from '../../store/cosmic/types'

const ESTIMATED_FEEDS_TO_STABILIZE = 8  // empirical with SUCCESS_RATE_BASE=0.7

const RARITY_BADGE_CLASS: Record<Rarity, string> = {
  common:    'bg-emerald-700/40 text-emerald-300',
  rare:      'bg-blue-700/40    text-blue-300',
  epic:      'bg-purple-700/40  text-purple-300',
  legendary: 'bg-amber-600/40   text-amber-200',
}

interface Props {
  carrier: CarrierData
  onDispose?: (frogId: string) => void
}

export function CarrierInfoCard({ carrier, onDispose }: Props) {
  const { t } = useTranslation()
  const tintHex = ELEMENT_TINTS[carrier.element]
  const tintCss = `#${tintHex.toString(16).padStart(6, '0')}`

  const level = carrier.level ?? 1
  const stabilized = carrier.stabilized
  const safeFeed = Math.max(0, carrier.feedCount)
  const progress = stabilized
    ? 100
    : Math.min(100, Math.round((safeFeed / ESTIMATED_FEEDS_TO_STABILIZE) * 100))

  return (
    <div className="rounded-md border border-white/10 bg-gray-900/60 p-3 flex flex-col gap-2">
      {/* Row 1: tint swatch + element label + rarity badge + level */}
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: tintCss }}
        />
        <span className="text-white/90 text-sm font-semibold flex-1 truncate">
          {t(`cosmic_hub.elements.${carrier.element}`)}
        </span>
        <span
          className={[
            'rounded-full px-2 py-0.5 text-[10px] uppercase font-bold tracking-wide',
            RARITY_BADGE_CLASS[carrier.rarity],
          ].join(' ')}
        >
          {t(`rarity.${carrier.rarity}`)}
        </span>
        <span className="text-white/70 text-xs font-medium">L{level}</span>
      </div>

      {/* Row 2: ceiling display + dispose button stub */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-xs">{t('cosmic_hub.carrier.ceiling_label')}:</span>
          <CeilingDisplay carrier={carrier} />
        </div>
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

      {/* Row 3: progress bar (UX-10) */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={[
              'h-full transition-all',
              stabilized
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-300'
                : 'bg-gradient-to-r from-amber-500 to-emerald-400',
            ].join(' ')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-white/50 text-[10px] tabular-nums w-12 text-right">
          {stabilized
            ? t('cosmic_hub.carrier.progress_stabilized')
            : `${safeFeed}/${ESTIMATED_FEEDS_TO_STABILIZE}`}
        </span>
      </div>
    </div>
  )
}
