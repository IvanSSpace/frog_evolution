// RaidStarMapController — controller для raid mode на StarMap.
// Когда raidMode=true:
//   - показывает banner "Выберите цель"
//   - target cycler bottom-right (prev/next через MAIN_RACES)
//   - кнопка отмены сбрасывает raidMode
//
// Logic flow:
//   1. Игрок тапает race-планету → стандартный popover (Лететь/Изучить)
//   2. Корабль летит → docked на планете
//   3. Игрок жмёт «🔬 Изучить» в popover'е → InvestigateModal открывается
//      (popovers.ts: при raidMode «Изучить» = открыть InvestigateModal вместо box)
//   4. Атака / Уйти → дальше через RaidFlowController.

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { MAIN_RACES } from '../../game/scenes/starmap/planetarium'

export function RaidStarMapController() {
  const raidMode = useGameStore((s) => s.raidMode)
  const setRaidMode = useGameStore((s) => s.setRaidMode)
  const [targetIdx, setTargetIdx] = useState(0)

  const targets = useMemo(
    () => MAIN_RACES.filter((r) => r.id !== 'home'),
    [],
  )

  if (!raidMode) return null

  const handleCancel = () => {
    setRaidMode(false)
  }

  return createPortal(
    <>
      <div
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + var(--tg-chrome-pad) + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 250,
          pointerEvents: 'auto',
          background: 'linear-gradient(180deg, #dc2626 0%, #7f1d1d 100%)',
          border: '2px solid #fca5a5',
          borderRadius: 14,
          padding: '8px 16px',
          color: '#fff',
          fontWeight: 700,
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 4px 0 rgba(0,0,0,0.35)',
          whiteSpace: 'nowrap',
        }}
      >
        <span>🎯 Лети к цели и жми «Изучить»</span>
        <button
          type="button"
          onClick={handleCancel}
          style={{
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 12,
            padding: '4px 10px',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          Отмена
        </button>
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          right: 12,
          zIndex: 250,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(15, 23, 10, 0.88)',
          border: '2px solid rgba(220,38,38,0.6)',
          borderRadius: 12,
          padding: '6px 8px',
          boxShadow: '0 4px 0 rgba(0,0,0,0.35)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            const next = (targetIdx - 1 + targets.length) % targets.length
            setTargetIdx(next)
            eventBus.emit('starmap:focus-planet', { planetId: targets[next].id })
          }}
          style={{
            background: 'linear-gradient(180deg, #dc2626 0%, #7f1d1d 100%)',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            color: '#fff',
            fontSize: 16,
            width: 32,
            height: 32,
            cursor: 'pointer',
            touchAction: 'manipulation',
            lineHeight: 1,
            fontWeight: 700,
          }}
          aria-label="Предыдущая цель"
        >
          ‹
        </button>
        <div
          style={{
            color: '#fef9d7',
            fontSize: 11,
            fontWeight: 700,
            minWidth: 44,
            textAlign: 'center',
            padding: '0 4px',
            lineHeight: 1.1,
          }}
        >
          {targetIdx + 1} / {targets.length}
        </div>
        <button
          type="button"
          onClick={() => {
            const next = (targetIdx + 1) % targets.length
            setTargetIdx(next)
            eventBus.emit('starmap:focus-planet', { planetId: targets[next].id })
          }}
          style={{
            background: 'linear-gradient(180deg, #dc2626 0%, #7f1d1d 100%)',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            color: '#fff',
            fontSize: 16,
            width: 32,
            height: 32,
            cursor: 'pointer',
            touchAction: 'manipulation',
            lineHeight: 1,
            fontWeight: 700,
          }}
          aria-label="Следующая цель"
        >
          ›
        </button>
      </div>
    </>,
    document.body,
  )
}
