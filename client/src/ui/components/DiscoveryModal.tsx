import { useTranslation } from 'react-i18next'
import { configForLevel } from '../../game/config/frogs'
import { TintedFrog } from './TintedFrog'

type Props = {
  level: number
  onClose: () => void
}

export function DiscoveryModal({ level, onClose }: Props) {
  console.log('[DiscoveryModal] render level=', level)
  const { t } = useTranslation()
  const cfg = configForLevel(level)
  const frogName = t(`frogs.${level}`)

  return (
    <div
      className="ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        pointerEvents: 'auto',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.92) 70%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: '95%',
          clipPath: 'polygon(40% 0%, 60% 0%, 110% 100%, -10% 100%)',
          background:
            'linear-gradient(180deg, rgba(255,229,128,0.45) 0%, rgba(255,210,80,0.18) 50%, rgba(255,200,60,0.02) 100%)',
          pointerEvents: 'none',
          filter: 'blur(8px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '95%',
          height: '85%',
          clipPath: 'polygon(46% 0%, 54% 0%, 100% 100%, 0% 100%)',
          background:
            'linear-gradient(180deg, rgba(255,238,140,0.85) 0%, rgba(255,220,90,0.4) 50%, rgba(255,200,60,0.05) 100%)',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1.2px)',
          backgroundSize: '40px 40px',
          maskImage:
            'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
          opacity: 0.35,
          animation: 'ffShimmer 3s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      <div
        className="relative flex flex-col items-center"
        style={{ zIndex: 1 }}
      >
        <div
          className="ff-display text-center leading-[0.95] ff-pop"
          style={{
            fontSize: 'clamp(28px, 8.5vw, 44px)',
            color: '#ffe066',
            letterSpacing: 1.5,
            whiteSpace: 'pre-line',
            textShadow:
              '-3px 0 0 #7f1d1d, 3px 0 0 #7f1d1d, 0 -3px 0 #7f1d1d, 0 3px 0 #7f1d1d, -3px -3px 0 #7f1d1d, 3px -3px 0 #7f1d1d, -3px 3px 0 #7f1d1d, 3px 3px 0 #7f1d1d, 0 6px 0 rgba(0,0,0,0.45)',
          }}
        >
          {t('discovery.title')}
        </div>

        <TintedFrog
          path={cfg.path}
          tint={cfg.tint}
          alt={frogName}
          className="w-44 h-44 object-contain mt-6"
          style={{
            filter:
              'drop-shadow(0 0 32px rgba(255,230,100,0.85)) drop-shadow(0 8px 12px rgba(0,0,0,0.45))',
            animation: 'discFloat 2.4s ease-in-out infinite',
          }}
        />

        <div
          className="ff-display mt-5 px-6 py-2.5"
          style={{
            fontSize: 'clamp(26px, 8vw, 38px)',
            color: '#fff',
            letterSpacing: 1,
            background: 'linear-gradient(180deg, #34d399 0%, #047857 100%)',
            border: '4px solid #064e3b',
            borderBottomWidth: 7,
            borderRadius: 18,
            boxShadow:
              'inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 rgba(0,0,0,0.35), 0 10px 24px rgba(0,0,0,0.45)',
            textShadow:
              '0 3px 0 rgba(0,0,0,0.4), 0 0 16px rgba(255,255,255,0.3)',
          }}
        >
          {frogName}
        </div>

        <button
          onClick={onClose}
          className="ff-btn ff-btn-yellow mt-8 text-lg"
          style={{
            paddingLeft: 28,
            paddingRight: 28,
            paddingTop: 12,
            paddingBottom: 12,
          }}
        >
          {t('discovery.continue')}
        </button>
      </div>

      <style>{`
        @keyframes discFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.05); }
        }
      `}</style>
    </div>
  )
}
