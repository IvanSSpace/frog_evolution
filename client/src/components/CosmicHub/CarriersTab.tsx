// Phase 17: list of all carriers (cosmicSlice.carriers) с прогрессом + dispose.
// Plan 17-05 wires DisposeConfirmModal.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { CarrierInfoCard } from './CarrierInfoCard'
import { DisposeConfirmModal } from './DisposeConfirmModal'
import { eventBus } from '../../store/eventBus'
import type { CarrierData } from '../../store/cosmic/types'

export function CarriersTab() {
  const { t } = useTranslation()
  const carriers = useGameStore((s) => s.carriers)
  const disposeCarrier = useGameStore((s) => s.disposeCarrier)
  const [pendingDispose, setPendingDispose] = useState<CarrierData | null>(null)

  if (carriers.length === 0) {
    return (
      <div className="p-6 text-center text-white/50">
        <div className="text-4xl mb-2">🐸</div>
        <div className="text-sm">{t('cosmic_hub.carrier.empty_state')}</div>
        <div className="text-xs mt-1 text-white/30">{t('cosmic_hub.carrier.empty_hint')}</div>
      </div>
    )
  }

  const handleDisposeRequest = (frogId: string) => {
    const c = carriers.find((x) => x.frogId === frogId)
    if (c) setPendingDispose(c)
  }

  const handleConfirmDispose = () => {
    if (!pendingDispose) return
    const result = disposeCarrier(pendingDispose.frogId)
    eventBus.emit('cosmic:toast', {
      type: 'generic',
      msg: result.recovered
        ? t('cosmic_hub.carrier.dispose.toast_recovered')
        : t('cosmic_hub.carrier.dispose.toast_no_recovery'),
      duration: 3000,
    })
    setPendingDispose(null)
  }

  // Sort: stabilized последними; внутри — по feedCount desc.
  const sorted = [...carriers].sort((a, b) => {
    if (a.stabilized !== b.stabilized) return a.stabilized ? 1 : -1
    return b.feedCount - a.feedCount
  })

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
