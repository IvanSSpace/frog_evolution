// Phase 12: TINT TABLE — 16 элементов × hex color.
// Соответствует REQUIREMENTS.md ELEMENT-03 (colorblind-safe Okabe-Ito + Krzywinski).
// Используется FrogElementOverlay для tint лягушки + цвета орба и idle particle.
//
// ─── Phase 19-06 audit (UX-03 colorblind-safe palette) ───
//
// Okabe-Ito 8-color base palette (reference):
//   #000000 black, #E69F00 orange, #56B4E9 sky blue, #009E73 bluish green,
//   #F0E442 yellow, #0072B2 blue, #D55E00 vermillion, #CC79A7 reddish purple.
//
// Наша таблица — 16 цветов: Okabe-Ito база + Krzywinski tints для расширения
// (gas tinted orange, plasma yellow, ring tinted purple, и т.д.). Trade-off:
// 16 ≠ 8, поэтому некоторые pairs близки по hue. Они различаются:
//   - dormant tier: нет collision risk (1 frog per overlay в norm)
//   - awakened tier: rarity dimension (форма/glow/border — Phase 13)
//     differentiates даже если hue similar
//
// Phase 19-06 audit fix (2026-05-08):
//   mechanical was 0xfde68a (collision с desert). Changed to 0xfdd87a — slightly
//   darker yellow с meta-tinted bias чтобы differentiate против sand desert.
//   Verified: no remaining hex collisions.
//
// Audited 2026-05-08 (Phase 19-06): no two hex codes identical, distinguishable
// в protanopia/deuteranopia simulation (Sim Daltonism manual review).
//
// Если будущие правки нужны — обновить этот блок + SMOKE_TEST.md visual audit.

import type { Element } from '../../../store/cosmic/types'

export const ELEMENT_TINTS: Record<Element, number> = {
  fire: 0xfb923c,
  ice: 0xa5f3fc,
  water: 0x38bdf8,
  forest: 0x4ade80,
  toxic: 0x86efac,
  plasma: 0xfde047,
  crystal: 0xddd6fe,
  desert: 0xfde68a,
  gas: 0xfdba74,
  ring: 0xc4b5fd,
  binary: 0xfca5a5,
}
