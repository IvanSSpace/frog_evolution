// Phase 24 Plan 24-04 — Captain birth Beat 4 + Beat 5 coordinator.
//
// Подписан на eventBus 'captain:birth-cta' (эмитит CaptainBirthModal в Plan 24-03
// после CTA-tap'а или backdrop click). Выполняет:
//   - Beat 4: символический spawn L1 frog на ТЕКУЩЕЙ локации игрока
//     (per CONTEXT Claude's Discretion: на currentLocation, не на Лужу).
//     FrogSpawner подхватит store update через existing spawn flow.
//   - Beat 5: eventBus.emit('starmap:open') — LocationStack subscribe'нут,
//     setStarMapActive(true), Phaser StarMapScene открывается.
//
// install() — idempotent (повторный вызов снимает старый handler и ставит новый).
// Вызывается из App.tsx один раз на boot (НЕ под DEV gate).

import { eventBus } from '../../store/eventBus'
import { useGameStore } from '../../store/gameStore'

let uninstall: (() => void) | null = null

export function installCaptainBirthController(): void {
  if (uninstall) {
    uninstall()
    uninstall = null
  }

  const handler = () => {
    // Beat 4: spawn L1 frog на текущей локации.
    const store = useGameStore.getState()
    const currentLoc = store.currentLocation
    store.addFrogToLocation(currentLoc, 1)

    // Beat 5: open Star Map.
    eventBus.emit('starmap:open')
  }

  eventBus.on('captain:birth-cta', handler)
  uninstall = () => eventBus.off('captain:birth-cta', handler)
}
