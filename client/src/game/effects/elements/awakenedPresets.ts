// Phase 13: awakened idle presets — 4 tiers × 16 elements = 64 unique entries.
// Each element × tier combination uses a distinct set of thematically matched
// primitives. No repeated core — every tier escalates with genuinely different effects.
//
// Intervals: common=2500ms, rare=2000ms, epic=1500ms, legendary=1000ms
// All primitives in a preset fire together on each tick (burst pattern).

import type Phaser from 'phaser'
import type { Element } from '../../../store/cosmic/types'
import {
  // Core elemental
  compFlameTongues,
  compIceWisps,
  compRipple,
  compBloomPetals,
  compToxicCloud,
  compPlasmaArc,
  compHaloFlash,
  compCrystalShatter,
  compSandSwirl,
  compChromaShift,
  compChimeRing,
  compEchoWave,
  compStarBurst,
  compConfetti,
  compFlash,
  compBubbleStream,
  // Extended set
  compMultiRing,
  compLightning,
  compOrbit,
  compSpiral,
  compWave,
  compComet,
  compVortex,
  compStormSwirl,
  compRingDance,
  compLavaErupt,
  compDustPuff,
  compBeam,
  compTwinPulse,
  compSingularity,
  compGravityWell,
  compSolarFlare,
  compAuroraRibbon,
  compDNAHelix,
  compConstellation,
  compMagneticField,
  compPhoenixBurst,
  compWormhole,
  compCosmicRay,
  compQuantumSplit,
  compHeartPulse,
  compCrackleDischarge,
  compPixelGrid,
  compSpiralArms,
  compCrystalGrow,
  compSnowDrift,
  compGalaxySpawn,
  compTornado,
  compStarPolygon,
  compCrossFlash,
  compWaveTrain,
  compPetalStorm,
  compSnakeTrail,
  compBubblePop,
  compAtomShells,
  compSupernova,
  compAccretionDisk,
  compFlickerStars,
  compLightDance,
  compDimensionRift,
  compFrostExplode,
  compTimeWave,
  compGlyphFlash,
  compPrismShift,
  compChargeBurst,
  compInfinityTrail,
  compShieldRipple,
  compFireworks,
  compScanline,
  compLiquidPool,
  compGravityKnot,
  compCosmicWeb,
  compParticleFountain,
  compEchoSpawn,
  compRipBlade,
  compEarthquakeShake,
  compKaleidoscope,
  compGlitchStutter,
  compDopplerWave,
  compMorseFlash,
  compCrystalBell,
  compWindRustle,
  compClockGears,
  compBouncingBall,
  compDigitalGlitch,
  compRingPulsar,
  compSwarmParticles,
  compPrismRefract,
  compLifeBloom,
  compWindRibbons,
  compWreckageOrbit,
} from '../anim/shared'
import type { SharedBgSystem } from '../anim/shared/types'
import { ELEMENT_TINTS } from './elementTints'
import { archetypeForElement } from './elementMapping'
import type { ElementTier, OverlayLifecycle } from './types'
import { AWAKENED_TIERS } from './types'

// ============== Primitive types ==============

type SysPrimitive = (
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  sys: SharedBgSystem,
  rng: () => number,
) => void

type FlashPrimitive = (
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  rng: () => number,
) => void

interface TierPresetList {
  fns: SysPrimitive[]
  flashes?: FlashPrimitive[]
}

type AwakenedTier = Exclude<ElementTier, 'dormant'>

// ============== Tier params ==============

interface TierParams {
  size: number
  brightness: number
  intervalMs: number
}

const TIER_PARAMS: Record<AwakenedTier, TierParams> = {
  common:    { size: 8,  brightness: 0.55, intervalMs: 2500 },
  rare:      { size: 10, brightness: 0.70, intervalMs: 2000 },
  epic:      { size: 13, brightness: 0.85, intervalMs: 1500 },
  legendary: { size: 16, brightness: 1.00, intervalMs: 1000 },
}

// ============== Direct element × tier preset table ==============
// Each element has its own thematic primitive signature that escalates per tier.
// No generic core/glow/accent — every combination is handcrafted.

