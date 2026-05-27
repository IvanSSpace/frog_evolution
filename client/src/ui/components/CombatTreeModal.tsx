// CombatTreeModal — боевая прокачка (combat tree). 3 вертикальные ветки
// (Урон / Здоровье / Броня), узлы идут вниз, открываются последовательно.
// Валюта — gold (= слизь 💧, единая валюта). Эффект на всю армию игрока.
//
// MVP client-прототип: трата gold валидируется локально (buyCombatNode).

import { useGameStore } from '../../store/gameStore'
import { useModalLock } from '../../utils/modalLock'
import { hapticNotification, hapticSelection } from '../../utils/telegram'
import { fmt } from '../../utils/formatting'
import {
  COMBAT_TREE,
  COMBAT_BRANCHES,
  COMBAT_MAX_NODES,
  combatNodeCost,
  type CombatBranch,
} from '../../game/config/combatTree'

type Props = { onClose: () => void }

export function CombatTreeModal({ onClose }: Props) {
  useModalLock()
  const gold = useGameStore((s) => s.gold)
  const tree = useGameStore((s) => s.combatTree)
  const buyCombatNode = useGameStore((s) => s.buyCombatNode)

  return (
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
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
            className="ff-display ff-stroke-white text-2xl"
            style={{ color: '#7c3aed', letterSpacing: 1.5 }}
          >
            ПРОКАЧКА
          </h2>
          <div className="flex items-center gap-3">
            <div
              className="ff-body tabular-nums"
              style={{ fontSize: 15, color: '#15803d', fontWeight: 800 }}
            >
              💧 {fmt(gold)}
            </div>
            <button
              onClick={onClose}
              aria-label="close"
              className="ff-tile w-9 h-9 text-lg"
              style={{
                ['--ff-tile-from' as never]: '#c4b5fd',
                ['--ff-tile-to' as never]: '#7c3aed',
                ['--ff-tile-border' as never]: '#4c1d95',
                color: '#fff',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* 3 ветки */}
        <div
          className="flex-1 min-h-0 ff-no-scrollbar"
          style={{
            overflowY: 'auto',
            display: 'flex',
            gap: 8,
            padding: '14px 12px',
          }}
        >
          {COMBAT_BRANCHES.map((branch) => (
            <BranchColumn
              key={branch}
              branch={branch}
              level={tree[branch]}
              balance={gold}
              onBuy={() => {
                const ok = buyCombatNode(branch)
                if (ok) hapticSelection()
                else hapticNotification('error')
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BranchColumn({
  branch,
  level,
  balance,
  onBuy,
}: {
  branch: CombatBranch
  level: number
  balance: number
  onBuy: () => void
}) {
  const cfg = COMBAT_TREE[branch]
  const totalLabel =
    cfg.unit === 'pct' ? `+${level * cfg.perNode}%` : `+${level * cfg.perNode}`
  const nextCost = combatNodeCost(branch, level)
  const maxed = nextCost === null
  const affordable = nextCost !== null && balance >= nextCost

  return (
    <div
      className="flex-1 ff-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '12px 6px',
        minWidth: 0,
      }}
    >
      {/* Заголовок ветки */}
      <div style={{ fontSize: 26, lineHeight: 1 }}>{cfg.emoji}</div>
      <div
        className="ff-display"
        style={{ fontSize: 13, color: '#15803d', textAlign: 'center' }}
      >
        {cfg.name}
      </div>
      <div
        className="ff-body tabular-nums"
        style={{ fontSize: 14, color: '#7c3aed', fontWeight: 800 }}
      >
        {totalLabel}
      </div>

      {/* Узлы — сверху вниз */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 5,
          marginTop: 4,
        }}
      >
        {Array.from({ length: COMBAT_MAX_NODES }).map((_, i) => {
          const nodeNum = i + 1
          const filled = level >= nodeNum
          const isNext = level === i // следующий покупаемый
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 900,
                  color: filled ? '#fff' : '#9ca3af',
                  background: filled
                    ? 'linear-gradient(180deg, #c4b5fd 0%, #7c3aed 100%)'
                    : isNext
                      ? 'linear-gradient(180deg, #fefdf3 0%, #f5e9b8 100%)'
                      : 'rgba(0,0,0,0.06)',
                  border: filled
                    ? '2px solid #4c1d95'
                    : isNext
                      ? '2px solid #7c3aed'
                      : '2px solid rgba(0,0,0,0.12)',
                  boxShadow: filled
                    ? 'inset 0 1px 0 rgba(255,255,255,0.4)'
                    : 'none',
                }}
              >
                {filled ? '✓' : nodeNum}
              </div>
              {/* соединитель */}
              {nodeNum < COMBAT_MAX_NODES && (
                <div
                  style={{
                    width: 3,
                    height: 6,
                    background:
                      level > nodeNum ? '#7c3aed' : 'rgba(0,0,0,0.12)',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Кнопка покупки следующего */}
      <button
        onClick={maxed || !affordable ? undefined : onBuy}
        disabled={maxed || !affordable}
        className="ff-btn"
        style={{
          marginTop: 6,
          fontSize: 12,
          padding: '8px 6px',
          width: '100%',
          opacity: maxed ? 0.5 : affordable ? 1 : 0.55,
          background: maxed
            ? 'linear-gradient(180deg, #9ca3af 0%, #6b7280 100%)'
            : 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
          color: '#fff',
          cursor: maxed || !affordable ? 'not-allowed' : 'pointer',
        }}
      >
        {maxed ? 'МАКС' : `💧 ${fmt(nextCost ?? 0)}`}
      </button>
    </div>
  )
}
