import { eventBus } from '../store/eventBus'
import { sfx } from './sfx'
import { planetVoice } from './planetVoice'

let initialized = false
let primed = false
let ToneRef: typeof import('tone') | null = null

/** Подписывает SFX на игровые события. Вызывается один раз. */
export function initSfx(): void {
  if (initialized) return
  initialized = true

  eventBus.on('frog:pickup', ({ level }) => sfx.play('pickup', { level }))
  eventBus.on('frog:drop', ({ level, merged }) => {
    if (!merged) sfx.play('drop', { level })
  })
  eventBus.on('merge:happened', ({ level }) => sfx.play('merge', { level }))
  eventBus.on('frog:discovered', ({ level }) => sfx.play('evolve', { level }))

  // Предзагружаем Tone заранее, чтобы Tone.start() мог быть вызван
  // синхронно внутри обработчика жеста (требование iOS Safari).
  void import('tone')
    .then((m) => {
      ToneRef = m
    })
    .catch(() => {
      /* noop */
    })

  if (typeof window === 'undefined') return

  const prime = (): void => {
    // Синхронный resume AudioContext внутри user gesture (iOS Safari).
    if (ToneRef && ToneRef.context.state !== 'running') {
      void ToneRef.start().catch(() => {
        /* noop */
      })
    }
    if (!primed) {
      primed = true
      void sfx.ensureReady().catch(() => {
        /* noop */
      })
      void planetVoice.ensureReady().catch(() => {
        /* noop */
      })
    }
    // Отписываемся только когда context подтверждённо running.
    if (ToneRef && ToneRef.context.state === 'running') {
      window.removeEventListener('pointerdown', prime)
      window.removeEventListener('touchstart', prime)
      window.removeEventListener('touchend', prime)
      window.removeEventListener('click', prime)
      window.removeEventListener('keydown', prime)
    }
  }

  const passiveOpts: AddEventListenerOptions = { passive: true }
  window.addEventListener('pointerdown', prime, passiveOpts)
  window.addEventListener('touchstart', prime, passiveOpts)
  window.addEventListener('touchend', prime, passiveOpts)
  window.addEventListener('click', prime, passiveOpts)
  window.addEventListener('keydown', prime)
}
