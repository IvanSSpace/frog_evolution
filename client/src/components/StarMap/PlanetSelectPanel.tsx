import { createPortal } from 'react-dom'

interface Props {
  planetId: string
  name: string
  archetype: string
  onFly: () => void
  onClose: () => void
  isCurrentPlanet: boolean
  isTransit: boolean
}

export function PlanetSelectPanel({
  planetId: _planetId,
  name,
  archetype,
  onFly,
  onClose,
  isCurrentPlanet,
  isTransit,
}: Props) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: '13%',
        left: 0,
        right: 0,
        zIndex: 200,
        pointerEvents: 'auto',
        padding: '8px 16px',
        background: 'rgba(15, 23, 10, 0.92)',
        borderTop: '1px solid rgba(163, 230, 53, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: '#fef9d7',
            fontWeight: 700,
            fontSize: 15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        <div style={{ color: '#a3e635', fontSize: 11, opacity: 0.8 }}>
          {archetype}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {isCurrentPlanet ? (
          <div style={{ color: '#a3e635', fontSize: 13, padding: '8px 12px' }}>
            Здесь ✓
          </div>
        ) : isTransit ? (
          <div style={{ color: '#6b7280', fontSize: 13, padding: '8px 12px' }}>
            В пути...
          </div>
        ) : (
          <button
            type="button"
            onClick={onFly}
            style={{
              padding: '8px 20px',
              background: 'linear-gradient(180deg, #4ade80 0%, #16a34a 100%)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            Лететь 🚀
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.5)',
            fontSize: 16,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  )
}
