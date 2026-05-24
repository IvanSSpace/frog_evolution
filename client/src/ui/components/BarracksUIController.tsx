// BarracksUIController — слушает события из BarracksScene и показывает
// React-popup'ы для добавления/удаления воинов + открытия RaidPick.

import { useEffect, useState } from 'react'
import { eventBus } from '../../store/eventBus'
import { useGameStore } from '../../store/gameStore'
import { WarriorPoolModal } from './WarriorPoolModal'
import { RaidPickModal } from './RaidPickModal'

export function BarracksUIController() {
  const [addSlotIdx, setAddSlotIdx] = useState<number | null>(null)
  const [raidPickOpen, setRaidPickOpen] = useState(false)
  const removeWarrior = useGameStore((s) => s.removeWarriorFromBarracks)

  useEffect(() => {
    const onAdd = ({ slotIdx }: { slotIdx: number }) => {
      setAddSlotIdx(slotIdx)
    }
    const onRemove = ({ slotIdx }: { slotIdx: number }) => {
      // MVP: direct remove без confirm.
      removeWarrior(slotIdx)
    }
    const onRaidPick = () => setRaidPickOpen(true)
    const onBattleStart = () => {
      setRaidPickOpen(false)
      setAddSlotIdx(null)
    }
    const onBarracksExit = () => {
      setRaidPickOpen(false)
      setAddSlotIdx(null)
    }
    eventBus.on('barracks:add-request', onAdd)
    eventBus.on('barracks:remove-request', onRemove)
    eventBus.on('barracks:open-raid-pick', onRaidPick)
    eventBus.on('battle:start', onBattleStart)
    eventBus.on('barracks:exit', onBarracksExit)
    return () => {
      eventBus.off('barracks:add-request', onAdd)
      eventBus.off('barracks:remove-request', onRemove)
      eventBus.off('barracks:open-raid-pick', onRaidPick)
      eventBus.off('battle:start', onBattleStart)
      eventBus.off('barracks:exit', onBarracksExit)
    }
  }, [removeWarrior])

  return (
    <>
      {addSlotIdx !== null && (
        <WarriorPoolModal
          slotIdx={addSlotIdx}
          onClose={() => setAddSlotIdx(null)}
        />
      )}
      {raidPickOpen && (
        <RaidPickModal onClose={() => setRaidPickOpen(false)} />
      )}
    </>
  )
}
