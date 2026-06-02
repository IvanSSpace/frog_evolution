// Loc3LottieTest — ТЕСТОВЫЙ DOM-оверлей с Lottie-анимацией на Loc3.
//
// ⚠️ Lottie в проекте «выпилен» (см. правила). Здесь рантайм НЕ в бандле:
// dotLottie web-component тянется лениво через CDN dynamic-import только когда
// игрок на Loc3. Если оставляем в проде — конвертнуть в WebM/spritesheet и
// проигрывать Phaser-tween'ами (тогда вообще без CDN).
//
// ⚠️ ТЕСТ: огни едут вместе с двухзонным полем — позиция каждый кадр считается
// от #game-canvas rect + scroll-progress камеры (getFieldScroll). В зоне зданий
// (progress→1) сидят на заводах; при скролле к зоне лягушек уезжают вниз за кадр.
// За зумом перехода между локациями не следят. Координаты заданы автором.

import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { getFieldScroll } from '../../game/index'

// Файл перетаймлен в [0,84] (контент сдвинут -60, лид-ин холд убран → нет паузы
// на стыке лупа). 84 кадра. Луп = [0, 84] = вся анимация.
const SEG_START = 0
const SEG_END = 84

// Локальная копия с линеаризованным easing концовки (убрано торможение
// последних кейфреймов t>=160). Оригинал был на lottie.host.
const LOTTIE_URL = '/loc3_anim.json'

// Точки размещения (xFrac от ширины, yFracZone от высоты) — заданы автором.
const SPOTS = [
  { xFrac: 0.419, yFrac: 0.144 },
  { xFrac: 0.708, yFrac: 0.196 },
]
// Размер огонька (px). Уменьшено 120→80 по запросу.
const SIZE = 80

// JSX-тип для кастом-элемента dotlottie-wc.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'dotlottie-wc': {
        src?: string
        autoplay?: boolean
        loop?: boolean
        // Диапазон кадров для проигрывания/лупа ("start end"). Обрезает хвостовой
        // холд: файл ip=60 op=240 — крутим только активные 60–240.
        segment?: string
        ref?: React.Ref<HTMLElement>
        style?: React.CSSProperties
      }
    }
  }
}

let loaderPromise: Promise<unknown> | null = null
// URL в переменной → vite не пытается бандлить, TS не резолвит модуль.
const DOTLOTTIE_CDN = 'https://esm.sh/@lottiefiles/dotlottie-wc@0.9.16'
function ensureDotlottieLoaded(): Promise<unknown> {
  if (!loaderPromise) {
    // Лениво из CDN — в бандл не попадает. esm.sh регистрирует custom element.
    loaderPromise = import(/* @vite-ignore */ DOTLOTTIE_CDN).catch((e) => {
      console.warn('[Loc3LottieTest] dotlottie-wc load failed:', e)
    })
  }
  return loaderPromise
}

export function Loc3LottieTest() {
  const currentLocation = useGameStore((s) => s.currentLocation)
  const [ready, setReady] = useState(false)
  const spotRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (currentLocation !== 3) return
    let alive = true
    ensureDotlottieLoaded().then(() => {
      if (alive) setReady(true)
    })
    return () => {
      alive = false
    }
  }, [currentLocation])

  const active = currentLocation === 3 && ready

  // Каждый кадр: позиция = канвас rect + scroll-progress поля. progress=1 (зона
  // зданий) → огни на yFrac зоны; progress→0 (зона лягушек) → уезжают вниз за кадр.
  useEffect(() => {
    if (!active) return
    let raf = 0
    const loop = () => {
      const canvas = document.getElementById('game-canvas')
      const fs = getFieldScroll()
      if (canvas && fs) {
        const r = canvas.getBoundingClientRect()
        const off = 1 - fs.progress // 0 в зоне зданий, 1 в зоне лягушек
        SPOTS.forEach((s, i) => {
          const el = spotRefs.current[i]
          if (!el) return
          el.style.left = `${r.left + s.xFrac * r.width}px`
          el.style.top = `${r.top + (s.yFrac + off) * r.height}px`
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])

  if (!active) return null

  return (
    <>
      {SPOTS.map((_s, i) => (
        <div
          key={i}
          ref={(el) => {
            spotRefs.current[i] = el
          }}
          style={{
            position: 'fixed',
            left: -9999, // стартовая позиция до первого кадра rAF
            top: -9999,
            transform: 'translate(-50%, -50%)',
            width: SIZE,
            height: SIZE,
            zIndex: 40,
            pointerEvents: 'none',
          }}
        >
          <LottieSpot />
        </div>
      ))}
    </>
  )
}

// Один экземпляр анимации. После готовности инстанса dotLottie выставляем луп
// по активному сегменту [SEG_START, SEG_END] — убирает «паузу» на стыке цикла.
function LottieSpot() {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    type Inst = {
      isLoaded?: boolean
      setSegment?: (s: number, e: number) => void
      setLoop?: (v: boolean) => void
      play?: () => void
      addEventListener?: (ev: string, cb: () => void) => void
    }
    const el = ref.current as (HTMLElement & { dotLottie?: Inst }) | null
    if (!el) return

    let timer: number | undefined
    let timeout: number | undefined
    const configure = (inst: Inst) => {
      try {
        inst.setSegment?.(SEG_START, SEG_END) // луп только живой части
        inst.setLoop?.(true)
        inst.play?.()
      } catch (e) {
        console.warn('[Loc3LottieTest] segment loop config failed:', e)
      }
    }
    // Инстанс dotLottie создаётся асинхронно. Ждём его, затем — событие load
    // (segment применяется к загруженной анимации).
    const tryGet = (): boolean => {
      const inst = el.dotLottie
      if (!inst) return false
      if (inst.isLoaded) configure(inst)
      else inst.addEventListener?.('load', () => configure(inst))
      return true
    }
    if (!tryGet()) {
      timer = window.setInterval(() => {
        if (tryGet()) window.clearInterval(timer)
      }, 120)
      timeout = window.setTimeout(() => window.clearInterval(timer), 5000)
    }
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(timeout)
    }
  }, [])

  return (
    <dotlottie-wc
      ref={ref}
      src={LOTTIE_URL}
      autoplay
      loop
      style={{ width: '100%', height: '100%' }}
    />
  )
}
