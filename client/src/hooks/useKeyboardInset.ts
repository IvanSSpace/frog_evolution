import { useEffect } from 'react'
import { getTelegramWebApp } from '../utils/telegram'

// Telegram Mini App / iOS: при открытии клавиатуры WebView ужимается, из-за чего
// модалки с height:100% «сжимаются» (шапка деформируется). Хук пишет в CSS-vars
// на :root:
//   --stable-vh — высота вьюпорта БЕЗ клавиатуры (стабильная). Модалка задаёт по
//                 ней height, поэтому не сжимается при открытии клавиатуры.
//   --kb-inset  — высота наезжающей клавиатуры. Блок ввода поднимается на неё.
//
// В Telegram источник — WebApp.viewportStableHeight / viewportHeight (TG ужимает
// сам window.innerHeight, поэтому visualViewport там бесполезен). В браузере —
// window.visualViewport как фолбэк.
export function useKeyboardInset(): void {
  useEffect(() => {
    const root = document.documentElement
    const tg = getTelegramWebApp()

    // ── Telegram Mini App ──
    if (
      tg &&
      typeof tg.viewportStableHeight === 'number' &&
      typeof tg.onEvent === 'function'
    ) {
      const applyTg = () => {
        const stable = tg.viewportStableHeight ?? window.innerHeight
        const cur = tg.viewportHeight ?? stable
        const kb = Math.max(0, stable - cur)
        root.style.setProperty('--stable-vh', `${stable}px`)
        root.style.setProperty('--kb-inset', `${kb}px`)
      }
      applyTg()
      tg.onEvent('viewportChanged', applyTg)
      return () => {
        tg.offEvent?.('viewportChanged', applyTg)
      }
    }

    // ── Браузерный фолбэк (visualViewport) ──
    const vv = window.visualViewport
    let stable = window.innerHeight
    const apply = () => {
      const innerH = window.innerHeight
      const visH = vv ? vv.height : innerH
      const offsetTop = vv ? vv.offsetTop : 0
      const kb = Math.max(0, innerH - visH - offsetTop)
      if (kb === 0) stable = innerH
      root.style.setProperty('--stable-vh', `${stable}px`)
      root.style.setProperty('--kb-inset', `${kb}px`)
    }
    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
    }
  }, [])
}
