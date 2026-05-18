// Phase 25-03: BulkOpenSummary dark stats card + pink count pills + GOLD legendary glow
// Phase 15 (REQ SLOT-07): bulk-open summary modal — показывает grouped results
// после «Открыть все» в BoxesTab. Skips full cascade drama; показывает только
// final aggregated table.
//
// Lazy-loaded из BoxesTab (PERF-08 separate chunk).

// Phase 22: rarity removed — BulkOpenResult groups by element only.
import { useTranslation } from 'react-i18next'
import type { Element } from '../../store/cosmic/types'
import { ELEMENT_TINT } from './ElementGrid'

export interface BulkOpenResult {
  element: Element
  planetName: string
}

interface Props {
  results: BulkOpenResult[]
  onClose: () => void
}

interface GroupedRow {
  element: Element
  count: number
}

function groupResults(results: BulkOpenResult[]): GroupedRow[] {
  const map = new Map<string, GroupedRow>()
  for (const r of results) {
    const key = r.element
    const existing = map.get(key)
    if (existing) existing.count++
    else map.set(key, { element: r.element, count: 1 })
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

export default function BulkOpenSummary({ results, onClose }: Props) {
  const { t } = useTranslation()
  const grouped = groupResults(results)
  const hasLegendary = false // Phase 22: rarity removed

  return (
    <div
      data-testid="bulk-open-summary"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        padding: 20,
      }}
    >
      {/* Confetti glow для legendary (Phase 22: hasLegendary=false, kept for future) */}
      {hasLegendary && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 40%, rgba(253,224,71,0.18) 0%, transparent 60%)',
            animation: 'bulkSummaryGlow 2s ease-out infinite alternate',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Modal card — dark cosmic theme */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a2e1a',
          border: '2px solid rgba(255,255,255,0.15)',
          borderRadius: 16,
          padding: 24,
          color: '#fff',
          boxShadow: hasLegendary
            ? '0 8px 24px rgba(0,0,0,0.5), 0 0 24px 4px rgba(253,224,71,0.4)'
            : '0 8px 24px rgba(0,0,0,0.5)',
          width: '100%',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          className="text-center"
          style={{
            fontSize: 'clamp(20px, 6vw, 26px)',
            fontWeight: 800,
            color: '#fde047',
            letterSpacing: 1.5,
            textShadow: '0 1px 0 rgba(0,0,0,0.4), 0 0 12px rgba(253,224,71,0.4)',
            margin: 0,
          }}
        >
          {t('cosmic_hub.bulk.summary_title')}
        </div>

        <div
          className="flex flex-col gap-2 overflow-y-auto"
          style={{ maxHeight: '60vh', width: '100%' }}
        >
          {grouped.map((row) => (
            <SummaryRow key={row.element} row={row} />
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'linear-gradient(180deg, #f9a8d4 0%, #db2777 100%)',
            borderRadius: 999,
            padding: '10px 24px',
            fontWeight: 800,
            fontSize: 14,
            color: '#fff',
            textShadow: '0 1px 0 rgba(0,0,0,0.4)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.45), 0 3px 0 rgba(0,0,0,0.3)',
            border: 'none',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          {t('cosmic_hub.bulk.summary_close')}
        </button>
      </div>

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
      className="flex items-center gap-3"
      style={{
        borderRadius: 12,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div
        className="flex-shrink-0"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          backgroundColor: tint,
          boxShadow: `0 0 8px ${tint}80`,
        }}
      />
      <span
        className="flex-1"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#fff',
          textShadow: '0 1px 0 rgba(0,0,0,0.4)',
        }}
      >
        {t(`cosmic_hub.elements.${row.element}`)}
      </span>
      <span
        style={{
          background: '#ec4899',
          color: '#fff',
          borderRadius: 999,
          padding: '2px 10px',
          fontSize: 12,
          fontWeight: 800,
          textShadow: '0 1px 0 rgba(0,0,0,0.4)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
      >
        ×{row.count}
      </span>
    </div>
  )
}
