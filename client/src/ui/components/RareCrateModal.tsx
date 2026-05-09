import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TintedFrog } from './TintedFrog'
import { FROG_LEVELS } from '../../game/config/frogs'

type Props = {
  minLevel: number
  maxLevel: number
  onClose: (wonLevel: number) => void
}

const SPIN_DURATION = 2200
const REEL_ITEMS = 20
const ITEM_HEIGHT = 88

export function RareCrateModal({ minLevel, maxLevel, onClose }: Props) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<'spinning' | 'result'>('spinning')
  const wonLevelRef = useRef<number>(
    Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel,
  )
  const wonLevel = wonLevelRef.current

  // finalOffset: item at index 18 centered in 2-item window (height=176px, center=88px)
  // center of item 18 = 18*88 + 44 = 1628px => offset = -(1628 - 88) = -1540px
  const finalOffset = -1540

  const reelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reelRef.current) {
      reelRef.current.style.transition = 'none'
      reelRef.current.style.transform = 'translateY(0px)'
      void reelRef.current.offsetHeight

      reelRef.current.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.1, 0, 0.05, 1)`
      reelRef.current.style.transform = `translateY(${finalOffset}px)`
    }

    const timer = setTimeout(() => {
      setPhase('result')
    }, SPIN_DURATION + 100)

    return () => clearTimeout(timer)
  }, [])

  const reelLevels: number[] = Array.from({ length: REEL_ITEMS }, (_, i) => {
    if (i === REEL_ITEMS - 2 || i === REEL_ITEMS - 1) return wonLevel
    return Math.floor(Math.random() * FROG_LEVELS.length) + 1
  })

  const wonName = t(`frogs.${wonLevel}`)

  return (
    <div
      className="ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.93) 70%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          height: '80%',
          background:
            'linear-gradient(180deg, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.05) 60%, transparent 100%)',
          clipPath: 'polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)',
          pointerEvents: 'none',
          filter: 'blur(12px)',
        }}
      />

      <div
        className="relative flex flex-col items-center gap-4"
        style={{ zIndex: 1 }}
      >
        <div
          className="ff-display text-center"
          style={{
            fontSize: 'clamp(22px, 6vw, 32px)',
            color: '#ffd700',
            letterSpacing: 2,
            textShadow: '0 0 20px rgba(255,215,0,0.6), 0 3px 0 rgba(0,0,0,0.5)',
          }}
        >
          {t('rare_crate.title')}
        </div>

        <div
          style={{
            width: 100,
            height: ITEM_HEIGHT * 2 + 4,
            overflow: 'hidden',
            border: '4px solid #b8860b',
            borderRadius: 16,
            background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
            boxShadow:
              '0 0 24px rgba(255,215,0,0.4), inset 0 0 12px rgba(0,0,0,0.5)',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              pointerEvents: 'none',
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.7) 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: ITEM_HEIGHT,
              transform: 'translateY(-50%)',
              border: '2px solid rgba(255,215,0,0.5)',
              zIndex: 3,
              pointerEvents: 'none',
              borderRadius: 4,
            }}
          />

          <div ref={reelRef} style={{ willChange: 'transform' }}>
            {reelLevels.map((level, i) => {
              const cfg = FROG_LEVELS[level - 1]
              return (
                <div
                  key={i}
                  style={{
                    width: 100,
                    height: ITEM_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 8,
                  }}
                >
                  <TintedFrog
                    path={cfg.path}
                    tint={cfg.tint}
                    alt={`level ${level}`}
                    style={{ width: 64, height: 64, objectFit: 'contain' }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div
          style={{
            opacity: phase === 'result' ? 1 : 0,
            transform:
              phase === 'result' ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            className="ff-display px-5 py-2"
            style={{
              fontSize: 'clamp(20px, 6vw, 28px)',
              color: '#fff',
              background: 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)',
              border: '3px solid #92400e',
              borderBottomWidth: 5,
              borderRadius: 14,
              boxShadow:
                'inset 0 2px 0 rgba(255,255,255,0.3), 0 4px 0 rgba(0,0,0,0.3)',
              textShadow: '0 2px 0 rgba(0,0,0,0.3)',
            }}
          >
            {wonName}
          </div>

          <button
            onClick={() => phase === 'result' && onClose(wonLevel)}
            className="ff-btn ff-btn-green text-lg"
            style={{
              paddingLeft: 32,
              paddingRight: 32,
              paddingTop: 12,
              paddingBottom: 12,
              opacity: phase === 'result' ? 1 : 0.3,
              cursor: phase === 'result' ? 'pointer' : 'default',
            }}
          >
            {t('rare_crate.claim')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes rarePulse {
          0%, 100% { box-shadow: 0 0 24px rgba(255,215,0,0.4), inset 0 0 12px rgba(0,0,0,0.5); }
          50% { box-shadow: 0 0 40px rgba(255,215,0,0.7), inset 0 0 12px rgba(0,0,0,0.5); }
        }
      `}</style>
    </div>
  )
}
