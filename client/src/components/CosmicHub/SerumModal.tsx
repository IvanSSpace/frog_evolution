// Phase 25-03: SerumModal dark theme + pink apply CTA
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { SerumInventoryTab } from './SerumInventoryTab'

interface Props {
  onClose: () => void
}

export function SerumModal({ onClose }: Props) {
  const { t } = useTranslation()

  return createPortal(
    <>
      {/* Backdrop (full-screen dim + blur, click → close) */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          pointerEvents: 'auto',
        }}
        aria-hidden
      />
      {/* Modal container — dark cosmic theme */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '12%',
          bottom: '13%',
          left: 0,
          right: 0,
          zIndex: 100,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: '#1a2e1a',
          border: '2px solid rgba(255,255,255,0.15)',
          borderRadius: 16,
          color: '#fff',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
        className="ff-fade"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            // Subtle pink accent underline (Phase 25 design tokens)
            backgroundImage:
              'linear-gradient(180deg, rgba(236,72,153,0.06) 0%, rgba(236,72,153,0) 100%)',
          }}
        >
          <div className="flex items-center gap-2">
            <img
              src="/genBottle.svg"
              alt="serum"
              style={{
                height: 40,
                width: 'auto',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }}
            />
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: '#fff',
                textShadow: '0 1px 0 rgba(0,0,0,0.4)',
                letterSpacing: 0.5,
                margin: 0,
              }}
            >
              {t('cosmic_hub.tab_serums')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('settings_modal.close')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(236,72,153,0.85)',
              fontSize: 18,
              fontWeight: 800,
              cursor: 'pointer',
              touchAction: 'manipulation',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'color 120ms ease-out, border-color 120ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ec4899'
              e.currentTarget.style.borderColor = 'rgba(236,72,153,0.6)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(236,72,153,0.85)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <SerumInventoryTab onClose={onClose} />
        </div>
      </div>
    </>,
    document.body,
  )
}
