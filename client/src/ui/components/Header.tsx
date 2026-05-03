import { useGameStore } from '../../store/gameStore'

export function Header() {
  const gold = useGameStore((s) => s.gold)

  return (
    <div
      className="w-full flex items-center justify-between px-4 py-3"
      style={{ pointerEvents: 'auto', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
    >
      <span className="text-white font-bold text-lg">🐸 Frog Evolution</span>
      <div className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-400/40 rounded-full px-3 py-1">
        <span className="text-yellow-300 text-sm">💩</span>
        <span className="text-yellow-200 font-bold text-sm tabular-nums">{gold}</span>
      </div>
    </div>
  )
}
