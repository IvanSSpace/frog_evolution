import { useTranslation } from 'react-i18next'
import { SerumInventoryTab } from './SerumInventoryTab'
import { useModalLock } from '../../utils/modalLock'

interface Props {
  onClose: () => void
}

export function SerumModal({ onClose }: Props) {
  useModalLock()
  const { t } = useTranslation()

  return (
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'auto',
        padding: '0 12px calc(9vh + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop relative"
        style={{
          width: '100%',
          maxWidth: 380,
          height: 'calc(100dvh - var(--ui-top-offset) - var(--tg-chrome-pad) - 9vh)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="relative flex items-center justify-between px-4 pt-3 pb-2"
          style={{ borderBottom: '1px solid rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-xl"
            style={{ color: '#15803d', letterSpacing: 1.5 }}
          >
            {t('cosmic_hub.tab_serums')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('settings_modal.close')}
            className="ff-tile w-8 h-8 text-base"
            style={{
              ['--ff-tile-from' as never]: '#fca5a5',
              ['--ff-tile-to' as never]: '#dc2626',
              ['--ff-tile-border' as never]: '#7f1d1d',
              color: '#fff',
            }}
          >
            {t('settings_modal.close')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SerumInventoryTab onClose={onClose} />
        </div>
      </div>
    </div>
  )
}
