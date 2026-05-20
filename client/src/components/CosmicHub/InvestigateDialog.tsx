import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/gameStore'
import { findPlanetById, DAILY_CAP } from '../../game/data/missionConfig'
import { useModalLock } from '../../utils/modalLock'

interface Props {
  planetId: string
  onConfirm: () => void
  onCancel: () => void
}

export function InvestigateDialog({ planetId, onConfirm, onCancel }: Props) {
  useModalLock()
  const crew = useGameStore((s) => s.crew)
  const planet = findPlanetById(planetId)

  if (!planet) {
    onCancel()
    return null
  }

  const remaining = DAILY_CAP - crew.missionsToday
  const canInvestigate = remaining > 0

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
        <h3 className="text-lg font-bold mb-2">Изучить {planet.name}?</h3>
        <div className="text-sm text-white/70 mb-1">
          Получите бокс с ресурсами планеты
        </div>
        {canInvestigate ? (
          <div className="text-xs text-white/50 mt-2">
            Осталось сегодня: {remaining} из {DAILY_CAP}
          </div>
        ) : (
          <div className="text-xs text-amber-300 mt-2">
            Экипаж устал. Миссии возобновятся завтра.
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Позже
          </button>
          <button
            onClick={onConfirm}
            disabled={!canInvestigate}
            className={[
              'flex-1 py-2 rounded text-sm font-medium',
              canInvestigate
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            Изучить
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
