// Phase 16: «Найди скрытое» (hot-spot mission).

import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  onComplete: (score: number) => void
}

interface Spot {
  x: number  // 0..1
  y: number
  found: boolean
}

const TOTAL_SPOTS = 5
const TOTAL_MS = 20_000
const PER_SPOT_MS = 4_000
const HIT_RADIUS = 0.08  // ~8% от площади (generous touch)

export function HotSpotMission({ onComplete }: Props) {
  const { t } = useTranslation()
  const [spots, setSpots] = useState<Spot[]>(() =>
    Array.from({ length: TOTAL_SPOTS }, () => ({
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
      found: false,
    })),
  )
  const [activeIdx, setActiveIdx] = useState(0)
  const [remainingMs, setRemainingMs] = useState(TOTAL_MS)
  const finishedRef = useRef(false)
  const spotsRef = useRef(spots)
  const activeIdxRef = useRef(0)

  // Sync refs со state
  useEffect(() => { spotsRef.current = spots }, [spots])
  useEffect(() => { activeIdxRef.current = activeIdx }, [activeIdx])

  useEffect(() => {
    const startedAt = performance.now()
    const id = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      const remaining = TOTAL_MS - elapsed
      // Auto-advance к next spot каждые PER_SPOT_MS (если не найден manually)
      const expectedIdx = Math.min(TOTAL_SPOTS - 1, Math.floor(elapsed / PER_SPOT_MS))
      if (expectedIdx !== activeIdxRef.current && !finishedRef.current) {
        setActiveIdx(expectedIdx)
      }
      if (remaining <= 0 && !finishedRef.current) {
        finishedRef.current = true
        window.clearInterval(id)
        const found = spotsRef.current.filter((s) => s.found).length
        onComplete(found / TOTAL_SPOTS)
      } else {
        setRemainingMs(Math.max(0, remaining))
      }
    }, 200)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAreaTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (finishedRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const idx = activeIdxRef.current
    const target = spotsRef.current[idx]
    if (!target || target.found) return
    const dx = px - target.x
    const dy = py - target.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < HIT_RADIUS) {
      const next = idx + 1
      setSpots((arr) => arr.map((s, i) => i === idx ? { ...s, found: true } : s))
      if (next >= TOTAL_SPOTS) {
        finishedRef.current = true
        setTimeout(() => onComplete(1.0), 0)
      } else {
        setActiveIdx(next)
      }
    }
  }

  const found = spots.filter((s) => s.found).length

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-white/80 text-sm">
        {t('mission.hotspot_label', { found, total: TOTAL_SPOTS })}
      </div>
      <div
        onClick={handleAreaTap}
        className="relative w-72 h-72 bg-gradient-to-br from-purple-900 to-blue-900 rounded-lg cursor-crosshair overflow-hidden"
      >
        {/* Hint: показать area-glow вокруг текущего spot */}
        {spots[activeIdx] && !spots[activeIdx].found && (
          <div
            className="absolute w-16 h-16 rounded-full bg-yellow-300/10 animate-pulse pointer-events-none"
            style={{
              left: `${spots[activeIdx].x * 100}%`,
              top: `${spots[activeIdx].y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}
        {/* Found dots */}
        {spots.filter((s) => s.found).map((s, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full bg-emerald-400"
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>
      <div className="text-white/60 text-xs">
        {t('mission.time_left', { secs: Math.ceil(remainingMs / 1000) })}
      </div>
    </div>
  )
}
