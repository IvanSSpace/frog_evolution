// Phase 13: awakened idle presets — 4 tiers × 16 elements = 64 entries.
// Каждый tier добавляет primitives к предыдущему (escalating complexity per ELEMENT-09):
//   common:    2-3 primitives, brightness 0.55, sys.size 8,  interval 2500ms
//   rare:      4-5 primitives + halo glow,    brightness 0.70, sys.size 10, interval 2000ms
//   epic:      5-6 primitives + ground emit,  brightness 0.85, sys.size 13, interval 1500ms
//   legendary: 8+ primitives full storm,      brightness 1.00, sys.size 16, interval 1000ms
//
// scheduleAwakenedIdle — аналог scheduleDormantIdle, но запускает соответствующий tier preset.

import type Phaser from 'phaser'
import type { Element } from '../../../store/cosmic/types'
import {
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
  compRing,
  compSparkle,
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
  // compFlash вызывается без sys — лежит отдельно. Может быть >1 в legendary.
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
  common: { size: 8, brightness: 0.55, intervalMs: 2500 },
  rare: { size: 10, brightness: 0.7, intervalMs: 2000 },
  epic: { size: 13, brightness: 0.85, intervalMs: 1500 },
  legendary: { size: 16, brightness: 1.0, intervalMs: 1000 },
}

// ============== Element → primitives mapping ==============
// Каждый element определяет "core" primitive (как в dormantPresets) — он повторяется
// и наращивается по мере роста tier. Mapping строго соответствует ELEMENT-09 ladder.

const ELEMENT_CORE: Record<Element, SysPrimitive> = {
  fire: compFlameTongues,
  ice: compIceWisps,
  water: compRipple,
  forest: compBloomPetals,
  toxic: compToxicCloud,
  plasma: compPlasmaArc,
  shadow: compHaloFlash,
  crystal: compCrystalShatter,
  desert: compSandSwirl,
  gas: compChromaShift,
  ring: compChimeRing,
  binary: compEchoWave,
  arcane: compStarBurst,
  mechanical: compConfetti,
  war: compFlameTongues, // war core = flame (compFlash без sys, отдельно через flashes[])
  void: compBubbleStream,
}

// "Glow" primitive (rare+) — обычно compHaloFlash, иногда compSparkle для контраста.
const ELEMENT_GLOW: Record<Element, SysPrimitive> = {
  fire: compHaloFlash,
  ice: compHaloFlash,
  water: compHaloFlash,
  forest: compHaloFlash,
  toxic: compHaloFlash,
  plasma: compHaloFlash,
  shadow: compEchoWave,
  crystal: compHaloFlash,
  desert: compHaloFlash,
  gas: compHaloFlash,
  ring: compHaloFlash,
  binary: compHaloFlash,
  arcane: compHaloFlash,
  mechanical: compHaloFlash,
  war: compHaloFlash,
  void: compHaloFlash,
}

// "Accent" primitive (rare+) — element-specific вторичный motif (sparkle / shatter / bubble).
const ELEMENT_ACCENT: Record<Element, SysPrimitive> = {
  fire: compSparkle,
  ice: compCrystalShatter,
  water: compBubbleStream,
  forest: compSparkle,
  toxic: compBubbleStream,
  plasma: compSparkle,
  shadow: compBubbleStream,
  crystal: compSparkle,
  desert: compConfetti,
  gas: compBubbleStream,
  ring: compSparkle,
  binary: compSparkle,
  arcane: compSparkle,
  mechanical: compSparkle,
  war: compSparkle,
  void: compEchoWave,
}

// "Storm" primitive (legendary only) — третий level накладывается поверх.
const ELEMENT_STORM: Record<Element, SysPrimitive> = {
  fire: compStarBurst,
  ice: compEchoWave,
  water: compEchoWave,
  forest: compStarBurst,
  toxic: compChromaShift,
  plasma: compStarBurst,
  shadow: compChromaShift,
  crystal: compStarBurst,
  desert: compChromaShift,
  gas: compEchoWave,
  ring: compStarBurst,
  binary: compStarBurst,
  arcane: compStarBurst,
  mechanical: compStarBurst,
  war: compStarBurst,
  void: compStarBurst,
}

// ============== Build preset map ==============

