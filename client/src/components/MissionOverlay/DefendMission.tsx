// Phase 16: «Защити корабль от 3 вспышек» (defend mission).

import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  onComplete: (score: number) => void
}

interface Flash {
  id: number
  x: number  // 0..1 (relative to overlay)
  y: number
  startMs: number
  durationMs: number  // 1000 (1 sec window)
  hit: boolean
}

const TOTAL_FLASHES = 3

export function DefendMission({ onComplete }: Props) {
  const { t } = useTranslation()
  const [flashes, setFlashes] = useState<Flash[]>([])
  const [hits, setHits] = useState(0)
  const hitsRef = useRef(0)
  const finishedRef = useRef(false)

  useEffect(() => {
    // Spawn 3 вспышки на t = 2s, 7s, 12s
    const spawnTimes = [2000, 7000, 12000]
    const timeouts: number[] = []
    spawnTimes.forEach((tms, i) => {
      timeouts.push(window.setTimeout(() => {
        if (finishedRef.current) return
        setFlashes((arr) => [...arr, {
          id: i,
          x: 0.2 + Math.random() * 0.6,
          y: 0.2 + Math.random() * 0.5,
          startMs: performance.now(),
          durationMs: 1000,
          hit: false,
        }])
      }, tms))
    })
    // Auto-complete на 15s
    const finalTimer = window.setTimeout(() => {
      if (finishedRef.current) return
      finishedRef.current = true
      const score = hitsRef.current / TOTAL_FLASHES
      onComplete(score)
    }, 15_000)
    timeouts.push(finalTimer)

    // Cleanup expired flashes (poll @ 100ms)
    const cleanupId = window.setInterval(() => {
      const now = performance.now()
      setFlashes((arr) => arr.filter((f) => now - f.startMs < f.durationMs || f.hit))
    }, 100)

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id))
      window.clearInterval(cleanupId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFlashTap = (id: number) => {
    setFlashes((arr) => arr.map((f) => f.id === id ? { ...f, hit: true } : f))
    hitsRef.current += 1
    setHits(hitsRef.current)
    if (hitsRef.current >= TOTAL_FLASHES && !finishedRef.current) {
      finishedRef.current = true
      setTimeout(() => onComplete(1.0), 0)
    }
  }

  return (
    <div className="relative w-full h-64 bg-black/30 rounded-lg overflow-hidden">
      <div className="absolute top-2 left-2 text-white/80 text-sm">
        {t('mission.defend_label', { hits })}
      </div>
      {flashes.filter((f) => !f.hit).map((f) => (
        <button
          key={f.id}
          onClick={() => handleFlashTap(f.id)}
          className="absolute w-12 h-12 rounded-full bg-red-500 animate-pulse"
          style={{
            left: `${f.x * 100}%`,
            top: `${f.y * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
          aria-label={t('mission.defend_flash')}
        />
      ))}
    </div>
  )
}
