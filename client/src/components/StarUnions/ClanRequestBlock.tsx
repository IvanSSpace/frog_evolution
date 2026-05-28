import { useState, useEffect } from 'react'
import type { ClanRequestDto, ClanRequestType } from '../../api/clan'

interface Props {
  req: ClanRequestDto
  canDonate: boolean
}

const TYPE_ICON: Record<ClanRequestType, string> = {
  SLIME: '💧',
  ESSENCE: '💎',
  SERUM: '🧪',
}

const TYPE_LABEL: Record<ClanRequestType, string> = {
  SLIME: 'Слизь',
  ESSENCE: 'Сущность',
  SERUM: 'Сыворотка',
}

function formatTimeLeft(expiresAt: string): string {
  const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now())
  const totalMin = Math.floor(diff / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}ч ${m}м`
  return `${m}м`
}

export function ClanRequestBlock({ req, canDonate }: Props) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (req.completed) return
    const id = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [req.completed])

  const current = Number(req.currentAmount)
  const target = Number(req.targetAmount)
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0

  const label = TYPE_LABEL[req.type] + (req.element ? ` (${req.element})` : '')

  return (
    <div
      className="rounded-lg px-3 py-2 text-sm my-1"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">{TYPE_ICON[req.type]}</span>
        <span className="text-white/80 flex-1">Нужно: {label}</span>
        {!req.completed && (
          <span className="text-xs text-white/40">⏱ {formatTimeLeft(req.expiresAt)}</span>
        )}
      </div>
      <div className="h-1.5 rounded-full mb-2" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: req.completed ? '#22c55e' : '#6366f1' }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">
          {Number(req.currentAmount).toLocaleString()} / {Number(req.targetAmount).toLocaleString()}
        </span>
        <button
          disabled={req.completed || !canDonate}
          onClick={() => alert('P5: donate dialog')}
          className="px-2 py-1 rounded text-xs font-semibold transition-opacity"
          style={{
            background: req.completed ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.4)',
            color: req.completed ? '#86efac' : '#c7d2fe',
            opacity: req.completed ? 0.7 : 1,
            cursor: req.completed ? 'default' : 'pointer',
          }}
        >
          {req.completed ? 'Готово' : 'Пожертвовать'}
        </button>
      </div>
    </div>
  )
}
