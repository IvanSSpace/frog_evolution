// RaidFlowController — orchestrator всего raid жизненного цикла.
// 1. raid:battle-start (from InvestigateModal) → store enemyDeck/element → emit battle:start
// 2. raid:battle-ended (from BattleScene) → apply losses to barracksGrid → set loot → cleanup
// 3. RaidLootModal close → request flight home (cinematic) → cleanup investigatePlanetId

import { useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'

export function RaidFlowController() {
  const investigatePlanetId = useGameStore((s) => s.investigatePlanetId)
  const setInvestigatePlanetId = useGameStore(
    (s) => s.setInvestigatePlanetId,
  )
  const setRaidLoot = useGameStore((s) => s.setRaidLoot)

  // raid:battle-start → emit battle:start с raid context (enemyDeck сохраняется
  // в planet через investigatePlanetId — BattleScene прочитает).
  useEffect(() => {
    const onBattleStart = (e: { planetId: string }) => {
      // currentLocation влияет на rewards формулы BattleScene. Используем
      // production-grade: location 1 для всех raid'ов пока (rewards × tier later).
      eventBus.emit('battle:start', { locationId: 1, planetId: e.planetId })
    }
    eventBus.on('raid:battle-start', onBattleStart)
    return () => {
      eventBus.off('raid:battle-start', onBattleStart)
    }
  }, [])

  // raid:scout-exit (из RaidScoutScene «Назад») → вернуть InvestigateModal
  // на осмотренную планету. scoutPlanetId запомнен при «Осмотреть».
  useEffect(() => {
    const onScoutExit = () => {
      const store = useGameStore.getState()
      const pid = store.scoutPlanetId
      if (!pid) return
      store.setScoutPlanetId(null)
      store.setInvestigatePlanetId(pid)
    }
    eventBus.on('raid:scout-exit', onScoutExit)
    return () => {
      eventBus.off('raid:scout-exit', onScoutExit)
    }
  }, [])

  // raid:battle-ended → apply losses + open loot modal.
  useEffect(() => {
    const onBattleEnded = (e: {
      victory: boolean
      deadSlotIdxs: number[]
      planetId: string
    }) => {
      const store = useGameStore.getState()

      // 1. Apply losses — мёртвые юниты исчезают из barracksGrid.
      for (const slotIdx of e.deadSlotIdxs) {
        store.setBarracksCell(slotIdx, null)
      }

      // 2. Compute loot — только слайм (серум как награда отключён).
      let slime = 0
      if (e.victory) {
        // Slime — base + bonus за количество живых юнитов (proxy на performance).
        const baseSlime = 1500
        slime = baseSlime + Math.floor(Math.random() * 800)
        store.addGold(slime)
      }

      // 3. Open loot modal — закрытие триггерит auto return.
      setRaidLoot({
        slime,
        element: null,
        serumCount: 0,
        deadCount: e.deadSlotIdxs.length,
        victory: e.victory,
      })
    }
    eventBus.on('raid:battle-ended', onBattleEnded)
    return () => {
      eventBus.off('raid:battle-ended', onBattleEnded)
    }
  }, [setRaidLoot])

  // RaidLootModal close → auto return home. Watch raidLoot transitioning к null.
  // Используем effect на raidLoot: если был non-null а станет null И есть
  // investigatePlanetId → request flight home.
  useEffect(() => {
    let prevLoot = useGameStore.getState().raidLoot
    const unsub = useGameStore.subscribe((state) => {
      const cur = state.raidLoot
      if (prevLoot !== null && cur === null) {
        // Loot закрыт — отправляем корабль домой.
        eventBus.emit('cosmic:request-flight', { planetId: 'home' })
        // Reset investigatePlanetId после короткой задержки (даём ship transit
        // запуститься перед очисткой контекста).
        setTimeout(() => setInvestigatePlanetId(null), 200)
      }
      prevLoot = cur
    })
    return () => unsub()
  }, [setInvestigatePlanetId])

  void investigatePlanetId // подписка идёт через useGameStore.subscribe
  return null
}
