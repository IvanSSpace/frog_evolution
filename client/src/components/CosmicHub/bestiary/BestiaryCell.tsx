// Phase 18: одна ячейка бестиария 64×64.
// Pure presentational; state управляется родительским BestiaryGrid.
// Memoized чтобы virtualizer мог переиспользовать без re-render.

import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Element } from '../../../store/cosmic/types'
import type { LegacyRarity } from '../../../store/cosmic/bestiary'
import { ELEMENT_TINTS } from '../../../game/effects/elements/elementTints'
import { RARITY_BORDER, RARITY_GLOW, tintToCss } from './rarityStyles'

interface Props {
  element: Element
  rarity: LegacyRarity
  level: number
  unlocked: boolean
  onTap: (element: Element, rarity: LegacyRarity, level: number) => void
}

const SIZE = 64

export const BestiaryCell = memo(function BestiaryCell({
  element,
  rarity,
  level,
  unlocked,
  onTap,
}: Props) {
  const { t } = useTranslation()

  if (!unlocked) {
    // Locked variant: gray silhouette + «???» overlay + tooltip
    return (
      <button
        type="button"
        onClick={() => onTap(element, rarity, level)}
        className="relative rounded-md bg-slate-800/40 border border-slate-700/50 flex items-center justify-center"
        style={{ width: SIZE, height: SIZE }}
        title={t('cosmic_hub.bestiary.locked_tooltip')}
        aria-label={t('cosmic_hub.bestiary.locked_aria', { level })}
      >
        <span className="text-slate-500 text-2xl font-bold select-none">
          ???
        </span>
      </button>
    )
  }

  // Discovered: tint background + rarity border + mini-icon + level corner
  const bgColor = tintToCss(ELEMENT_TINTS[element])
  const borderClass = RARITY_BORDER[rarity]
  const glowClass = RARITY_GLOW[rarity]

  return (
    <button
      type="button"
      onClick={() => onTap(element, rarity, level)}
      className={`relative rounded-md flex items-center justify-center ${borderClass} ${glowClass}`}
      style={{
        width: SIZE,
        height: SIZE,
        background: `linear-gradient(135deg, ${bgColor}cc 0%, ${bgColor}88 100%)`,
      }}
      aria-label={t('cosmic_hub.bestiary.cell_aria', {
        element,
        rarity,
        level,
      })}
    >
      {/* Mini frog icon — простая emoji 🐸; реальный sprite optional Phase 19+ */}
      <span className="text-3xl filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
        🐸
      </span>

      {/* Level badge — bottom-right corner */}
      <span
        className="absolute bottom-0.5 right-0.5 text-[10px] font-bold text-white bg-black/60 rounded px-1 tabular-nums"
        aria-hidden="true"
      >
        L{level}
      </span>
    </button>
  )
})
