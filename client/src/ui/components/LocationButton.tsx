// LocationButton — переиспользуемая кнопка локации (круг с эмодзи + pink-ring
// активной локации). Используется в LocationStack.

import { useTranslation } from 'react-i18next'
import type { LocationConfig } from '../../store/gameStore'

// Финальные картинки локаций (placeholder-эмодзи выпилены 2026-06-02).
const LOCATION_IMG: Record<number, string> = {
  1: '/locations/swamp.webp', // Болото
  2: '/locations/forestIcon2.webp', // Лес
  3: '/locations/planetIcon3.webp', // Континент
  6: '/locations/galaxyIcon4.webp', // Звёздная карта
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
  const imgSrc = LOCATION_IMG[loc.id] ?? LOCATION_IMG[1]

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
          background: 'transparent',
          border: 'none',
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
        <img
          src={imgSrc}
          alt=""
          style={{
            width: 46,
            height: 46,
            objectFit: 'contain',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))',
          }}
        />
      </button>
    </div>
  )
}