const PRESETS: Record<AwakenedTier, Record<Element, TierPresetList>> = {
  common: {
    fire:       { fns: [compFlameTongues, compSolarFlare] },
    ice:        { fns: [compIceWisps, compSnowDrift] },
    water:      { fns: [compRipple, compBubbleStream] },
    forest:     { fns: [compBloomPetals, compLifeBloom] },
    toxic:      { fns: [compToxicCloud, compBubbleStream] },
    plasma:     { fns: [compPlasmaArc, compCrackleDischarge] },
    shadow:     { fns: [compHaloFlash, compEchoWave] },
    crystal:    { fns: [compCrystalShatter, compCrystalGrow] },
    desert:     { fns: [compSandSwirl, compDustPuff] },
    gas:        { fns: [compChromaShift, compDopplerWave] },
    ring:       { fns: [compChimeRing, compRingPulsar] },
    binary:     { fns: [compEchoWave, compMorseFlash] },
    arcane:     { fns: [compStarBurst, compConstellation] },
    mechanical: { fns: [compConfetti, compClockGears] },
    war:        { fns: [], flashes: [compFlash, compFlash] },
    void:       { fns: [compBubbleStream, compWormhole] },
  },

  rare: {
    fire:       { fns: [compFlameTongues, compSolarFlare, compLavaErupt] },
    ice:        { fns: [compIceWisps, compSnowDrift, compFrostExplode] },
    water:      { fns: [compRipple, compWave, compBubblePop] },
    forest:     { fns: [compBloomPetals, compLifeBloom, compPetalStorm] },
    toxic:      { fns: [compToxicCloud, compBubblePop, compDustPuff] },
    plasma:     { fns: [compPlasmaArc, compCrackleDischarge, compLightning] },
    shadow:     { fns: [compHaloFlash, compEchoWave, compSingularity] },
    crystal:    { fns: [compCrystalBell, compCrystalGrow, compPrismRefract] },
    desert:     { fns: [compSandSwirl, compDustPuff, compStormSwirl] },
    gas:        { fns: [compChromaShift, compDopplerWave, compAuroraRibbon] },
    ring:       { fns: [compRingPulsar, compRingDance, compChimeRing] },
    binary:     { fns: [compEchoWave, compDigitalGlitch, compScanline] },
    arcane:     { fns: [compStarBurst, compConstellation, compGalaxySpawn] },
    mechanical: { fns: [compClockGears, compBouncingBall, compBeam] },
    war:        { fns: [compLavaErupt, compCrossFlash], flashes: [compFlash] },
    void:       { fns: [compBubbleStream, compWormhole, compGravityWell] },
  },

  epic: {
    fire:       { fns: [compPhoenixBurst, compFlameTongues, compLavaErupt, compFireworks] },
    ice:        { fns: [compFrostExplode, compCrystalGrow, compIceWisps, compShieldRipple] },
    water:      { fns: [compRipple, compLiquidPool, compBubblePop, compWaveTrain] },
    forest:     { fns: [compLifeBloom, compPetalStorm, compWindRustle, compBloomPetals] },
    toxic:      { fns: [compToxicCloud, compBubblePop, compChromaShift, compDimensionRift] },
    plasma:     { fns: [compPlasmaArc, compLightning, compChargeBurst, compCrackleDischarge] },
    shadow:     { fns: [compSingularity, compEchoSpawn, compGravityWell, compHaloFlash] },
    crystal:    { fns: [compCrystalBell, compPrismShift, compCrystalGrow, compCrystalShatter] },
    desert:     { fns: [compTornado, compSandSwirl, compDustPuff, compEarthquakeShake] },
    gas:        { fns: [compChromaShift, compPrismShift, compAuroraRibbon, compDopplerWave] },
    ring:       { fns: [compMultiRing, compRingDance, compRingPulsar, compChimeRing] },
    binary:     { fns: [compDigitalGlitch, compPixelGrid, compGlyphFlash, compMorseFlash] },
    arcane:     { fns: [compGalaxySpawn, compStarPolygon, compFlickerStars, compConstellation] },
    mechanical: { fns: [compClockGears, compAtomShells, compOrbit, compBouncingBall] },
    war:        { fns: [compFireworks, compLavaErupt, compCrossFlash, compEarthquakeShake], flashes: [compFlash] },
    void:       { fns: [compSingularity, compWormhole, compDimensionRift, compGravityKnot] },
  },

  legendary: {
    fire:       { fns: [compPhoenixBurst, compFireworks, compSolarFlare, compLavaErupt, compFlameTongues, compStarBurst], flashes: [compFlash] },
    ice:        { fns: [compFrostExplode, compCrystalBell, compIceWisps, compSnowDrift, compCrystalShatter, compShieldRipple] },
    water:      { fns: [compTornado, compBubblePop, compRipple, compWave, compLiquidPool, compDopplerWave, compParticleFountain] },
    forest:     { fns: [compPetalStorm, compLifeBloom, compWindRibbons, compBloomPetals, compHeartPulse, compSpiral, compFlickerStars] },
    toxic:      { fns: [compDimensionRift, compChromaShift, compToxicCloud, compBubblePop, compVortex, compEchoWave, compSwarmParticles] },
    plasma:     { fns: [compLightning, compChargeBurst, compMagneticField, compPlasmaArc, compCrackleDischarge, compCosmicRay, compBeam] },
    shadow:     { fns: [compSingularity, compWormhole, compGravityKnot, compEchoWave, compHaloFlash, compDimensionRift, compRipBlade] },
    crystal:    { fns: [compPrismRefract, compPrismShift, compCrystalBell, compKaleidoscope, compCrystalGrow, compCrystalShatter, compMultiRing] },
    desert:     { fns: [compTornado, compEarthquakeShake, compStormSwirl, compSandSwirl, compConstellation, compComet, compDustPuff] },
    gas:        { fns: [compAuroraRibbon, compPrismShift, compChromaShift, compKaleidoscope, compInfinityTrail, compTimeWave, compLightDance] },
    ring:       { fns: [compMultiRing, compRingDance, compAtomShells, compRingPulsar, compOrbit, compChimeRing, compTwinPulse] },
    binary:     { fns: [compGlyphFlash, compDNAHelix, compDigitalGlitch, compPixelGrid, compSnakeTrail, compMorseFlash, compGlitchStutter] },
    arcane:     { fns: [compSupernova, compGalaxySpawn, compConstellation, compStarPolygon, compAccretionDisk, compCosmicWeb, compSpiralArms] },
    mechanical: { fns: [compDNAHelix, compOrbit, compClockGears, compAtomShells, compWreckageOrbit, compSwarmParticles, compCosmicRay] },
    war:        { fns: [compFireworks, compSupernova, compStarBurst, compPhoenixBurst, compLavaErupt], flashes: [compFlash, compFlash] },
    void:       { fns: [compSingularity, compDimensionRift, compWormhole, compGravityWell, compQuantumSplit, compEchoSpawn, compCosmicWeb] },
  },
}

