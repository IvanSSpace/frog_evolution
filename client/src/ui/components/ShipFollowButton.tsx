import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'

export function ShipFollowButton() {
  const shipState = useGameStore((s) => s.ship?.state)
  const [following, setFollowing] = useState(false)
  const [starMapActive, setStarMapActive] = useState(false)

  useEffect(() => {
    const onOpen = () => setStarMapActive(true)
    const onClose = () => {
      setStarMapActive(false)
      setFollowing(false)
    }
    eventBus.on('starmap:open', onOpen)
    eventBus.on('starmap:close', onClose)
    return () => {
      eventBus.off('starmap:open', onOpen)
      eventBus.off('starmap:close', onClose)
    }
  }, [])

  useEffect(() => {
    const handler = ({ following: f }: { following: boolean }) =>
      setFollowing(f)
    eventBus.on('starmap:follow-changed', handler)
    return () => eventBus.off('starmap:follow-changed', handler)
  }, [])

  // Reset following когда ship меняет state с transit на docked
  useEffect(() => {
    if (shipState !== 'transit') setFollowing(false)
  }, [shipState])

  if (!starMapActive) return null

  const isTransit = shipState === 'transit'

  const handleClick = () => {
    if (isTransit) {
      const next = !following
      setFollowing(next)
      eventBus.emit('starmap:follow-ship', { enable: next })
    } else {
      // Docked — one-shot center
      eventBus.emit('starmap:goto-ship')
    }
  }

  // Label + style по контексту
  let label: string
  let icon: string
  let isActive: boolean

  if (isTransit) {
    icon = following ? '📍' : '🚀'
    label = following ? 'Следую' : 'Следовать'
    isActive = following
  } else {
    icon = '🚀'
    label = 'К кораблю'
    isActive = false
  }

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      style={{
        position: 'fixed',
        top: 'calc(12% + 10px)',
        left: 12,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 20,
        border: isActive
          ? '1.5px solid #34d399'
          : '1.5px solid rgba(255,255,255,0.25)',
        background: isActive ? 'rgba(16,185,129,0.18)' : 'rgba(0,0,0,0.55)',
        color: isActive ? '#34d399' : 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: 600,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        cursor: 'pointer',
        pointerEvents: 'auto',
        transition: 'all 0.2s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  )
}
