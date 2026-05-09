import { useEffect, useRef } from 'react'
import { audioPlayer } from '../audioPlayer'

type Props = {
  active: boolean
}

export function Visualizer({ active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let last = 0
    const draw = (): void => {
      const now = performance.now()
      if (now - last < 33) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      last = now

      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)

      const analyser = audioPlayer.getAnalyser()
      if (analyser) {
        const buf = analyser.getValue() as Float32Array
        ctx.strokeStyle = 'rgba(190, 242, 100, 0.25)'
        ctx.lineWidth = 5
        ctx.beginPath()
        const step = w / buf.length
        for (let i = 0; i < buf.length; i++) {
          const x = i * step
          const y = (buf[i] * 0.55 + 0.5) * h
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()

        ctx.strokeStyle = 'rgba(74, 222, 128, 0.95)'
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let i = 0; i < buf.length; i++) {
          const x = i * step
          const y = (buf[i] * 0.55 + 0.5) * h
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="ff-card"
      style={{
        width: '100%',
        height: 80,
        padding: 0,
        background: '#0f1f0f',
      }}
    />
  )
}
