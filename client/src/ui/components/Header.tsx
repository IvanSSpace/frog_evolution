import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useGameStore,
  activeTemporaryBuffFraction,
} from '../../store/gameStore'
import { fmt, fmtRate } from '../../utils/formatting'
import { useCosmosUnlocked } from '../../utils/cosmosGate'
import { getRareBoxThreshold } from '../../game/config/upgrades'
import { getEvolutionBonusFraction } from '../../game/config/evolution'

function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(h)}:${pad(m)}`
}

export function Header({ onOpenIncome }: { onOpenIncome?: () => void }) {
  const { t } = useTranslation()
  const gold = useGameStore((s) => s.gold)
  const incomePerSec = useGameStore((s) => s.incomePerSec)
  const boxProgress = useGameStore((s) => s.boxProgress)
  const boxWaiting = useGameStore((s) => s.boxWaiting)
  const boxOpenCount = useGameStore((s) => s.boxOpenCount)
  const rareBoxSpeed = useGameStore((s) => s.upgrades.rareBoxSpeed)
  const rareBoxProgress = Math.min(
    boxOpenCount / getRareBoxThreshold(rareBoxSpeed),
    1,
  )
  const essence = useGameStore((s) => s.essence)
  const frogTiers = useGameStore((s) => s.frogTiers)
  const temporaryIncomeBuff = useGameStore((s) => s.temporaryIncomeBuff)
  useGameStore((s) => s.numberFormat) // subscribe to format changes
  const cosmosUnlocked = useCosmosUnlocked()

  // Tick раз в секунду пока buff активен — для countdown'а.
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!temporaryIncomeBuff || temporaryIncomeBuff.until <= now) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [temporaryIncomeBuff, now])

  // 2026-05-23: permanent % теперь только эволюция; временный — buff после
  // L18+L18 merge'а. Мирор формулы `addGold`.
  const evolutionFraction = getEvolutionBonusFraction(frogTiers)
  const tempFraction = activeTemporaryBuffFraction(temporaryIncomeBuff, now)
  const multiplier = 1 + evolutionFraction + tempFraction
  const bonusPct = Math.round((multiplier - 1) * 1000) / 10
  const tempActive = tempFraction > 0
  const tempRemaining = tempActive
    ? Math.max(0, (temporaryIncomeBuff?.until ?? 0) - now)
    : 0

  return (
    <div
      className="ff-bar flex flex-col w-full h-full px-3"
      style={{
        pointerEvents: 'auto',
        // var(--tg-chrome-pad) — 54px на mobile (TG fullscreen header), 0 на desktop.
        paddingTop: 'var(--tg-chrome-pad)',
        paddingBottom: 12,
      }}
    >
      <div
        className="grid items-center w-full flex-1"
        style={{ gridTemplateColumns: '1fr auto 1fr' }}
      >
        <div
          className="flex flex-col items-start gap-0.5"
          style={{ marginTop: 34 }}
        >
          {cosmosUnlocked && (
            <>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fde047',
                  textShadow: '0 1px 0 rgba(0,0,0,0.4)',
                  lineHeight: 1.2,
                }}
                title="Эссенция"
              >
                <img
                  src="/essence.png"
                  alt=""
                  style={{
                    width: '1.2em',
                    height: '1.2em',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                    marginRight: 2,
                  }}
                />
                {fmt(essence)}
              </div>
            </>
          )}
        </div>

        <div
          className="flex flex-col items-center"
          onClick={onOpenIncome}
          style={{
            marginTop: 24,
            gap: 2,
            position: 'relative',
            cursor: onOpenIncome ? 'pointer' : undefined,
          }}
        >
          <div className="ff-balance">
            <img
              src="/goo.svg"
              style={{
                width: '1.4em',
                height: '1.4em',
                display: 'inline-block',
                verticalAlign: 'middle',
              }}
              alt=""
            />
            <span className="tabular-nums text-base">{fmt(gold)}</span>
          </div>
          <div
            className="ff-display tabular-nums"
            style={{
              fontSize: '11px',
              color: '#fde047',
              textShadow: '0 1px 0 rgba(0,0,0,0.45)',
              letterSpacing: '0.3px',
              marginTop: 0,
            }}
          >
            +{fmtRate(incomePerSec * multiplier)}{' '}
            <img
              src="/goo.svg"
              style={{
                width: '0.9em',
                height: '0.9em',
                display: 'inline-block',
                verticalAlign: 'middle',
                marginRight: 1,
              }}
              alt=""
            />
            {t('header.per_sec')}
            {bonusPct > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 10,
                  color: '#ec4899',
                  fontWeight: 700,
                }}
              >
                ×{multiplier.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}{' '}
                (+{bonusPct}%)
              </span>
            )}
            {tempActive && (
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 10,
                  color: '#a855f7',
                  fontWeight: 700,
                }}
                title="Временный бафф к доходу"
              >
                ⏱ {formatCountdown(tempRemaining)}
              </span>
            )}
          </div>
        </div>

        <div
          className="justify-self-end flex flex-col items-end gap-2"
          style={{ marginTop: 34, marginRight: 16 }}
        >
          <BoxProgress progress={boxProgress} waiting={boxWaiting} />
        </div>
      </div>

      <RareBoxProgress progress={rareBoxProgress} />
    </div>
  )
}

function BoxProgress({
  progress,
  waiting,
}: {
  progress: number
  waiting: boolean
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)))
  const reveal = 100 - pct
  return (
    <div
      className={`relative inline-block leading-none ${waiting ? 'animate-pulse' : ''}`}
      style={{ width: 32, height: 32 }}
    >
      <img
        src="/box.webp"
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          filter: 'brightness(0.3) saturate(0.4)',
        }}
      />
      <img
        src="/box.webp"
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          clipPath: `inset(${reveal}% 0 0 0)`,
          transition: 'clip-path 250ms linear',
        }}
      />
    </div>
  )
}

function RareBoxProgress({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100)
  const isReady = pct >= 100
  return (
    <div
      className="relative"
      style={{ marginLeft: 0, marginRight: 4, width: 'calc(100% - 4px)' }}
    >
      <div
        className="ff-progress-track w-full h-1.5"
        style={{ borderRadius: 0 }}
      >
        <div
          className={`ff-progress-fill ${isReady ? 'animate-pulse' : ''}`}
          style={{
            width: `${pct}%`,
            borderRadius: 0,
            background: isReady
              ? 'linear-gradient(90deg, #fcd34d, #f59e0b)'
              : 'linear-gradient(90deg, #60a5fa, #2563eb)',
          }}
        />
      </div>
      <div
        className={`absolute leading-none ${isReady ? 'animate-pulse' : ''}`}
        style={{
          right: 0,
          top: '50%',
          transform: 'translate(50%, -50%)',
          width: 26,
          height: 26,
          pointerEvents: 'none',
        }}
      >
        {/* box.webp с золотым tint (SYNC с RARE_BOX_TINT 0xffd700 в Phaser). */}
        <img
          src="/box.webp"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter:
              'brightness(1.15) sepia(0.85) saturate(2.6) hue-rotate(-12deg) drop-shadow(0 1px 1px rgba(0,0,0,0.45))',
          }}
        />
      </div>
    </div>
  )
}
