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

import { useEffect, useRef, useState } from 'react'
import lottie, { type AnimationItem } from 'lottie-web'
import { useGameStore } from '../../store/gameStore'
import { getFieldScroll } from '../../game/index'
import { eventBus } from '../../store/eventBus'
import { fireFilter, useFireLevel } from './fireLevels'

const LOTTIE_URL = '/loc3_anim.json'

// Точки размещения (доли канваса/зоны) — заданы автором.
const SPOTS = [
  { xFrac: 0.419, yFrac: 0.15 },
  { xFrac: 0.698, yFrac: 0.202 },
]
// Размер огня = доля ширины canvas → зумится вместе с картой при ресайзе.
const SIZE_FRAC = 0.13

export function Loc3LottieTest() {
  const currentLocation = useGameStore((s) => s.currentLocation)
  useFireLevel() // подписка: ре-рендер при смене уровня любого огня
  const clipRef = useRef<HTMLDivElement | null>(null)
  const spotRefs = useRef<(HTMLDivElement | null)[]>([])
  const lastSize = useRef(-1) // последний применённый размер огня (px); -1 → форс первый раз

  // На время zoom-перехода Lottie ставим на ПАУЗУ (замороженный кадр) — огни
  // остаются на позициях, не дёргаются и не «пропадают». CPU тоже экономится в
  // момент тяжёлой анимации перехода. Позицию rAF-loop продолжает обновлять.
  const [transitioning, setTransitioning] = useState(false)
  useEffect(() => {
    const onStart = () => setTransitioning(true)
    const onEnd = () => setTransitioning(false)
    eventBus.on('location:transitionStart', onStart)
    eventBus.on('location:transitionEnd', onEnd)
    return () => {
      eventBus.off('location:transitionStart', onStart)
      eventBus.off('location:transitionEnd', onEnd)
    }
  }, [])

  const active = currentLocation === 3

  // Каждый кадр: clip-контейнер = прямоугольник канваса; огни внутри = absolute
  // от контейнера: xFrac/yFrac зоны + scroll-progress (едут с картой).
  useEffect(() => {
    if (!active) return
    // При (ре)активации spot-div'ы перемонтированы с width:0 → форсим повторное
    // применение размера в первой итерации loop (иначе размер == lastSize и не
    // пишется → огонь остаётся 0×0 и невидим после возврата на Loc3).
    lastSize.current = -1
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
        // Размер пропорционален ширине canvas. Пишем width/height ТОЛЬКО при
        // изменении ширины (не каждый кадр) — ResizeObserver в LottieSpot тогда
        // дёрнет anim.resize() для чёткой перерисовки. Позицию двигаем каждый кадр.
        const size = SIZE_FRAC * r.width
        const sizeChanged = Math.abs(size - lastSize.current) > 0.5
        if (sizeChanged) lastSize.current = size
        SPOTS.forEach((s, i) => {
          const el = spotRefs.current[i]
          if (!el) return
          el.style.left = `${s.xFrac * r.width}px`
          el.style.top = `${(s.yFrac + off) * r.height}px`
          if (sizeChanged) {
            el.style.width = `${size}px`
            el.style.height = `${size}px`
          }
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
            width: 0, // размер задаётся в rAF-loop пропорционально canvas
            height: 0,
            pointerEvents: 'none',
            filter: fireFilter(i), // уровень горения этого огня (per-fire)
          }}
        >
          <LottieSpot paused={transitioning} />
        </div>
      ))}
    </div>
  )
}

// Один экземпляр анимации через bundled lottie-web (canvas-рендер, loop).
// paused — пауза проигрывания на время zoom-перехода (перф + нет глюка).
function LottieSpot({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const loadedRef = useRef(false)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

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
    animRef.current = anim
    // Канвас-renderer не масштабируется сам при ресайзе контейнера — следим
    // ResizeObserver'ом и зовём anim.resize() для чёткой перерисовки под новый
    // размер. Guard: resize ТОЛЬКО после загрузки (path async) и до destroy —
    // иначе lottie крашится (renderer.canvas undefined). RO фаерит сразу на
    // observe() — до DOMLoaded, поэтому флаг loaded обязателен.
    let loaded = false
    let alive = true
    anim.addEventListener('DOMLoaded', () => {
      loaded = true
      loadedRef.current = true
      if (alive) {
        try {
          anim.resize()
          if (pausedRef.current) anim.pause() // смонтировались во время перехода
        } catch {
          /* ignore */
        }
      }
    })
    const ro = new ResizeObserver(() => {
      if (!alive || !loaded) return
      try {
        anim.resize()
      } catch {
        /* ignore */
      }
    })
    ro.observe(container)
    return () => {
      alive = false
      loadedRef.current = false
      animRef.current = null
      ro.disconnect()
      anim.destroy()
    }
  }, [])

  // Пауза/возобновление проигрывания при смене paused (zoom-переход).
  useEffect(() => {
    const anim = animRef.current
    if (!anim || !loadedRef.current) return
    try {
      if (paused) anim.pause()
      else anim.play()
    } catch {
      /* ignore */
    }
  }, [paused])

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />
}
