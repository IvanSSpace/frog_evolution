import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TintedFrog } from './TintedFrog'
import { FROG_LEVELS } from '../../game/config/frogs'
import { useGameStore } from '../../store/gameStore'
import { useModalLock } from '../../utils/modalLock'

type Props = {
  minLevel: number
  maxLevel: number
  onClose: (wonLevel: number) => void
}

const SPIN_DURATION = 2200
const REEL_ITEMS = 20
const ITEM_HEIGHT = 88
const INTRO_DURATION = 1600

export function RareCrateModal({ minLevel, maxLevel, onClose }: Props) {
  useModalLock()
  const { t } = useTranslation()
  const [phase, setPhase] = useState<'intro' | 'spinning' | 'result'>('intro')

  // Eligible levels: только те, что юзер открыл, в пределах [minLevel..maxLevel].
  // Admin флаг `unlock_all_frogs` снимает ограничение (используется в FrogShopModal).
  // Fallback на [minLevel] если пересечение пустое (graceful — не падаем).
  const discoveredLevels = useGameStore((s) => s.discoveredLevels)
  const hasUnlockAll = useGameStore((s) =>
    s.devFlags.includes('unlock_all_frogs'),
  )
  const eligibleLevels = (() => {
    const range: number[] = []
    for (let l = minLevel; l <= maxLevel; l++) range.push(l)
    if (hasUnlockAll) return range
    const filtered = range.filter((l) => discoveredLevels.includes(l))
    return filtered.length > 0 ? filtered : [minLevel]
  })()

  const wonLevelRef = useRef<number>(
    eligibleLevels[Math.floor(Math.random() * eligibleLevels.length)],
  )
  const wonLevel = wonLevelRef.current

  // finalOffset: item at index 18 centered in 2-item window (height=176px, center=88px)
  // center of item 18 = 18*88 + 44 = 1628px => offset = -(1628 - 88) = -1540px
  const finalOffset = -1540

  const reelRef = useRef<HTMLDivElement>(null)

  const [introStage, setIntroStage] = useState<'in' | 'shake' | 'burst'>('in')

  useEffect(() => {
    const t1 = setTimeout(() => setIntroStage('shake'), 400)
    const t2 = setTimeout(() => setIntroStage('burst'), 1200)
    const t3 = setTimeout(() => setPhase('spinning'), INTRO_DURATION)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'spinning') return
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
  }, [phase])

  const reelLevels: number[] = Array.from({ length: REEL_ITEMS }, (_, i) => {
    if (i === REEL_ITEMS - 2 || i === REEL_ITEMS - 1) return wonLevel
    return eligibleLevels[Math.floor(Math.random() * eligibleLevels.length)]
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
            overflow: 'visible',
            border: phase === 'intro' ? '4px solid transparent' : '4px solid #b8860b',
            borderRadius: 16,
            background: phase === 'intro' ? 'transparent' : 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
            boxShadow: phase === 'intro' ? 'none' : '0 0 24px rgba(255,215,0,0.4), inset 0 0 12px rgba(0,0,0,0.5)',
            position: 'relative',
            transition: 'background 300ms ease, border-color 300ms ease, box-shadow 300ms ease',
          }}
        >
          {phase === 'intro' && (
            <div
              className={`ff-box-${introStage}`}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              <img
                src="/box.webp"
                alt=""
                style={{
                  width: 260,
                  height: 'auto',
                  filter: 'drop-shadow(0 0 22px rgba(255,215,0,0.7))',
                }}
              />
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: phase === 'intro' ? 0 : 1,
              transition: 'opacity 250ms ease-in',
              overflow: 'hidden',
              borderRadius: 12,
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
        @keyframes ffBoxIn {
          0% { transform: scale(0) rotate(-25deg); opacity: 0; }
          60% { transform: scale(1.2) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes ffBoxShake {
          0%, 100% { transform: translateX(0) rotate(0); }
          10% { transform: translateX(-6px) rotate(-4deg); }
          20% { transform: translateX(6px) rotate(4deg); }
          30% { transform: translateX(-6px) rotate(-4deg); }
          40% { transform: translateX(6px) rotate(4deg); }
          50% { transform: translateX(-4px) rotate(-3deg); }
          60% { transform: translateX(4px) rotate(3deg); }
          70% { transform: translateX(-3px) rotate(-2deg); }
          80% { transform: translateX(3px) rotate(2deg); }
          90% { transform: translateX(-1px) rotate(-1deg); }
        }
        @keyframes ffBoxBurst {
          0% { transform: scale(1); opacity: 1; filter: drop-shadow(0 0 18px rgba(255,215,0,0.65)) brightness(1); }
          40% { transform: scale(1.5); opacity: 1; filter: drop-shadow(0 0 36px rgba(255,215,0,1)) brightness(2.2); }
          100% { transform: scale(2.6); opacity: 0; filter: drop-shadow(0 0 50px rgba(255,255,255,1)) brightness(3); }
        }
        .ff-box-in img { animation: ffBoxIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .ff-box-shake img { animation: ffBoxShake 800ms ease-in-out both; }
        .ff-box-burst img { animation: ffBoxBurst 400ms ease-out both; }
      `}</style>
    </div>
  )
}
