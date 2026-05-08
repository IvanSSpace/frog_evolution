// Phase 9: shared helpers для anim primitives.
// Extracted from StarMapScene.ts L796-1308. Pure functions без зависимости от
// runtime state класса.

import type { AnimSys } from './types'

// DPR — копия StarMapScene.ts:12. Single source of truth для primitives + scenes.
// typeof window guard — для unit-test/SSR safety.
export const DPR = Math.max(
  1,
  Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 3),
)

// THEME_PALETTES — копия StarMapScene.ts:877-908. Каждый archetype/type имеет
// тематическую палитру для pickColor.
export const THEME_PALETTES: Record<string, number[]> = {
  // BG archetypes
  gas_giant:   [0xfde68a, 0xfb923c, 0xfdba74, 0xfacc15, 0xf59e0b, 0xfff7ed],
  gas_ringed:  [0xc4b5fd, 0xa78bfa, 0xddd6fe, 0xfde68a, 0xfff7ed],
  ice:         [0xa5f3fc, 0xbae6fd, 0xe0f2fe, 0xffffff, 0x67e8f9],
  ocean:       [0x7dd3fc, 0x38bdf8, 0x0ea5e9, 0xa5f3fc, 0x67e8f9],
  desert:      [0xfde68a, 0xfbbf24, 0xfdba74, 0xf59e0b, 0xfff7ed],
  lava:        [0xfca5a5, 0xef4444, 0xb91c1c, 0xfb923c, 0xfde047, 0xfff7ed],
  forest:      [0x86efac, 0x4ade80, 0x22c55e, 0xa3e635, 0xfde047],
  mineral:     [0xc4b5fd, 0xddd6fe, 0xa5f3fc, 0xfde047, 0xffffff],
  dead:        [0x9ca3af, 0xd1d5db, 0x6b7280, 0xfff7ed],
  toxic:       [0x86efac, 0xa3e635, 0xfde047, 0xfde68a, 0xbef264],
  plasma:      [0xfca5a5, 0xfde047, 0xfff7ed, 0xfb923c, 0xa78bfa, 0xffffff],
  binary:      [0xa78bfa, 0x7dd3fc, 0xfde047, 0xfca5a5, 0xffffff],
  // Main types
  home:        [0x7dd3fc, 0xa5f3fc, 0x86efac, 0xffffff],
  crystal:     [0xa5f3fc, 0x67e8f9, 0xddd6fe, 0xffffff],
  rocky:       [0xfbbf24, 0xfde68a, 0xfff7ed],
  ancient:     [0xc4b5fd, 0xa78bfa, 0xfde047, 0xfff7ed],
  mystic:      [0xddd6fe, 0xc4b5fd, 0x6d28d9, 0xffffff],
  organic:     [0x86efac, 0x4ade80, 0xfde047],
  forge:       [0xfdba74, 0xfb923c, 0xef4444, 0xfde047, 0xffffff],
  military:    [0xfca5a5, 0xef4444, 0x991b1b, 0xfff7ed],
  destroyed:   [0x6b7280, 0xfff7ed, 0xef4444],
  crystal_bio: [0x67e8f9, 0x86efac, 0xa5f3fc],
  mechano:     [0xfde68a, 0xa78bfa, 0xfde047, 0xffffff],
  energy:      [0xfef08a, 0xfde047, 0xfff7ed, 0xa5f3fc],
  mist:        [0xddd6fe, 0xa78bfa, 0xc4b5fd, 0xffffff],
  aquatic:     [0x7dd3fc, 0x67e8f9, 0xa5f3fc, 0xbae6fd],
  shadow:      [0x6b7280, 0x111827, 0x4b5563, 0xa78bfa],
  aerial:      [0xa5f3fc, 0xddd6fe, 0xffffff, 0x7dd3fc],
}

// ANIM_EASES — копия StarMapScene.ts:954-956.
export const ANIM_EASES = [
  'Cubic.easeOut', 'Quad.easeOut', 'Sine.easeOut', 'Back.easeOut', 'Quart.easeOut', 'Expo.easeOut',
]

// pickColor — копия StarMapScene.ts:1257-1266 без `this`.
// Phase 7 logic: палитра темы → sys.color → sys.accent, затем per-planet HSL hue shift.
export function pickColor(rng: () => number, sys: AnimSys): number {
  const theme = ('archetype' in sys ? (sys as { archetype: string }).archetype : sys.type) as string
  const palette = THEME_PALETTES[theme]
  const r = rng()
  let raw: number
  if (palette && r < 0.55) raw = palette[Math.floor(rng() * palette.length)]
  else if (r < 0.78) raw = sys.color
  else raw = sys.accent
  return shiftColorByPlanet(raw, rng)
}

// pickEase — копия StarMapScene.ts:1267-1269 без `this`.
export function pickEase(rng: () => number): string {
  return ANIM_EASES[Math.floor(rng() * ANIM_EASES.length)]
}

// shiftColorByPlanet — копия StarMapScene.ts:1274-1308 без `this`.
// Phase 7: per-planet HSL hue shift на ±25° для уникального подтона.
export function shiftColorByPlanet(color: number, rng: () => number): number {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  const rN = r / 255, gN = g / 255, bN = b / 255
  const max = Math.max(rN, gN, bN)
  const min = Math.min(rN, gN, bN)
  const l = (max + min) / 2
  const d = max - min
  let h = 0, s = 0
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rN) h = ((gN - bN) / d + (gN < bN ? 6 : 0)) * 60
    else if (max === gN) h = ((bN - rN) / d + 2) * 60
    else h = ((rN - gN) / d + 4) * 60
  }
  // shift hue ±25° (50° span)
  const shift = (rng() - 0.5) * 50
  h = (h + shift + 360) % 360
  // HSL → RGB
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r1 = 0, g1 = 0, b1 = 0
  if (h < 60) { r1 = c; g1 = x }
  else if (h < 120) { r1 = x; g1 = c }
  else if (h < 180) { g1 = c; b1 = x }
  else if (h < 240) { g1 = x; b1 = c }
  else if (h < 300) { r1 = x; b1 = c }
  else { r1 = c; b1 = x }
  const ri = Math.max(0, Math.min(255, Math.round((r1 + m) * 255)))
  const gi = Math.max(0, Math.min(255, Math.round((g1 + m) * 255)))
  const bi = Math.max(0, Math.min(255, Math.round((b1 + m) * 255)))
  return (ri << 16) | (gi << 8) | bi
}
