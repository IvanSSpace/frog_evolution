import { useState, useEffect } from 'react'
import type { ClanPinDto } from '../../api/clan'

interface Props {
  pin: ClanPinDto | null
  canDelete?: boolean
  onDelete?: () => void
}

function formatTimeLeft(expiresAt: string): string {
  const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now())
  const totalMin = Math.floor(diff / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}ч ${m}м`
  return `${m}м`
}

export function ClanPinBlock({ pin, canDelete, onDelete }: Props) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!pin) return
    const id = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [pin])

  if (!pin) return null

  return (
    <div
      className="ff-card flex-shrink-0 relative"
      style={{ margin: '0 0 8px', padding: '10px 14px', borderColor: '#b45309' }}
    >
      <div
        className="text-xs ff-display mb-1"
        style={{ color: '#92400e', letterSpacing: 1 }}
      >
        🗺️ МАРШРУТ
      </div>
      <div className="text-sm pr-6" style={{ color: '#2f1f0e' }}>{pin.text}</div>
      <div className="text-xs mt-0.5" style={{ color: '#7a5a2f' }}>
        Истекает через {formatTimeLeft(pin.expiresAt)}
      </div>
      {canDelete && (
        <button
          onClick={() => {
            if (window.confirm('Удалить маршрут?')) onDelete?.()
          }}
          className="ff-tile absolute top-2 right-2"
          style={{
            width: 28,
            height: 28,
            fontSize: 14,
            ['--ff-tile-from' as never]: '#fca5a5',
            ['--ff-tile-to' as never]: '#dc2626',
            ['--ff-tile-border' as never]: '#7f1d1d',
            color: '#fff',
          }}
          title="Удалить маршрут"
        >
          ✕
        </button>
      )}
    </div>
  )
}
