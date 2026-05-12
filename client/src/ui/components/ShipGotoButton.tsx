// ShipGotoButton — teleport camera to ship's current position (one-shot, no follow).
// Visible whenever StarMap is open.

import { useEffect, useState } from 'react'
import { eventBus } from '../../store/eventBus'

export function ShipGotoButton() {
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

  if (!starMapActive) return null

  const handleClick = () => {
    eventBus.emit('starmap:goto-ship')
  }

  return (
    <button
      onClick={handleClick}
      aria-label="К кораблю"
      style={{
        position: 'fixed',
        top: 'calc(12% + 10px)',
        left: 140,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 20,
        border: '1.5px solid rgba(255,255,255,0.25)',
        background: 'rgba(0,0,0,0.55)',
        color: 'rgba(255,255,255,0.7)',
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
      <span style={{ fontSize: 14 }}>🚀</span>К кораблю
    </button>
  )
}
