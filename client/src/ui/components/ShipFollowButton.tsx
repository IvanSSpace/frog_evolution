// ShipFollowButton — toggle camera-follow-ship mode on StarMap.
// Only visible when StarMap is open AND ship is in transit.

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

  // Scene cancels follow (e.g. drag or ship docked)
  useEffect(() => {
    const handler = ({ following: f }: { following: boolean }) =>
      setFollowing(f)
    eventBus.on('starmap:follow-changed', handler)
    return () => eventBus.off('starmap:follow-changed', handler)
  }, [])

  if (!starMapActive || shipState !== 'transit') return null

  const toggle = () => {
    const next = !following
    setFollowing(next)
    eventBus.emit('starmap:follow-ship', { enable: next })
  }

  return (
    <button
      onClick={toggle}
      aria-label={following ? 'Отключить слежение' : 'Следовать за кораблём'}
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
        border: following
          ? '1.5px solid #34d399'
          : '1.5px solid rgba(255,255,255,0.25)',
        background: following ? 'rgba(16,185,129,0.18)' : 'rgba(0,0,0,0.55)',
        color: following ? '#34d399' : 'rgba(255,255,255,0.7)',
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
      <span style={{ fontSize: 14 }}>{following ? '📍' : '🚀'}</span>
      {following ? 'Следую' : 'Следовать'}
    </button>
  )
}
