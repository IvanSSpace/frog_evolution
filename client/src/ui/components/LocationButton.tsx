// LocationButton — переиспользуемая кнопка локации (круг с эмодзи + pink-ring
// активной локации). Используется в LocationStack.

import { useTranslation } from 'react-i18next'
import type { LocationConfig } from '../../store/gameStore'

// Эмодзи и цвета для локаций (placeholder — потом юзер заменит на свои картинки)
export const LOCATION_VISUAL: Record<
  number,
  { emoji: string; from: string; to: string; border: string }
> = {
  1: { emoji: '🌿', from: '#bef264', to: '#65a30d', border: '#365314' }, // Болото
  2: { emoji: '🌲', from: '#86efac', to: '#15803d', border: '#14532d' }, // Лес
  3: { emoji: '🌍', from: '#fca5a5', to: '#b91c1c', border: '#7f1d1d' }, // Континент
  6: { emoji: '✨', from: '#67e8f9', to: '#0e7490', border: '#164e63' }, // Звёздная карта (тест)
}

export function LocationButton({
  loc,
  isCurrent,
  onClick,
  disabled = false,
  isPulsing = false,
}: {
  loc: LocationConfig
  isCurrent: boolean
  onClick: () => void
  disabled?: boolean
  /** Phase 23 Plan 23-05: pulse + glow на новой location button после unlock. */
  isPulsing?: boolean
}) {
  const { t } = useTranslation()
  const locName = t(`locations.${loc.id}`)
  const v = LOCATION_VISUAL[loc.id] ?? LOCATION_VISUAL[1]

  // Pulse-glow на unlock новой локации. isCurrent ring убран — текущую
  // локацию теперь показывает стрелка-указатель внутри круга.
  const baseShadow =
    'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 0 rgba(0,0,0,0.25)'
  const boxShadow = isPulsing
    ? `${baseShadow}, 0 0 16px 4px #ec4899`
    : baseShadow

  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
    >
      {/* Стрелка-указатель текущей локации — рендерится в LocationStack как
          одна общая, чтобы плавно перелетать между кнопками. */}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={locName}
        aria-pressed={isCurrent}
        title={locName}
        style={{
          pointerEvents: 'auto',
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: 46,
          height: 46,
          borderRadius: '50%',
          background: `linear-gradient(180deg, ${v.from} 0%, ${v.to} 100%)`,
          border: '2px solid ' + v.border,
          boxShadow,
          fontSize: 22,
          lineHeight: 1,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // 2026-05-28: isCurrent больше не увеличивается (убрали scale 1.05).
          // Pulse bobble (1.2s loop, infinite) — только при unlock.
          transform: isPulsing ? undefined : 'scale(1)',
          transition: isPulsing ? undefined : 'transform 120ms',
          animation: isPulsing
            ? 'onb-loc-bobble 1200ms ease-in-out infinite'
            : undefined,
        }}
      >
        {loc.id === 6 ||
        loc.id === 3 ||
        loc.id === 2 ||
        loc.id === 1 ? (
          <img
            src={
              loc.id === 6
                ? '/locations/galaxyIcon4.png'
                : loc.id === 3
                  ? '/locations/planetIcon3.png'
                  : loc.id === 2
                    ? '/locations/forestIcon2.png'
                    : '/locations/swamp.png'
            }
            alt=""
            style={{
              width: 40,
              height: 40,
              objectFit: 'contain',
              pointerEvents: 'none',
              filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))',
            }}
          />
        ) : (
          <span style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))' }}>
            {v.emoji}
          </span>
        )}
      </button>
    </div>
  )
}
