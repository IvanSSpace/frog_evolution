// Phase 9: barrel export для anim primitives + types.
// 18 primitives extracted из StarMapScene.ts. Каждая importable независимо.

export type { PrimitiveFn, FlashPrimitiveFn, AnimSys, SharedRace, SharedBgSystem } from './types'
export { DPR, ANIM_EASES, THEME_PALETTES, pickColor, pickEase, shiftColorByPlanet } from './sharedHelpers'
// Group A — Task 2
export { compRing } from './compRing'
export { compSparkle } from './compSparkle'
export { compFlash } from './compFlash'
export { compStarBurst } from './compStarBurst'
// Group B — Task 3
export { compHaloFlash } from './compHaloFlash'
export { compConfetti } from './compConfetti'
export { compRipple } from './compRipple'
export { compEchoWave } from './compEchoWave'
