import { useEffect } from 'react'
import { setPhaserInputEnabled } from '../game'

// Ref-count модалок. Когда > 0 — body.modal-open включён (CSS блокирует
// pointer-events у #game-canvas) И Phaser input manager выключен
// (двойная защита от click-through на canvas).
let count = 0

function acquire(): () => void {
  count++
  if (count === 1) {
    document.body.classList.add('modal-open')
    setPhaserInputEnabled(false)
  }
  let released = false
  return () => {
    if (released) return
    released = true
    count = Math.max(0, count - 1)
    if (count === 0) {
      document.body.classList.remove('modal-open')
      setPhaserInputEnabled(true)
    }
  }
}

/** Блокирует pointer-events у Phaser canvas пока компонент смонтирован. */
export function useModalLock(active: boolean = true): void {
  useEffect(() => {
    if (!active) return
    return acquire()
  }, [active])
}
