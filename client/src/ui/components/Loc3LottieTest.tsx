// Loc3LottieTest — DOM-оверлей зелёного огня на Loc3.
//
// Рантайм: lottie-web БАНДЛИТСЯ локально (Vite), без внешнего CDN/WASM — раньше
// dotlottie-wc тянулся с esm.sh и, похоже, вызывал петлю перезагрузки в dev/WebView.
// Анимация — локальный /loc3_anim.json (зелёный, перетаймлен в [0,84], loop без паузы).
//
// Позиция: считается каждый кадр от #game-canvas rect + scroll-progress поля
// (getFieldScroll) → огни едут вместе с двухзонной картой. Clip-контейнер
// (overflow:hidden) обрезает их по границе игрового вида (не лезут на футер/хедер).
// За зумом смены локаций не следят. Координаты/уровни — заданы автором.

import { useEffect, useRef } from 'react'
import lottie from 'lottie-web'
import { useGameStore } from '../../store/gameStore'
import { getFieldScroll } from '../../game/index'
import { fireFilter, useFireLevel } from './fireLevels'

const LOTTIE_URL = '/loc3_anim.json'

// Точки размещения (доли канваса/зоны) — заданы автором.
const SPOTS = [
  { xFrac: 0.419, yFrac: 0.13 },
  { xFrac: 0.698, yFrac: 0.182 },
]
const SIZE = 80

export function Loc3LottieTest() {
  const currentLocation = useGameStore((s) => s.currentLocation)
  useFireLevel() // подписка: ре-рендер при смене уровня любого огня
  const clipRef = useRef<HTMLDivElement | null>(null)
  const spotRefs = useRef<(HTMLDivElement | null)[]>([])

  const active = currentLocation === 3

  // Каждый кадр: clip-контейнер = прямоугольник канваса; огни внутри = absolute
  // от контейнера: xFrac/yFrac зоны + scroll-progress (едут с картой).
  useEffect(() => {
    if (!active) return
    let raf = 0
    const loop = () => {
      const canvas = document.getElementById('game-canvas')
      const fs = getFieldScroll()
      const clip = clipRef.current
      if (canvas && fs && clip) {
        const r = canvas.getBoundingClientRect()
        clip.style.left = `${r.left}px`
        clip.style.top = `${r.top}px`
        clip.style.width = `${r.width}px`
        clip.style.height = `${r.height}px`
        const off = 1 - fs.progress // 0 в зоне зданий, 1 в зоне лягушек
        SPOTS.forEach((s, i) => {
          const el = spotRefs.current[i]
          if (!el) return
          el.style.left = `${s.xFrac * r.width}px`
          el.style.top = `${(s.yFrac + off) * r.height}px`
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])

  if (!active) return null

  return (
    <div
      ref={clipRef}
      style={{
        position: 'fixed',
        left: -9999,
        top: -9999,
        width: 0,
        height: 0,
        overflow: 'hidden', // обрезает огни по границе игрового канваса
        zIndex: 40,
        pointerEvents: 'none',
      }}
    >
      {SPOTS.map((_s, i) => (
        <div
          key={i}
          ref={(el) => {
            spotRefs.current[i] = el
          }}
          style={{
            position: 'absolute',
            left: -9999,
            top: -9999,
            transform: 'translate(-50%, -50%)',
            width: SIZE,
            height: SIZE,
            pointerEvents: 'none',
            filter: fireFilter(i), // уровень горения этого огня (per-fire)
          }}
        >
          <LottieSpot />
        </div>
      ))}
    </div>
  )
}

// Один экземпляр анимации через bundled lottie-web (SVG-рендер, loop).
function LottieSpot() {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    const anim = lottie.loadAnimation({
      container,
      // canvas-renderer вместо svg: SVG-Lottie строит большое DOM-дерево и
      // анимирует его атрибуты каждый кадр (тяжёлый repaint, просадка FPS на
      // Loc3). Canvas рисует в один <canvas> 2D-контекстом — намного легче.
      // NB: canvas не поддерживает часть SVG-фич (маски/matte) — если огонь
      // глюканёт, откат на svg или миграция на CSS keyframes.
      renderer: 'canvas',
      loop: true,
      autoplay: true,
      path: LOTTIE_URL,
    })
    return () => anim.destroy()
  }, [])

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />
}
