// Loc3LottieTest — ТЕСТОВЫЙ DOM-оверлей с Lottie-анимацией на Loc3.
//
// ⚠️ Lottie в проекте «выпилен» (см. правила). Здесь рантайм НЕ в бандле:
// dotLottie web-component тянется лениво через CDN dynamic-import только когда
// игрок на Loc3. Если оставляем в проде — конвертнуть в WebM/spritesheet и
// проигрывать Phaser-tween'ами (тогда вообще без CDN).
//
// ⚠️ ТЕСТ: позиционируется по fractional-координатам относительно игрового
// канваса (#game-canvas rect), показывается ТОЛЬКО в зоне зданий (field:zoneChanged
// === 'buildings'). НЕ следует за зумом/частичным скроллом — точная привязка к
// сцене Loc3 за Чанком 1 (scenes/main). Координаты заданы автором.

import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'

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
  { xFrac: 0.693, yFrac: 0.196 },
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
  // Зона поля (frogs/buildings). Огни — только в зоне зданий (заводы).
  const [zone, setZone] = useState<'frogs' | 'buildings'>('frogs')
  // Прямоугольник игрового канваса — позиционируем относительно него, чтобы
  // учитывать Header-офсет (иначе огни висят выше, «всегда на экране»).
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const onZone = ({ zone: z }: { zone: 'frogs' | 'buildings' }) => setZone(z)
    eventBus.on('field:zoneChanged', onZone)
    return () => eventBus.off('field:zoneChanged', onZone)
  }, [])

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

  // Меряем канвас при показе + на ресайз.
  const visible = currentLocation === 3 && ready && zone === 'buildings'
  useEffect(() => {
    if (!visible) return
    const measure = () => {
      const el = document.getElementById('game-canvas')
      if (el) setRect(el.getBoundingClientRect())
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [visible])

  if (!visible || !rect) return null

  return (
    <>
      {SPOTS.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            left: rect.left + s.xFrac * rect.width,
            top: rect.top + s.yFrac * rect.height,
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
