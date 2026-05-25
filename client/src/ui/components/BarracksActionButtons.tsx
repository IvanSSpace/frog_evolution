// BarracksActionButtons — React-оверлей с кнопками действий казармы.
// Заменяет сырые Phaser add.text-кнопки в BarracksScene на app-стиль (ff-btn).
//
// Кнопки:
//   ✕ ВЫХОД          — top-right    → 'barracks:exit'
//   ⬆ ПРОКАЧКА        — bottom-left  → 'barracks:open-combat-tree'
//   🚀 В КОРАБЛЬ       — bottom-right → грузит отряд в корабль + открывает корабль.
//                       Если корабль НЕ на орбите home → «↩ ОТОЗВАТЬ» + таймер прилёта.
//   ⚔ В РЕЙД          — bottom-center → gate (пустой экипаж) → 'starmap:open'
//
// Видимость: между 'barracks:open' и ('barracks:exit' | 'battle:start').
// Контейнер pointerEvents:none, каждая кнопка pointerEvents:auto.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { eventBus } from '../../store/eventBus'
import { useGameStore } from '../../store/gameStore'
import { deckCount } from '../../store/barracks'
import { hapticSelection, hapticNotification } from '../../utils/telegram'

export function BarracksActionButtons() {
  const [visible, setVisible] = useState(false)
  const barracksGrid = useGameStore((s) => s.barracksGrid)
  const shipCrew = useGameStore((s) => s.shipCrew)
  const ship = useGameStore((s) => s.ship)
  const loadDeckIntoShip = useGameStore((s) => s.loadDeckIntoShip)
  const sendShipTo = useGameStore((s) => s.sendShipTo)
  const arriveShipAt = useGameStore((s) => s.arriveShipAt)

  // Тик для таймера прилёта (только когда корабль в transit).
  const inTransit = ship?.state === 'transit'
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!inTransit) return
    const t = window.setInterval(() => setNowMs(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [inTransit])

  // Авто-док по истечении transit (на случай если StarMap-тик не активен,
  // т.к. игрок в казарме — иначе корабль «завис» бы в полёте).
  const remainMs =
    ship?.state === 'transit' ? Math.max(0, ship.arrivesAt - nowMs) : 0
  useEffect(() => {
    if (ship?.state === 'transit' && remainMs <= 0) {
      arriveShipAt(ship.toPlanetId)
    }
  }, [ship, remainMs, arriveShipAt])

  useEffect(() => {
    const onOpen = () => setVisible(true)
    const onHide = () => setVisible(false)
    eventBus.on('barracks:open', onOpen)
    eventBus.on('barracks:exit', onHide)
    eventBus.on('battle:start', onHide)
    // Открыли корабль из казармы → казарма усыпает, прячем её кнопки.
    eventBus.on('ship:open', onHide)
    return () => {
      eventBus.off('barracks:open', onOpen)
      eventBus.off('barracks:exit', onHide)
      eventBus.off('battle:start', onHide)
      eventBus.off('ship:open', onHide)
    }
  }, [])

  if (!visible) return null

  const atHome = !ship || (ship.state === 'docked' && ship.planetId === 'home')
  const crewCount = shipCrew.filter(Boolean).length

  const toast = (msg: string) =>
    eventBus.emit('cosmic:toast', { type: 'generic', msg, duration: 2500 })

  const handleTree = () => {
    hapticSelection()
    eventBus.emit('barracks:open-combat-tree', {})
  }

  // 🚀 Грузим воинов из боевой зоны казармы в корабль + открываем корабль.
  const handleLoadShip = () => {
    if (deckCount(barracksGrid) === 0) {
      hapticNotification('error')
      toast('Нет воинов в боевой зоне казармы')
      return
    }
    hapticSelection()
    loadDeckIntoShip()
    eventBus.emit('ship:open', {})
  }

  // ↩ Корабль не дома — отзываем на home (sendShipTo считает время прилёта).
  const handleRecall = () => {
    hapticSelection()
    sendShipTo('home')
  }

  const handleRaid = () => {
    hapticSelection()
    // Гейт — отряд теперь в КОРАБЛЕ. Пустой экипаж → в рейд не пускаем.
    if (crewCount === 0) {
      toast('Загрузи отряд в корабль (🚀 В КОРАБЛЬ)')
      return
    }
    eventBus.emit('barracks:exit', {})
    requestAnimationFrame(() => eventBus.emit('starmap:open'))
  }

  // Контекстная кнопка корабля (label/цвет зависят от позиции корабля).
  const btnStyle: CSSProperties = { pointerEvents: 'auto', flex: '0 1 auto' }
  let shipButton: ReactNode
  if (atHome) {
    shipButton = (
      <button
        className="ff-btn ff-btn-green text-sm"
        onClick={handleLoadShip}
        style={btnStyle}
      >
        🚀 В КОРАБЛЬ
      </button>
    )
  } else if (inTransit) {
    const sec = Math.ceil(remainMs / 1000)
    shipButton = (
      <button
        className="ff-btn ff-btn-grey text-sm"
        onClick={handleRecall}
        style={btnStyle}
        title="Перенаправить корабль домой"
      >
        🛸 {sec}s
      </button>
    )
  } else {
    // docked не дома
    shipButton = (
      <button
        className="ff-btn ff-btn-amber text-sm"
        onClick={handleRecall}
        style={btnStyle}
        title="Отозвать корабль домой"
      >
        ↩ ОТОЗВАТЬ
      </button>
    )
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
      {/* Закрытие — повторный тап ⚔️ в футере (toggle). ✕ убран. */}

      {/* Нижний ряд действий — flex с gap, без наложений. */}
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
        {shipButton}
      </div>
    </div>
  )
}
