// BarracksActionButtons — React-оверлей с кнопками действий казармы.
// Заменяет сырые Phaser add.text-кнопки в BarracksScene на app-стиль (ff-btn).
//
// Кнопки:
//   ⬆ ПРОКАЧКА  — bottom-left   → 'barracks:open-combat-tree'
//   ⚔ В РЕЙД     — bottom-center → gate (пустая боевая зона) → 'starmap:open'
//
// Закрытие — повторный тап ⚔️ в футере (toggle). ✕ убран.
// Видимость: между 'barracks:open' и ('barracks:exit' | 'battle:start').
// Контейнер pointerEvents:none, каждая кнопка pointerEvents:auto.
//
// Корабль-носитель отряда убран — бой идёт прямо из казармы (boevaya zona).

import { useEffect, useState, type CSSProperties } from 'react'
import { eventBus } from '../../store/eventBus'
import { useGameStore } from '../../store/gameStore'
import { deckCount } from '../../store/barracks'
import { hapticSelection } from '../../utils/telegram'

export function BarracksActionButtons() {
  const [visible, setVisible] = useState(false)
  const barracksGrid = useGameStore((s) => s.barracksGrid)

  useEffect(() => {
    const onOpen = () => setVisible(true)
    const onHide = () => setVisible(false)
    eventBus.on('barracks:open', onOpen)
    eventBus.on('barracks:exit', onHide)
    eventBus.on('battle:start', onHide)
    return () => {
      eventBus.off('barracks:open', onOpen)
      eventBus.off('barracks:exit', onHide)
      eventBus.off('battle:start', onHide)
    }
  }, [])

  if (!visible) return null

  const handleTree = () => {
    hapticSelection()
    eventBus.emit('barracks:open-combat-tree', {})
  }

  const handleRaid = () => {
    hapticSelection()
    // Гейт — пустая боевая зона казармы → в рейд не пускаем.
    if (deckCount(barracksGrid) === 0) {
      eventBus.emit('cosmic:toast', {
        type: 'generic',
        msg: 'Поставь лягушек в боевую зону казармы',
        duration: 2500,
      })
      return
    }
    eventBus.emit('barracks:exit', {})
    requestAnimationFrame(() => eventBus.emit('starmap:open'))
  }

  const btnStyle: CSSProperties = { pointerEvents: 'auto', flex: '0 1 auto' }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 115,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(13% + env(safe-area-inset-bottom, 0px) + 10px)',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          pointerEvents: 'none',
        }}
      >
        <button
          className="ff-btn ff-btn-purple text-sm"
          onClick={handleTree}
          style={btnStyle}
        >
          ⬆ ПРОКАЧКА
        </button>
        <button
          className="ff-btn ff-btn-red text-sm"
          onClick={handleRaid}
          style={btnStyle}
        >
          ⚔ В РЕЙД
        </button>
      </div>
    </div>
  )
}
