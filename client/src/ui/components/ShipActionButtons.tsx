// ShipActionButtons — React-оверлей кнопок интерьера корабля (ShipScene).
//   ✕ ВЫХОД      — top-right → 'ship:exit' (назад в казарму)
//   🛬 ВЫГРУЗИТЬ  — bottom-left → вернуть экипаж в казарму + выход
//
// Видимость: между 'ship:open' и ('ship:exit' | 'battle:start').

import { useEffect, useState } from 'react'
import { eventBus } from '../../store/eventBus'
import { useGameStore } from '../../store/gameStore'
import { hapticSelection } from '../../utils/telegram'

export function ShipActionButtons() {
  const [visible, setVisible] = useState(false)
  const unloadShip = useGameStore((s) => s.unloadShipToBarracks)

  useEffect(() => {
    const onOpen = () => setVisible(true)
    const onHide = () => setVisible(false)
    eventBus.on('ship:open', onOpen)
    eventBus.on('ship:exit', onHide)
    eventBus.on('battle:start', onHide)
    eventBus.on('barracks:open', onHide)
    return () => {
      eventBus.off('ship:open', onOpen)
      eventBus.off('ship:exit', onHide)
      eventBus.off('battle:start', onHide)
      eventBus.off('barracks:open', onHide)
    }
  }, [])

  if (!visible) return null

  const handleUnload = () => {
    hapticSelection()
    unloadShip()
    eventBus.emit('ship:exit', {})
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 115,
        pointerEvents: 'none',
      }}
    >
      {/* Закрытие — повторный тап 🚀 в футере (toggle). ✕ убран. */}
      <button
        className="ff-btn ff-btn-amber text-sm"
        onClick={handleUnload}
        style={{
          position: 'absolute',
          bottom: 'calc(13% + env(safe-area-inset-bottom, 0px) + 10px)',
          left: 12,
          pointerEvents: 'auto',
        }}
      >
        🛬 ВЫГРУЗИТЬ
      </button>
    </div>
  )
}
