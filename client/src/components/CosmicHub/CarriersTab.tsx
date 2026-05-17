// Phase 22: простой список carriers (element + level + frogId).
// Удалены: stabilized badge, feedCount progress, disposeCarrier action.
// DisposeConfirmModal остаётся как stub — dispose TBD в Plan 22-03 (ascension flow).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { CarrierInfoCard } from './CarrierInfoCard'
import { DisposeConfirmModal } from './DisposeConfirmModal'
import type { CarrierData } from '../../store/cosmic/types'

export function CarriersTab() {
  const { t } = useTranslation()
  const carriers = useGameStore((s) => s.carriers)
  const removeCarrier = useGameStore((s) => s.removeCarrier)
  const [pendingDispose, setPendingDispose] = useState<CarrierData | null>(null)

  if (carriers.length === 0) {
    return (
      <div className="p-6 text-center text-white/50">
        <div className="text-4xl mb-2">🐸</div>
        <div className="text-sm">{t('cosmic_hub.carrier.empty_state')}</div>
        <div className="text-xs mt-1 text-white/30">
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
        <div className="text-xs text-white/50 mb-1">
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
