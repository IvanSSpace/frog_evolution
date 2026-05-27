// BarracksUIController — слушает события из BarracksScene и показывает
// React-popup'ы для добавления/удаления воинов + открытия RaidPick.

import { useEffect, useState } from 'react'
import { eventBus } from '../../store/eventBus'
import { useGameStore } from '../../store/gameStore'
import { WarriorPoolModal } from './WarriorPoolModal'
import { CombatTreeModal } from './CombatTreeModal'

// Блок переноса лягушек в казарму (WarriorPoolModal) временно скрыт:
// мета-сложность управления отрядом убрана из текущего билда.
// Вся логика (addWarriorToBarracks, событие 'barracks:add-request',
// drag/swap в BarracksScene) сохранена — чтобы вернуть блок, переключи
// флаг в true. Скрываем на уровне рендера модалки, сцену не трогаем.
const WARRIOR_POOL_ENABLED = false

export function BarracksUIController() {
  const [addSlotIdx, setAddSlotIdx] = useState<number | null>(null)
  const [combatTreeOpen, setCombatTreeOpen] = useState(false)
  const removeWarrior = useGameStore((s) => s.removeWarriorFromBarracks)

  useEffect(() => {
    const onAdd = ({ slotIdx }: { slotIdx: number }) => {
      setAddSlotIdx(slotIdx)
    }
    const onRemove = ({ slotIdx }: { slotIdx: number }) => {
      // MVP: direct remove без confirm.
      removeWarrior(slotIdx)
    }
    const onCombatTree = () => setCombatTreeOpen(true)
    const onBattleStart = () => {
      setAddSlotIdx(null)
      setCombatTreeOpen(false)
    }
    const onBarracksExit = () => {
      setAddSlotIdx(null)
      setCombatTreeOpen(false)
    }
    eventBus.on('barracks:add-request', onAdd)
    eventBus.on('barracks:remove-request', onRemove)
    eventBus.on('barracks:open-combat-tree', onCombatTree)
    eventBus.on('battle:start', onBattleStart)
    eventBus.on('barracks:exit', onBarracksExit)
    return () => {
      eventBus.off('barracks:add-request', onAdd)
      eventBus.off('barracks:remove-request', onRemove)
      eventBus.off('barracks:open-combat-tree', onCombatTree)
      eventBus.off('battle:start', onBattleStart)
      eventBus.off('barracks:exit', onBarracksExit)
    }
  }, [removeWarrior])

  return (
    <>
      {WARRIOR_POOL_ENABLED && addSlotIdx !== null && (
        <WarriorPoolModal
          slotIdx={addSlotIdx}
          onClose={() => setAddSlotIdx(null)}
        />
      )}
      {combatTreeOpen && (
        <CombatTreeModal onClose={() => setCombatTreeOpen(false)} />
      )}
    </>
  )
}
