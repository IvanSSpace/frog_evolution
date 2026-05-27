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

  // Box shadow assembly — pulse-glow override'ит обычный isCurrent ring (pink
  // glow #ec4899 более яркий, чем isCurrent's solid pink ring). Pulse > Current.
  const baseShadow =
    'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 0 rgba(0,0,0,0.25)'
  let boxShadow: string
  if (isPulsing) {
    // 16px glow + 4px spread #ec4899 → видимый pulse-ring «новая локация».
    boxShadow = `${baseShadow}, 0 0 16px 4px #ec4899`
  } else if (isCurrent) {
    boxShadow = `inset 0 1px 0 rgba(255,255,255,0.5), 0 0 0 2px #ec4899, 0 2px 0 rgba(0,0,0,0.25)`
  } else {
    boxShadow = baseShadow
  }

  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
    >
      {/* Розовая стрелка-указатель текущей локации, как в референсе */}
      {isCurrent && (
        <div
          style={{
            position: 'absolute',
            left: -10,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderLeft: '9px solid #ec4899',
            filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.3))',
          }}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={locName}
        title={locName}
        style={{
          pointerEvents: 'auto',
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: `linear-gradient(180deg, ${v.from} 0%, ${v.to} 100%)`,
          border: '2px solid ' + v.border,
          boxShadow,
          fontSize: 20,
          lineHeight: 1,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Pulse bobble (1.2s loop, infinite) перебивает isCurrent scale.
          // Если ни pulse ни isCurrent — обычный 1.0 без анимации.
          // transition только когда нет infinite animation — иначе мерцает.
          transform:
            isPulsing || isCurrent
              ? isCurrent && !isPulsing
                ? 'scale(1.05)'
                : undefined
              : 'scale(1)',
          transition: isPulsing ? undefined : 'transform 120ms',
          animation: isPulsing
            ? 'onb-loc-bobble 1200ms ease-in-out infinite'
            : undefined,
        }}
      >
        <span style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))' }}>
          {v.emoji}
        </span>
      </button>
    </div>
  )
}
