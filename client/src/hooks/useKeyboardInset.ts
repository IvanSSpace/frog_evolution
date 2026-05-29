import { useEffect } from 'react'

// Telegram Mini App / iOS: при открытии экранной клавиатуры WebView ужимается,
// из-за чего модалки с bottom:0 / height:100% «сжимаются» (шапка деформируется).
// Хук пишет в CSS-переменные на :root:
//   --stable-vh — высота вьюпорта БЕЗ клавиатуры (стабильная). Модалка задаёт по
//                 ней свою height, поэтому не сжимается при открытии клавиатуры.
//   --kb-inset  — текущая высота наезжающей клавиатуры. Блок ввода поднимается
//                 на эту величину, чтобы остаться над клавиатурой.
// Источник — window.visualViewport (WebKit, работает в Telegram iOS WebView).
export function useKeyboardInset(): void {
  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    let stable = window.innerHeight

    const apply = () => {
      const innerH = window.innerHeight
      const visH = vv ? vv.height : innerH
      const offsetTop = vv ? vv.offsetTop : 0
      const kb = Math.max(0, innerH - visH - offsetTop)
      // Клавиатура закрыта → текущая высота и есть стабильная.
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
