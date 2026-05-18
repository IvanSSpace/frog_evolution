import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { fmt, fmtRate } from '../../utils/formatting'

// L18+L18 merge bonus multiplier — same formula как в gameStore.addGold.
// Diminishing returns: merge1=+10%, merge2/3=+5%, merge4+=+2.5%.
function l18GoldMultiplier(count: number): number {
  if (count <= 0) return 1
  if (count === 1) return 1.10
  if (count === 2) return 1.15
  return 1.20 + (count - 3) * 0.025
}

export function Header() {
  const { t } = useTranslation()
  const gold = useGameStore((s) => s.gold)
  const incomePerSec = useGameStore((s) => s.incomePerSec)
  const l18MergesCount = useGameStore((s) => s.l18MergesCount)
  const boxProgress = useGameStore((s) => s.boxProgress)
  const boxWaiting = useGameStore((s) => s.boxWaiting)
  const rareBoxProgress = useGameStore((s) => s.rareBoxProgress)
  useGameStore((s) => s.numberFormat) // subscribe to format changes

  const multiplier = l18GoldMultiplier(l18MergesCount)
  const bonusPct = Math.round((multiplier - 1) * 1000) / 10 // 1 decimal: 12.5

  return (
    <div
      className="ff-bar grid items-center w-full h-full px-3"
      style={{
        gridTemplateColumns: '1fr auto 1fr',
        pointerEvents: 'auto',
      }}
    >
      <div />

      <div className="flex flex-col items-center gap-1">
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
          {l18MergesCount > 0 && (
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
        </div>
      </div>

      <div className="justify-self-end flex flex-col items-end gap-2">
        <BoxProgress progress={boxProgress} waiting={boxWaiting} />
        <RareBoxProgress progress={rareBoxProgress} />
      </div>
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
  const pct = Math.round(progress * 100)
  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className={`text-2xl leading-none ${waiting ? 'animate-pulse' : ''}`}
      >
        📦
      </div>
      <div className="ff-progress-track w-24 h-2.5">
        <div
          className={`ff-progress-fill ${waiting ? 'waiting' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function RareBoxProgress({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100)
  const isReady = pct >= 100
  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className={`text-2xl leading-none ${isReady ? 'animate-pulse' : ''}`}
      >
        ✨
      </div>
      <div className="ff-progress-track w-24 h-2.5">
        <div
          className="ff-progress-fill"
          style={{
            width: `${pct}%`,
            background: isReady
              ? 'linear-gradient(90deg, #fcd34d, #f59e0b)'
              : 'linear-gradient(90deg, #c4b5fd, #8b5cf6)',
          }}
        />
      </div>
    </div>
  )
}
