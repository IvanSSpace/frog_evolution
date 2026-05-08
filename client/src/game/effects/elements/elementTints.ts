// Phase 12: TINT TABLE — 16 элементов × hex color.
// Соответствует REQUIREMENTS.md ELEMENT-03 (colorblind-safe Okabe-Ito + Krzywinski).
// Используется FrogElementOverlay для tint лягушки + цвета орба и idle particle.

import type { Element } from '../../../store/cosmic/types'

export const ELEMENT_TINTS: Record<Element, number> = {
  fire: 0xfb923c,
  ice: 0xa5f3fc,
  water: 0x38bdf8,
  forest: 0x4ade80,
  toxic: 0x86efac,
  plasma: 0xfde047,
  shadow: 0x6b7280,
  crystal: 0xddd6fe,
  desert: 0xfde68a,
  gas: 0xfdba74,
  ring: 0xc4b5fd,
  binary: 0xfca5a5,
  arcane: 0xa78bfa,
  mechanical: 0xfde68a,
  war: 0xdc2626,
  void: 0x1f2937,
}
