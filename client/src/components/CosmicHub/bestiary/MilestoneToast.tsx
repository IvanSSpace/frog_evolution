// Phase 18: подписан на cosmic:bestiary-milestone и показывает auto-hide toast.
// Mounted один раз в дереве (App.tsx).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { eventBus } from '../../../store/eventBus'

interface ToastEntry {
  id: number
  threshold: 10 | 24 | 96 | 576
  rewardLabel: string
}

const AUTO_HIDE_MS = 4000

interface MilestonePayload {
  threshold: 10 | 24 | 96 | 576
  reward:
    | { readonly type: 'coins'; readonly amount: number }
    | { readonly type: 'serum' }
    | { readonly type: 'frog-exclusive' }
}

export function MilestoneToast() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<ToastEntry[]>([])

  useEffect(() => {
    const handler = (payload: MilestonePayload) => {
      const id = Date.now() + Math.random()
      const labelKey = `cosmic_hub.bestiary.milestone_${payload.threshold}`
      const entry: ToastEntry = {
        id,
        threshold: payload.threshold,
        rewardLabel: t(labelKey),
      }
      setEntries((prev) => [...prev, entry])
      // Auto-hide
      setTimeout(() => {
        setEntries((prev) => prev.filter((e) => e.id !== id))
      }, AUTO_HIDE_MS)
    }
    eventBus.on('cosmic:bestiary-milestone', handler)
    return () => {
      eventBus.off('cosmic:bestiary-milestone', handler)
    }
  }, [t])

  if (entries.length === 0) return null

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {entries.map((e) => (
        <div
          key={e.id}
          className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-auto"
          role="status"
        >
          🏆 {e.rewardLabel}
        </div>
      ))}
    </div>
  )
}
