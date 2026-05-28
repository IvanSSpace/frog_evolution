// 2026-05-28: lightweight DOM toast для одноразовых UI warnings.
//
// Не требует mount-точки и React — сам инжектит DOM-элемент при вызове,
// auto-removes через AUTO_DISMISS_MS. Использует CSS keyframes (memory
// feedback_animations: НЕ Lottie). Multiple toasts стэкуются вертикально
// сверху по простому offset accounting.

const AUTO_DISMISS_MS = 3000
const FADE_DURATION_MS = 250

let activeToasts = 0

function ensureStylesheet(): void {
  if (document.getElementById('ui-toast-keyframes')) return
  const style = document.createElement('style')
  style.id = 'ui-toast-keyframes'
  style.textContent = `
@keyframes ui-toast-in {
  from { opacity: 0; transform: translate(-50%, -16px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
@keyframes ui-toast-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
.ui-toast {
  position: fixed;
  left: 50%;
  top: 56px;
  transform: translate(-50%, 0);
  z-index: 1000;
  background: #1f1530;
  color: #fde047;
  border: 2px solid #f59e0b;
  border-radius: 10px;
  padding: 10px 16px;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  max-width: min(360px, 86vw);
  text-align: center;
  box-shadow: 0 6px 20px rgba(0,0,0,0.45);
  animation: ui-toast-in 220ms ease-out;
  pointer-events: none;
}
.ui-toast.--leaving {
  animation: ui-toast-out ${FADE_DURATION_MS}ms ease-in forwards;
}
`
  document.head.appendChild(style)
}

/**
 * Показывает короткий warning toast по центру сверху. Auto-dismiss ~3s.
 * Идемпотентность не гарантируется — если позвать несколько раз подряд, появится
 * стек (новые ниже предыдущих).
 */
export function showToast(message: string): void {
  if (typeof document === 'undefined') return
  ensureStylesheet()
  const el = document.createElement('div')
  el.className = 'ui-toast'
  const slot = activeToasts
  activeToasts++
  // Сдвигаем по вертикали если уже есть активные toast'ы (стек сверху вниз).
  el.style.top = `${56 + slot * 56}px`
  el.textContent = message
  document.body.appendChild(el)

  const fadeTimer = window.setTimeout(() => {
    el.classList.add('--leaving')
  }, AUTO_DISMISS_MS - FADE_DURATION_MS)
  const removeTimer = window.setTimeout(() => {
    el.remove()
    activeToasts = Math.max(0, activeToasts - 1)
  }, AUTO_DISMISS_MS)
  // Если элемент снимут раньше (например navigation) — таймеры не упадут,
  // но removed-twice безопасно.
  void fadeTimer
  void removeTimer
}