// ============== buildFakeSys helper ==============

function buildFakeSys(
  element: Element,
  size: number,
  brightness: number,
): SharedBgSystem {
  const tint = ELEMENT_TINTS[element]
  return {
    id: `awakened-${element}`,
    name: element,
    x: 0,
    y: 0,
    type: 'resource',
    archetype: archetypeForElement(element),
    color: tint,
    accent: tint,
    size,
    brightness,
    hasMoon: false,
    rngSeed: 0,
  }
}

// ============== Convenience exports (for tests / external consumers) ==============

export const COMMON_PRESETS    = PRESETS['common']
export const RARE_PRESETS      = PRESETS['rare']
export const EPIC_PRESETS      = PRESETS['epic']
export const LEGENDARY_PRESETS = PRESETS['legendary']

// ============== Public API ==============

interface ScheduleAwakenedOpts {
  throttle?: number
}

const VALID_AWAKENED_SET: ReadonlySet<string> = new Set<string>(AWAKENED_TIERS)

/**
 * Запускает повторяющийся awakened idle effect для (element, tier) поверх container.
 * Возвращает OverlayLifecycle с dispose() — отменяет timer.
 */
export function scheduleAwakenedIdle(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  element: Element,
  tier: AwakenedTier,
  opts?: ScheduleAwakenedOpts,
): OverlayLifecycle {
  const safeTier: AwakenedTier = VALID_AWAKENED_SET.has(tier) ? tier : 'common'
  const params = TIER_PARAMS[safeTier]
  const fakeSys = buildFakeSys(element, params.size, params.brightness)

  let seed = (Date.now() ^ element.length ^ safeTier.length) >>> 0
  const rng = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return (seed & 0xffffffff) / 0x100000000
  }

  const throttle = Math.max(0.1, opts?.throttle ?? 1)
  const intervalMs = Math.max(200, Math.round(params.intervalMs / throttle))
  const preset = PRESETS[safeTier][element]

  const timer = scene.time.addEvent({
    delay: intervalMs,
    loop: true,
    callback: () => {
      const ownerScene: Phaser.Scene | null = (
        container as { scene: Phaser.Scene | null }
      ).scene
      if (!ownerScene || !container.active) return
      try {
        for (const fn of preset.fns) {
          fn(scene, container, fakeSys, rng)
        }
        if (preset.flashes) {
          for (const flash of preset.flashes) flash(scene, container, rng)
        }
      } catch (e) {
        console.warn('[awakened] primitive failed for', element, safeTier, e)
        timer.remove(false)
      }
    },
  })

  return {
    dispose: () => {
      timer.remove(false)
    },
  }
}