function buildPresetForTier(
  element: Element,
  tier: AwakenedTier,
): TierPresetList {
  const core = ELEMENT_CORE[element]
  const glow = ELEMENT_GLOW[element]
  const accent = ELEMENT_ACCENT[element]
  const storm = ELEMENT_STORM[element]

  // war "common" — special case: 2× compFlash (без sys).
  if (element === 'war' && tier === 'common') {
    return { fns: [], flashes: [compFlash, compFlash] }
  }

  switch (tier) {
    case 'common':
      // 2 vis emits (common ladder: 2-3 primitives).
      return { fns: [core, core] }

    case 'rare':
      // 4 emits: core×2 + halo glow + accent.
      return { fns: [core, core, glow, accent] }

    case 'epic':
      // 5 emits: + ring (отчётливое kольцо) — total core×2 + glow + accent + compRing.
      return { fns: [core, core, glow, accent, compRing] }

    case 'legendary': {
      // 8+ emits: core×3 + glow + accent + storm + compRing + compFlash.
      const fns: SysPrimitive[] = [
        core,
        core,
        core,
        glow,
        accent,
        storm,
        compRing,
      ]
      // ring element — extra ring; war — extra flash.
      if (element === 'ring') fns.push(compRing)
      if (element === 'arcane') fns.push(storm)
      const flashes: FlashPrimitive[] =
        element === 'war' ? [compFlash, compFlash] : [compFlash]
      return { fns, flashes }
    }
  }
}

// 4 × 16 = 64 preset entries.
const AWAKENED_PRESET_MAP: Record<
  AwakenedTier,
  Record<Element, TierPresetList>
> = (() => {
  const result = {} as Record<AwakenedTier, Record<Element, TierPresetList>>
  const elements: Element[] = [
    'fire',
    'ice',
    'water',
    'forest',
    'toxic',
    'plasma',
    'shadow',
    'crystal',
    'desert',
    'gas',
    'ring',
    'binary',
    'arcane',
    'mechanical',
    'war',
    'void',
  ]
  for (const tier of AWAKENED_TIERS) {
    const tierMap = {} as Record<Element, TierPresetList>
    for (const el of elements) {
      tierMap[el] = buildPresetForTier(el, tier)
    }
    result[tier] = tierMap
  }
  return result
})()

// Convenience exports — strict typed records (per plan must_haves).
export const COMMON_PRESETS: Record<Element, TierPresetList> =
  AWAKENED_PRESET_MAP['common']
export const RARE_PRESETS: Record<Element, TierPresetList> =
  AWAKENED_PRESET_MAP['rare']
export const EPIC_PRESETS: Record<Element, TierPresetList> =
  AWAKENED_PRESET_MAP['epic']
export const LEGENDARY_PRESETS: Record<Element, TierPresetList> =
  AWAKENED_PRESET_MAP['legendary']

// ============== buildFakeSys helper (T-13-budget: avoid 64× literal duplication) ==============

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

// ============== Public API ==============

interface ScheduleAwakenedOpts {
  /** Phase 20 INFRA-05 wires real adaptive throttle. >0; default 1 — base intervalMs.
   *  <1 = реже, >1 = чаще (но cap'нутый снизу к 200ms). */
  throttle?: number
}

const VALID_AWAKENED_SET: ReadonlySet<string> = new Set<string>(AWAKENED_TIERS)

/**
 * Запускает повторяющийся awakened idle effect для (element, tier) поверх container.
 * Возвращает OverlayLifecycle с dispose() — отменяет timer.
 *
 * @param scene активная Phaser scene
 * @param container parent container (overlay container внутри frog container)
 * @param element один из 16 elements
 * @param tier 'common' | 'rare' | 'epic' | 'legendary'
 * @param opts throttle (Phase 20)
 */
export function scheduleAwakenedIdle(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  element: Element,
  tier: AwakenedTier,
  opts?: ScheduleAwakenedOpts,
): OverlayLifecycle {
  // T-13-01: validate tier — fallback к 'common' при tampered input.
  const safeTier: AwakenedTier = VALID_AWAKENED_SET.has(tier) ? tier : 'common'

  const params = TIER_PARAMS[safeTier]
  const fakeSys = buildFakeSys(element, params.size, params.brightness)

  // Lightweight LCG rng — детерминирован per (element, tier, time), даёт небольшое
  // разнообразие между tick'ами (как в dormantPresets).
  let seed = (Date.now() ^ element.length ^ safeTier.length) >>> 0
  const rng = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return (seed & 0xffffffff) / 0x100000000
  }

  const throttle = Math.max(0.1, opts?.throttle ?? 1)
  const intervalMs = Math.max(200, Math.round(params.intervalMs / throttle))

  const preset = AWAKENED_PRESET_MAP[safeTier][element]

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
        // T-12-08 паттерн: primitive crash не ломает scene; warn один раз и стопаем.
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
