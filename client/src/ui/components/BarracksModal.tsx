// BarracksModal — UI shell для казармы (Этап 2).
// Показывает сетку 5×4 + список доступных жаб с текущей локации + кнопку
// конвертации (cost = basePrice уровня). MVP: React-only, без drag-n-drop.
// Drag-n-drop + Phaser scene = Этап 3.

import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { fmt } from '../../utils/formatting'
import { hapticNotification, hapticSelection } from '../../utils/telegram'
import { useModalLock } from '../../utils/modalLock'
import { eventBus } from '../../store/eventBus'
import { TintedFrog } from './TintedFrog'
import { FROG_LEVELS, getFrogPath } from '../../game/config/frogs'
import {
  CLASS_META,
  getWarriorConfig,
  getWarriorConvertCost,
} from '../../game/config/warriors'
import {
  BARRACKS_GRID_H,
  BARRACKS_GRID_W,
  BATTLE_DECK_ROWS,
  BATTLE_DECK_SIZE,
  MAX_DECK_SIZE,
  deckCount,
} from '../../store/barracks'

type Props = { onClose: () => void }

export function BarracksModal({ onClose }: Props) {
  useModalLock()
  const gold = useGameStore((s) => s.gold)
  const grid = useGameStore((s) => s.barracksGrid)
  const addWarrior = useGameStore((s) => s.addWarriorToBarracks)
  const removeWarrior = useGameStore((s) => s.removeWarriorFromBarracks)
  const currentLocation = useGameStore((s) => s.currentLocation)
  const locationFrogs = useGameStore((s) => s.locationFrogs)
  const discoveredLevels = useGameStore((s) => s.discoveredLevels)

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  // Пул доступных уровней — пока MVP, берём все discovered (1-18).
  // Этап 3: ограничим текущей локацией + drag-and-drop из реальных жаб поля.
  const availableLevels: number[] = []
  for (const l of discoveredLevels) {
    if (l >= 1 && l <= 18 && !availableLevels.includes(l)) {
      availableLevels.push(l)
    }
  }
  availableLevels.sort((a, b) => a - b)

  const filledCount = grid.filter((c) => c !== null).length
  const deckFilled = deckCount(grid)

  const handleAdd = (level: number) => {
    hapticSelection()
    const idx = addWarrior(level)
    if (idx === -1) {
      hapticNotification('error')
    }
  }

  const handleSlotClick = (idx: number) => {
    if (!grid[idx]) return
    hapticSelection()
    setSelectedSlot(idx)
  }

  const handleRemove = () => {
    if (selectedSlot === null) return
    removeWarrior(selectedSlot)
    setSelectedSlot(null)
  }

  return (
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'auto',
        padding: '0 16px 4px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop"
        style={{
          width: '100%',
          maxWidth: 420,
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="relative flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-3xl"
            style={{ color: '#dc2626', letterSpacing: 1.5 }}
          >
            КАЗАРМА
          </h2>
          <button
            onClick={onClose}
            aria-label="close"
            className="ff-tile w-9 h-9 text-lg"
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

        {/* Stats row */}
        <div className="flex items-center justify-between px-5 py-2 text-xs ff-body">
          <span style={{ color: '#365314' }}>
            Воинов: <b>{filledCount}</b>/{grid.length}
          </span>
          <span
            style={{
              color: deckFilled === MAX_DECK_SIZE ? '#16a34a' : '#365314',
              fontWeight: 700,
            }}
          >
            В бой: {deckFilled}/{MAX_DECK_SIZE}
          </span>
        </div>

        {/* Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 ff-no-scrollbar">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${BARRACKS_GRID_W}, 1fr)`,
              gridTemplateRows: `repeat(${BARRACKS_GRID_H}, auto)`,
              gap: 6,
              padding: 6,
              borderRadius: 10,
              // Боевая зона = верхние 3 ряда. Подсвечиваем через двойной градиент:
              // top половина — жёлтая (deck), bottom — серая (reserve).
              background: `linear-gradient(180deg,
                rgba(251,191,36,0.18) 0%,
                rgba(251,191,36,0.18) ${(BATTLE_DECK_ROWS / BARRACKS_GRID_H) * 100}%,
                rgba(54,83,20,0.08) ${(BATTLE_DECK_ROWS / BARRACKS_GRID_H) * 100}%,
                rgba(54,83,20,0.08) 100%)`,
              border: '2px solid rgba(251,191,36,0.4)',
            }}
          >
            {grid.map((cell, idx) => {
              const isDeck = idx < BATTLE_DECK_SIZE
              return (
                <BarracksSlot
                  key={idx}
                  idx={idx}
                  cell={cell}
                  isSelected={selectedSlot === idx}
                  isDeck={isDeck}
                  onClick={handleSlotClick}
                />
              )
            })}
          </div>

          {/* Подписи зон */}
          <div className="flex justify-between mt-2 px-1 text-xs ff-body">
            <span style={{ color: '#a16207' }}>⚔ Боевая зона (top 3)</span>
            <span style={{ color: '#475569' }}>Резерв (bottom 2)</span>
          </div>

          {selectedSlot !== null && grid[selectedSlot] && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={handleRemove}
                className="ff-btn ff-btn-red text-sm py-2"
                style={{ minWidth: 160 }}
              >
                Убрать воина из слота
              </button>
            </div>
          )}

          {/* Pool — для добавления воинов */}
          <div
            className="mt-3 pt-3"
            style={{ borderTop: '2px dashed rgba(77,107,31,0.4)' }}
          >
            <div
              className="ff-display mb-2"
              style={{ color: '#15803d', fontSize: 14 }}
            >
              Добавить воина (loc {currentLocation})
            </div>
            {availableLevels.length === 0 ? (
              <div
                className="text-xs ff-body"
                style={{ color: '#365314' }}
              >
                Нет открытых жаб ещё.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 6,
                }}
              >
                {availableLevels.map((level) => (
                  <PoolButton
                    key={level}
                    level={level}
                    gold={gold}
                    onAdd={handleAdd}
                  />
                ))}
              </div>
            )}
            {/* Inline reference to suppress unused warning. */}
            <div style={{ display: 'none' }}>
              {locationFrogs[currentLocation - 1]?.length ?? 0}
            </div>
          </div>
        </div>

        {/* Footer: deploy button (Этап 4 — пока заглушка) */}
        <div
          className="px-5 py-3 flex justify-center"
          style={{ borderTop: '3px dashed rgba(77,107,31,0.4)' }}
        >
          <button
            onClick={() => {
              if (filledCount === 0) return
              hapticNotification('success')
              eventBus.emit('battle:start', { locationId: 1 })
              onClose()
            }}
            disabled={filledCount === 0}
            className="ff-btn ff-btn-orange text-base flex-1"
            style={{ maxWidth: 240 }}
          >
            В РЕЙД
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function BarracksSlot({
  idx,
  cell,
  isSelected,
  isDeck,
  onClick,
}: {
  idx: number
  cell: import('../../store/barracks').BarracksCell | null
  isSelected: boolean
  isDeck: boolean
  onClick: (idx: number) => void
}) {
  if (!cell) {
    return (
      <div
        onClick={() => onClick(idx)}
        style={{
          aspectRatio: '1',
          background: isDeck
            ? 'rgba(251,191,36,0.12)'
            : 'rgba(54,83,20,0.08)',
          border: `2px dashed ${isDeck ? 'rgba(251,191,36,0.5)' : 'rgba(77,107,31,0.3)'}`,
          borderRadius: 8,
          cursor: 'default',
        }}
      />
    )
  }
  const cfg = FROG_LEVELS[cell.level - 1]
  const wcfg = getWarriorConfig(cell.level)
  const cls = wcfg ? CLASS_META[wcfg.class] : null
  return (
    <div
      onClick={() => onClick(idx)}
      style={{
        aspectRatio: '1',
        background: 'linear-gradient(180deg, #fefdf3 0%, #f5e9b8 100%)',
        border: `3px solid ${isSelected ? '#dc2626' : '#7c5c2a'}`,
        borderRadius: 8,
        boxShadow: '0 0 0 2px #fef9d7 inset',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <TintedFrog
        path={getFrogPath(cell.level, cell.tier)}
        tint={cfg.tint}
        alt={`L${cell.level}`}
        style={{ width: '70%', height: '70%' }}
      />
      {cls && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            fontSize: 10,
            lineHeight: 1,
          }}
        >
          {cls.emoji}
        </span>
      )}
      <span
        style={{
          position: 'absolute',
          bottom: 2,
          left: 4,
          fontSize: 9,
          fontWeight: 700,
          color: '#365314',
        }}
      >
        L{cell.level}
      </span>
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
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        opacity: canAfford ? 1 : 0.5,
        cursor: canAfford ? 'pointer' : 'not-allowed',
        borderRadius: 8,
        boxShadow: '0 0 0 1px #fef9d7 inset',
        border: '2px solid #7c5c2a',
      }}
    >
      <div style={{ width: 36, height: 36 }}>
        <TintedFrog
          path={getFrogPath(level, 0)}
          tint={cfg.tint}
          alt={`L${level}`}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <div
        className="ff-body"
        style={{
          fontSize: 10,
          color: '#15803d',
          fontWeight: 700,
        }}
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
