// Phase 18: CSS-based preview анимации для BestiaryDetailModal.
// Использует ELEMENT_TINTS (Phase 12+) и rarity glow.
// Намеренно НЕ использует Phaser — preview не требует interactive sprite.

import type { Element, Rarity } from '../../../store/cosmic/types'
import { ELEMENT_TINTS } from '../../../game/effects/elements/elementTints'
import { tintToCss } from './rarityStyles'

const RARITY_PULSE_DURATION: Record<Rarity, string> = {
  common: '2s',
  rare: '1.6s',
  epic: '1.2s',
  legendary: '0.9s',
}

const RARITY_GLOW_INTENSITY: Record<Rarity, string> = {
  common: '0 0 16px',
  rare: '0 0 24px',
  epic: '0 0 36px',
  legendary: '0 0 48px',
}

interface Props {
  element: Element
  rarity: Rarity
  size?: number
}

export function AwakenedPreviewCanvas({ element, rarity, size = 160 }: Props) {
  const tint = tintToCss(ELEMENT_TINTS[element])
  const pulseDuration = RARITY_PULSE_DURATION[rarity]
  const glowIntensity = RARITY_GLOW_INTENSITY[rarity]

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Outer rarity glow ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${tint}40 0%, transparent 70%)`,
          boxShadow: `${glowIntensity} ${tint}`,
          animation: `bestiary-pulse ${pulseDuration} ease-in-out infinite`,
        }}
      />

      {/* Inner element orb */}
      <div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: size * 0.6,
          height: size * 0.6,
          background: `radial-gradient(circle at 35% 30%, ${tint}ff 0%, ${tint}80 60%, ${tint}40 100%)`,
          boxShadow: `inset 0 0 20px rgba(255,255,255,0.4), 0 0 12px ${tint}`,
        }}
      >
        <span
          className="text-5xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
          style={{ animation: `bestiary-bob ${pulseDuration} ease-in-out infinite` }}
        >
          🐸
        </span>
      </div>

      {/* Inline keyframes для pulse + bob */}
      <style>{`
        @keyframes bestiary-pulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes bestiary-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
