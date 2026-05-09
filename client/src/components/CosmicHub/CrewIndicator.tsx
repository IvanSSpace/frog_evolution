// Phase 16: Crew indicator card (REQ CREW-06, CREW-07).
// Показывает «Сегодня: N/4 миссий ⏱ через H:MM».
// Tap → expand info tooltip с объяснением системы.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  used: number
  cap: number
  msUntilReset: number
}

export function CrewIndicator({ used, cap, msUntilReset }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  // Relative countdown (next local midnight).
  const totalMin = Math.floor(msUntilReset / 60_000)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60

  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      className="text-left bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/10 transition-colors"
      aria-label={t('crew.tap_for_info')}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">
          {t('crew.indicator_label', { used, cap })}
        </span>
        <span className="text-xs text-white/60">
          ⏱{' '}
          {t('crew.until_reset', {
            hh: String(hh).padStart(2, '0'),
            mm: String(mm).padStart(2, '0'),
          })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={used >= cap ? 'bg-red-400' : 'bg-emerald-400'}
          style={{ width: `${(used / cap) * 100}%`, height: '100%' }}
        />
      </div>

      {/* Expanded explanation (REQ CREW-07) */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70 leading-relaxed">
          {t('crew.explanation', { cap })}
        </div>
      )}
    </button>
  )
}
