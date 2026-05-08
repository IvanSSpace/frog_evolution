// Phase 15 (UX-06): persisted Settings toggles для Cosmic Frogs System.
// Phase 19-04 (UX-04, UX-05): добавлены calmFarmMode + reducedEffects.
//
// Все 3 toggle хранятся индивидуально в localStorage; default = false.
// Subscribe pattern идентичен — useSyncExternalStore reactive из SettingsModal.
// Consumer wiring (FrogOverlayManager, awakened presets, SerumSlotMachine) —
// читают через get* функции; verify в Phase 19-07 audit.

const KEY_INSTANT_BOXES = 'frog_evolution_cosmic_instant_boxes'
const KEY_CALM_FARM = 'frog_evolution_cosmic_calm_farm'
const KEY_REDUCED_EFFECTS = 'frog_evolution_cosmic_reduced_effects'
const EVENT_NAME = 'cosmic:settings-changed'

// ─── instantBoxes (UX-06) ───

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
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export function subscribeInstantBoxes(cb: () => void): () => void {
  window.addEventListener(EVENT_NAME, cb)
  return () => window.removeEventListener(EVENT_NAME, cb)
}

// ─── calmFarmMode (UX-04, Phase 19-04) ───

export function getCalmFarmMode(): boolean {
  try {
    return localStorage.getItem(KEY_CALM_FARM) === '1'
  } catch {
    return false
  }
}

export function setCalmFarmMode(value: boolean): void {
  try {
    localStorage.setItem(KEY_CALM_FARM, value ? '1' : '0')
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export function subscribeCalmFarmMode(cb: () => void): () => void {
  window.addEventListener(EVENT_NAME, cb)
  return () => window.removeEventListener(EVENT_NAME, cb)
}

// ─── reducedEffects (UX-05, Phase 19-04 — default OFF Locked Decision) ───

export function getReducedEffects(): boolean {
  try {
    return localStorage.getItem(KEY_REDUCED_EFFECTS) === '1'
  } catch {
    return false
  }
}

export function setReducedEffects(value: boolean): void {
  try {
    localStorage.setItem(KEY_REDUCED_EFFECTS, value ? '1' : '0')
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export function subscribeReducedEffects(cb: () => void): () => void {
  window.addEventListener(EVENT_NAME, cb)
  return () => window.removeEventListener(EVENT_NAME, cb)
}
