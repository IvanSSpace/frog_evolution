// Phase 15 (REQ SLOT-07): bulk-open summary modal — показывает grouped results
// после «Открыть все» в BoxesTab. Skips full cascade drama; показывает только
// final aggregated table.
//
// Lazy-loaded из BoxesTab (PERF-08 separate chunk).

import { useTranslation } from 'react-i18next'
import type { Element, Rarity } from '../../store/cosmic/types'
import { ELEMENT_TINT } from './ElementGrid'

export interface BulkOpenResult {
  element: Element
  rarity: Rarity
  planetName: string
}

interface Props {
  results: BulkOpenResult[]
  onClose: () => void
}

interface GroupedRow {
  element: Element
  rarity: Rarity
  count: number
}

function groupResults(results: BulkOpenResult[]): GroupedRow[] {
  const map = new Map<string, GroupedRow>()
  for (const r of results) {
    const key = `${r.element}:${r.rarity}`
    const existing = map.get(key)
    if (existing) existing.count++
    else map.set(key, { element: r.element, rarity: r.rarity, count: 1 })
  }
  // Sort: rarity DESC (legendary first), then by count DESC.
  const order: Record<Rarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }
  return Array.from(map.values()).sort((a, b) => {
    const r = order[a.rarity] - order[b.rarity]
    if (r !== 0) return r
    return b.count - a.count
  })
}

export default function BulkOpenSummary({ results, onClose }: Props) {
  const { t } = useTranslation()
  const grouped = groupResults(results)
  const hasLegendary = grouped.some((g) => g.rarity === 'legendary')

  return (
    <div
      data-testid="bulk-open-summary"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.95) 70%)',
        padding: 20,
      }}
    >
      {/* Confetti glow для legendary */}
      {hasLegendary && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 50% 40%, rgba(255,215,0,0.15) 0%, transparent 60%)',
            animation: 'bulkSummaryGlow 2s ease-out infinite alternate',
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        className="ff-display text-center"
        style={{
          fontSize: 'clamp(20px, 6vw, 28px)',
          color: '#ffd700',
          letterSpacing: 2,
          textShadow: '0 0 20px rgba(255,215,0,0.6)',
          marginBottom: 16,
        }}
      >
        {t('cosmic_hub.bulk.summary_title')}
      </div>

      <div
        className="flex flex-col gap-2 overflow-y-auto"
        style={{ maxHeight: '60vh', width: '100%', maxWidth: 360 }}
      >
        {grouped.map((row) => (
          <SummaryRow key={`${row.element}:${row.rarity}`} row={row} />
        ))}
      </div>

      <button
        onClick={onClose}
        className="ff-btn ff-btn-green text-lg"
        style={{
          paddingLeft: 32, paddingRight: 32, paddingTop: 12, paddingBottom: 12,
          marginTop: 16,
        }}
      >
        {t('cosmic_hub.bulk.summary_close')}
      </button>

      <style>{`
        @keyframes bulkSummaryGlow {
          from { opacity: 0.6; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function SummaryRow({ row }: { row: GroupedRow }) {
  const { t } = useTranslation()
  const tint = ELEMENT_TINT[row.element] ?? '#888'
  return (
    <div
      className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border-2"
      style={{ borderColor: tint }}
    >
      <div
        className="flex-shrink-0"
        style={{
          width: 32, height: 32, borderRadius: '50%',
          backgroundColor: tint, boxShadow: `0 0 8px ${tint}`,
        }}
      />
      <span className="flex-1 text-sm text-white">
        {t('cosmic_hub.bulk.summary_row', {
          element: t(`cosmic_hub.elements.${row.element}`),
          rarity: t(`rarity.${row.rarity}`),
          count: row.count,
        })}
      </span>
      <span
        className="text-xs font-bold px-2 py-1 rounded uppercase"
        style={{ backgroundColor: rarityColor(row.rarity), color: 'white' }}
      >
        ×{row.count}
      </span>
    </div>
  )
}

function rarityColor(r: Rarity): string {
  switch (r) {
    case 'legendary': return '#f59e0b'
    case 'epic':      return '#a855f7'
    case 'rare':      return '#3b82f6'
    case 'common':    return '#6b7280'
  }
}
