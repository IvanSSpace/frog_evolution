// Phase 9: barrel export для anim primitives + types.
// 18 primitives extracted из StarMapScene.ts. Каждая importable независимо.

export type { PrimitiveFn, FlashPrimitiveFn, AnimSys, SharedRace, SharedBgSystem } from './types'
export { DPR, ANIM_EASES, THEME_PALETTES, pickColor, pickEase, shiftColorByPlanet } from './sharedHelpers'
// Primitive exports добавляются в Tasks 2-7.
