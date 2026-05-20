import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { fmt, fmtRate } from '../../utils/formatting'
import { useCosmosUnlocked } from '../../utils/cosmosGate'
import { getRareBoxThreshold } from '../../game/config/upgrades'

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
  const boxOpenCount = useGameStore((s) => s.boxOpenCount)
  const rareBoxSpeed = useGameStore((s) => s.upgrades.rareBoxSpeed)
  const rareBoxProgress = Math.min(
    boxOpenCount / getRareBoxThreshold(rareBoxSpeed),
    1,
  )
  const essence = useGameStore((s) => s.essence)
  const serums = useGameStore((s) => s.serums)
  useGameStore((s) => s.numberFormat) // subscribe to format changes
  // Cosmos gate — отображаем essence + серум только после unlock'а космоса.
  const cosmosUnlocked = useCosmosUnlocked()

  const multiplier = l18GoldMultiplier(l18MergesCount)
  const bonusPct = Math.round((multiplier - 1) * 1000) / 10 // 1 decimal: 12.5

  // Total серум across all elements (single counter, не per-element).
  const totalSerum = cosmosUnlocked
    ? Object.values(serums).reduce((sum, n) => sum + (n || 0), 0)
    : 0

  return (
    <div
      className="ff-bar flex flex-col w-full h-full px-3"
      style={{
        pointerEvents: 'auto',
        // 54px gap сверху чтобы content не залезал под Telegram header кнопки
        // (close + ⋮) когда WebApp в fullscreen mode.
        paddingTop: 54,
        paddingBottom: 12,
      }}
    >
      <div
        className="grid items-center w-full flex-1"
        style={{ gridTemplateColumns: '1fr auto 1fr' }}
      >
      <div className="flex flex-col items-start gap-0.5">
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
              💎 {fmt(essence)}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#a78bfa',
                textShadow: '0 1px 0 rgba(0,0,0,0.4)',
                lineHeight: 1.2,
              }}
              title="Серум (все элементы)"
            >
              🧪 {fmt(totalSerum)}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col items-center" style={{ marginTop: 24, gap: 2 }}>
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

      <div className="justify-self-end flex flex-col items-end gap-2" style={{ marginTop: 34, marginRight: 16 }}>
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
        }}
      />
    </div>
  )
}

function RareBoxProgress({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100)
  const isReady = pct >= 100
  return (
    <div className="relative" style={{ marginLeft: 0, marginRight: 4, width: 'calc(100% - 4px)' }}>
      <div className="ff-progress-track w-full h-1.5" style={{ borderRadius: 0 }}>
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
          fontSize: 18,
          pointerEvents: 'none',
        }}
      >
        🎁
      </div>
    </div>
  )
}
