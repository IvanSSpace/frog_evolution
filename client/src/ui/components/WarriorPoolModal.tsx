// WarriorPoolModal — компактная модалка для выбора лягушки на пустую клетку
// казармы. Открывается из BarracksScene по 'barracks:add-request'.

import { useGameStore } from '../../store/gameStore'
import { fmt } from '../../utils/formatting'
import { hapticNotification, hapticSelection } from '../../utils/telegram'
import { useModalLock } from '../../utils/modalLock'
import { TintedFrog } from './TintedFrog'
import { FROG_LEVELS, getFrogPath } from '../../game/config/frogs'
import {
  CLASS_META,
  getWarriorConfig,
  getWarriorConvertCost,
} from '../../game/config/warriors'

type Props = {
  /** Индекс слота на котором юзер тапнул (для подсказки). */
  slotIdx: number
  onClose: () => void
}

export function WarriorPoolModal({ slotIdx, onClose }: Props) {
  useModalLock()
  const gold = useGameStore((s) => s.gold)
  const addWarrior = useGameStore((s) => s.addWarriorToBarracks)
  const discoveredLevels = useGameStore((s) => s.discoveredLevels)

  const available: number[] = []
  for (const l of discoveredLevels) {
    if (l >= 1 && l <= 18 && !available.includes(l)) available.push(l)
  }
  available.sort((a, b) => a - b)

  const handleAdd = (level: number) => {
    hapticSelection()
    const idx = addWarrior(level)
    if (idx === -1) {
      hapticNotification('error')
      return
    }
    onClose()
  }

  return (
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop"
        style={{
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="flex items-center justify-between px-4 pt-3 pb-2"
          style={{ borderBottom: '2px dashed rgba(77,107,31,0.4)' }}
        >
          <span
            className="ff-display"
            style={{ color: '#15803d', fontSize: 18 }}
          >
            Слот #{slotIdx + 1}
          </span>
          <button
            onClick={onClose}
            className="ff-tile w-8 h-8 text-base"
            style={{
              ['--ff-tile-from' as never]: '#fca5a5',
              ['--ff-tile-to' as never]: '#dc2626',
              ['--ff-tile-border' as never]: '#7f1d1d',
              color: '#fff',
            }}
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {available.length === 0 ? (
            <div
              className="ff-body text-center text-sm"
              style={{ color: '#365314' }}
            >
              Нет открытых жаб. Сначала прокачай ферму.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              {available.map((level) => (
                <PoolButton
                  key={level}
                  level={level}
                  gold={gold}
                  onAdd={handleAdd}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PoolButton({
  level,
  gold,
  onAdd,
}: {
  level: number
  gold: number
  onAdd: (level: number) => void
}) {
  const cost = getWarriorConvertCost(level)
  const cfg = FROG_LEVELS[level - 1]
  const wcfg = getWarriorConfig(level)
  const cls = wcfg ? CLASS_META[wcfg.class] : null
  const canAfford = gold >= cost
  return (
    <button
      onClick={() => onAdd(level)}
      disabled={!canAfford}
      className="ff-card"
      style={{
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        opacity: canAfford ? 1 : 0.5,
        cursor: canAfford ? 'pointer' : 'not-allowed',
        borderRadius: 10,
        border: '2px solid #7c5c2a',
      }}
    >
      <div style={{ width: 44, height: 44 }}>
        <TintedFrog
          path={getFrogPath(level, 0)}
          tint={cfg.tint}
          alt={`L${level}`}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <div
        className="ff-body"
        style={{ fontSize: 11, color: '#15803d', fontWeight: 700 }}
      >
        L{level} {cls?.emoji ?? ''}
      </div>
      <div
        className="tabular-nums"
        style={{ fontSize: 10, color: '#365314' }}
      >
        💧 {fmt(cost)}
      </div>
    </button>
  )
}
