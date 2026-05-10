// Phase 20-04 follow-up: Animation orchestration extracted from PopoverController.
//
// AnimationOrchestrator owns:
//   - tap-driven planet animation orchestration (recipe из THEME_COMPONENTS pool)
//   - per-component dispatch table (96 comp* функций)
//   - предрасчёт длительности recipe (для starmap:planet-tapped emit)
//
// Design: класс-controller, потому что orchestration зависит от scene-level state
// (THEME_COMPONENTS, mainSeedOverride, systemSprites). PopoverController владеет
// инстансом и делегирует вызовы из handlePlanetPress.
//
// Public API:
//   - getAnimationDurationMs(sys): suммарная длительность recipe (cap=1500ms)
//   - playUniqueAnimation(sys): запускает recipe компонентов с rng-параметрами
//
// Internal: runAnimComponent — switch по 96 индексам компонентов.

import Phaser from 'phaser'
import type { StarMapScene } from '../../StarMapScene'
import type { Race, BgSystem } from '../types'
import { animRng } from '../helpers'
import {
  compRing,
  compSparkle,
  compFlash,
  compStarBurst,
  compHaloFlash,
  compConfetti,
  compRipple,
  compEchoWave,
  compFlameTongues,
  compIceWisps,
  compPlasmaArc,
  compChromaShift,
  compCrystalShatter,
  compBloomPetals,
  compToxicCloud,
  compSandSwirl,
  compChimeRing,
  compBubbleStream,
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
  compLensFlare,
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
  compPulseHex,
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
  compDroneHum,
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
} from '../../../effects/anim/shared'

// Типичная длительность каждого из 96 компонентов анимации (ms).
// Значения — приблизительный max каждой компоненты, выведенный из const dur
// внутри comp* функций. Cap=1500ms (wrapper destroy в playUniqueAnimation).
// Phase 8: добавлены entries 88-95 для новых компонентов.
const COMP_DURATIONS_MS: Record<number, number> = {
  0: 800,
  1: 800,
  2: 600,
  3: 250,
  4: 500,
  5: 1500,
  6: 900,
  7: 800,
  8: 850,
  9: 1200,
  10: 700,
  11: 800,
  12: 1300,
  13: 1100,
  14: 1000,
  15: 600,
  16: 800,
  17: 1000,
  18: 1100,
  19: 900,
  20: 1000,
  21: 1100,
  22: 550,
  23: 750,
  24: 1000,
  25: 700,
  26: 1000,
  27: 900,
  28: 1200,
  29: 1000,
  30: 550,
  31: 900,
  32: 850,
  33: 1200,
  34: 1300,
  35: 550,
  36: 600,
  37: 800,
  38: 350,
  39: 800,
  40: 1500,
  41: 700,
  42: 1200,
  43: 800,
  44: 750,
  45: 1500,
  46: 750,
  47: 550,
  48: 1000,
  49: 1100,
  50: 600,
  51: 1000,
  52: 700,
  53: 400,
  54: 1500,
  55: 1300,
  56: 1500,
  57: 800,
  58: 900,
  59: 1100,
  60: 700,
  61: 900,
  62: 550,
  63: 600,
  64: 900,
  65: 1500,
  66: 700,
  67: 800,
  68: 800,
  69: 1000,
  70: 1200,
  71: 1000,
  72: 900,
  73: 800,
  74: 1100,
  75: 550,
  76: 700,
  77: 800,
  78: 1000,
  79: 1500,
  80: 400,
  81: 900,
  82: 600,
  83: 700,
  84: 1000,
  85: 1100,
  86: 900,
  87: 1200,
  // Phase 8 components
  88: 900, // bouncingBall
  89: 600, // digitalGlitch
  90: 900, // ringPulsar
  91: 1000, // swarmParticles
  92: 600, // prismRefract
  93: 1000, // lifeBloom
  94: 1100, // windRibbons
  95: 900, // wreckageOrbit
}

export class AnimationOrchestrator {
  private scene: StarMapScene

  constructor(scene: StarMapScene) {
    this.scene = scene
  }

