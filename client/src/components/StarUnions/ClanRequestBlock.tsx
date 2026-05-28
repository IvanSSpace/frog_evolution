import { useState, useEffect } from 'react'
import type { ClanRequestDto, ClanRequestType } from '../../api/clan'

interface Props {
  req: ClanRequestDto
  canDonate: boolean
  onDonateClick: (req: ClanRequestDto) => void
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

export function ClanRequestBlock({ req, canDonate, onDonateClick }: Props) {
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
    <div className="ff-card px-3 py-2 text-sm my-1">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">{TYPE_ICON[req.type]}</span>
        <span className="flex-1" style={{ color: '#2f1f0e' }}>Нужно: {label}</span>
        {!req.completed && (
          <span className="text-xs" style={{ color: '#7a5a2f' }}>⏱ {formatTimeLeft(req.expiresAt)}</span>
        )}
      </div>
      <div className="ff-progress-track h-2 mb-2">
        <div
          className="ff-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: '#7a5a2f' }}>
          {Number(req.currentAmount).toLocaleString()} / {Number(req.targetAmount).toLocaleString()}
        </span>
        <button
          disabled={req.completed || !canDonate}
          onClick={() => onDonateClick(req)}
          className={`ff-btn text-xs py-1.5 px-3 ${req.completed ? 'ff-btn-grey' : 'ff-btn-green'}`}
        >
          {req.completed ? '✓ Готово' : 'Пожертвовать'}
        </button>
      </div>
    </div>
  )
}
