// Phase 9: barrel export для anim primitives + types.
// 18 primitives extracted из StarMapScene.ts. Каждая importable независимо.

export type {
  PrimitiveFn,
  FlashPrimitiveFn,
  AnimSys,
  SharedRace,
  SharedBgSystem,
} from './types'
export {
  DPR,
  ANIM_EASES,
  THEME_PALETTES,
  pickColor,
  pickEase,
  shiftColorByPlanet,
} from './sharedHelpers'
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
// Group F — Phase 20-02 (ring/orbit/spiral + thematic 12-23 + creative 24-31)
export { compMultiRing } from './compMultiRing'
export { compLightning } from './compLightning'
export { compOrbit } from './compOrbit'
export { compSpiral } from './compSpiral'
export { compWave } from './compWave'
export { compComet } from './compComet'
export { compVortex } from './compVortex'
export { compStormSwirl } from './compStormSwirl'
export { compRingDance } from './compRingDance'
export { compLavaErupt } from './compLavaErupt'
export { compDustPuff } from './compDustPuff'
export { compBeam } from './compBeam'
export { compTwinPulse } from './compTwinPulse'
export { compSingularity } from './compSingularity'
export { compGravityWell } from './compGravityWell'
export { compSolarFlare } from './compSolarFlare'
export { compAuroraRibbon } from './compAuroraRibbon'
export { compDNAHelix } from './compDNAHelix'
export { compLensFlare } from './compLensFlare'
export { compConstellation } from './compConstellation'
// Group G — Phase 20-02 (extension 39-53 + creative 32-38)
export { compMagneticField } from './compMagneticField'
export { compPhoenixBurst } from './compPhoenixBurst'
export { compWormhole } from './compWormhole'
export { compCosmicRay } from './compCosmicRay'
export { compQuantumSplit } from './compQuantumSplit'
export { compHeartPulse } from './compHeartPulse'
export { compCrackleDischarge } from './compCrackleDischarge'
export { compPixelGrid } from './compPixelGrid'
export { compSpiralArms } from './compSpiralArms'
export { compCrystalGrow } from './compCrystalGrow'
export { compSnowDrift } from './compSnowDrift'
export { compGalaxySpawn } from './compGalaxySpawn'
export { compPulseHex } from './compPulseHex'
export { compTornado } from './compTornado'
export { compStarPolygon } from './compStarPolygon'
export { compCrossFlash } from './compCrossFlash'
export { compWaveTrain } from './compWaveTrain'
export { compPetalStorm } from './compPetalStorm'
export { compSnakeTrail } from './compSnakeTrail'
export { compBubblePop } from './compBubblePop'
// Group H — Phase 20-02 (Phase 7 components 54-63 + extension 3 64-72)
export { compAtomShells } from './compAtomShells'
export { compSupernova } from './compSupernova'
export { compAccretionDisk } from './compAccretionDisk'
export { compFlickerStars } from './compFlickerStars'
export { compLightDance } from './compLightDance'
export { compDimensionRift } from './compDimensionRift'
export { compFrostExplode } from './compFrostExplode'
export { compTimeWave } from './compTimeWave'
export { compGlyphFlash } from './compGlyphFlash'
export { compPrismShift } from './compPrismShift'
export { compChargeBurst } from './compChargeBurst'
export { compInfinityTrail } from './compInfinityTrail'
export { compShieldRipple } from './compShieldRipple'
export { compFireworks } from './compFireworks'
export { compScanline } from './compScanline'
export { compLiquidPool } from './compLiquidPool'
export { compGravityKnot } from './compGravityKnot'
export { compCosmicWeb } from './compCosmicWeb'
export { compParticleFountain } from './compParticleFountain'