  // Прогоняет ту же логику recipe-сборки что и playUniqueAnimation, но без
  // запуска tweens. Возвращает суммарную длительность анимации (delay + max comp).
  // Cap=1500ms (wrapper destroy timeout в playUniqueAnimation).
  getAnimationDurationMs(sys: Race | BgSystem): number {
    const scene = this.scene
    const rng = animRng(sys, scene.mainSeedOverride)
    const theme = (sys as BgSystem).archetype ?? sys.type
    const pool = scene.THEME_COMPONENTS[theme] ?? [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]

    // Реплицируем порядок rng() из playUniqueAnimation
    const r1 = rng()
    const targetCount = r1 < 0.5 ? 2 : r1 < 0.85 ? 3 : 4
    const compCount = Math.min(targetCount, pool.length)
    const used = new Set<number>()
    const components: number[] = []
    while (components.length < compCount) {
      const c = pool[Math.floor(rng() * pool.length)]
      if (!used.has(c)) {
        used.add(c)
        components.push(c)
      }
    }

    // useModifier rng calls (для совпадения порядка, хотя нам они не нужны)
    const useModifier = rng() < 0.25
    if (useModifier) {
      rng()
      rng()
    }

    let maxFinish = 0
    components.forEach((c, i) => {
      const delay = i === 0 ? 0 : Math.floor(rng() * 250) + 50
      const dur = COMP_DURATIONS_MS[c] ?? 800
      const finish = delay + dur
      if (finish > maxFinish) maxFinish = finish
    })

    // +50ms tail на затухание звука; cap = 1500ms wrapper
    return Math.min(1500, maxFinish + 50)
  }

  // Главный entry — собирает уникальный рецепт анимации для планеты.
  // 1) Pool компонентов берётся из THEME_COMPONENTS по archetype/type → каждая
  //    планета играет анимации, тематически подходящие её природе.
  // 2) Recipe = 1-4 случайных компонента из pool с rng-параметрами.
  // 3) Цвета берутся из THEME_PALETTES → визуально соответствуют ассоциации архетипа.
  // Уникальных подписей: ~24 компонента × ~10⁵ комбинаций параметров × pool size = миллионы.
  playUniqueAnimation(sys: Race | BgSystem): void {
    const scene = this.scene
    const sprite = scene.systemSprites.get(sys.id)
    if (!sprite) return
    const rng = animRng(sys, scene.mainSeedOverride)

    // Тематический pool компонентов
    const theme = (sys as BgSystem).archetype ?? sys.type
    const pool = scene.THEME_COMPONENTS[theme] ?? [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]

    // Phase 7: минимум 2 компонента — 1-component recipes давали всего 10 уникальных вариантов
    // на pool из 10, что приводило к видимым повторам среди ~25% планет.
    // Распределение: 2 (50%), 3 (35%), 4 (15%).
    const r1 = rng()
    const targetCount = r1 < 0.5 ? 2 : r1 < 0.85 ? 3 : 4
    const compCount = Math.min(targetCount, pool.length)
    const used = new Set<number>()
    const components: number[] = []
    while (components.length < compCount) {
      const c = pool[Math.floor(rng() * pool.length)]
      if (!used.has(c)) {
        used.add(c)
        components.push(c)
      }
    }

    // Phase 7: композитный модификатор recipe (25% шанс) —
    // оборачивает все компоненты recipe в общий wrapper-container с глобальным
    // rotation offset (±90°) и scale shift (0.7-1.3). Это даёт миллионы доп. вариаций.
    const useModifier = rng() < 0.25
    const modRotation = useModifier ? (rng() - 0.5) * Math.PI : 0
    const modScale = useModifier ? 0.7 + rng() * 0.6 : 1

    components.forEach((c, i) => {
      const delay = i === 0 ? 0 : Math.floor(rng() * 250) + 50
      scene.time.delayedCall(delay, () => {
        if (!sprite.active) return
        if (useModifier) {
          const wrapper = scene.add.container(0, 0)
          wrapper.rotation = modRotation
          wrapper.setScale(modScale)
          sprite.add(wrapper)
          this.runAnimComponent(c, wrapper, sys, rng)
          // Уборка wrapper'а после завершения всех его child-tweens.
          // 1500ms покрывает дольший компонент (комет, торнадо ~700-1000ms).
          scene.time.delayedCall(1500, () => {
            if (wrapper.active) wrapper.destroy()
          })
        } else {
          this.runAnimComponent(c, sprite, sys, rng)
        }
      })
    })
  }

