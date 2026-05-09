import { useTranslation } from 'react-i18next'
import { fmt } from '../../utils/formatting'

type Props = {
  earned: number
  hours: number
  onClose: () => void
}

export function WelcomeBackModal({ earned, hours, onClose }: Props) {
  const { t } = useTranslation()

  return (
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop"
        style={{ width: '100%', maxWidth: 320 }}
      >
        <div className="flex flex-col items-center px-6 py-6 text-center">
          <div
            className="text-7xl"
            style={{
              filter: 'drop-shadow(0 6px 0 rgba(0,0,0,0.25))',
              animation: 'discFloat 2.2s ease-in-out infinite',
            }}
          >
            🚜
          </div>

          <h2
            className="ff-display ff-stroke-white mt-3 text-2xl"
            style={{ color: '#15803d', letterSpacing: 1 }}
          >
            {t('welcome_back.title')}
          </h2>
          <p className="ff-body mt-2 text-sm font-bold text-emerald-800">
            {t('welcome_back.worked', { hours: hours.toFixed(1) })}
          </p>

          <div
            className="ff-display mt-4 inline-flex items-center gap-2 px-5 py-3 tabular-nums"
            style={{
              background: 'linear-gradient(180deg, #fde047 0%, #d97706 100%)',
              border: '4px solid #78350f',
              borderBottomWidth: 7,
              borderRadius: 18,
              color: '#3a2207',
              fontSize: 26,
              letterSpacing: 0.5,
              textShadow: '0 2px 0 rgba(255,255,255,0.45)',
              boxShadow:
                'inset 0 2px 0 rgba(255,255,255,0.5), 0 6px 0 rgba(0,0,0,0.25)',
            }}
          >
            <img
              src="/goo.svg"
              style={{
                width: '1.3em',
                height: '1.3em',
                display: 'inline-block',
                verticalAlign: 'middle',
              }}
              alt=""
            />
            <span>+{fmt(earned)}</span>
          </div>

          <button
            onClick={onClose}
            className="ff-btn ff-btn-green mt-6 text-base w-full"
            style={{ paddingTop: 12, paddingBottom: 12 }}
          >
            {t('welcome_back.claim')}
          </button>
        </div>
      </div>
    </div>
  )
}
