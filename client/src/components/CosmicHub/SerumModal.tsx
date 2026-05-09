import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { SerumInventoryTab } from './SerumInventoryTab'

interface Props {
  onClose: () => void
}

export function SerumModal({ onClose }: Props) {
  const { t } = useTranslation()

  return createPortal(
    <div
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
        background: 'linear-gradient(180deg, #f5fbe9 0%, #d9eeb6 100%)',
        border: '4px solid #4d6b1f',
        borderRadius: 0,
        boxShadow: '0 0 0 3px #f7ffe0 inset',
      }}
      className="ff-fade"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0"
        style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
      >
        <div className="flex items-center gap-2">
          <img
            src="/genBottle.svg"
            alt="serum"
            style={{
              height: 48,
              width: 'auto',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
            }}
          />
          <h2
            className="ff-display ff-stroke-white text-3xl"
            style={{ color: '#15803d', letterSpacing: 1.5 }}
          >
            {t('cosmic_hub.tab_serums')}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('settings_modal.close')}
          className="ff-tile w-10 h-10 text-xl flex-shrink-0"
          style={{
            ['--ff-tile-from' as never]: '#fca5a5',
            ['--ff-tile-to' as never]: '#dc2626',
            ['--ff-tile-border' as never]: '#7f1d1d',
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <SerumInventoryTab onClose={onClose} />
      </div>
    </div>,
    document.body,
  )
}
