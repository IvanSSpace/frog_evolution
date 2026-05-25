// RaidScoutLocationStack — кнопки переключения локаций для рейд-скаута.
// Те же кнопки (LocationButton) и та же позиция, что у фермы (LocationStack),
// но управляются локальным locId сцены через eventBus (а не gameStore).
//
// Сцена RaidScoutScene эмитит 'raid:scout-changed' { locId } при смене
// бота/локации → оверлей подсвечивает активную. Клик по кнопке →
// 'raid:scout-set-loc' { locId } → сцена переключает локацию.
//
// Видимость: показан между 'raid:scout-open' и ('raid:scout-exit' | 'battle:start').
// Поле LocationStack в это время скрыто (battleSceneActive=true), пересечения нет.

import { useEffect, useState } from 'react'
import { eventBus } from '../../store/eventBus'
import { getLocationById } from '../../store/gameStore'
import { hapticSelection } from '../../utils/telegram'
import { LocationButton } from './LocationButton'

// Скаут показывает 3 фарм-локации врага. Порядок сверху-вниз — как на ферме
// (LocationStack рендерит [...LOCATIONS].reverse()): 3 → 2 → 1, Болото внизу.
const SCOUT_LOC_IDS = [3, 2, 1] as const

export function RaidScoutLocationStack() {
  const [visible, setVisible] = useState(false)
  const [activeLocId, setActiveLocId] = useState(1)

  useEffect(() => {
    const onOpen = () => {
      setActiveLocId(1)
      setVisible(true)
    }
    const onHide = () => setVisible(false)
    const onChanged = ({ locId }: { locId: number }) => setActiveLocId(locId)
    eventBus.on('raid:scout-open', onOpen)
    eventBus.on('raid:scout-exit', onHide)
    eventBus.on('battle:start', onHide)
    eventBus.on('raid:scout-changed', onChanged)
    return () => {
      eventBus.off('raid:scout-open', onOpen)
      eventBus.off('raid:scout-exit', onHide)
      eventBus.off('battle:start', onHide)
      eventBus.off('raid:scout-changed', onChanged)
    }
  }, [])

  if (!visible) return null

  const handleSelect = (id: number) => {
    if (id === activeLocId) return
    hapticSelection()
    setActiveLocId(id)
    eventBus.emit('raid:scout-set-loc', { locId: id })
  }

  // Позиционирование 1-в-1 с LocationStack (top-right, вертикальный стек).
  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(var(--ui-top-offset) + var(--tg-chrome-pad) + 8px)',
        right: 8,
        left: 'auto',
        zIndex: 115,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 4,
      }}
    >
      {SCOUT_LOC_IDS.map((id) => (
        <LocationButton
          key={id}
          loc={getLocationById(id)}
          isCurrent={id === activeLocId}
          onClick={() => handleSelect(id)}
        />
      ))}
    </div>
  )
}
