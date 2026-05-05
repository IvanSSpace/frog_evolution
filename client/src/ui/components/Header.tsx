import { useGameStore } from '../../store/gameStore'

const fmt = (n: number) => n.toLocaleString('ru-RU')
const fmtRate = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toFixed(n >= 10 ? 0 : 1)
}

export function Header() {
  const gold = useGameStore((s) => s.gold)
  const incomePerSec = useGameStore((s) => s.incomePerSec)
  const boxProgress = useGameStore((s) => s.boxProgress)
  const boxWaiting = useGameStore((s) => s.boxWaiting)

  return (
    <div
      className="ff-bar grid items-center w-full h-full px-3"
      style={{
        gridTemplateColumns: '1fr auto 1fr',
        pointerEvents: 'auto',
      }}
    >
      {/* Слева — пусто (потом сюда можно положить иконку профиля / уровень локации) */}
      <div />

      {/* Центр — баланс золота + доход/сек */}
      <div className="flex flex-col items-center gap-1">
        <div className="ff-balance">
          <span className="text-xl leading-none">💩</span>
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
          +{fmtRate(incomePerSec)} 💩/сек
        </div>
      </div>

      {/* Справа — прогресс падения коробки */}
      <div className="justify-self-end">
        <BoxProgress progress={boxProgress} waiting={boxWaiting} />
      </div>
    </div>
  )
}

function BoxProgress({ progress, waiting }: { progress: number; waiting: boolean }) {
  const pct = Math.round(progress * 100)
  return (
    <div className="flex flex-col items-end gap-1">
      <div className={`text-2xl leading-none ${waiting ? 'animate-pulse' : ''}`}>📦</div>
      <div className="ff-progress-track w-24 h-2.5">
        <div className={`ff-progress-fill ${waiting ? 'waiting' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
