// Phase 25-02: visual restyle (Tailwind color utilities → inline styles)
// Phase 16: Tab «Корабль» в Cosmic Hub.
// Заменяет ScoutsTab из Phase 11 (placeholder). Tab id остаётся 'scouts' в
// CosmicTab union для backward compat sessionStorage (Phase 19 polish может
// сменить ID при необходимости миграции).

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { findPlanetById } from '../../game/data/missionConfig'
import {
  DARK_CARD_STYLE,
  PINK_CTA_STYLE,
  TEXT_DIM,
  TEXT_VERY_DIM,
  EMPTY_STATE_TEXT_STYLE,
} from './_styles'

interface Props {
  onClose: () => void // close Cosmic Hub modal (для «Открыть карту»)
}

export function ShipTab({ onClose }: Props) {
  const { t } = useTranslation()
  const ship = useGameStore((s) => s.ship)
  const ensureShipExists = useGameStore((s) => s.ensureShipExists)

  // Live tick для transit countdown (1s).
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // На mount: ensure ship exists.
  useEffect(() => {
    ensureShipExists()
  }, [ensureShipExists])

  const handleOpenMap = () => {
    eventBus.emit('starmap:open')
    onClose()
  }

  if (!ship) {
    // Empty state (defensive — после ensureShipExists не должно случиться)
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-3 p-4"
        style={{ color: TEXT_VERY_DIM }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>🚀</div>
        <p style={EMPTY_STATE_TEXT_STYLE}>{t('ship.empty_state')}</p>
      </div>
    )
  }

  // Resolve names + countdown
  let stateLabel = ''
  let stateDetail: ReactNode = null

  if (ship.state === 'docked') {
    const planet = findPlanetById(ship.planetId)
    const name = planet?.name ?? ship.planetId.toUpperCase()
    stateLabel = t('ship.state_docked', { name })
  } else {
    const target = findPlanetById(ship.toPlanetId)
    const name = target?.name ?? ship.toPlanetId.toUpperCase()
    const remainingMs = Math.max(0, ship.arrivesAt - Date.now())
    const mins = Math.floor(remainingMs / 60_000)
    const secs = Math.floor((remainingMs % 60_000) / 1000)
    stateLabel = t('ship.state_transit', { name })
    stateDetail = (
      <div
        style={{
          fontSize: 13,
          color: TEXT_DIM,
          marginTop: 4,
        }}
      >
        {t('ship.transit_eta', { mins, secs: String(secs).padStart(2, '0') })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4" style={{ color: '#fff' }}>
      {/* State pill */}
      <div style={DARK_CARD_STYLE}>
        <div
          style={{
            fontSize: 11,
            color: TEXT_VERY_DIM,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 600,
          }}
        >
          {t('ship.section_state')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>
          {stateLabel}
        </div>
        {stateDetail}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleOpenMap}
          style={PINK_CTA_STYLE}
        >
          {t('ship.open_map')}
        </button>
      </div>
    </div>
  )
}
