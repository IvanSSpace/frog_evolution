// RaidLootModal — показывает результат рейда: slime, серумы, потери.
// Открывается после raid:battle-ended. Закрытие → auto-return ship home.

import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/gameStore'
import { useModalLock } from '../../utils/modalLock'
import { fmt } from '../../utils/formatting'
import type { Element } from '../../store/cosmic/types'

interface Props {
  slime: number
  element: Element | null
  serumCount: number
  deadCount: number
  victory: boolean
  onClose: () => void
}

export function RaidLootModal({
  slime,
  element,
  serumCount,
  deadCount,
  victory,
  onClose,
}: Props) {
  useModalLock()
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 280,
        pointerEvents: 'auto',
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #1f2937 0%, #111827 100%)',
          border: `3px solid ${victory ? '#16a34a' : '#dc2626'}`,
          borderRadius: 16,
          padding: 20,
          maxWidth: 340,
          width: '100%',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 12,
            color: victory ? '#4ade80' : '#fca5a5',
          }}
        >
          {victory ? '🏆 Победа!' : '💀 Поражение'}
        </div>

        {victory && slime > 0 && (
          <div style={{ marginBottom: 10, fontSize: 16 }}>
            💧 <b>+{fmt(slime)}</b> слизи
          </div>
        )}

        {victory && element && serumCount > 0 && (
          <div style={{ marginBottom: 10, fontSize: 16 }}>
            🧪 <b>+{serumCount}</b> сыворотка ({element})
          </div>
        )}

        {deadCount > 0 && (
          <div
            style={{
              marginTop: 10,
              marginBottom: 14,
              fontSize: 14,
              color: '#fca5a5',
              padding: '8px 12px',
              background: 'rgba(220,38,38,0.15)',
              border: '1px solid rgba(220,38,38,0.4)',
              borderRadius: 8,
            }}
          >
            ⚰️ Погибло юнитов: <b>{deadCount}</b>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
              Слоты в казарме освобождены
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            background: 'linear-gradient(180deg, #4ade80 0%, #16a34a 100%)',
            border: '2px solid #14532d',
            borderRadius: 10,
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            touchAction: 'manipulation',
            marginTop: 4,
          }}
        >
          🛰 Вернуться на базу
        </button>
      </div>
    </div>,
    document.body,
  )
}

export function RaidLootModalController() {
  const loot = useGameStore((s) => s.raidLoot)
  const setLoot = useGameStore((s) => s.setRaidLoot)
  if (!loot) return null
  return (
    <RaidLootModal
      slime={loot.slime}
      element={loot.element}
      serumCount={loot.serumCount}
      deadCount={loot.deadCount}
      victory={loot.victory}
      onClose={() => setLoot(null)}
    />
  )
}
