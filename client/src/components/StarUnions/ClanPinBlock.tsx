import { useState, useEffect } from 'react'
import type { ClanPinDto } from '../../api/clan'

interface Props {
  pin: ClanPinDto | null
}

function formatTimeLeft(expiresAt: string): string {
  const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now())
  const totalMin = Math.floor(diff / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}ч ${m}м`
  return `${m}м`
}

export function ClanPinBlock({ pin }: Props) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!pin) return
    const id = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [pin])

  if (!pin) return null

  return (
    <div
      className="mx-3 mt-2 rounded-lg px-3 py-2 text-sm"
      style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
    >
      <div className="font-semibold text-white/90">🗺️ Маршрут союза: {pin.text}</div>
      <div className="text-xs text-white/50 mt-0.5">
        Истекает через {formatTimeLeft(pin.expiresAt)}
      </div>
    </div>
  )
}
