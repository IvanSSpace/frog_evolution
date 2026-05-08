// Phase 16: «Кликни планету N раз за 30 сек» (rhythm-tap mission).

import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  onComplete: (score: number) => void  // score: 0..1
}

export function RhythmTapMission({ onComplete }: Props) {
  const { t } = useTranslation()
  const targetRef = useRef<number>(15 + Math.floor(Math.random() * 16))  // 15..30
  const [taps, setTaps] = useState(0)
  const [remainingMs, setRemainingMs] = useState(30_000)
  const tapsRef = useRef(0)
  const finishedRef = useRef(false)

  useEffect(() => {
    const startedAt = performance.now()
    const id = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      const remaining = 30_000 - elapsed
      if (remaining <= 0 && !finishedRef.current) {
        finishedRef.current = true
        window.clearInterval(id)
        const score = Math.min(1, tapsRef.current / targetRef.current)
        onComplete(score)
      } else {
        setRemainingMs(Math.max(0, remaining))
      }
    }, 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTap = () => {
    if (finishedRef.current) return
    tapsRef.current += 1
    setTaps(tapsRef.current)
    if (tapsRef.current >= targetRef.current) {
      finishedRef.current = true
      // Defer onComplete on next tick (избежать setState in setState warning)
      setTimeout(() => onComplete(1.0), 0)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-white/80 text-sm">
        {t('mission.rhythm_label', { taps, target: targetRef.current })}
      </div>
      <button
        onClick={handleTap}
        className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 active:scale-95 transition-transform shadow-lg shadow-amber-500/30"
        aria-label={t('mission.rhythm_tap_button')}
      >
        <span className="text-3xl">🪐</span>
      </button>
      <div className="text-white/60 text-xs">
        {t('mission.time_left', { secs: Math.ceil(remainingMs / 1000) })}
      </div>
    </div>
  )
}
