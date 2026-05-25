// BarracksButton — кнопка казармы (PvP raid mode entry).
//
// Маленький блок снизу справа. Открывает BarracksModal при клике.
// Visible после первого discovered[7] (открытие Леса) — auto-unlocks barracks.
// Юзер позже заменит иконку.

import { useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { hapticSelection } from '../../utils/telegram'
import { eventBus } from '../../store/eventBus'

export function BarracksButton() {
  const discoveredLevels = useGameStore((s) => s.discoveredLevels)
  const barracksUnlocked = useGameStore((s) => s.barracksUnlocked)
  const unlockBarracks = useGameStore((s) => s.unlockBarracks)
  const battleSceneActive = useGameStore((s) => s.battleSceneActive)

  // Auto-unlock при первом discovered L7+ (Лес).
  useEffect(() => {
    if (barracksUnlocked) return
    if (discoveredLevels.some((l) => l >= 7)) {
      unlockBarracks()
    }
  }, [discoveredLevels, barracksUnlocked, unlockBarracks])

  if (!barracksUnlocked) return null
  if (battleSceneActive) return null

  return (
    <button
      onClick={() => {
        hapticSelection()
        eventBus.emit('barracks:open', {})
      }}
      aria-label="Казарма"
      style={{
        position: 'fixed',
        // Below BottomBar — на нижней кромке экрана, вне зоны прыжков лягушек.
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)',
        right: 6,
        zIndex: 60,
        pointerEvents: 'auto',
        width: 36,
        height: 36,
        ['--ff-tile-from' as never]: '#fca5a5',
        ['--ff-tile-to' as never]: '#dc2626',
        ['--ff-tile-border' as never]: '#7f1d1d',
        color: '#fff',
        fontSize: 18,
        lineHeight: 1,
      }}
      className="ff-tile"
    >
      ⚔️
    </button>
  )
}
