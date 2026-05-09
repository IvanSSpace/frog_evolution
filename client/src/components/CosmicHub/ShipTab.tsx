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
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/60 p-4">
        <div className="text-4xl">🚀</div>
        <p className="text-sm">{t('ship.empty_state')}</p>
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
      <div className="text-sm text-white/70 mt-1">
        {t('ship.transit_eta', { mins, secs: String(secs).padStart(2, '0') })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4 text-white">
      {/* State pill */}
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <div className="text-xs text-white/40 uppercase tracking-wide">
          {t('ship.section_state')}
        </div>
        <div className="text-base font-medium">{stateLabel}</div>
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
          onClick={handleOpenMap}
          className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-md text-sm font-medium"
        >
          {t('ship.open_map')}
        </button>
      </div>

      {/* Boxes section */}
      {boxes.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-white/60 uppercase tracking-wide">
            📦 Боксы
          </div>
          {boxes.map((box) => {
            const atHome = ship?.state === 'docked' && ship.planetId === 'home'
            return (
              <div
                key={box.id}
                className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10"
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
                  <div className="text-sm text-white truncate">
                    {box.planetName || box.planetId}
                  </div>
                  <div className="text-xs text-white/40">{box.archetype}</div>
                </div>
                <button
                  type="button"
                  disabled={!atHome}
                  title={atHome ? undefined : 'Вернись на HOME'}
                  onClick={() => {
                    if (!atHome) return
                    useGameStore.getState().openBox(box.id)
                  }}
                  style={{ pointerEvents: 'auto' }}
                  className={[
                    'text-xs px-3 py-1 rounded-md font-medium',
                    atHome
                      ? 'bg-amber-500 hover:bg-amber-600 text-gray-900 cursor-pointer'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed',
                  ].join(' ')}
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
