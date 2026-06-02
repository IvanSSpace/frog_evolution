// Loc3LottieTest — ТЕСТОВЫЙ DOM-оверлей с Lottie-анимацией на Loc3.
//
// ⚠️ Lottie в проекте «выпилен» (см. правила). Здесь рантайм НЕ в бандле:
// dotLottie web-component тянется лениво через CDN dynamic-import только когда
// игрок на Loc3. Если оставляем в проде — конвертнуть в WebM/spritesheet и
// проигрывать Phaser-tween'ами (тогда вообще без CDN).
//
// ⚠️ ТЕСТ: позиционируется по fractional-координатам относительно вьюпорта и НЕ
// следует за зумом/скроллом камеры Phaser. Точная привязка к сцене Loc3 — за
// Чанком 1 (scenes/main). Координаты заданы автором.

import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore'

const LOTTIE_URL =
  'https://lottie.host/d9853330-fbc3-4bf6-9a69-bc69f456b746/I3cObDe6cE.lottie'

// Точки размещения (xFrac от ширины, yFracZone от высоты) — заданы автором.
const SPOTS = [
  { xFrac: 0.417, yFrac: 0.17 },
  { xFrac: 0.698, yFrac: 0.221 },
]

// JSX-тип для кастом-элемента dotlottie-wc.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'dotlottie-wc': {
        src?: string
        autoplay?: boolean
        loop?: boolean
        style?: React.CSSProperties
      }
    }
  }
}

let loaderPromise: Promise<unknown> | null = null
// URL в переменной → vite не пытается бандлить, TS не резолвит модуль.
const DOTLOTTIE_CDN = 'https://esm.sh/@lottiefiles/dotlottie-wc@0.6.2'
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

  if (currentLocation !== 3 || !ready) return null

  return (
    <>
      {SPOTS.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            left: `${s.xFrac * 100}vw`,
            top: `${s.yFrac * 100}vh`,
            transform: 'translate(-50%, -50%)',
            width: 120,
            height: 120,
            zIndex: 40,
            pointerEvents: 'none',
          }}
        >
          <dotlottie-wc
            src={LOTTIE_URL}
            autoplay
            loop
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ))}
    </>
  )
}