  private runAnimComponent(
    idx: number,
    sprite: Phaser.GameObjects.Container,
    sys: Race | BgSystem,
    rng: () => number,
  ): void {
    const scene = this.scene
    switch (idx) {
      case 0:
        compRing(scene, sprite, sys, rng)
        break
      case 1:
        compMultiRing(scene, sprite, sys, rng)
        break
      case 2:
        compSparkle(scene, sprite, sys, rng)
        break
      case 3:
        compFlash(scene, sprite, rng)
        break
      case 4:
        compLightning(scene, sprite, sys, rng)
        break
      case 5:
        compOrbit(scene, sprite, sys, rng)
        break
      case 6:
        compSpiral(scene, sprite, sys, rng)
        break
      case 7:
        compConfetti(scene, sprite, sys, rng)
        break
      case 8:
        compWave(scene, sprite, sys, rng)
        break
      case 9:
        compComet(scene, sprite, sys, rng)
        break
      case 10:
        compStarBurst(scene, sprite, sys, rng)
        break
      case 11:
        compHaloFlash(scene, sprite, sys, rng)
        break
      case 12:
        compVortex(scene, sprite, sys, rng)
        break
      case 13:
        compStormSwirl(scene, sprite, sys, rng)
        break
      case 14:
        compRingDance(scene, sprite, sys, rng)
        break
      case 15:
        compCrystalShatter(scene, sprite, sys, rng)
        break
      case 16:
        compRipple(scene, sprite, sys, rng)
        break
      case 17:
        compSandSwirl(scene, sprite, sys, rng)
        break
      case 18:
        compLavaErupt(scene, sprite, sys, rng)
        break
      case 19:
        compBloomPetals(scene, sprite, sys, rng)
        break
      case 20:
        compDustPuff(scene, sprite, sys, rng)
        break
      case 21:
        compToxicCloud(scene, sprite, sys, rng)
        break
      case 22:
        compBeam(scene, sprite, sys, rng)
        break
      case 23:
        compTwinPulse(scene, sprite, sys, rng)
        break
      case 24:
        compSingularity(scene, sprite, sys, rng)
        break
      case 25:
        compEchoWave(scene, sprite, sys, rng)
        break
      case 26:
        compGravityWell(scene, sprite, sys, rng)
        break
      case 27:
        compSolarFlare(scene, sprite, sys, rng)
        break
      case 28:
        compAuroraRibbon(scene, sprite, sys, rng)
        break
      case 29:
        compDNAHelix(scene, sprite, sys, rng)
        break
      case 30:
        compLensFlare(scene, sprite, sys, rng)
        break
      case 31:
        compConstellation(scene, sprite, sys, rng)
        break
      case 32:
        compMagneticField(scene, sprite, sys, rng)
        break
      case 33:
        compPhoenixBurst(scene, sprite, sys, rng)
        break
      case 34:
        compWormhole(scene, sprite, sys, rng)
        break
      case 35:
        compCosmicRay(scene, sprite, sys, rng)
        break
      case 36:
        compQuantumSplit(scene, sprite, sys, rng)
        break
      case 37:
        compHeartPulse(scene, sprite, sys, rng)
        break
      case 38:
        compCrackleDischarge(scene, sprite, sys, rng)
        break
      case 39:
        compPixelGrid(scene, sprite, sys, rng)
        break
      case 40:
        compSpiralArms(scene, sprite, sys, rng)
        break
      case 41:
        compCrystalGrow(scene, sprite, sys, rng)
        break
      case 42:
        compSnowDrift(scene, sprite, sys, rng)
        break
      case 43:
        compGalaxySpawn(scene, sprite, sys, rng)
        break
      case 44:
        compPulseHex(scene, sprite, sys, rng)
        break
      case 45:
        compTornado(scene, sprite, sys, rng)
        break
      case 46:
        compStarPolygon(scene, sprite, sys, rng)
        break
      case 47:
        compCrossFlash(scene, sprite, sys, rng)
        break
      case 48:
        compWaveTrain(scene, sprite, sys, rng)
        break
      case 49:
        compPetalStorm(scene, sprite, sys, rng)
        break
      case 50:
        compFlameTongues(scene, sprite, sys, rng)
        break
      case 51:
        compSnakeTrail(scene, sprite, sys, rng)
        break
      case 52:
        compBubblePop(scene, sprite, sys, rng)
        break
      case 53:
        compChromaShift(scene, sprite, sys, rng)
        break
      // Phase 7: новые компоненты
      case 54:
        compAtomShells(scene, sprite, sys, rng)
        break
      case 55:
        compSupernova(scene, sprite, sys, rng)
        break
      case 56:
        compAccretionDisk(scene, sprite, sys, rng)
        break
      case 57:
        compFlickerStars(scene, sprite, sys, rng)
        break
      case 58:
        compLightDance(scene, sprite, sys, rng)
        break
      case 59:
        compDimensionRift(scene, sprite, sys, rng)
        break
      case 60:
        compFrostExplode(scene, sprite, sys, rng)
        break
      case 61:
        compTimeWave(scene, sprite, sys, rng)
        break
      case 62:
        compGlyphFlash(scene, sprite, sys, rng)
        break
      case 63:
        compPrismShift(scene, sprite, sys, rng)
        break
      // Расширение 3 (доп. оригинальные компоненты)
      case 64:
        compChargeBurst(scene, sprite, sys, rng)
        break
      case 65:
        compInfinityTrail(scene, sprite, sys, rng)
        break
      case 66:
        compShieldRipple(scene, sprite, sys, rng)
        break
      case 67:
        compFireworks(scene, sprite, sys, rng)
        break
      case 68:
        compScanline(scene, sprite, sys, rng)
        break
      case 69:
        compLiquidPool(scene, sprite, sys, rng)
        break
      case 70:
        compGravityKnot(scene, sprite, sys, rng)
        break
      case 71:
        compCosmicWeb(scene, sprite, sys, rng)
        break
      case 72:
        compParticleFountain(scene, sprite, sys, rng)
        break
      case 73:
        compEchoSpawn(scene, sprite, sys, rng)
        break
      case 74:
        compIceWisps(scene, sprite, sys, rng)
        break
      case 75:
        compRipBlade(scene, sprite, sys, rng)
        break
      // Расширение 4 — компоненты 76-87 (с явными sound-style)
      case 76:
        compChimeRing(scene, sprite, sys, rng)
        break
      case 77:
        compEarthquakeShake(scene, sprite, sys, rng)
        break
      case 78:
        compKaleidoscope(scene, sprite, sys, rng)
        break
      case 79:
        compDroneHum(scene, sprite, sys, rng)
        break
      case 80:
        compGlitchStutter(scene, sprite, sys, rng)
        break
      case 81:
        compDopplerWave(scene, sprite, sys, rng)
        break
      case 82:
        compMorseFlash(scene, sprite, sys, rng)
        break
      case 83:
        compCrystalBell(scene, sprite, sys, rng)
        break
      case 84:
        compWindRustle(scene, sprite, sys, rng)
        break
      case 85:
        compClockGears(scene, sprite, sys, rng)
        break
      case 86:
        compBubbleStream(scene, sprite, sys, rng)
        break
      case 87:
        compPlasmaArc(scene, sprite, sys, rng)
        break
      // Phase 8 — компоненты 88-95
      case 88:
        compBouncingBall(scene, sprite, sys, rng)
        break
      case 89:
        compDigitalGlitch(scene, sprite, sys, rng)
        break
      case 90:
        compRingPulsar(scene, sprite, sys, rng)
        break
      case 91:
        compSwarmParticles(scene, sprite, sys, rng)
        break
      case 92:
        compPrismRefract(scene, sprite, sys, rng)
        break
      case 93:
        compLifeBloom(scene, sprite, sys, rng)
        break
      case 94:
        compWindRibbons(scene, sprite, sys, rng)
        break
      case 95:
        compWreckageOrbit(scene, sprite, sys, rng)
        break
    }
  }
}
