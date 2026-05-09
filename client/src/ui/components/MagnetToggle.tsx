// MagnetToggle — toggle button for the magnet upgrade.
// Visible only on swamp location (1) when player has bought magnet upgrade
// and is not on StarMap.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { hapticSelection } from '../../utils/telegram'

export function MagnetToggle() {
  const { t } = useTranslation()
  const magnetLevel = useGameStore((s) => s.upgrades.magnet)
  const magnetEnabled = useGameStore((s) => s.magnetEnabled)
  const toggleMagnet = useGameStore((s) => s.toggleMagnet)
  const currentLocation = useGameStore((s) => s.currentLocation)
  const [starMapActive, setStarMapActive] = useState(false)

  useEffect(() => {
    const onOpen = () => setStarMapActive(true)
    const onClose = () => setStarMapActive(false)
    eventBus.on('starmap:open', onOpen)
    eventBus.on('starmap:close', onClose)
    return () => {
      eventBus.off('starmap:open', onOpen)
      eventBus.off('starmap:close', onClose)
    }
  }, [])

  if (magnetLevel < 1) return null
  if (currentLocation !== 1) return null
  if (starMapActive) return null // на Звёздной карте магнит не нужен

  return (
    <button
      onClick={() => {
        hapticSelection()
        toggleMagnet()
      }}
      aria-label={magnetEnabled ? t('magnet.off') : t('magnet.on')}
      style={{
        position: 'fixed',
        top: 'calc(12% + 2px)',
        left: 12,
        zIndex: 50,
        pointerEvents: 'auto',
        ['--ff-tile-from' as never]: magnetEnabled ? '#fcd34d' : '#9ca3af',
        ['--ff-tile-to' as never]: magnetEnabled ? '#d97706' : '#4b5563',
        ['--ff-tile-border' as never]: magnetEnabled ? '#78350f' : '#1f2937',
        opacity: magnetEnabled ? 1 : 0.7,
      }}
      className="ff-tile w-12 h-12 text-2xl"
    >
      <span
        style={{
          filter: magnetEnabled
            ? 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))'
            : 'grayscale(0.7)',
        }}
      >
        🧲
      </span>
      {!magnetEnabled && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626',
            fontSize: '32px',
            fontWeight: 900,
            textShadow:
              '0 0 4px rgba(255,255,255,0.85), 0 0 6px rgba(255,255,255,0.6)',
            pointerEvents: 'none',
          }}
        >
          ⊘
        </span>
      )}
    </button>
  )
}
