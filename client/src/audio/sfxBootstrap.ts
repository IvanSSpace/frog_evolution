import { eventBus } from '../store/eventBus'
import { sfx } from './sfx'
import { planetVoice } from './planetVoice'

let initialized = false
let primed = false

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

  // Прогреваем Tone после первого user gesture (browser audio policy).
  // Оба движка стартуют параллельно — планеты будут готовы к первому тапу.
  const prime = (): void => {
    if (primed) return
    primed = true
    void sfx.ensureReady().catch(() => {
      /* noop */
    })
    void planetVoice.ensureReady().catch(() => {
      /* noop */
    })
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', prime, { once: true, passive: true })
    window.addEventListener('touchstart', prime, { once: true, passive: true })
    window.addEventListener('keydown', prime, { once: true })
  }
}
