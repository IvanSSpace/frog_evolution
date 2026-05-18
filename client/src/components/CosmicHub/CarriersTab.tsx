// Phase 25-02: visual restyle (dark cards + pink CTAs)
// Phase 22: простой список carriers (element + level + frogId).
// Удалены: stabilized badge, feedCount progress, disposeCarrier action.
// DisposeConfirmModal остаётся как stub — dispose TBD в Plan 22-03 (ascension flow).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { CarrierInfoCard } from './CarrierInfoCard'
import { DisposeConfirmModal } from './DisposeConfirmModal'
import type { CarrierData } from '../../store/cosmic/types'
import { TEXT_DIM, TEXT_VERY_DIM, EMPTY_STATE_TEXT_STYLE } from './_styles'

export function CarriersTab() {
  const { t } = useTranslation()
  const carriers = useGameStore((s) => s.carriers)
  const removeCarrier = useGameStore((s) => s.removeCarrier)
  const [pendingDispose, setPendingDispose] = useState<CarrierData | null>(null)

  if (carriers.length === 0) {
    return (
      <div className="p-6 text-center">
        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 8 }}>🐸</div>
        <div style={EMPTY_STATE_TEXT_STYLE}>
          {t('cosmic_hub.carrier.empty_state')}
        </div>
        <div
          style={{
            fontSize: 12,
            marginTop: 4,
            color: TEXT_VERY_DIM,
            textAlign: 'center',
          }}
        >
          {t('cosmic_hub.carrier.empty_hint')}
        </div>
      </div>
    )
  }

  const handleDisposeRequest = (frogId: string) => {
    const c = carriers.find((x) => x.frogId === frogId)
    if (c) setPendingDispose(c)
  }

  const handleConfirmDispose = () => {
    if (!pendingDispose) return
    // Phase 22: simple removeCarrier (ascension + serum recovery in Plan 22-03)
    removeCarrier(pendingDispose.frogId)
    setPendingDispose(null)
  }

  // Phase 22: simple sort by level descending
  const sorted = [...carriers].sort((a, b) => b.level - a.level)

  return (
    <>
      <div className="p-3 flex flex-col gap-2">
        <div
          style={{
            fontSize: 12,
            color: TEXT_DIM,
            marginBottom: 4,
          }}
        >
          {t('cosmic_hub.carrier.count', { count: carriers.length })}
        </div>
        {sorted.map((c) => (
          <CarrierInfoCard
            key={c.frogId}
            carrier={c}
            onDispose={handleDisposeRequest}
          />
        ))}
      </div>
      {pendingDispose ? (
        <DisposeConfirmModal
          carrier={pendingDispose}
          onConfirm={handleConfirmDispose}
          onCancel={() => setPendingDispose(null)}
        />
      ) : null}
    </>
  )
}
