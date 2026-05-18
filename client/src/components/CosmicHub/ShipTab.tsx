// Phase 25-02: visual restyle (Tailwind color utilities → inline styles)
// Phase 16: Tab «Корабль» в Cosmic Hub.
// Заменяет ScoutsTab из Phase 11 (placeholder). Tab id остаётся 'scouts' в
// CosmicTab union для backward compat sessionStorage (Phase 19 polish может
// сменить ID при необходимости миграции).

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import {
  findPlanetById,
  DAILY_CAP,
  msUntilLocalMidnight,
} from '../../game/data/missionConfig'
import { CrewIndicator } from './CrewIndicator'
import { ELEMENT_TINT } from './ElementGrid'
import {
  DARK_CARD_STYLE,
  PINK_CTA_STYLE,
  DISABLED_CTA_OVERRIDES,
  TEXT_DIM,
  TEXT_VERY_DIM,
  SECTION_HEADER_STYLE,
  EMPTY_STATE_TEXT_STYLE,
} from './_styles'

interface Props {
  onClose: () => void // close Cosmic Hub modal (для «Открыть карту»)
}

export function ShipTab({ onClose }: Props) {
  const { t } = useTranslation()
  const ship = useGameStore((s) => s.ship)
  const crew = useGameStore((s) => s.crew)
  const allBoxes = useGameStore((s) => s.boxes)
  const boxes = allBoxes.filter((b) => !b.opened)
  const ensureShipExists = useGameStore((s) => s.ensureShipExists)
  const resetCrewIfNewDay = useGameStore((s) => s.resetCrewIfNewDay)

  // Live tick для transit countdown (1s).
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // На mount: ensure ship exists + reset crew если новый день.
  useEffect(() => {
    ensureShipExists()
    resetCrewIfNewDay()
  }, [ensureShipExists, resetCrewIfNewDay])

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

      {/* Crew indicator (REQ CREW-06/07) */}
      <CrewIndicator
        used={crew.missionsToday}
        cap={DAILY_CAP}
        msUntilReset={msUntilLocalMidnight()}
      />

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

      {/* Boxes section */}
      {boxes.length > 0 && (
        <div className="flex flex-col gap-2">
          <div style={SECTION_HEADER_STYLE}>📦 Боксы</div>
          {boxes.map((box) => {
            const atHome = ship?.state === 'docked' && ship.planetId === 'home'
            return (
              <div
                key={box.id}
                className="flex items-center gap-2"
                style={{ ...DARK_CARD_STYLE, padding: '8px 12px' }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: ELEMENT_TINT[box.element],
                    flexShrink: 0,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="truncate"
                    style={{ fontSize: 13, color: '#fff' }}
                  >
                    {box.planetName || box.planetId}
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_VERY_DIM }}>
                    {box.archetype}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!atHome}
                  title={atHome ? undefined : 'Вернись на HOME'}
                  onClick={() => {
                    if (!atHome) return
                    useGameStore.getState().openBox(box.id)
                  }}
                  style={
                    atHome
                      ? {
                          ...PINK_CTA_STYLE,
                          padding: '6px 12px',
                          fontSize: 12,
                          pointerEvents: 'auto',
                        }
                      : {
                          ...PINK_CTA_STYLE,
                          ...DISABLED_CTA_OVERRIDES,
                          padding: '6px 12px',
                          fontSize: 12,
                          pointerEvents: 'auto',
                        }
                  }
                >
                  Открыть
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
