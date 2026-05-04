import { useGameStore } from '../../store/gameStore'

export function Header() {
  const gold = useGameStore((s) => s.gold)
  const boxProgress = useGameStore((s) => s.boxProgress)
  const boxWaiting = useGameStore((s) => s.boxWaiting)

  return (
    <div
      className="w-full h-full flex items-center justify-between px-4"
      style={{ pointerEvents: 'auto', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
    >
      <div className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-400/40 rounded-full px-3 py-1">
        <span className="text-yellow-300 text-sm">💩</span>
        <span className="text-yellow-200 font-bold text-sm tabular-nums">{gold}</span>
      </div>

      <BoxProgress progress={boxProgress} waiting={boxWaiting} />
    </div>
  )
}

function BoxProgress({ progress, waiting }: { progress: number; waiting: boolean }) {
  const pct = Math.round(progress * 100)
  const fillColor = waiting ? '#ef4444' : '#facc15'

  return (
    <div className="flex flex-col items-end gap-1">
      <div className={`flex items-center gap-1 ${waiting ? 'animate-pulse' : ''}`}>
        <span className="text-xl leading-none">📦</span>
      </div>
      <div className="w-20 h-2 rounded-full bg-white/20 overflow-hidden">
        <div
          className="h-full transition-[width] duration-100 ease-linear"
          style={{ width: `${pct}%`, background: fillColor }}
        />
      </div>
    </div>
  )
}
