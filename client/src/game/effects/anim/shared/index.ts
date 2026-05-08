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
// Group C — Task 5 (elemental)
export { compFlameTongues } from './compFlameTongues'
export { compIceWisps } from './compIceWisps'
export { compPlasmaArc } from './compPlasmaArc'
export { compChromaShift } from './compChromaShift'
// Group D — Task 6 (material)
export { compCrystalShatter } from './compCrystalShatter'
export { compBloomPetals } from './compBloomPetals'
export { compToxicCloud } from './compToxicCloud'
export { compSandSwirl } from './compSandSwirl'
// Group E — Task 7 (final 2)
export { compChimeRing } from './compChimeRing'
export { compBubbleStream } from './compBubbleStream'
