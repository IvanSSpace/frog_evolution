// Phase 15 (UX-06): persisted Settings toggles для Cosmic Frogs System.
// Currently: instantBoxes (cascade reveal минимизирован до ~400ms).
// Phase 19 расширит: calmFarm, reducedEffects.

const KEY_INSTANT_BOXES = 'frog_evolution_cosmic_instant_boxes'
const EVENT_NAME = 'cosmic:settings-changed'

export function getInstantBoxes(): boolean {
  try {
    return localStorage.getItem(KEY_INSTANT_BOXES) === '1'
  } catch {
    return false
  }
}

export function setInstantBoxes(value: boolean): void {
  try {
    localStorage.setItem(KEY_INSTANT_BOXES, value ? '1' : '0')
  } catch {
    // ignore quota or private mode failures
  }
  // Dispatch event so SettingsModal + CascadeRevealModal могут подписаться.
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export function subscribeInstantBoxes(cb: () => void): () => void {
  window.addEventListener(EVENT_NAME, cb)
  return () => window.removeEventListener(EVENT_NAME, cb)
}
