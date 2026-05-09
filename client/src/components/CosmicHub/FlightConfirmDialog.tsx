// Phase 16: FlightConfirmDialog (REQ SHIP-07).
// Показывается когда юзер тапает по planet на StarMap при открытом Cosmic Hub.
// Если ship уже docked у этой planet — caller не показывает dialog (SHIP-08).

import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  findPlanetById,
  planetDistance,
  travelTimeMs,
} from '../../game/data/missionConfig'
import { useGameStore } from '../../store/gameStore'

interface Props {
  toPlanetId: string
  onConfirm: () => void
  onCancel: () => void
}

export function FlightConfirmDialog({
  toPlanetId,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation()
  const ship = useGameStore((s) => s.ship)
  const latestPos = useGameStore((s) => s.latestShipPos)

  const target = findPlanetById(toPlanetId)
  if (!target) {
    // unknown planet — auto-cancel
    onCancel()
    return null
  }

  // Compute travel time preview based on ship's current state.
  let fromPos: { x: number; y: number } | null = null
  let fromName = '—'
  let inTransit = false

  if (!ship || ship.state === 'docked') {
    const fromPlanet =
      ship && ship.state === 'docked' ? findPlanetById(ship.planetId) : null
    if (fromPlanet) {
      fromPos = { x: fromPlanet.x, y: fromPlanet.y }
      fromName = fromPlanet.name
    }
  } else {
    inTransit = true
    fromPos = latestPos ?? null
    if (!fromPos) {
      const fp = findPlanetById(ship.fromPlanetId)
      if (fp) fromPos = { x: fp.x, y: fp.y }
    }
    fromName = findPlanetById(ship.fromPlanetId)?.name ?? ship.fromPlanetId
  }

  const dist = fromPos
    ? planetDistance(fromPos, { x: target.x, y: target.y })
    : 0
  const durSecs = Math.round(travelTimeMs(dist) / 1000)

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.70)',
        pointerEvents: 'auto',
        touchAction: 'manipulation',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="bg-gray-900 border border-white/10 rounded-lg p-5 w-[90%] max-w-sm text-white">
        <h3 className="text-lg font-bold mb-2">
          {t('flight_confirm.title', { name: target.name })}
        </h3>
        <div className="text-sm text-white/70 mb-1">
          {t('flight_confirm.duration', { secs: durSecs })}
        </div>
        {inTransit ? (
          <div className="text-xs text-amber-300 mt-2">
            {t('flight_confirm.in_transit', {
              from: fromName,
              to: target.name,
            })}
          </div>
        ) : (
          <div className="text-xs text-white/50 mt-2">
            {t('flight_confirm.current_planet', { name: fromName })}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            {t('flight_confirm.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm font-medium"
          >
            {t('flight_confirm.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
