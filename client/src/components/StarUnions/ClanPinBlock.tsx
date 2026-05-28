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
      className="mx-3 mt-2 rounded-lg px-3 py-2 text-sm relative"
      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}
    >
      {canDelete && (
        <button
          onClick={() => {
            if (window.confirm('Удалить маршрут?')) onDelete?.()
          }}
          className="absolute top-1.5 right-1.5 text-xs leading-none px-1"
          style={{ color: '#6b7280' }}
          title="Удалить маршрут"
        >
          ✕
        </button>
      )}
      <div className="font-semibold" style={{ color: '#1f2937' }}>🗺️ Маршрут союза: {pin.text}</div>
      <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
        Истекает через {formatTimeLeft(pin.expiresAt)}
      </div>
    </div>
  )
}
