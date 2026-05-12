// HUD Звёздной карты — координаты, zoom, FPS. DOM-overlay поверх Phaser canvas.
// Появляется только когда StarMap активен.

import { useEffect, useState } from 'react'
import { eventBus } from '../../store/eventBus'

export function StarMapHUD() {
  const [active, setActive] = useState(false)
  const [data, setData] = useState({
    x: 0,
    y: 0,
    zoom: 1,
    fps: 60,
    vis: 0,
    total: 0,
  })

  useEffect(() => {
    const onOpen = () => setActive(true)
    const onClose = () => setActive(false)
    eventBus.on('starmap:open', onOpen)
    eventBus.on('starmap:close', onClose)
    return () => {
      eventBus.off('starmap:open', onOpen)
      eventBus.off('starmap:close', onClose)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    // 10Hz вместо 60Hz: HUD это координаты/FPS — глаз не отличит обновление
    // чаще. Снимает React re-render каждый кадр (~1-2ms на mobile).
    const id = window.setInterval(async () => {
      const { getStarMapHUD } = await import('../../game')
      const d = getStarMapHUD()
      if (d) setData(d)
    }, 100)
    return () => window.clearInterval(id)
  }, [active])

  if (!active) return null

  const fpsColor =
    data.fps > 50 ? '#86efac' : data.fps > 30 ? '#fde047' : '#fca5a5'
  return (
    <div
      style={{
        position: 'fixed',
        top: 6,
        left: 8,
        zIndex: 200,
        pointerEvents: 'none',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        lineHeight: 1.3,
        color: '#ffd700',
        textShadow: '0 0 3px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.95)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        display: 'flex',
        gap: 8,
      }}
    >
      <span>X:{data.x}</span>
      <span>Y:{data.y}</span>
      <span>Z:{data.zoom.toFixed(2)}</span>
      <span style={{ color: fpsColor }}>FPS:{Math.round(data.fps)}</span>
      <span style={{ opacity: 0.7 }}>
        {data.vis}/{data.total}
      </span>
    </div>
  )
}
