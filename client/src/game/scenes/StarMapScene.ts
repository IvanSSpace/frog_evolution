import Phaser from 'phaser'
import { eventBus } from '../../store/eventBus'
import { useGameStore } from '../../store/gameStore'
import {
  attachNebulaBackground,
  type NebulaBackgroundHandle,
} from '../effects/NebulaBackground'
import { ShipSprite } from '../effects/ShipSprite'
import { violetRing } from '../effects/presets'
import planetMap from '../data/planetMap.json'
import { findPlanetById, DAILY_CAP } from '../data/missionConfig'
import type { ShipState } from '../../store/cosmic/types'
import { deriveModulations } from '../../audio/planetVoice'
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
  // Group F — Phase 20-02
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
  // Group G — Phase 20-02
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
  // Group H — Phase 20-02
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
  // Group I — Phase 20-02 (final batch)
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
} from '../effects/anim/shared'
import type { Race, BgSystem, Archetype, PlanetMapEntry } from './starmap/types'
import {
  TYPE_LABELS,
  mulberry32,
  hashId,
  effectiveSeed,
  animRng,
  worldToDom,
} from './starmap/helpers'

// Phaser-сцена Звёздной карты. Запускается рядом с MainScene через scene-manager.
// Ничего о gameStore не знает — это «декоративная карта» для просмотра системы
// и (в будущем) удобной навигации Скаутов.

const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))
// Размер мира — 7000 от центра (полный 14000)
const WORLD_SIZE = 7000 * DPR
// Сколько всего обитаемых планет (16 главных + 51 фоновая обитаемая)
const TOTAL_INHABITED = 67
// Спутники появляются плавным fade-in между MOON_FADE_START и MOON_FADE_END.
// Ниже START — alpha 0, выше END — alpha 1, между — линейный переход.
// Цель: спутники видны только при близком zoom (>0.85), не грузят сцену при отдалении.
const MOON_FADE_START = 0.7
const MOON_FADE_END = 0.85
// Минимальный zoom, при котором BG-контейнеры (с детальным рендером + interactivity)
// показываются. Ниже — batch-точки (звёздное небо, 1 draw call). Не кликабельны.
const BG_PLANET_MIN_ZOOM = 0.08
// Минимальный zoom, при котором рисуется ДЕТАЛИЗАЦИЯ BG-планет
// (archetype-specific узоры + universal modifiers).
// 0.10 — детали видны почти всегда. Ниже порога вступает batch-рендер (звёздное небо).
const BG_DETAIL_MIN_ZOOM = 0.1
// Минимальный zoom, при котором планеты (BG + main) кликабельны.
// Ниже — interactive отключён (планеты выглядят как точки, клики бессмысленны).
// Это снимает hit-test overhead с pointer events во время drag/pinch.
const BG_INTERACTIVE_MIN_ZOOM = 0.41

// MAIN_RACES читаются из planetMap.json — источник истины для всех 16 главных рас.
// Координаты/размеры в JSON хранятся в DPR=1 base, в runtime умножаются на real DPR.
// Чтобы изменить позицию/цвет/размер главной расы — правь planetMap.json напрямую.
const MAIN_RACES: Race[] = (planetMap.planets as PlanetMapEntry[])
  .filter((p) => p.kind === 'main')
  .map((p) => ({
    id: p.id,
    name: p.name,
    x: p.x * DPR,
    y: p.y * DPR,
    type: p.type,
    color: p.color,
    accent: p.accent,
    size: p.size * DPR,
  }))

// NAMES_POOL устарел — теперь имена берутся из BG_NAME_POOL (data/planetNames.ts).
// Перемешиваются seed-shuffle в generateBackgroundSystems → каждая планета
// получает уникальное стабильное имя.
//
// TYPE_LABELS, mulberry32, Archetype, BgSystem, Race, PlanetMapEntry — extracted
// в `./starmap/types.ts` и `./starmap/helpers.ts` (Phase 20-01).

const SEED = 19450707

// Базовые HSL hue по архетипам (диапазон). Цвет генерируется из этого
// + рандомное смещение, чтобы каждая планета имела УНИКАЛЬНЫЙ оттенок.
const ARCHETYPE_HUES: Record<Archetype, [number, number]> = {
  gas_giant: [25, 55], // жёлто-оранжевый
  gas_ringed: [260, 295], // фиолетовый
  ice: [180, 220], // голубой
  ocean: [200, 230], // синий
  desert: [30, 50], // песочный
  lava: [0, 25], // красно-оранжевый
  forest: [90, 140], // зелёный
  mineral: [200, 280], // серо-синий-фиолет
  dead: [200, 240], // холодный серый
  toxic: [80, 130], // ядовито-зелёный
  plasma: [20, 50], // оранжево-жёлтый
  binary: [0, 360], // любой (две планеты разных цветов)
}

function hslToHex(h: number, s: number, l: number): number {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  const r = Math.round(f(0) * 255)
  const g = Math.round(f(8) * 255)
  const b = Math.round(f(4) * 255)
  return (r << 16) | (g << 8) | b
}

function generatePalette(
  archetype: Archetype,
  rng: () => number,
): { color: number; accent: number } {
  const [hMin, hMax] = ARCHETYPE_HUES[archetype]
  const h = hMin + rng() * (hMax - hMin)
  const s = 55 + rng() * 35
  const l = 55 + rng() * 20
  const color = hslToHex(h, s, l)
  // Accent — родственный hue со сдвигом + другая яркость
  const hAccent = (h + (rng() - 0.5) * 30 + 360) % 360
  const accent = hslToHex(hAccent, s + 5, Math.max(15, l - 25))
  return { color, accent }
}

// TYPE_TO_ARCHETYPES и ARCHETYPE_SIZES перенесены в скрипт регенерации
// (/tmp/starmap_dump.cjs). Используются только для регенерации planetMap.json.
//
// Генерация фоновых планет перенесена в data/planetMap.json (источник истины).
// Скрипт перегенерации: /tmp/starmap_dump.cjs (запускать при изменении SEED/MIN_TO_DIST/etc).
// Чтобы изменить позицию/цвет/имя конкретной планеты — правь planetMap.json напрямую.

export class StarMapScene extends Phaser.Scene {
  private allSystems: (Race | BgSystem)[] = []
  private systemSprites = new Map<string, Phaser.GameObjects.Container>()
  private selectionMarker: Phaser.GameObjects.Graphics | null = null
  // Список объектов для manual culling (Phaser не делает frustum culling для Container).
  // lodMinZoom: если zoom < lodMinZoom → объект скрыт независимо от viewport (LOD).
  private cullableData: Array<{
    obj: Phaser.GameObjects.GameObject
    x: number
    y: number
    r: number
    lodMinZoom?: number
  }> = []
  private cullTickCounter = 0
  // Адаптивный hit-area для главных планет (тап по ним удобен на любом зуме)
  private mainPlanetHits: Array<{
    container: Phaser.GameObjects.Container
    baseR: number
    circle: Phaser.Geom.Circle
  }> = []
  // Целевая позиция центра камеры в world coords. Управляем через setCameraCenter().
  // Phaser scroll выводится из этой позиции через centerOn() каждый раз.
  private camCenterX = 0
  private camCenterY = 0
  // ID выбранной для popover расы (Phaser-popover в той же scene, в world-coords)
  private selectedMainRaceId: string | null = null
  private popover?: Phaser.GameObjects.Container
  // Простая модалка с именем BG-планеты — появляется через 400ms после клика.
  private bgNamePopup?: Phaser.GameObjects.Container
  private bgNamePopupTimer?: Phaser.Time.TimerEvent
  private nebula?: NebulaBackgroundHandle
  // Звёзды-ромбы, которые компенсируют zoom (видны и при максимальном отдалении)
  private zoomCompStars: Array<{
    obj: Phaser.GameObjects.Graphics
    baseScale: number
  }> = []
  // Спутники планет — рендерятся только при zoom >= MOON_MIN_ZOOM, иначе скрыты.
  private moons: Array<{
    obj: Phaser.GameObjects.Arc
    angle: number
    radius: number
    speed: number
  }> = []
  // Детализация BG-планет (archetype-specific графика + universal modifiers).
  // При zoom < BG_DETAIL_MIN_ZOOM скрывается → видны только базовые шары.
  // Это даёт ~80% сокращение draw calls на zoom-out → +20-30 FPS.
  private bgArchetypeGfx: Phaser.GameObjects.Graphics[] = []
  // Batch-рендер всех 434 BG как точек в одном Graphics — для экстремального zoom (<0.10).
  // Заменяет 434 индивидуальных контейнера → 1 draw call. Не кликабелен (звёздное небо).
  private bgBatchGfx: Phaser.GameObjects.Graphics | null = null
  // Контейнеры BG-планет для быстрого toggle interactive по zoom.
  // При zoom < BG_INTERACTIVE_MIN_ZOOM — input.enabled = false для всех (нет hit-test overhead).
  private bgInteractiveContainers: Phaser.GameObjects.Container[] = []
  private bgInteractiveEnabled = true
  // Линии связи между главными расами + кэш edges для перерисовки при изменении zoom.
  private mainLinesGfx: Phaser.GameObjects.Graphics | null = null
  private mainLinesEdges: Array<{
    ax: number
    ay: number
    bx: number
    by: number
  }> = []
  private mainLinesLastZoom = -1
  // Состояние счётчика тапов на каждую планету. Уникальная анимация срабатывает
  // на первом нажатии после смены/перерыва, потом раз в 2-6 нажатий.
  private planetPressState = new Map<
    string,
    { count: number; threshold: number }
  >()
  private currentPressedPlanetId: string | null = null
  // Флаг: текущий pointerup перехвачен interactive объектом (планетой/звездой).
  // Используется глобальным pointerup'ом для определения «тап в пустое место».
  tapHandledThisFrame = false

  // Phase 16: Ship singleton — Phaser-native ракетка с trail.
  // Auto-spawn в create() через ensureShipExists. Subscribed на cosmicSlice.ship.
  private shipSprite: ShipSprite | null = null
  private shipUnsubscribe: (() => void) | null = null
  private lastShipStateSig = ''
  private followingShip = false

  constructor() {
    super({ key: 'StarMapScene' })
  }

  preload() {
    this.load.image('spaceShip', '/spaceShip.png')
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000)
    // Стартуем с alpha 0 — game/index.ts сделает fade-in после create.
    this.cameras.main.setAlpha(0)

    // Туманность — закреплена в центре вселенной (0, 0), там где чёрная дыра.
    // Двигается и зумится с камерой — часть мира.
    // ↓ Размер туманности (множитель WORLD_SIZE). Увеличить — поменяй коэффициент.
    try {
      const NEBULA_SIZE = WORLD_SIZE * 2.5
      this.nebula = attachNebulaBackground(this, violetRing, {
        width: NEBULA_SIZE,
        height: NEBULA_SIZE,
        x: 0,
        y: 0,
      })
      const shader = this.nebula.shader
      if (shader && typeof shader.setDepth === 'function')
        shader.setDepth(-9000)
    } catch (err) {
      console.warn('[NebulaBackground] failed to attach:', err)
    }

    // Starfield перенесён ниже — нужны this.allSystems для кластеризации звёзд

    // Источник истины для всех планет — planetMap.json. Координаты/размеры в DPR-units
    // (DPR=1 base) → умножаем на real DPR в runtime.
    const bg: BgSystem[] = (planetMap.planets as PlanetMapEntry[])
      .filter((p) => p.kind === 'bg')
      .map((p) => ({
        id: p.id,
        name: p.name,
        x: p.x * DPR,
        y: p.y * DPR,
        type: p.type,
        archetype: p.archetype,
        color: p.color,
        accent: p.accent,
        size: p.size * DPR,
        brightness: p.brightness,
        hasMoon: p.hasMoon,
        rngSeed: p.rngSeed,
      }))

    // Помечаем 51 случайную фоновую как обитаемую (16 главных + 51 = 67 всего обитаемых)
    const inhabitedNeeded = Math.max(0, TOTAL_INHABITED - MAIN_RACES.length)
    const rngI = mulberry32(SEED + 99)
    const indices = bg.map((_, i) => i).sort(() => rngI() - 0.5)
    for (let i = 0; i < Math.min(inhabitedNeeded, indices.length); i++) {
      bg[indices[i]].isInhabited = true
    }
    this.allSystems = [...MAIN_RACES, ...bg]

    // Phase 7: глобальная уникальность signatures.
    // ВАЖНО: refineTextureSeeds() ДОЛЖЕН вызываться ПЕРЕД refineAnimSeeds() —
    // мутация rngSeed для текстур инвалидирует animation signatures, текстуры идут первыми.
    // Phase 8: refineSoundSeeds() — третий pass (texture → anim → sound).
    // Каждый pass conservative для следующего; sound mutation использует разную константу
    // (0xc2b2ae3d) чтобы не пересекаться с anim (0x9e3779b9) и texture (0x85ebca6b).
    this.refineTextureSeeds()
    this.refineAnimSeeds()
    this.refineSoundSeeds() // Phase 8
    // Phase 8 plan 06: anim+sound refine могут изменить rngSeed → редко создают
    // новую texture коллизию (наблюдение: 1 collision из 984 после первого прогона).
    // Второй проход texture refine стабилизирует pipeline до 984/984 unique.
    // Anim/sound signatures не страдают: повторная texture mutation использует
    // ту же константу 0x85ebca6b которую refineAnimSeeds учитывает в своих
    // signature space (88+ comp × strict params, миллионы вариантов).
    this.refineTextureSeeds()

    // Starfield — после генерации систем, чтобы кластеризовать звёзды вокруг планет
    this.setupStarfield()

    this.drawLines()

    for (const sys of this.allSystems) this.renderSystem(sys)

    // Batch-рендер всех BG-планет как точек (один Graphics, 1 draw call).
    // Виден при zoom < BG_PLANET_MIN_ZOOM, заменяет 434 индивидуальных контейнера.
    this.buildBgBatch()

    // Камера: ставим zoom 1.0 и центрируем на HOME (родной планете).
    // Координаты HOME — из planetMap.json, поэтому камера автоматически
    // подстраивается если HOME перемещён в JSON.
    const home = MAIN_RACES.find((r) => r.id === 'home') ?? MAIN_RACES[0]
    this.cameras.main.setZoom(1.0)
    this.setCameraCenter(home.x, home.y)
    this.updatePlanetHitAreas()

    this.setupControls()

    // Сброс выбранной планеты при закрытии popover извне
    eventBus.on('starmap:popover-close', () => {
      this.selectedMainRaceId = null
    })

    // Центрирование камеры на HOME с плавным tween (повторный клик по кнопке "Космос")
    eventBus.on('starmap:centerHome', () => {
      const homeRace = MAIN_RACES.find((r) => r.id === 'home') ?? MAIN_RACES[0]
      const cam = this.cameras.main
      // Плавный zoom-back до 1.0 + центрирование на HOME
      this.tweens.add({
        targets: { z: cam.zoom, x: this.camCenterX, y: this.camCenterY },
        z: 1.0,
        x: homeRace.x,
        y: homeRace.y,
        duration: 700,
        ease: 'Cubic.easeInOut',
        onUpdate: (tw) => {
          const t = tw.targets[0] as { x: number; y: number; z: number }
          cam.setZoom(t.z)
          this.setCameraCenter(t.x, t.y)
          // Hit-areas зависят от zoom — обновляем по ходу tween, иначе после
          // завершения hit-area остаётся гигантской (от прежнего малого zoom).
          this.scheduleBoundsUpdate()
        },
        onComplete: () => {
          this.updatePlanetHitAreas() // финальное обновление под точный zoom 1.0
        },
      })
    })

    // Живые анимации
    // this.setupBlackHole() // удалено по запросу — туманность вместо
    // this.setupHomeOrbiter() // удалено — кольца висели в (0,0), не в HOME
    this.setupCosmicDust()
    // this.setupSignalPulses()  // ВРЕМЕННО ОТКЛЮЧЕНО — понадобится для общения планет
    this.setupRandomSignals()
    this.setupTorRing()
    this.setupVeranLightning()
    this.setupRelictMourning()

    this.setupCoordinatesHUD()

    // Phaser-popover scale-compensation. Применяется в PRE_RENDER чтобы scale
    // соответствовал текущему cam.zoom синхронно с render (без 1-frame lag).
    this.events.on(Phaser.Scenes.Events.PRE_RENDER, () => {
      if (this.popover) {
        this.popover.setScale(1 / this.cameras.main.zoom)
      }
    })

    // Phase 16: Ship singleton (REQ SHIP-02..06).
    this.setupShipSprite()

    // Phase 16: cleanup на shutdown — destroy ship + unsubscribe store.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.teardownShipSprite(),
    )
    this.events.once(Phaser.Scenes.Events.DESTROY, () =>
      this.teardownShipSprite(),
    )
  }

  /** Phase 16: Auto-spawn ship и подписка на cosmicSlice.ship. */
  private setupShipSprite() {
    // Гарантируем что ship существует (auto-spawn at home при первом open).
    useGameStore.getState().ensureShipExists()
    const initialShip = useGameStore.getState().ship
    const homeId =
      initialShip?.state === 'docked' ? initialShip.planetId : 'home'
    const homePlanet = findPlanetById(homeId) ?? findPlanetById('home')
    if (!homePlanet) return

    // planetMap.json — DPR=1 base, scene умножает на DPR. Применяем тот же multiplier.
    this.shipSprite = new ShipSprite({
      scene: this,
      parent: null, // scene root; нет worldContainer в этой scene
      initialPosition: { x: homePlanet.x * DPR, y: homePlanet.y * DPR },
      depth: 1500,
      onPositionUpdate: (x, y) => {
        // throttled выше; здесь — простой proxy в store для redirect calc.
        // Позиция нормализуется обратно в DPR=1 base (для slice + sendShipTo math).
        useGameStore.getState().setShipPosition(x / DPR, y / DPR)
      },
    })

    // Sync initial state
    this.applyShipState(useGameStore.getState().ship)

    // Subscribe — реагируем на изменения ship через JSON-сигнатуру dedup.
    this.shipUnsubscribe = useGameStore.subscribe((state) => {
      this.applyShipState(state.ship)
      // Disable follow when ship docks
      if (state.ship?.state !== 'transit' && this.followingShip) {
        this.followingShip = false
        eventBus.emit('starmap:follow-changed', { following: false })
      }
    })

    // React button → toggle follow mode
    const onFollowShip = ({ enable }: { enable: boolean }) => {
      this.followingShip = enable
    }
    eventBus.on('starmap:follow-ship', onFollowShip)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      eventBus.off('starmap:follow-ship', onFollowShip),
    )
    this.events.once(Phaser.Scenes.Events.DESTROY, () =>
      eventBus.off('starmap:follow-ship', onFollowShip),
    )
  }

  private teardownShipSprite() {
    if (this.shipUnsubscribe) {
      this.shipUnsubscribe()
      this.shipUnsubscribe = null
    }
    if (this.shipSprite) {
      this.shipSprite.destroy()
      this.shipSprite = null
    }
    this.lastShipStateSig = ''
  }

  /** Phase 16: применить ShipState из store к ShipSprite. JSON-dedup чтобы не reapply identical state. */
  private applyShipState(ship: ShipState | null): void {
    if (!this.shipSprite || ship === null) return

    const sig = JSON.stringify(ship)
    if (sig === this.lastShipStateSig) return
    this.lastShipStateSig = sig

    if (ship.state === 'docked') {
      const p = findPlanetById(ship.planetId)
      if (!p) return
      this.shipSprite.setDocked(
        { x: p.x * DPR, y: p.y * DPR },
        (p.size ?? 60) * DPR,
      )
    } else {
      const fp = findPlanetById(ship.fromPlanetId)
      const tp = findPlanetById(ship.toPlanetId)
      if (!fp || !tp) return
      const onArrive = () => {
        useGameStore.getState().arriveShipAt(ship.toPlanetId)
      }
      this.shipSprite.syncFromState(
        {
          from: { x: fp.x * DPR, y: fp.y * DPR },
          to: { x: tp.x * DPR, y: tp.y * DPR },
          startedAt: ship.startedAt,
          arrivesAt: ship.arrivesAt,
        },
        (tp.size ?? 60) * DPR,
        onArrive,
      )
    }
  }

  // Адаптивный hit-area для главных планет — чем сильнее zoom-out,
  // тем больше зона тапа в мировых координатах (фиксированно ~32px на экране).
  private updatePlanetHitAreas() {
    const cam = this.cameras.main
    const minScreenR = 32 * DPR
    const minWorldR = minScreenR / cam.zoom
    for (const h of this.mainPlanetHits) {
      const newR = Math.max(h.baseR, minWorldR)
      h.circle.radius = newR
    }
  }

  // Минимальный zoom — «cover»: вселенная заполняет экран по длинной оси.
  // Это исключает появление чёрного пространства за её пределами.
  private getMinZoom(): number {
    const cam = this.cameras.main
    const worldFull = WORLD_SIZE * 2
    return Math.max(cam.width / worldFull, cam.height / worldFull)
  }

  // ЕДИНАЯ ТОЧКА управления камерой: все компоненты вызывают это.
  // Возвращает true если значение упёрлось в границу (для обнуления velocity).
  private setCameraCenter(
    targetX: number,
    targetY: number,
  ): { hitX: boolean; hitY: boolean } {
    const cam = this.cameras.main
    const halfViewW = cam.width / cam.zoom / 2
    const halfViewH = cam.height / cam.zoom / 2
    const boundHalfW = Math.max(WORLD_SIZE - halfViewW, 0)
    const boundHalfH = Math.max(WORLD_SIZE - halfViewH, 0)
    const clampedX = Math.max(-boundHalfW, Math.min(boundHalfW, targetX))
    const clampedY = Math.max(-boundHalfH, Math.min(boundHalfH, targetY))
    const hitX = clampedX !== targetX
    const hitY = clampedY !== targetY
    this.camCenterX = clampedX
    this.camCenterY = clampedY
    cam.centerOn(clampedX, clampedY)
    return { hitX, hitY }
  }

  // Hit-areas обновляются throttled — не критично для визуала
  private hitAreasScheduled = false
  private scheduleBoundsUpdate() {
    if (this.hitAreasScheduled) return
    this.hitAreasScheduled = true
    requestAnimationFrame(() => {
      this.hitAreasScheduled = false
      this.updatePlanetHitAreas()
    })
  }

  // ============== TEMP DEBUG HUD ==============
  // HUD теперь через React (см. StarMapHUD компонент в App.tsx).
  // Здесь только сохраняем данные в публичные поля сцены.
  hudFps = 60
  hudVisible = 0
  hudTotal = 0

  private setupCoordinatesHUD() {
    // Сглаженный FPS (скользящее среднее по 30 кадрам)
    const fpsHistory: number[] = []
    const FPS_WINDOW = 30

    this.events.on('update', (_t: number, dt: number) => {
      const cam = this.cameras.main

      const instantFps = dt > 0 ? 1000 / dt : 60
      fpsHistory.push(instantFps)
      if (fpsHistory.length > FPS_WINDOW) fpsHistory.shift()
      const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length

      // Spike-детектор: лог в консоль если кадр > 50ms (FPS < 20) — для диагностики лагов.
      if (dt > 50) {
        const visibleNow = this.cullableData.filter((c) => c.obj.visible).length
        // eslint-disable-next-line no-console
        console.warn(
          `[StarMap spike] frame=${dt.toFixed(1)}ms zoom=${cam.zoom.toFixed(3)} visible=${visibleNow}/${this.cullableData.length} tweens=${this.tweens.getTweens().length}`,
        )
      }

      // Culling tick — каждые 6 кадров
      this.cullTickCounter++
      let visibleCount = 0
      if (this.cullTickCounter >= 6) {
        this.cullTickCounter = 0
        const view = cam.worldView
        const margin = 50 * DPR
        const left = view.left - margin
        const right = view.right + margin
        const top = view.top - margin
        const bottom = view.bottom + margin
        const curZoom = cam.zoom
        for (const c of this.cullableData) {
          // LOD-cut: при zoom ниже lodMinZoom объект скрыт независимо от viewport.
          // Используется для фоновых планет: при сильном отдалении 434 контейнера
          // не нужны — превращаются в шум, плюс одновременное setVisible(true)
          // при возврате zoom давало FPS-spike.
          const lodOk = c.lodMinZoom === undefined || curZoom >= c.lodMinZoom
          const inView =
            lodOk &&
            c.x + c.r > left &&
            c.x - c.r < right &&
            c.y + c.r > top &&
            c.y - c.r < bottom
          if (c.obj.visible !== inView) c.obj.setVisible(inView)
          if (inView) visibleCount++
        }
      }

      // Сохраняем для React-HUD overlay
      this.hudFps = avgFps
      this.hudVisible = visibleCount
      this.hudTotal = this.cullableData.length

      // Компенсация zoom для звёзд-ромбов: при отдалении они растут,
      // при приближении остаются нормального размера. Cap на минимум 1.
      const zoom = this.cameras.main.zoom
      const zoomComp = Math.max(1, 1 / zoom)
      for (const s of this.zoomCompStars) {
        if (s.obj.visible) s.obj.setScale(s.baseScale * zoomComp)
      }

      // Линии связи между главными расами: re-draw с новой толщиной если zoom
      // изменился заметно (>2%). Плавный рост видимости при отдалении.
      if (
        this.mainLinesGfx &&
        Math.abs(zoom - this.mainLinesLastZoom) / Math.max(zoom, 0.001) > 0.02
      ) {
        this.redrawMainLines()
      }

      // LOD деталей BG-планет: при zoom < BG_DETAIL_MIN_ZOOM скрываем archetype-detail
      // Graphics. Видны только базовые шары → ~80% меньше draw calls на zoom-out.
      const detailVisible = zoom >= BG_DETAIL_MIN_ZOOM
      // Update только если состояние изменилось (раз в zoom-переход, не каждый кадр)
      if (
        this.bgArchetypeGfx.length > 0 &&
        this.bgArchetypeGfx[0].visible !== detailVisible
      ) {
        for (const gd of this.bgArchetypeGfx) gd.setVisible(detailVisible)
      }

      // Batch BG: видим при zoom < BG_PLANET_MIN_ZOOM (звёздное небо вместо containers).
      // Когда видим — индивидуальные containers скрыты через manual culling LOD-cut.
      const batchVisible = zoom < BG_PLANET_MIN_ZOOM
      if (this.bgBatchGfx && this.bgBatchGfx.visible !== batchVisible) {
        this.bgBatchGfx.setVisible(batchVisible)
      }

      // Interactive toggle для BG: при zoom < BG_INTERACTIVE_MIN_ZOOM отключаем
      // input.enabled у всех BG containers — снимает hit-test overhead.
      const wantInteractive = zoom >= BG_INTERACTIVE_MIN_ZOOM
      if (this.bgInteractiveEnabled !== wantInteractive) {
        this.bgInteractiveEnabled = wantInteractive
        for (const c of this.bgInteractiveContainers) {
          if (c.input) c.input.enabled = wantInteractive
        }
      }

      // Спутники планет: плавный fade-in между MOON_FADE_START и MOON_FADE_END.
      // alpha 0 при zoom < 0.45, alpha 1 при zoom > 0.55 — плавный crossfade.
      const moonAlpha = Phaser.Math.Clamp(
        (zoom - MOON_FADE_START) / (MOON_FADE_END - MOON_FADE_START),
        0,
        1,
      )
      const moonsActive = moonAlpha > 0.001
      const dtSec = dt / 1000
      for (const m of this.moons) {
        if (m.obj.visible !== moonsActive) m.obj.setVisible(moonsActive)
        if (!moonsActive) continue
        m.obj.setAlpha(moonAlpha * 0.85) // 0.85 — базовая alpha спутника как было
        m.angle += dtSec * m.speed
        m.obj.x = Math.cos(m.angle) * m.radius
        m.obj.y = Math.sin(m.angle) * m.radius * 0.6 // эллиптическая орбита
      }

      // Popover-follower: planet-moved обновляет position для текущего placement.
      // Placement не меняется при follow — фиксируется в момент выбора.
      // ВАЖНО: planet-moved emit перенесён в PRE_RENDER event ниже.
      // Здесь (внутри 'update') scroll/zoom могут быть ещё не финальными —
      // другие update-listeners (inertia, clamp) могут их изменить позже.
      // PRE_RENDER гарантирует финальные значения = синхронно с тем что рисует Phaser.
    })
  }

  // ============== ФОНЫ ==============

  private setupStarfield() {
    const bgRng = mulberry32(SEED + 1)
    const farStars = this.add.graphics()
    farStars.setDepth(-100)
    // Дальние звёзды (один Graphics — 1 draw call). Снижено с 5000.
    for (let i = 0; i < 2000; i++) {
      const x = (bgRng() - 0.5) * WORLD_SIZE * 1.9
      const y = (bgRng() - 0.5) * WORLD_SIZE * 1.9
      const a = 0.15 + bgRng() * 0.4
      farStars.fillStyle(0xffffff, a)
      farStars.fillCircle(x, y, 1 * DPR)
    }
    // Helper: gauss-распределение от центра одной из переданных планет (radius в DPR-px)
    const sampleNearPlanetIn = (
      pool: ReadonlyArray<{ x: number; y: number }>,
      clusterRadius: number,
    ): { x: number; y: number } => {
      const planet = pool[Math.floor(bgRng() * pool.length)]
      let u = 0,
        v = 0
      while (u === 0) u = bgRng()
      while (v === 0) v = bgRng()
      const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      const angle = bgRng() * Math.PI * 2
      const dist = Math.abs(g) * clusterRadius
      return {
        x: planet.x + Math.cos(angle) * dist,
        y: planet.y + Math.sin(angle) * dist,
      }
    }
    const allPlanets = this.allSystems
    const sampleNearPlanet = (clusterRadius: number) =>
      sampleNearPlanetIn(allPlanets, clusterRadius)

    // Средние мерцающие — кластеризуются вокруг планет, не рандомно
    for (let i = 0; i < 200; i++) {
      const { x, y } = sampleNearPlanet(180 * DPR)
      const tint = [0xffffff, 0xfff7ed, 0xa5f3fc, 0xfde047, 0xfdba74][
        Math.floor(bgRng() * 5)
      ]
      const radius = (1.2 + bgRng() * 1.4) * DPR
      const star = this.add.circle(x, y, radius, tint, 0.85)
      star.setDepth(-90)
      this.tweens.add({
        targets: star,
        alpha: { from: 0.35, to: 1 },
        duration: 900 + bgRng() * 2200,
        yoyo: true,
        repeat: -1,
        delay: bgRng() * 2500,
        ease: 'Sine.easeInOut',
      })
      // Mid stars видны всегда — это звёздное небо. На сильном отдалении полезно.
      this.cullableData.push({ obj: star, x, y, r: 4 * DPR })
    }

    // Sparkle-звёзды теперь создаются в renderSystem/renderBgPoint как
    // отдельные world-coords Graphics, привязанные к позиции конкретной планеты.
    // См. createSparkleAt(). Старый блок удалён — sparkle на каждой планете.

    // Близкие крупные с лучами и tween-анимациями. Снижено с 40.
    for (let i = 0; i < 16; i++) {
      const x = (bgRng() - 0.5) * WORLD_SIZE * 1.6
      const y = (bgRng() - 0.5) * WORLD_SIZE * 1.6
      const color = [0xfff7ed, 0xa5f3fc, 0xfed7aa][Math.floor(bgRng() * 3)]
      const g = this.add.graphics()
      g.fillStyle(color, 0.9)
      g.fillCircle(0, 0, 2.5 * DPR)
      g.lineStyle(1 * DPR, color, 0.5)
      g.lineBetween(-6 * DPR, 0, 6 * DPR, 0)
      g.lineBetween(0, -6 * DPR, 0, 6 * DPR)
      g.x = x
      g.y = y
      g.setDepth(-85)
      this.tweens.add({
        targets: g,
        angle: 360,
        duration: 30000 + bgRng() * 30000,
        repeat: -1,
        ease: 'Linear',
      })
      this.tweens.add({
        targets: g,
        alpha: { from: 0.6, to: 1 },
        duration: 2200 + bgRng() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
      this.cullableData.push({ obj: g, x, y, r: 12 * DPR })
      // Тап по звезде — вспышка + ⭐
      const starBaseR = 14 * DPR
      const starHit = new Phaser.Geom.Circle(0, 0, starBaseR)
      g.setInteractive(starHit, Phaser.Geom.Circle.Contains)
      let dt = 0,
        dx = 0,
        dy = 0
      g.on('pointerdown', (p: Phaser.Input.Pointer) => {
        dt = Date.now()
        dx = p.x
        dy = p.y
      })
      g.on('pointerup', (p: Phaser.Input.Pointer) => {
        const elapsed = Date.now() - dt
        const moved = Math.abs(p.x - dx) + Math.abs(p.y - dy)
        if (elapsed < 300 && moved < 8 * DPR) {
          this.tapHandledThisFrame = true
          this.popEmojiAt(x, y, '⭐', g)
        }
      })
      this.mainPlanetHits.push({
        container: g as unknown as Phaser.GameObjects.Container,
        baseR: starBaseR,
        circle: starHit,
      })
    }
  }

  // Туманности удалены — пользователь добавит свои ассеты позже

  // ============== СВЯЗИ И СИСТЕМЫ ==============

  private drawLines() {
    // Соединяем каждую расу с её K ближайшими соседями ИЗ MAIN_RACES.
    // Толщина линий компенсирует zoom через redrawMainLines() в update-loop —
    // при отдалении линии остаются видимыми (плавно растут).
    const K = 3
    const drawn = new Set<string>()
    this.mainLinesEdges = []
    for (const race of MAIN_RACES) {
      const others = MAIN_RACES.filter((r) => r.id !== race.id)
        .map((r) => ({ r, d: Math.hypot(r.x - race.x, r.y - race.y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, K)
      for (const { r } of others) {
        const key = race.id < r.id ? `${race.id}|${r.id}` : `${r.id}|${race.id}`
        if (drawn.has(key)) continue
        drawn.add(key)
        this.mainLinesEdges.push({ ax: race.x, ay: race.y, bx: r.x, by: r.y })
      }
    }
    this.mainLinesGfx = this.add.graphics()
    this.mainLinesGfx.setDepth(-50)
    this.redrawMainLines() // initial draw
  }

  // Пере-рисовывает линии связи с толщиной, компенсирующей текущий zoom.
  // Вызывается из update-loop когда zoom изменился (с throttling).
  // Цель: линии плавно растут при отдалении камеры, остаются видимыми.
  private redrawMainLines() {
    if (!this.mainLinesGfx) return
    const zoom = this.cameras.main.zoom
    // Smooth zoom compensation. При zoom=1 → толщина 2*DPR. При zoom=0.05 → ~24*DPR.
    // sqrt сглаживает рост — иначе линии бы стали гигантскими при сильном отдалении.
    const zoomComp = 1 / Math.max(0.05, Math.sqrt(zoom))
    const thickness = 2 * DPR * Math.max(1, zoomComp)
    const alpha = 0.55
    this.mainLinesGfx.clear()
    this.mainLinesGfx.lineStyle(thickness, 0x67e8f9, alpha)
    for (const e of this.mainLinesEdges) {
      this.mainLinesGfx.lineBetween(e.ax, e.ay, e.bx, e.by)
    }
    this.mainLinesLastZoom = zoom
  }

  // Batch-рендер всех 434 BG как точек в одном Graphics.
  // Используется на zoom < BG_PLANET_MIN_ZOOM (звёздное небо). Не кликабелен.
  // 1 draw call вместо 434 — огромная экономия на сильном отдалении.
  private buildBgBatch() {
    const gfx = this.add.graphics()
    gfx.setDepth(-80)
    gfx.setVisible(false) // visible toggle через update
    for (const sys of this.allSystems) {
      if (!('archetype' in sys)) continue // только BG, не main
      // Точка цветом sys.color, радиус ~ половине size (silhouette)
      gfx.fillStyle(sys.color, 0.85)
      gfx.fillCircle(sys.x, sys.y, sys.size * 0.6)
    }
    this.bgBatchGfx = gfx
  }

  private renderSystem(sys: Race | BgSystem) {
    const isMain = MAIN_RACES.some((m) => m.id === sys.id)
    if (isMain) this.renderMainPlanet(sys as Race)
    else this.renderBgPoint(sys as BgSystem)
  }

  // Создаёт sparkle-звёздочку (8-конечную) над планетой в world-coords.
  // Звёздочки НЕ являются child контейнера — это отдельные Graphics с фиксированной
  // позицией в мире, чтобы LOD-скрытие планеты не убивало sparkle (см. BG_PLANET_MIN_ZOOM).
  // Между flash'ами alpha=0, активные tweens только на момент мерцания.
  private createSparkleAt(
    planetX: number,
    planetY: number,
    planetSize: number,
    rng: () => number,
  ) {
    // 70% белый, 30% жёлтый
    const isYellow = rng() < 0.3
    const c = isYellow
      ? [0xfde047, 0xfbbf24, 0xfacc15][Math.floor(rng() * 3)]
      : [0xffffff, 0xfff7ed, 0xfafafa][Math.floor(rng() * 3)]
    const baseR = (4 + rng() * 4) * DPR

    // 8-конечная sparkle-звезда: 4 длинных луча по осям + 4 коротких по диагонали.
    const longR = baseR
    const shortR = baseR * 0.4
    const innerR = baseR * 0.16
    const points: Phaser.Math.Vector2[] = []
    for (let p = 0; p < 16; p++) {
      const a = (p * Math.PI) / 8 - Math.PI / 2
      let r: number
      if (p % 2 === 1) r = innerR
      else r = p % 4 === 0 ? longR : shortR
      points.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r))
    }

    const star = this.add.graphics()
    star.setDepth(-87)
    star.fillStyle(c, 1)
    star.fillPoints(points, true)
    // Position: случайная точка ВНУТРИ диска планеты (равномерное распределение по площади
    // через sqrt(rng) для радиуса). Sparkle остаётся в world-coords — при LOD-скрытии
    // планеты-контейнера она остаётся видна как звезда.
    const ang = rng() * Math.PI * 2
    const rad = Math.sqrt(rng()) * planetSize * 0.7
    star.x = planetX + Math.cos(ang) * rad
    star.y = planetY + Math.sin(ang) * rad
    star.setAlpha(0)
    this.zoomCompStars.push({ obj: star, baseScale: 1 })

    // Flash в редком ритме. 3 типа поведения (rotate/fade/spin) для разнообразия.
    const flashType: 'rotate' | 'fade' | 'spin' = (() => {
      const r = rng()
      if (r < 0.45) return 'rotate'
      if (r < 0.85) return 'fade'
      return 'spin'
    })()

    const triggerFlash = () => {
      if (!star.active) return
      if (flashType === 'rotate') {
        star.setAngle(Math.random() * 360)
        star.setAlpha(0)
        const dur = 600 + Math.random() * 500
        this.tweens.add({
          targets: star,
          alpha: 1,
          duration: dur * 0.4,
          ease: 'Sine.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: star,
              alpha: 0,
              duration: dur * 0.6,
              ease: 'Sine.easeIn',
            })
          },
        })
        this.tweens.add({
          targets: star,
          angle: star.angle + 180,
          duration: dur,
          ease: 'Linear',
        })
      } else if (flashType === 'fade') {
        star.setAlpha(0)
        const dur = 900 + Math.random() * 800
        this.tweens.add({
          targets: star,
          alpha: 1,
          duration: dur * 0.4,
          ease: 'Sine.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: star,
              alpha: 0,
              duration: dur * 0.6,
              ease: 'Sine.easeIn',
            })
          },
        })
      } else {
        star.setAngle(Math.random() * 360)
        star.setAlpha(0)
        const dur = 2000 + Math.random() * 1000
        this.tweens.add({
          targets: star,
          alpha: 1,
          duration: dur * 0.3,
          ease: 'Sine.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: star,
              alpha: 0,
              duration: dur * 0.7,
              ease: 'Sine.easeIn',
            })
          },
        })
        this.tweens.add({
          targets: star,
          angle: star.angle + 360,
          duration: dur,
          ease: 'Linear',
        })
      }
    }

    const scheduleNext = () => {
      const wait = 25000 + Math.random() * 35000
      this.time.delayedCall(wait, () => {
        triggerFlash()
        scheduleNext()
      })
    }
    this.time.delayedCall(rng() * 30000, () => {
      triggerFlash()
      scheduleNext()
    })
  }

  // ============== УНИКАЛЬНЫЕ АНИМАЦИИ ПЛАНЕТ ==============

  // Обработка нажатия на планету: первое нажатие после смены планеты или
  // после перерыва срабатывает анимацию, далее — каждые 2-6 нажатий случайно.
  private handlePlanetPress(sys: Race | BgSystem) {
    if (this.currentPressedPlanetId !== sys.id) {
      this.planetPressState.set(sys.id, { count: 0, threshold: 1 })
      this.currentPressedPlanetId = sys.id
    }
    let st = this.planetPressState.get(sys.id)
    if (!st) {
      st = { count: 0, threshold: 1 }
      this.planetPressState.set(sys.id, st)
    }
    st.count++
    if (st.count >= st.threshold) {
      const durationMs = this.getAnimationDurationMs(sys)
      eventBus.emit('starmap:planet-tapped', {
        id: sys.id,
        type: sys.type,
        archetype: 'archetype' in sys ? (sys as BgSystem).archetype : undefined,
        durationMs,
        seed: effectiveSeed(sys, this.mainSeedOverride),
      })
      // Phase 16 (REQ SHIP-07): parallel emit для Cosmic Hub flight flow.
      // App-side subscriber решает, открыт ли Hub, и показывает confirm dialog.
      eventBus.emit('cosmic:request-flight', { planetId: sys.id })
      this.playUniqueAnimation(sys)
      st.count = 0
      st.threshold = 2 + Math.floor(Math.random() * 5) // 2-6
    }
  }

  // Типичная длительность каждого из 96 компонентов анимации (ms).
  // Значения — приблизительный max каждой компоненты, выведенный из const dur
  // внутри comp* функций. Cap=1500ms (wrapper destroy в playUniqueAnimation).
  // Phase 8: добавлены entries 88-95 для новых компонентов.
  private static readonly COMP_DURATIONS_MS: Record<number, number> = {
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

  // Прогоняет ту же логику recipe-сборки что и playUniqueAnimation, но без
  // запуска tweens. Возвращает суммарную длительность анимации (delay + max comp).
  // Cap=1500ms (wrapper destroy timeout в playUniqueAnimation:943).
  private getAnimationDurationMs(sys: Race | BgSystem): number {
    const rng = animRng(sys, this.mainSeedOverride)
    const theme = (sys as BgSystem).archetype ?? sys.type
    const pool = this.THEME_COMPONENTS[theme] ?? [
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
      const dur = StarMapScene.COMP_DURATIONS_MS[c] ?? 800
      const finish = delay + dur
      if (finish > maxFinish) maxFinish = finish
    })

    // +50ms tail на затухание звука; cap = 1500ms wrapper
    return Math.min(1500, maxFinish + 50)
  }

  // Тематические палитры — extracted в effects/anim/shared/sharedHelpers.ts (Phase 9).
  // Использовались только pickColor() который теперь thin-wrapper над sharedPickColor.
  // Если в будущем потребуется доступ из StarMapScene напрямую — re-import THEME_PALETTES.

  // Тематический mapping: каждый тип получает пул из подходящих компонентов.
  // 0-11: универсальные (ring, multiRing, sparkle, flash, lightning, orbit, spiral, confetti, wave, comet, starBurst, halo)
  // 12-23: тематические (vortex, stormSwirl, ringDance, crystalShatter, ripple, sandSwirl, lavaErupt, bloomPetals, dustPuff, toxicCloud, beam, twinPulse)
  // 24-38: креативные (singularity, echoWave, gravityWell, solarFlare, auroraRibbon, dnaHelix, lensFlare, constellation, magneticField, phoenixBurst, wormhole, cosmicRay, quantumSplit, heartPulse, crackleDischarge)
  // 39-53: расширение (pixelGrid, spiralArms, crystalGrow, snowDrift, galaxySpawn, pulseHex, tornado, starPolygon, crossFlash, waveTrain, petalStorm, flameTongues, snakeTrail, bubblePop, chromaShift)
  // Phase 7: добавлены компоненты 54-63 в pools, каждый archetype/type ≥10 компонентов.
  // Расширение 3: компоненты 64-75 (chargeBurst, infinityTrail, shieldRipple, fireworks,
  // scanline, liquidPool, gravityKnot, cosmicWeb, particleFountain, echoSpawn, iceWisps, ripBlade)
  // Расширение 4: компоненты 76-87 (chimeRing, earthquakeShake, kaleidoscope, droneHum,
  // glitchStutter, dopplerWave, morseFlash, crystalBell, windRustle, clockGears, bubbleStream, plasmaArc)
  // Phase 8: расширены под-загруженные pool'ы новыми компонентами 88-95, все pool'ы ≥14.
  private readonly THEME_COMPONENTS: Record<string, number[]> = {
    // BG archetypes
    gas_giant: [
      12, 13, 6, 2, 8, 11, 27, 32, 33, 0, 1, 40, 45, 50, 49, 56, 67, 70, 79, 81,
    ],
    gas_ringed: [1, 5, 0, 8, 14, 28, 32, 30, 43, 49, 46, 56, 65, 71, 76, 83],
    ice: [15, 2, 4, 0, 11, 10, 36, 32, 25, 41, 42, 47, 60, 64, 74, 76, 83, 84],
    ocean: [16, 8, 2, 6, 11, 25, 28, 37, 48, 52, 51, 69, 72, 81, 86],
    desert: [17, 7, 8, 6, 11, 35, 27, 42, 51, 0, 3, 68, 75, 77, 84],
    lava: [18, 4, 10, 7, 9, 11, 33, 27, 30, 38, 50, 53, 67, 75, 72, 87, 77],
    forest: [19, 11, 2, 6, 14, 29, 28, 49, 41, 51, 69, 71, 84, 86, 91, 93],
    mineral: [15, 10, 4, 2, 0, 30, 31, 38, 41, 44, 46, 54, 66, 75, 78, 83, 92],
    dead: [20, 3, 11, 8, 26, 24, 34, 53, 55, 35, 9, 73, 70, 79, 77, 95],
    toxic: [21, 6, 2, 11, 7, 38, 26, 52, 53, 50, 69, 75, 80, 86, 91, 89],
    plasma: [
      4, 22, 10, 9, 11, 0, 27, 30, 35, 32, 47, 50, 53, 55, 58, 63, 64, 67, 75,
      80, 87, 92,
    ],
    binary: [23, 5, 1, 7, 11, 14, 36, 29, 37, 53, 43, 65, 73, 81, 88, 90],
    // Main types — заточены под лор каждой расы
    home: [11, 2, 0, 1, 5, 14, 19, 28, 37, 31, 49, 43, 66, 71, 76, 83],
    crystal: [15, 2, 10, 0, 4, 30, 36, 31, 38, 41, 44, 46, 60, 66, 64, 78, 83],
    rocky: [3, 20, 4, 7, 26, 35, 39, 47, 11, 0, 53, 75, 77, 88, 95],
    ancient: [
      11, 0, 6, 2, 22, 31, 29, 26, 44, 46, 43, 57, 61, 62, 65, 71, 78, 85,
    ],
    mystic: [
      11, 6, 22, 4, 12, 14, 26, 31, 34, 28, 43, 53, 57, 59, 61, 62, 70, 73, 78,
      82,
    ],
    organic: [19, 11, 2, 6, 14, 29, 37, 49, 51, 41, 69, 72, 86, 84, 91, 93],
    forge: [7, 10, 4, 9, 22, 18, 33, 27, 38, 50, 47, 53, 64, 67, 75, 87, 85],
    military: [10, 7, 4, 9, 22, 18, 27, 30, 35, 47, 39, 53, 66, 67, 75, 82, 87],
    destroyed: [7, 3, 9, 20, 24, 34, 26, 39, 53, 55, 59, 70, 75, 80, 89, 95],
    crystal_bio: [15, 2, 11, 6, 19, 36, 29, 41, 49, 62, 63, 64, 78, 83, 90, 92],
    mechano: [
      15, 4, 9, 1, 22, 10, 32, 38, 30, 39, 47, 54, 58, 66, 71, 80, 82, 85, 89,
    ],
    energy: [
      10, 22, 4, 11, 0, 30, 27, 35, 32, 53, 50, 54, 58, 63, 64, 67, 80, 87,
    ],
    mist: [11, 8, 6, 21, 20, 28, 26, 52, 51, 57, 73, 64, 79, 84, 91, 94],
    aquatic: [8, 16, 2, 11, 6, 25, 37, 28, 48, 52, 51, 69, 72, 81, 86],
    shadow: [3, 20, 11, 6, 12, 26, 34, 24, 53, 51, 59, 70, 73, 75, 79, 89],
    aerial: [6, 8, 11, 2, 16, 28, 32, 35, 42, 51, 49, 60, 64, 72, 84, 94],
  }

  // ANIM_EASES — extracted в effects/anim/shared/sharedHelpers.ts (Phase 9).
  // pickEase wrapper делегирует туда; локальная константа больше не нужна.

  // Phase 7: override-карта для main races (которым нельзя мутировать rngSeed как BG).
  // Заполняется в refineAnimSeeds() при коллизиях signatures.
  private mainSeedOverride = new Map<string, number>()

  // animRng / effectiveSeed — extracted в './starmap/helpers.ts' (Phase 20-01).
  // Принимают `mainSeedOverride` явным аргументом вместо `this`.

  // Главный entry — собирает уникальный рецепт анимации для планеты.
  // 1) Pool компонентов берётся из THEME_COMPONENTS по archetype/type → каждая
  //    планета играет анимации, тематически подходящие её природе.
  // 2) Recipe = 1-4 случайных компонента из pool с rng-параметрами.
  // 3) Цвета берутся из THEME_PALETTES → визуально соответствуют ассоциации архетипа.
  // Уникальных подписей: ~24 компонента × ~10⁵ комбинаций параметров × pool size = миллионы.
  private playUniqueAnimation(sys: Race | BgSystem) {
    const sprite = this.systemSprites.get(sys.id)
    if (!sprite) return
    const rng = animRng(sys, this.mainSeedOverride)

    // Тематический pool компонентов
    const theme = (sys as BgSystem).archetype ?? sys.type
    const pool = this.THEME_COMPONENTS[theme] ?? [
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
      this.time.delayedCall(delay, () => {
        if (!sprite.active) return
        if (useModifier) {
          const wrapper = this.add.container(0, 0)
          wrapper.rotation = modRotation
          wrapper.setScale(modScale)
          sprite.add(wrapper)
          this.runAnimComponent(c, wrapper, sys, rng)
          // Уборка wrapper'а после завершения всех его child-tweens.
          // 1500ms покрывает дольший компонент (комет, торнадо ~700-1000ms).
          this.time.delayedCall(1500, () => {
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
  ) {
    switch (idx) {
      case 0:
        compRing(this, sprite, sys, rng)
        break
      case 1:
        compMultiRing(this, sprite, sys, rng)
        break
      case 2:
        compSparkle(this, sprite, sys, rng)
        break
      case 3:
        compFlash(this, sprite, rng)
        break
      case 4:
        compLightning(this, sprite, sys, rng)
        break
      case 5:
        compOrbit(this, sprite, sys, rng)
        break
      case 6:
        compSpiral(this, sprite, sys, rng)
        break
      case 7:
        compConfetti(this, sprite, sys, rng)
        break
      case 8:
        compWave(this, sprite, sys, rng)
        break
      case 9:
        compComet(this, sprite, sys, rng)
        break
      case 10:
        compStarBurst(this, sprite, sys, rng)
        break
      case 11:
        compHaloFlash(this, sprite, sys, rng)
        break
      case 12:
        compVortex(this, sprite, sys, rng)
        break
      case 13:
        compStormSwirl(this, sprite, sys, rng)
        break
      case 14:
        compRingDance(this, sprite, sys, rng)
        break
      case 15:
        compCrystalShatter(this, sprite, sys, rng)
        break
      case 16:
        compRipple(this, sprite, sys, rng)
        break
      case 17:
        compSandSwirl(this, sprite, sys, rng)
        break
      case 18:
        compLavaErupt(this, sprite, sys, rng)
        break
      case 19:
        compBloomPetals(this, sprite, sys, rng)
        break
      case 20:
        compDustPuff(this, sprite, sys, rng)
        break
      case 21:
        compToxicCloud(this, sprite, sys, rng)
        break
      case 22:
        compBeam(this, sprite, sys, rng)
        break
      case 23:
        compTwinPulse(this, sprite, sys, rng)
        break
      case 24:
        compSingularity(this, sprite, sys, rng)
        break
      case 25:
        compEchoWave(this, sprite, sys, rng)
        break
      case 26:
        compGravityWell(this, sprite, sys, rng)
        break
      case 27:
        compSolarFlare(this, sprite, sys, rng)
        break
      case 28:
        compAuroraRibbon(this, sprite, sys, rng)
        break
      case 29:
        compDNAHelix(this, sprite, sys, rng)
        break
      case 30:
        compLensFlare(this, sprite, sys, rng)
        break
      case 31:
        compConstellation(this, sprite, sys, rng)
        break
      case 32:
        compMagneticField(this, sprite, sys, rng)
        break
      case 33:
        compPhoenixBurst(this, sprite, sys, rng)
        break
      case 34:
        compWormhole(this, sprite, sys, rng)
        break
      case 35:
        compCosmicRay(this, sprite, sys, rng)
        break
      case 36:
        compQuantumSplit(this, sprite, sys, rng)
        break
      case 37:
        compHeartPulse(this, sprite, sys, rng)
        break
      case 38:
        compCrackleDischarge(this, sprite, sys, rng)
        break
      case 39:
        compPixelGrid(this, sprite, sys, rng)
        break
      case 40:
        compSpiralArms(this, sprite, sys, rng)
        break
      case 41:
        compCrystalGrow(this, sprite, sys, rng)
        break
      case 42:
        compSnowDrift(this, sprite, sys, rng)
        break
      case 43:
        compGalaxySpawn(this, sprite, sys, rng)
        break
      case 44:
        compPulseHex(this, sprite, sys, rng)
        break
      case 45:
        compTornado(this, sprite, sys, rng)
        break
      case 46:
        compStarPolygon(this, sprite, sys, rng)
        break
      case 47:
        compCrossFlash(this, sprite, sys, rng)
        break
      case 48:
        compWaveTrain(this, sprite, sys, rng)
        break
      case 49:
        compPetalStorm(this, sprite, sys, rng)
        break
      case 50:
        compFlameTongues(this, sprite, sys, rng)
        break
      case 51:
        compSnakeTrail(this, sprite, sys, rng)
        break
      case 52:
        compBubblePop(this, sprite, sys, rng)
        break
      case 53:
        compChromaShift(this, sprite, sys, rng)
        break
      // Phase 7: новые компоненты
      case 54:
        compAtomShells(this, sprite, sys, rng)
        break
      case 55:
        compSupernova(this, sprite, sys, rng)
        break
      case 56:
        compAccretionDisk(this, sprite, sys, rng)
        break
      case 57:
        compFlickerStars(this, sprite, sys, rng)
        break
      case 58:
        compLightDance(this, sprite, sys, rng)
        break
      case 59:
        compDimensionRift(this, sprite, sys, rng)
        break
      case 60:
        compFrostExplode(this, sprite, sys, rng)
        break
      case 61:
        compTimeWave(this, sprite, sys, rng)
        break
      case 62:
        compGlyphFlash(this, sprite, sys, rng)
        break
      case 63:
        compPrismShift(this, sprite, sys, rng)
        break
      // Расширение 3 (доп. оригинальные компоненты)
      case 64:
        compChargeBurst(this, sprite, sys, rng)
        break
      case 65:
        compInfinityTrail(this, sprite, sys, rng)
        break
      case 66:
        compShieldRipple(this, sprite, sys, rng)
        break
      case 67:
        compFireworks(this, sprite, sys, rng)
        break
      case 68:
        compScanline(this, sprite, sys, rng)
        break
      case 69:
        compLiquidPool(this, sprite, sys, rng)
        break
      case 70:
        compGravityKnot(this, sprite, sys, rng)
        break
      case 71:
        compCosmicWeb(this, sprite, sys, rng)
        break
      case 72:
        compParticleFountain(this, sprite, sys, rng)
        break
      case 73:
        compEchoSpawn(this, sprite, sys, rng)
        break
      case 74:
        compIceWisps(this, sprite, sys, rng)
        break
      case 75:
        compRipBlade(this, sprite, sys, rng)
        break
      // Расширение 4 — компоненты 76-87 (с явными sound-style)
      case 76:
        compChimeRing(this, sprite, sys, rng)
        break
      case 77:
        compEarthquakeShake(this, sprite, sys, rng)
        break
      case 78:
        compKaleidoscope(this, sprite, sys, rng)
        break
      case 79:
        compDroneHum(this, sprite, sys, rng)
        break
      case 80:
        compGlitchStutter(this, sprite, sys, rng)
        break
      case 81:
        compDopplerWave(this, sprite, sys, rng)
        break
      case 82:
        compMorseFlash(this, sprite, sys, rng)
        break
      case 83:
        compCrystalBell(this, sprite, sys, rng)
        break
      case 84:
        compWindRustle(this, sprite, sys, rng)
        break
      case 85:
        compClockGears(this, sprite, sys, rng)
        break
      case 86:
        compBubbleStream(this, sprite, sys, rng)
        break
      case 87:
        compPlasmaArc(this, sprite, sys, rng)
        break
      // Phase 8 — компоненты 88-95
      case 88:
        compBouncingBall(this, sprite, sys, rng)
        break
      case 89:
        compDigitalGlitch(this, sprite, sys, rng)
        break
      case 90:
        compRingPulsar(this, sprite, sys, rng)
        break
      case 91:
        compSwarmParticles(this, sprite, sys, rng)
        break
      case 92:
        compPrismRefract(this, sprite, sys, rng)
        break
      case 93:
        compLifeBloom(this, sprite, sys, rng)
        break
      case 94:
        compWindRibbons(this, sprite, sys, rng)
        break
      case 95:
        compWreckageOrbit(this, sprite, sys, rng)
        break
    }
  }

  /* ════════════════════════════════════════════════════════════════════════
   * SOUND-STYLE TABLE — каждый компонент имеет «звуковую подпись» (концептуально).
   * Используется как mental model и для будущей привязки к sound effects.
   *
   * 0  ring             — whoosh-pulse        (мягкий выдох)
   * 1  multiRing        — chime-cascade       (каскад звонов)
   * 2  sparkle          — twinkle-pop         (искрящийся попкорн)
   * 3  flash            — strobe-blink        (вспышка-моргание)
   * 4  lightning        — zap-crack           (электрический треск)
   * 5  orbit            — hum-orbit           (низкий гул орбиты)
   * 6  spiral           — whir-spin           (закрученный whir)
   * 7  confetti         — pop-shower          (хлопки разлетающиеся)
   * 8  wave             — wash-swell          (мощная волна)
   * 9  comet            — swoosh-trail        (стремительный свист)
   * 10 starBurst        — boom-snipe          (резкий взрыв)
   * 11 haloFlash        — bloom-glow          (свет распускается)
   * 12 vortex           — suck-drone          (всасывающий гул)
   * 13 stormSwirl       — thunder-rumble      (раскат грозы)
   * 14 ringDance        — chime-twirl         (звон кружится)
   * 15 crystalShatter   — shatter-clink       (звон осколков)
   * 16 ripple           — water-bubble        (пузырьки на воде)
   * 17 sandSwirl        — wind-rustle         (шорох песка)
   * 18 lavaErupt        — boom-splatter       (взрыв с брызгами)
   * 19 bloomPetals      — soft-bloom          (нежный расцвет)
   * 20 dustPuff         — soft-puff           (мягкий пшик)
   * 21 toxicCloud       — bubble-hiss         (шипящие пузыри)
   * 22 beam             — laser-zap           (лазерный заряд)
   * 23 twinPulse        — boom-boom           (двойной удар)
   * 24 singularity      — crunch-snap         (хруст коллапса)
   * 25 echoWave         — pulse-echo          (эхо в пещере)
   * 26 gravityWell      — sub-rumble          (низкочастотный гул)
   * 27 solarFlare       — fwoosh              (огненный fwoosh)
   * 28 auroraRibbon     — chime-ribbon        (плавная мелодия)
   * 29 dnaHelix         — twin-warble         (парная вибрация)
   * 30 lensFlare        — flash-blaze         (яркий блик)
   * 31 constellation    — spark-net           (искры на сетке)
   * 32 magneticField    — pulse-arc           (импульс по дуге)
   * 33 phoenixBurst     — fire-fountain       (огненный фонтан)
   * 34 wormhole         — suck-warp           (затягивающее искажение)
   * 35 cosmicRay        — zip-laser           (стремительный zip)
   * 36 quantumSplit     — phase-blink         (фазовое мерцание)
   * 37 heartPulse       — thump-beat          (сердечный удар)
   * 38 crackleDischarge — crackle-spark       (треск разряда)
   * 39 pixelGrid        — digital-tick        (цифровой щёлк)
   * 40 spiralArms       — galaxy-whir         (вращение галактики)
   * 41 crystalGrow      — clink-grow          (растущий звон)
   * 42 snowDrift        — soft-fall           (мягкое падение)
   * 43 galaxySpawn      — birth-shimmer       (рождающееся свечение)
   * 44 pulseHex         — geo-pulse           (геометрический импульс)
   * 45 tornado          — howl-spiral         (вой воронки)
   * 46 starPolygon      — chime-star          (звон звезды)
   * 47 crossFlash       — slash-snap          (резкий разрез)
   * 48 waveTrain        — wave-rolling        (катящиеся волны)
   * 49 petalStorm       — flutter-spin        (порхание лепестков)
   * 50 flameTongues     — fire-lick           (языки пламени)
   * 51 snakeTrail       — slither-hiss        (скользящее шипение)
   * 52 bubblePop        — pop-pop-pop         (пузыри лопают)
   * 53 chromaShift      — glitch-stab         (цветной глюк)
   * 54 atomShells       — orbital-hum         (орбитальный гул)
   * 55 supernova        — mega-boom           (огромный взрыв)
   * 56 accretionDisk    — drone-orbit         (гул аккреции)
   * 57 flickerStars     — twinkle-twinkle     (мерцание звёзд)
   * 58 lightDance       — pulse-dance         (танцующий свет)
   * 59 dimensionRift    — rip-tear            (разрыв ткани)
   * 60 frostExplode     — frost-crack         (морозный треск)
   * 61 timeWave         — warp-pulse          (искажение времени)
   * 62 glyphFlash       — rune-snap           (вспышка руны)
   * 63 prismShift       — rainbow-shimmer     (радужное мерцание)
   * 64 chargeBurst      — charge-boom         (заряд → взрыв)
   * 65 infinityTrail    — loop-hum            (бесконечный гул)
   * 66 shieldRipple     — shield-ping         (звон щита)
   * 67 fireworks        — boom-pop-pop        (фейерверк)
   * 68 scanline         — scan-beep           (сканирующий бип)
   * 69 liquidPool       — splash-spread       (растекание жидкости)
   * 70 gravityKnot      — twist-warp          (скручивание)
   * 71 cosmicWeb        — connect-hum         (соединение узлов)
   * 72 particleFountain — fountain-spray      (фонтан брызг)
   * 73 echoSpawn        — phase-echo          (эхо-копии)
   * 74 iceWisps         — frost-whisper       (морозный шёпот)
   * 75 ripBlade         — slash-tear          (рассекающий удар)
   * 76 chimeRing        — bell-tinkle         (нежный звон колокольчика)
   * 77 earthquakeShake  — rumble-shake        (тряска земли)
   * 78 kaleidoscope     — symmetry-spin       (симметричное вращение)
   * 79 droneHum         — bass-drone          (бас-дрон)
   * 80 glitchStutter    — glitch-stutter      (цифровое заикание)
   * 81 dopplerWave      — doppler-shift       (доплер-волна)
   * 82 morseFlash       — dit-dah-dit         (азбука морзе)
   * 83 crystalBell      — clink-resonate      (хрустальный звон)
   * 84 windRustle       — wind-whisper        (шёпот ветра)
   * 85 clockGears       — clockwork-tick      (часовой ход)
   * 86 bubbleStream     — fizz-rise           (поднимающаяся газировка)
   * 87 plasmaArc        — arc-buzz            (электрическая дуга)
   * ════════════════════════════════════════════════════════════════════════ */

  // Helpers: pickColor/pickEase wrappers удалены в Phase 20-02 — все comp методы вынесены
  // в effects/anim/shared/, которые импортируют helpers напрямую из sharedHelpers.ts.

  // === 12 АТОМАРНЫХ КОМПОНЕНТОВ ===

  // 0. compRing — extracted в effects/anim/shared/compRing.ts (Phase 9).

  // 1. compMultiRing — extracted в effects/anim/shared/compMultiRing.ts (Phase 20-02).
  // 2. compSparkle — extracted в effects/anim/shared/compSparkle.ts (Phase 9).
  // 3. compFlash — extracted в effects/anim/shared/compFlash.ts (Phase 9).

  // 4. compLightning — extracted в effects/anim/shared/compLightning.ts (Phase 20-02).
  // 5. compOrbit — extracted в effects/anim/shared/compOrbit.ts (Phase 20-02).
  // 6. compSpiral — extracted в effects/anim/shared/compSpiral.ts (Phase 20-02).
  // 7. compConfetti — extracted в effects/anim/shared/compConfetti.ts (Phase 9).

  // 8. compWave — extracted в effects/anim/shared/compWave.ts (Phase 20-02).
  // 9. compComet — extracted в effects/anim/shared/compComet.ts (Phase 20-02).
  // 10. compStarBurst — extracted в effects/anim/shared/compStarBurst.ts (Phase 9).

  // 11. compHaloFlash — extracted в effects/anim/shared/compHaloFlash.ts (Phase 9).

  // === ТЕМАТИЧЕСКИЕ КОМПОНЕНТЫ 12-23 ===

  // 12. compVortex — extracted в effects/anim/shared/compVortex.ts (Phase 20-02).
  // 13. compStormSwirl — extracted в effects/anim/shared/compStormSwirl.ts (Phase 20-02).
  // 14. compRingDance — extracted в effects/anim/shared/compRingDance.ts (Phase 20-02).
  // 15. compCrystalShatter — extracted в effects/anim/shared/compCrystalShatter.ts (Phase 9).
  // 16. compRipple — extracted в effects/anim/shared/compRipple.ts (Phase 9).
  // 17. compSandSwirl — extracted в effects/anim/shared/compSandSwirl.ts (Phase 9).

  // 18. compLavaErupt — extracted в effects/anim/shared/compLavaErupt.ts (Phase 20-02).
  // 19. compBloomPetals — extracted в effects/anim/shared/compBloomPetals.ts (Phase 9).
  // 20. compDustPuff — extracted в effects/anim/shared/compDustPuff.ts (Phase 20-02).
  // 21. compToxicCloud — extracted в effects/anim/shared/compToxicCloud.ts (Phase 9).
  // 22. compBeam — extracted в effects/anim/shared/compBeam.ts (Phase 20-02).
  // 23. compTwinPulse — extracted в effects/anim/shared/compTwinPulse.ts (Phase 20-02).

  // === КРЕАТИВНЫЕ КОМПОНЕНТЫ 24-38 ===

  // 24. compSingularity — extracted в effects/anim/shared/compSingularity.ts (Phase 20-02).
  // 25. compEchoWave — extracted в effects/anim/shared/compEchoWave.ts (Phase 9).

  // 26. compGravityWell — extracted в effects/anim/shared/compGravityWell.ts (Phase 20-02).
  // 27. compSolarFlare — extracted в effects/anim/shared/compSolarFlare.ts (Phase 20-02).
  // 28. compAuroraRibbon — extracted в effects/anim/shared/compAuroraRibbon.ts (Phase 20-02).
  // 29. compDNAHelix — extracted в effects/anim/shared/compDNAHelix.ts (Phase 20-02).
  // 30. compLensFlare — extracted в effects/anim/shared/compLensFlare.ts (Phase 20-02).
  // 31. compConstellation — extracted в effects/anim/shared/compConstellation.ts (Phase 20-02).

  // 32. compMagneticField — extracted в effects/anim/shared/compMagneticField.ts (Phase 20-02).

  // 33. compPhoenixBurst — extracted в effects/anim/shared/compPhoenixBurst.ts (Phase 20-02).
  // 34. compWormhole — extracted в effects/anim/shared/compWormhole.ts (Phase 20-02).
  // 35. compCosmicRay — extracted в effects/anim/shared/compCosmicRay.ts (Phase 20-02).
  // 36. compQuantumSplit — extracted в effects/anim/shared/compQuantumSplit.ts (Phase 20-02).
  // 37. compHeartPulse — extracted в effects/anim/shared/compHeartPulse.ts (Phase 20-02).
  // 38. compCrackleDischarge — extracted в effects/anim/shared/compCrackleDischarge.ts (Phase 20-02).

  // === РАСШИРЕНИЕ 39-53 ===

  // 39. compPixelGrid — extracted в effects/anim/shared/compPixelGrid.ts (Phase 20-02).
  // 40. compSpiralArms — extracted в effects/anim/shared/compSpiralArms.ts (Phase 20-02).
  // 41. compCrystalGrow — extracted в effects/anim/shared/compCrystalGrow.ts (Phase 20-02).
  // 42. compSnowDrift — extracted в effects/anim/shared/compSnowDrift.ts (Phase 20-02).
  // 43. compGalaxySpawn — extracted в effects/anim/shared/compGalaxySpawn.ts (Phase 20-02).
  // 44. compPulseHex — extracted в effects/anim/shared/compPulseHex.ts (Phase 20-02).
  // 45. compTornado — extracted в effects/anim/shared/compTornado.ts (Phase 20-02).
  // 46. compStarPolygon — extracted в effects/anim/shared/compStarPolygon.ts (Phase 20-02).
  // 47. compCrossFlash — extracted в effects/anim/shared/compCrossFlash.ts (Phase 20-02).
  // 48. compWaveTrain — extracted в effects/anim/shared/compWaveTrain.ts (Phase 20-02).
  // 49. compPetalStorm — extracted в effects/anim/shared/compPetalStorm.ts (Phase 20-02).
  // 50. compFlameTongues — extracted в effects/anim/shared/compFlameTongues.ts (Phase 9).
  // 51. compSnakeTrail — extracted в effects/anim/shared/compSnakeTrail.ts (Phase 20-02).
  // 52. compBubblePop — extracted в effects/anim/shared/compBubblePop.ts (Phase 20-02).
  // 53. compChromaShift — extracted в effects/anim/shared/compChromaShift.ts (Phase 9).

  // === PHASE 7: UNIQUENESS CHECK ===

  // Phase 8: квантует значение в индекс ближайшего бина (по abs distance).
  // thresholds — отсортированный массив центров бинов. Возвращает 0..thresholds.length-1.
  private quantize(value: number, thresholds: number[]): number {
    let bestIdx = 0
    let bestDist = Math.abs(value - thresholds[0])
    for (let i = 1; i < thresholds.length; i++) {
      const d = Math.abs(value - thresholds[i])
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    return bestIdx
  }

  // Симулирует первые RNG-вызовы playUniqueAnimation и возвращает signature.
  // Должен ТОЧНО реплицировать порядок rng() calls в реальной игре.
  // Phase 8: signature расширена strict-параметрами (rotationBin, scaleBin, hueBin, delayBins)
  // для отлова коллизий по visible-различимым параметрам, не только recipe set.
  private buildAnimSignature(sys: Race | BgSystem): string {
    const rng = animRng(sys, this.mainSeedOverride)
    const theme = (sys as BgSystem).archetype ?? sys.type
    const pool = this.THEME_COMPONENTS[theme] ?? [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]

    // (1) recipe size + components — реплицирует playUniqueAnimation:984-992
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

    // (2) modifier flag + rotation/scale (реплицирует playUniqueAnimation:997-999)
    const useModifier = rng() < 0.25
    const modRotation = useModifier ? (rng() - 0.5) * Math.PI : 0
    const modScale = useModifier ? 0.7 + rng() * 0.6 : 1

    // Phase 8: квантуем modifier params в бины
    // rotation: 4 бина около (-π/2, -π/4, +π/4, +π/2); -1 если modifier нет
    const rotationBin = useModifier
      ? this.quantize(modRotation, [
          -Math.PI / 2,
          -Math.PI / 4,
          Math.PI / 4,
          Math.PI / 2,
        ])
      : -1
    // scale: 4 бина около (0.7, 0.85, 1.15, 1.3); -1 если modifier нет
    const scaleBin = useModifier
      ? this.quantize(modScale, [0.7, 0.85, 1.15, 1.3])
      : -1

    // (3) hue_bin: дополнительный детерминированный hash от seed (НЕ дёргает rng).
    // ВАЖНО: pickColor вызывает rng() уже внутри runAnimComponent — мы НЕ можем
    // повторить этот порядок в signature, т.к. он зависит от внутренностей comp.
    // Решение: используем raw seed (как его вычисляет animRng) и проектируем в 8 бинов.
    const seedSource =
      'rngSeed' in sys && typeof (sys as BgSystem).rngSeed === 'number'
        ? (sys as BgSystem).rngSeed
        : (this.mainSeedOverride.get(sys.id) ?? hashId(sys.id))
    // Проектируем seed в 8 hue bins (0..7)
    const hueBin = (seedSource >>> 5) & 0x7

    // (4) delay_bins per non-first comp (3 бина: <100ms / 100-199ms / ≥200ms)
    // ВАЖНО: реплицирует playUniqueAnimation:1002 — `Math.floor(rng() * 250) + 50`
    // (диапазон 50..299), затем мы квантуем в 3 бина.
    const delayBins: number[] = []
    for (let i = 1; i < components.length; i++) {
      const delay = Math.floor(rng() * 250) + 50
      let bin: number
      if (delay < 100) bin = 0
      else if (delay < 200) bin = 1
      else bin = 2
      delayBins.push(bin)
    }

    // Sorted comps for set-equality (как в Phase 7), плюс strict params
    // (rotationBin, scaleBin, hueBin, delayBins encoded in segments r/s/h/d).
    const compsKey = [...components].sort((a, b) => a - b).join(',')
    return `${compsKey}|m${useModifier ? 1 : 0}|r${rotationBin}|s${scaleBin}|h${hueBin}|d${delayBins.join(',')}|${theme}`
  }

  // После создания allSystems — refine seeds для уникальности recipe.
  // Если signature уже встречалась → детерминированно мутируем seed и пересчитываем.
  // Phase 8: после strict signature — 10 attempts на mutate seed (Phase 7 был 5).
  // Mutation: seed XOR ((attempt+1) * 0x9e3779b9) — golden ratio константа для distribution.
  private refineAnimSeeds(): void {
    const sigs = new Map<string, string>()
    let conflicts = 0
    for (const sys of this.allSystems) {
      let attempt = 0
      let sig = this.buildAnimSignature(sys)
      while (sigs.has(sig) && attempt < 10) {
        const isBg =
          'rngSeed' in sys && typeof (sys as BgSystem).rngSeed === 'number'
        const cur = isBg
          ? (sys as BgSystem).rngSeed
          : (this.mainSeedOverride.get(sys.id) ?? hashId(sys.id))
        const newSeed = (cur ^ ((attempt + 1) * 0x9e3779b9)) >>> 0
        if (isBg) {
          ;(sys as BgSystem).rngSeed = newSeed
        } else {
          this.mainSeedOverride.set(sys.id, newSeed)
        }
        sig = this.buildAnimSignature(sys)
        attempt++
        if (attempt === 10 && sigs.has(sig)) conflicts++
      }
      sigs.set(sig, sys.id)
    }
    // eslint-disable-next-line no-console
    console.log(
      `[StarMap] anim signatures (strict): ${sigs.size}/${this.allSystems.length} unique, ${conflicts} unresolved conflicts (max 10 attempts)`,
    )
  }

  // hashId — extracted в './starmap/helpers.ts' (Phase 20-01).

  // Phase 8: signature формат tuple-string. archetype|pitch|rot|inv|det|cutoff.
  // Используется для refineSoundSeeds — гарантирует 1000/1000 unique sound signatures.
  private buildSoundSignature(sys: Race | BgSystem): string {
    const archetype = (sys as BgSystem).archetype ?? sys.type
    const seed = effectiveSeed(sys, this.mainSeedOverride)
    const m = deriveModulations(seed, archetype)
    return `${archetype}|${m.pitchStep}|${m.rotationIdx}|${m.inversionIdx}|${m.detuneBin}|${m.cutoffBin}`
  }

  // Phase 8: третий refine pass (после texture → anim → sound).
  // При коллизии sound signature мутирует seed XOR ((attempt+1) * 0xc2b2ae3d).
  // До 10 attempts на планету. Логирует unique/total + unresolved в консоль.
  // ВАЖНО: эта мутация seed повлияет на anim signature, поэтому проводится ПОСЛЕДНЕЙ
  // (после texture и anim refine). Обратная зависимость допустима: после Sound mutation
  // мы НЕ возвращаемся к anim refine, потому что anim signature space уже достаточен
  // (10 attempts × strict signature) для absorbing новых мутаций.
  // Mutation constant 0xc2b2ae3d (FNV-1a hash multiplier) отличается от anim (0x9e3779b9)
  // и texture (0x85ebca6b) чтобы каждый pass разводил seeds в РАЗНОМ направлении.
  private refineSoundSeeds(): void {
    const sigs = new Map<string, string>()
    let conflicts = 0
    for (const sys of this.allSystems) {
      let attempt = 0
      let sig = this.buildSoundSignature(sys)
      while (sigs.has(sig) && attempt < 10) {
        const isBg =
          'rngSeed' in sys && typeof (sys as BgSystem).rngSeed === 'number'
        const cur = isBg
          ? (sys as BgSystem).rngSeed
          : (this.mainSeedOverride.get(sys.id) ?? hashId(sys.id))
        const newSeed = (cur ^ ((attempt + 1) * 0xc2b2ae3d)) >>> 0
        if (isBg) {
          ;(sys as BgSystem).rngSeed = newSeed
        } else {
          this.mainSeedOverride.set(sys.id, newSeed)
        }
        sig = this.buildSoundSignature(sys)
        attempt++
        if (attempt === 10 && sigs.has(sig)) conflicts++
      }
      sigs.set(sig, sys.id)
    }
    // eslint-disable-next-line no-console
    console.log(
      `[StarMap] sound signatures: ${sigs.size}/${this.allSystems.length} unique, ${conflicts} unresolved conflicts (max 10 attempts)`,
    )
  }

  // Phase 7: signature для текстуры BG-планеты — реплицирует первые ~10 rng() calls
  // в renderBgPoint. Captures: aura/baseRotation/sub-variant choice + первые counts +
  // флаги universal modifiers. Main races не учитываются (уникальны по id).
  private buildTextureSignature(sys: Race | BgSystem): string {
    if (!('archetype' in sys)) return `main:${sys.id}`
    const bg = sys as BgSystem
    const rng = mulberry32(bg.rngSeed)
    // 1) sparkle decision
    rng()
    // 2) aura
    const showAura =
      bg.archetype !== 'dead' &&
      bg.archetype !== 'mineral' &&
      bg.archetype !== 'desert'
    if (showAura) {
      rng() // auraR
      rng() // auraAlpha
      if (rng() < 0.3) {
        rng() // double aura
      }
    }
    // 3) base color shift
    rng() // 0.92 + rng() * 0.07
    rng() // ringOffsetAng
    rng() // ringOffsetMag
    rng() // size factor
    // 4) baseRotation
    rng()
    // 5) sub-variant choice (введём в Task 9 в renderBgPoint, signature заранее реплицирует)
    const variant = Math.floor(rng() * 3)
    // 6-7) первые 2 counts (зависит от archetype, но возьмём как general 0-4)
    const c1 = Math.floor(rng() * 5)
    const c2 = Math.floor(rng() * 5)
    // Phase 8: third count для расширения signature space (особенно важно для dead variant 2 — bare)
    const c3 = Math.floor(rng() * 5)
    // 8) modifier flags (universal modifiers)
    const surfaceLines = rng() < 0.15 ? 1 : 0
    const gradientBands = rng() < 0.12 ? 1 : 0
    const multiSpots = rng() < 0.15 ? 1 : 0
    const stackedRings = rng() < 0.08 ? 1 : 0
    // Phase 8: asymmetric atmosphere + color speckle modifiers (последние 2 universal modifiers)
    const asym = rng() < 0.2 ? 1 : 0
    const speckle = rng() < 0.25 ? 1 : 0
    return `${bg.archetype}:v${variant}:c${c1}-${c2}-${c3}:m${surfaceLines}${gradientBands}${multiSpots}${stackedRings}${asym}${speckle}`
  }

  // Phase 7: refine seed для текстур. Вызывается ДО refineAnimSeeds() в create().
  // Phase 8: 10 attempts (вместо 5) — consistent с refineAnimSeeds; используется
  // расширенный signature space (c3, asym, speckle).
  private refineTextureSeeds(): void {
    const sigs = new Map<string, string>()
    let conflicts = 0
    let bgCount = 0
    for (const sys of this.allSystems) {
      if (!('archetype' in sys)) continue // skip main
      bgCount++
      const bg = sys as BgSystem
      let attempt = 0
      let sig = this.buildTextureSignature(bg)
      while (sigs.has(sig) && attempt < 10) {
        const cur = bg.rngSeed
        bg.rngSeed = (cur ^ ((attempt + 1) * 0x85ebca6b)) >>> 0
        sig = this.buildTextureSignature(bg)
        attempt++
        if (attempt === 10 && sigs.has(sig)) conflicts++
      }
      sigs.set(sig, sys.id)
    }
    // eslint-disable-next-line no-console
    console.log(
      `[StarMap] texture signatures: ${sigs.size}/${bgCount} unique BG, ${conflicts} unresolved`,
    )
  }

  // === PHASE 7: НОВЫЕ КОМПОНЕНТЫ 54-63 ===

  // 54. compAtomShells — extracted в effects/anim/shared/compAtomShells.ts (Phase 20-02).
  // 55. compSupernova — extracted в effects/anim/shared/compSupernova.ts (Phase 20-02).
  // 56. compAccretionDisk — extracted в effects/anim/shared/compAccretionDisk.ts (Phase 20-02).
  // 57. compFlickerStars — extracted в effects/anim/shared/compFlickerStars.ts (Phase 20-02).
  // 58. compLightDance — extracted в effects/anim/shared/compLightDance.ts (Phase 20-02).
  // 59. compDimensionRift — extracted в effects/anim/shared/compDimensionRift.ts (Phase 20-02).
  // 60. compFrostExplode — extracted в effects/anim/shared/compFrostExplode.ts (Phase 20-02).
  // 61. compTimeWave — extracted в effects/anim/shared/compTimeWave.ts (Phase 20-02).
  // 62. compGlyphFlash — extracted в effects/anim/shared/compGlyphFlash.ts (Phase 20-02).
  // 63. compPrismShift — extracted в effects/anim/shared/compPrismShift.ts (Phase 20-02).

  // === РАСШИРЕНИЕ 3 (компоненты 64-75) ===

  // 64. compChargeBurst — extracted в effects/anim/shared/compChargeBurst.ts (Phase 20-02).
  // 65. compInfinityTrail — extracted в effects/anim/shared/compInfinityTrail.ts (Phase 20-02).
  // 66. compShieldRipple — extracted в effects/anim/shared/compShieldRipple.ts (Phase 20-02).
  // 67. compFireworks — extracted в effects/anim/shared/compFireworks.ts (Phase 20-02).
  // 68. compScanline — extracted в effects/anim/shared/compScanline.ts (Phase 20-02).
  // 69. compLiquidPool — extracted в effects/anim/shared/compLiquidPool.ts (Phase 20-02).
  // 70. compGravityKnot — extracted в effects/anim/shared/compGravityKnot.ts (Phase 20-02).
  // 71. compCosmicWeb — extracted в effects/anim/shared/compCosmicWeb.ts (Phase 20-02).
  // 72. compParticleFountain — extracted в effects/anim/shared/compParticleFountain.ts (Phase 20-02).
  // 73. compEchoSpawn — extracted в effects/anim/shared/compEchoSpawn.ts (Phase 20-02).
  // 74. compIceWisps — extracted в effects/anim/shared/compIceWisps.ts (Phase 9).
  // 75. compRipBlade — extracted в effects/anim/shared/compRipBlade.ts (Phase 20-02).

  // === РАСШИРЕНИЕ 4 (компоненты 76-87) ===
  // Каждый имеет sound-style ярлык — концептуальное «звучание» анимации.

  // 76. compChimeRing — extracted в effects/anim/shared/compChimeRing.ts (Phase 9).
  // 77. compEarthquakeShake — extracted в effects/anim/shared/compEarthquakeShake.ts (Phase 20-02).
  // 78. compKaleidoscope — extracted в effects/anim/shared/compKaleidoscope.ts (Phase 20-02).
  // 79. compDroneHum — extracted в effects/anim/shared/compDroneHum.ts (Phase 20-02).
  // 80. compGlitchStutter — extracted в effects/anim/shared/compGlitchStutter.ts (Phase 20-02).
  // 81. compDopplerWave — extracted в effects/anim/shared/compDopplerWave.ts (Phase 20-02).
  // 82. compMorseFlash — extracted в effects/anim/shared/compMorseFlash.ts (Phase 20-02).
  // 83. compCrystalBell — extracted в effects/anim/shared/compCrystalBell.ts (Phase 20-02).
  // 84. compWindRustle — extracted в effects/anim/shared/compWindRustle.ts (Phase 20-02).
  // 85. compClockGears — extracted в effects/anim/shared/compClockGears.ts (Phase 20-02).
  // 86. compBubbleStream — extracted в effects/anim/shared/compBubbleStream.ts (Phase 9).
  // 87. compPlasmaArc — extracted в effects/anim/shared/compPlasmaArc.ts (Phase 9).

  // === PHASE 8 (компоненты 88-95) ===
  // Тематические дополнения: bouncingBall, digitalGlitch, ringPulsar, swarmParticles,
  // prismRefract, lifeBloom, windRibbons, wreckageOrbit. Расширяют under-loaded pool'ы.

  // 88. compBouncingBall — extracted в effects/anim/shared/compBouncingBall.ts (Phase 20-02).
  // 89. compDigitalGlitch — extracted в effects/anim/shared/compDigitalGlitch.ts (Phase 20-02).
  // 90. compRingPulsar — extracted в effects/anim/shared/compRingPulsar.ts (Phase 20-02).
  // 91. compSwarmParticles — extracted в effects/anim/shared/compSwarmParticles.ts (Phase 20-02).
  // 92. compPrismRefract — extracted в effects/anim/shared/compPrismRefract.ts (Phase 20-02).
  // 93. compLifeBloom — extracted в effects/anim/shared/compLifeBloom.ts (Phase 20-02).
  // 94. compWindRibbons — extracted в effects/anim/shared/compWindRibbons.ts (Phase 20-02).
  // 95. compWreckageOrbit — extracted в effects/anim/shared/compWreckageOrbit.ts (Phase 20-02).

  private renderMainPlanet(sys: Race) {
    // Sparkle над планетой — один на каждую главную расу.
    // Создаётся в world coords (НЕ child container), чтобы не зависеть от LOD-скрытия.
    this.createSparkleAt(
      sys.x,
      sys.y,
      sys.size,
      mulberry32(sys.id.charCodeAt(0) * 7919 + 13),
    )

    const container = this.add.container(sys.x, sys.y)
    const g = this.add.graphics()

    if (sys.id === 'home') {
      // Phase 7: HOME — выразительные континенты + облачный покров
      g.fillStyle(0x0c4a6e)
      g.fillCircle(0, 0, sys.size)
      g.fillStyle(sys.color)
      g.fillCircle(-4 * DPR, -3 * DPR, sys.size * 0.95)
      // Континенты (зелёные)
      g.fillStyle(sys.accent, 0.85)
      g.fillEllipse(-12 * DPR, 2 * DPR, 28 * DPR, 18 * DPR)
      g.fillStyle(sys.accent, 0.7)
      g.fillEllipse(15 * DPR, -10 * DPR, 20 * DPR, 14 * DPR)
      g.fillStyle(sys.accent, 0.6)
      g.fillCircle(8 * DPR, 18 * DPR, 10 * DPR)
      // Phase 7: дополнительные мелкие острова
      g.fillStyle(sys.accent, 0.7)
      g.fillEllipse(-18 * DPR, -16 * DPR, 12 * DPR, 8 * DPR)
      g.fillStyle(sys.accent, 0.6)
      g.fillCircle(20 * DPR, 12 * DPR, 5 * DPR)
      // Phase 7: тонкие облачные слои
      g.fillStyle(0xffffff, 0.25)
      g.fillEllipse(-2 * DPR, -8 * DPR, 32 * DPR, 4 * DPR)
      g.fillStyle(0xffffff, 0.2)
      g.fillEllipse(2 * DPR, 14 * DPR, 28 * DPR, 3 * DPR)
      // Полярные шапки
      g.fillStyle(0xffffff, 0.8)
      g.fillEllipse(0, -sys.size * 0.85, sys.size * 0.4, sys.size * 0.12)
      g.fillStyle(0xffffff, 0.7)
      g.fillEllipse(0, sys.size * 0.85, sys.size * 0.35, sys.size * 0.1)
      // Атмосфера
      g.lineStyle(2 * DPR, 0x7dd3fc, 0.4)
      g.strokeCircle(0, 0, sys.size + 4 * DPR)
      g.lineStyle(1 * DPR, 0xa5f3fc, 0.2)
      g.strokeCircle(0, 0, sys.size + 8 * DPR)
    } else if (sys.id === 'relict') {
      // Phase 7: RELICT — больше шрамов и обломков
      g.fillStyle(0x171717)
      g.fillCircle(0, 0, sys.size)
      // Большие диагональные трещины
      g.lineStyle(3 * DPR, sys.color, 0.6)
      g.lineBetween(
        -sys.size * 0.6,
        -sys.size * 0.6,
        sys.size * 0.6,
        sys.size * 0.6,
      )
      g.lineBetween(
        -sys.size * 0.6,
        sys.size * 0.6,
        sys.size * 0.6,
        -sys.size * 0.6,
      )
      // Phase 7: дополнительные мелкие шрамы
      g.lineStyle(1.5 * DPR, sys.color, 0.5)
      g.lineBetween(-sys.size * 0.5, 0, sys.size * 0.3, sys.size * 0.4)
      g.lineBetween(0, -sys.size * 0.5, -sys.size * 0.3, sys.size * 0.3)
      // Кратеры от ударов
      g.fillStyle(0x000000, 0.7)
      g.fillCircle(-sys.size * 0.3, sys.size * 0.2, sys.size * 0.12)
      g.fillStyle(0x000000, 0.6)
      g.fillCircle(sys.size * 0.35, -sys.size * 0.25, sys.size * 0.1)
      g.fillStyle(0x000000, 0.5)
      g.fillCircle(sys.size * 0.1, sys.size * 0.45, sys.size * 0.07)
      // Аура трагедии
      g.lineStyle(1 * DPR, 0xfca5a5, 0.4)
      g.strokeCircle(0, 0, sys.size + 6 * DPR)
      g.lineStyle(0.5 * DPR, 0xfca5a5, 0.3)
      g.strokeCircle(0, 0, sys.size + 11 * DPR)
    } else {
      g.fillStyle(sys.accent)
      g.fillCircle(0, 0, sys.size)
      g.fillStyle(sys.color, 0.95)
      g.fillCircle(-3 * DPR, -2 * DPR, sys.size * 0.92)
      const D = DPR
      if (sys.type === 'crystal') {
        // Phase 7: BLIKS — более яркие кристаллы + блики
        g.fillStyle(0xffffff, 0.7)
        for (let a = 0; a < 6; a++) {
          const θ = (a * Math.PI) / 3
          g.fillTriangle(
            Math.cos(θ) * sys.size * 0.3,
            Math.sin(θ) * sys.size * 0.3,
            Math.cos(θ) * sys.size * 0.7 - 3 * D,
            Math.sin(θ) * sys.size * 0.7,
            Math.cos(θ) * sys.size * 0.7 + 3 * D,
            Math.sin(θ) * sys.size * 0.7,
          )
        }
        // Phase 7: маленькие блики на кристаллах
        g.fillStyle(0xffffff, 0.95)
        for (let a = 0; a < 6; a++) {
          const θ = (a * Math.PI) / 3
          g.fillCircle(
            Math.cos(θ) * sys.size * 0.55,
            Math.sin(θ) * sys.size * 0.55,
            1.5 * D,
          )
        }
        // Центральный кристалл
        g.fillStyle(sys.color, 0.9)
        g.fillCircle(0, 0, sys.size * 0.18)
        g.fillStyle(0xffffff, 0.8)
        g.fillCircle(-1.5 * D, -1.5 * D, sys.size * 0.08)
      } else if (sys.type === 'rocky') {
        // Phase 7: ROCKY — больше камней и текстуры
        g.fillStyle(sys.accent, 0.9)
        g.fillCircle(-8 * D, -5 * D, 10 * D)
        g.fillStyle(sys.accent, 0.8)
        g.fillCircle(10 * D, 8 * D, 8 * D)
        g.fillStyle(sys.accent, 0.7)
        g.fillCircle(2 * D, -12 * D, 6 * D)
        g.fillStyle(sys.accent, 0.6)
        g.fillCircle(-12 * D, 10 * D, 5 * D)
        // Тени-впадины
        g.fillStyle(0x000000, 0.3)
        g.fillCircle(-6 * D, -3 * D, 6 * D)
        g.fillStyle(0x000000, 0.25)
        g.fillCircle(12 * D, 10 * D, 5 * D)
      } else if (sys.type === 'ancient') {
        // Phase 7: MAR — древняя раса со множеством символов
        g.lineStyle(2 * D, 0xffffff, 0.4)
        g.strokeCircle(0, 0, sys.size * 0.6)
        g.strokeCircle(0, 0, sys.size * 0.3)
        // Phase 7: внешнее кольцо рун
        g.lineStyle(1 * D, sys.accent, 0.5)
        g.strokeCircle(0, 0, sys.size * 0.85)
        // Маленькие точки-символы по 2 кругам
        g.fillStyle(0xffffff, 0.8)
        for (let a = 0; a < 8; a++) {
          const θ = (a * Math.PI) / 4
          g.fillCircle(
            Math.cos(θ) * sys.size * 0.6,
            Math.sin(θ) * sys.size * 0.6,
            1 * D,
          )
        }
        for (let a = 0; a < 12; a++) {
          const θ = (a * Math.PI) / 6 + 0.15
          g.fillStyle(sys.accent, 0.7)
          g.fillCircle(
            Math.cos(θ) * sys.size * 0.85,
            Math.sin(θ) * sys.size * 0.85,
            0.8 * D,
          )
        }
      } else if (sys.type === 'mystic') {
        // Phase 7: NUM — больше мистических огоньков
        g.fillStyle(0xffffff, 0.5)
        g.fillCircle(-5 * D, -8 * D, 4 * D)
        g.fillCircle(8 * D, 5 * D, 3 * D)
        g.fillCircle(-2 * D, 10 * D, 3 * D)
        // Phase 7: дополнительные огоньки
        g.fillStyle(0xa5f3fc, 0.7)
        g.fillCircle(6 * D, -4 * D, 2 * D)
        g.fillStyle(0xc4b5fd, 0.6)
        g.fillCircle(-9 * D, 4 * D, 2.5 * D)
        g.fillStyle(0xfde047, 0.5)
        g.fillCircle(2 * D, -2 * D, 1.5 * D)
        // Тонкие линии-связи между огоньками (созвездие)
        g.lineStyle(0.5 * D, 0xa5f3fc, 0.4)
        g.lineBetween(-5 * D, -8 * D, 6 * D, -4 * D)
        g.lineBetween(6 * D, -4 * D, 8 * D, 5 * D)
        g.lineBetween(8 * D, 5 * D, -2 * D, 10 * D)
      } else if (sys.type === 'organic') {
        // Phase 7: организм — больше форм
        g.fillStyle(sys.accent, 0.7)
        g.fillEllipse(0, 0, sys.size * 1.2, sys.size * 0.5)
        // Phase 7: дополнительные органические выпуклости
        g.fillStyle(sys.accent, 0.6)
        g.fillEllipse(0, 0, sys.size * 0.5, sys.size * 1.2)
        g.fillStyle(sys.color, 0.5)
        g.fillCircle(-sys.size * 0.3, 0, sys.size * 0.18)
        g.fillStyle(sys.color, 0.5)
        g.fillCircle(sys.size * 0.3, 0, sys.size * 0.18)
        g.fillStyle(0xffffff, 0.4)
        g.fillCircle(0, 0, sys.size * 0.1)
      } else if (sys.type === 'forge') {
        // Phase 7: VRAK — кузнецы: огонь и наковальня
        g.lineStyle(3 * D, sys.accent, 0.9)
        g.beginPath()
        g.moveTo(-sys.size * 0.6, sys.size * 0.3)
        g.lineTo(sys.size * 0.6, -sys.size * 0.3)
        g.strokePath()
        g.lineStyle(2 * D, 0xfff7ed, 0.7)
        g.strokeCircle(-sys.size * 0.4, sys.size * 0.2, 4 * D)
        // Phase 7: горящие очаги по поверхности
        g.fillStyle(0xef4444, 0.85)
        g.fillCircle(sys.size * 0.4, -sys.size * 0.2, 4 * D)
        g.fillStyle(0xfde047, 0.7)
        g.fillCircle(sys.size * 0.4, -sys.size * 0.2, 2.5 * D)
        g.fillStyle(0xfb923c, 0.7)
        g.fillCircle(-sys.size * 0.5, -sys.size * 0.4, 3 * D)
        // Дым над очагами
        g.fillStyle(0x4b5563, 0.4)
        g.fillEllipse(
          sys.size * 0.4,
          -sys.size * 0.45,
          sys.size * 0.3,
          sys.size * 0.1,
        )
      } else if (sys.type === 'military') {
        // Phase 7: VEKTAR — больше техники и оружия
        g.lineStyle(3 * D, sys.accent, 1)
        g.strokeCircle(0, 0, sys.size + 6 * D)
        g.fillStyle(sys.accent, 0.8)
        for (let a = 0; a < 4; a++) {
          const θ = (a * Math.PI) / 2
          g.fillCircle(
            Math.cos(θ) * (sys.size + 6 * D),
            Math.sin(θ) * (sys.size + 6 * D),
            4 * D,
          )
        }
        // Phase 7: дополнительные мини-турели на меньшем кольце
        g.lineStyle(1.5 * D, sys.accent, 0.7)
        g.strokeCircle(0, 0, sys.size * 0.7)
        g.fillStyle(sys.accent, 0.85)
        for (let a = 0; a < 8; a++) {
          const θ = (a * Math.PI) / 4 + Math.PI / 8
          g.fillRect(
            Math.cos(θ) * sys.size * 0.7 - D,
            Math.sin(θ) * sys.size * 0.7 - D,
            2 * D,
            2 * D,
          )
        }
        // Центральный командный пункт
        g.fillStyle(0xef4444, 0.9)
        g.fillCircle(0, 0, sys.size * 0.15)
        g.fillStyle(0xfde047, 0.85)
        g.fillCircle(0, 0, sys.size * 0.07)
      } else if (sys.type === 'crystal_bio') {
        // Phase 7: ШИОН — кристаллы прорастают сквозь органическую поверхность (расширено)
        g.fillStyle(sys.accent, 0.7)
        g.fillEllipse(0, 0, sys.size * 1.3, sys.size * 0.7)
        g.fillStyle(0xffffff, 0.85)
        for (let a = 0; a < 4; a++) {
          const θ = (a * Math.PI) / 2 + 0.4
          const tipR = sys.size * 0.95
          g.fillTriangle(
            Math.cos(θ - 0.15) * sys.size * 0.2,
            Math.sin(θ - 0.15) * sys.size * 0.2,
            Math.cos(θ + 0.15) * sys.size * 0.2,
            Math.sin(θ + 0.15) * sys.size * 0.2,
            Math.cos(θ) * tipR,
            Math.sin(θ) * tipR,
          )
        }
        // Phase 7: малые вторичные кристаллы между большими
        g.fillStyle(sys.color, 0.85)
        for (let a = 0; a < 4; a++) {
          const θ = (a * Math.PI) / 2 + 0.4 + Math.PI / 4
          const tipR = sys.size * 0.55
          g.fillTriangle(
            Math.cos(θ - 0.1) * sys.size * 0.15,
            Math.sin(θ - 0.1) * sys.size * 0.15,
            Math.cos(θ + 0.1) * sys.size * 0.15,
            Math.sin(θ + 0.1) * sys.size * 0.15,
            Math.cos(θ) * tipR,
            Math.sin(θ) * tipR,
          )
        }
        g.fillStyle(sys.color, 0.6)
        g.fillCircle(0, 0, sys.size * 0.25)
        g.fillStyle(0xffffff, 0.7)
        g.fillCircle(0, 0, sys.size * 0.12)
      } else if (sys.type === 'mechano') {
        // Phase 7: ДРЕВИУС — механо-животное (расширено: больше зубцов и заклёпок)
        g.lineStyle(2 * D, sys.accent, 0.85)
        g.strokeCircle(0, 0, sys.size * 0.65)
        g.strokeCircle(0, 0, sys.size * 0.35)
        for (let a = 0; a < 8; a++) {
          const θ = (a * Math.PI) / 4
          g.lineBetween(
            Math.cos(θ) * sys.size * 0.55,
            Math.sin(θ) * sys.size * 0.55,
            Math.cos(θ) * sys.size * 0.85,
            Math.sin(θ) * sys.size * 0.85,
          )
        }
        // Phase 7: внешние зубцы шестерни
        g.fillStyle(sys.accent, 0.85)
        for (let a = 0; a < 12; a++) {
          const θ = (a * Math.PI) / 6
          const r = sys.size * 0.92
          g.fillRect(Math.cos(θ) * r - D, Math.sin(θ) * r - D, 2 * D, 2 * D)
        }
        // Phase 7: заклёпки
        g.fillStyle(0xffffff, 0.7)
        for (let a = 0; a < 4; a++) {
          const θ = (a * Math.PI) / 2 + Math.PI / 4
          g.fillCircle(
            Math.cos(θ) * sys.size * 0.5,
            Math.sin(θ) * sys.size * 0.5,
            1.5 * D,
          )
        }
        g.fillStyle(sys.accent, 0.95)
        g.fillCircle(0, 0, sys.size * 0.18)
        g.fillStyle(0xfde047, 0.8)
        g.fillCircle(0, 0, sys.size * 0.08)
      } else if (sys.type === 'energy') {
        // Phase 7: КАЛЕБ — энергетическая раса (расширено: больше молний и обводка)
        g.lineStyle(2 * D, sys.color, 0.95)
        for (let i = 0; i < 5; i++) {
          const θ = (i * Math.PI * 2) / 5 + 0.2
          let x = Math.cos(θ) * sys.size * 0.3
          let y = Math.sin(θ) * sys.size * 0.3
          g.beginPath()
          g.moveTo(x, y)
          for (let j = 0; j < 3; j++) {
            x +=
              Math.cos(θ) * sys.size * 0.2 +
              (Math.random() - 0.5) * sys.size * 0.15
            y +=
              Math.sin(θ) * sys.size * 0.2 +
              (Math.random() - 0.5) * sys.size * 0.15
            g.lineTo(x, y)
          }
          g.strokePath()
        }
        // Phase 7: внешнее кольцо энергии
        g.lineStyle(1.5 * D, 0xfde047, 0.6)
        g.strokeCircle(0, 0, sys.size * 0.85)
        g.lineStyle(0.8 * D, sys.color, 0.4)
        g.strokeCircle(0, 0, sys.size * 1.05)
        // Точки разрядов вокруг
        g.fillStyle(0xfff7ed, 0.9)
        for (let i = 0; i < 8; i++) {
          const θ = (i * Math.PI) / 4
          g.fillCircle(
            Math.cos(θ) * sys.size * 0.85,
            Math.sin(θ) * sys.size * 0.85,
            1.2 * D,
          )
        }
        g.fillStyle(0xffffff, 0.95)
        g.fillCircle(0, 0, sys.size * 0.35)
        g.fillStyle(0xfde047, 0.85)
        g.fillCircle(0, 0, sys.size * 0.18)
      } else if (sys.type === 'mist') {
        // Phase 7: ТЕВР — туманная раса (расширено: больше слоёв)
        for (let i = 0; i < 6; i++) {
          const θ = (i * Math.PI * 2) / 6
          g.fillStyle(0xffffff, 0.25 + (i % 2) * 0.1)
          g.fillEllipse(
            Math.cos(θ) * sys.size * 0.4,
            Math.sin(θ) * sys.size * 0.4,
            sys.size * 0.55,
            sys.size * 0.25,
          )
        }
        // Phase 7: дополнительный слой завитков
        for (let i = 0; i < 4; i++) {
          const θ = (i * Math.PI) / 2 + Math.PI / 4
          g.fillStyle(sys.color, 0.3)
          g.fillEllipse(
            Math.cos(θ) * sys.size * 0.6,
            Math.sin(θ) * sys.size * 0.6,
            sys.size * 0.4,
            sys.size * 0.18,
          )
        }
        g.lineStyle(1 * D, sys.accent, 0.5)
        g.strokeCircle(0, 0, sys.size * 0.85)
        g.lineStyle(0.5 * D, 0xc4b5fd, 0.4)
        g.strokeCircle(0, 0, sys.size * 0.55)
      } else if (sys.type === 'aquatic') {
        // Phase 7: ЮРУМ — водянистая (расширено: больше волн и капель)
        g.fillStyle(0xffffff, 0.4)
        g.fillEllipse(0, -sys.size * 0.3, sys.size * 1.2, sys.size * 0.18)
        g.fillEllipse(0, sys.size * 0.05, sys.size * 1.3, sys.size * 0.16)
        g.fillEllipse(0, sys.size * 0.4, sys.size * 1.1, sys.size * 0.15)
        // Phase 7: тонкие промежуточные волны
        g.fillStyle(0xffffff, 0.25)
        g.fillEllipse(0, -sys.size * 0.55, sys.size * 0.9, sys.size * 0.08)
        g.fillEllipse(0, -sys.size * 0.1, sys.size * 1.25, sys.size * 0.07)
        g.fillEllipse(0, sys.size * 0.65, sys.size * 0.85, sys.size * 0.07)
        // Капли — много
        g.fillStyle(sys.accent, 0.7)
        g.fillCircle(sys.size * 0.3, sys.size * 0.2, sys.size * 0.15)
        g.fillStyle(sys.accent, 0.6)
        g.fillCircle(-sys.size * 0.4, -sys.size * 0.2, sys.size * 0.1)
        g.fillStyle(sys.color, 0.6)
        g.fillCircle(sys.size * 0.5, -sys.size * 0.45, sys.size * 0.07)
        // Блики на каплях
        g.fillStyle(0xffffff, 0.85)
        g.fillCircle(sys.size * 0.27, sys.size * 0.17, sys.size * 0.04)
      } else if (sys.type === 'shadow') {
        // Phase 7: НОКТИС — тёмная раса (расширено: больше теней)
        g.fillStyle(0x000000, 0.7)
        g.fillCircle(0, 0, sys.size * 0.7)
        g.fillStyle(sys.accent, 0.6)
        for (let a = 0; a < 8; a++) {
          const θ = (a * Math.PI) / 4
          const r = sys.size * (0.6 + Math.random() * 0.3)
          g.fillEllipse(
            Math.cos(θ) * r * 0.6,
            Math.sin(θ) * r * 0.6,
            sys.size * 0.18,
            sys.size * 0.3,
          )
        }
        // Phase 7: дополнительные тёмные щупальца наружу
        g.fillStyle(0x000000, 0.5)
        for (let a = 0; a < 6; a++) {
          const θ = (a * Math.PI) / 3 + 0.2
          g.fillTriangle(
            Math.cos(θ) * sys.size * 0.3,
            Math.sin(θ) * sys.size * 0.3,
            Math.cos(θ - 0.2) * sys.size * 0.85,
            Math.sin(θ - 0.2) * sys.size * 0.85,
            Math.cos(θ + 0.2) * sys.size * 0.85,
            Math.sin(θ + 0.2) * sys.size * 0.85,
          )
        }
        // Глаз тьмы
        g.fillStyle(0xa78bfa, 0.5)
        g.fillCircle(0, 0, sys.size * 0.18)
        g.fillStyle(0x000000, 0.95)
        g.fillCircle(0, 0, sys.size * 0.08)
      } else if (sys.type === 'aerial') {
        // Phase 7: АЛЬТУС — воздушная раса (расширено: больше облаков и потоков)
        g.fillStyle(0xffffff, 0.55)
        g.fillEllipse(0, -sys.size * 0.3, sys.size * 1.4, sys.size * 0.22)
        g.fillEllipse(0, sys.size * 0.0, sys.size * 1.1, sys.size * 0.16)
        g.fillEllipse(0, sys.size * 0.35, sys.size * 1.3, sys.size * 0.2)
        // Phase 7: дополнительный слой пушистых облаков
        g.fillStyle(0xffffff, 0.4)
        g.fillEllipse(
          -sys.size * 0.4,
          -sys.size * 0.15,
          sys.size * 0.5,
          sys.size * 0.12,
        )
        g.fillEllipse(
          sys.size * 0.4,
          sys.size * 0.2,
          sys.size * 0.6,
          sys.size * 0.12,
        )
        // Лёгкие воздушные потоки (тонкие линии)
        g.lineStyle(0.5 * D, sys.accent, 0.45)
        g.strokeEllipse(0, 0, sys.size * 1.4, sys.size * 0.4)
        g.strokeEllipse(0, sys.size * 0.2, sys.size * 1.2, sys.size * 0.35)
        g.lineStyle(1 * D, sys.accent, 0.5)
        g.strokeCircle(0, 0, sys.size + 5 * D)
        g.lineStyle(0.5 * D, 0xa5f3fc, 0.3)
        g.strokeCircle(0, 0, sys.size + 11 * D)
      }
    }

    container.add(g)

    // Idle-анимации
    if (sys.id === 'home') {
      this.tweens.add({
        targets: container,
        scale: { from: 1, to: 1.04 },
        duration: 3500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else if (sys.id === 'relict') {
      this.tweens.add({
        targets: g,
        alpha: { from: 1, to: 0.6 },
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else {
      this.tweens.add({
        targets: g,
        angle: 360,
        duration: 30000 + Math.random() * 30000,
        repeat: -1,
        ease: 'Linear',
      })
      this.tweens.add({
        targets: container,
        scale: { from: 0.97, to: 1.03 },
        duration: 2500 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    // Подсказка пульсации для bliks (с задержкой, чтобы не вспыхивать при открытии сцены)
    if (sys.id === 'bliks') {
      const pulse = this.add.graphics()
      pulse.lineStyle(2 * DPR, 0xffd700, 0.7)
      pulse.strokeCircle(0, 0, sys.size + 12 * DPR)
      pulse.setAlpha(0)
      container.add(pulse)
      this.time.delayedCall(700, () => {
        this.tweens.add({
          targets: pulse,
          scale: { from: 1, to: 1.4 },
          alpha: { from: 0.7, to: 0 },
          duration: 1200,
          repeat: -1,
          ease: 'Sine.easeOut',
        })
      })
    }

    // Интерактивность через pointerup (drag-aware) с адаптивным hit-area
    const baseR = sys.size + 6 * DPR
    const hitArea = new Phaser.Geom.Circle(0, 0, baseR)
    container.setInteractive(hitArea, Phaser.Geom.Circle.Contains)
    let downTime = 0
    let downX = 0,
      downY = 0
    container.on('pointerdown', (p: Phaser.Input.Pointer) => {
      downTime = Date.now()
      downX = p.x
      downY = p.y
    })
    container.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dt = Date.now() - downTime
      const moved = Math.abs(p.x - downX) + Math.abs(p.y - downY)
      if (dt < 300 && moved < 8 * DPR) {
        this.tapHandledThisFrame = true
        eventBus.emit('starmap:planet-select', {
          planetId: sys.id,
          name: sys.name,
          archetype: sys.type ?? '',
        })
        this.handlePlanetPress(sys)
        this.selectSystem(sys)
      }
    })

    this.systemSprites.set(sys.id, container)
    // Регистрируем для culling
    this.cullableData.push({
      obj: container,
      x: sys.x,
      y: sys.y,
      r: sys.size * 3,
    })
    // Регистрируем для адаптивного hit-area (увеличивается при zoom-out)
    this.mainPlanetHits.push({ container, baseR, circle: hitArea })
    // Регистрируем для batch-toggle interactive по zoom (как BG)
    this.bgInteractiveContainers.push(container)
  }

  private renderBgPoint(sys: BgSystem) {
    // Контейнер для всей планеты — позволяет idle-анимации (вращение, дыхание)
    const container = this.add.container(sys.x, sys.y)
    const rng = mulberry32(sys.rngSeed)

    // Sparkle над планетой — у ~40% фоновых планет.
    // Создаётся в world coords (НЕ child container), чтобы не исчезать при LOD-скрытии планеты.
    if (rng() < 0.4) {
      this.createSparkleAt(sys.x, sys.y, sys.size, mulberry32(sys.rngSeed + 17))
    }

    // ── Разделение на 2 Graphics для LOD ──
    // gBase — aura + базовый шар + блик. ВСЕГДА видим (минимальный draw cost).
    // g (gDetail ниже) — все archetype-specific детали + universal modifiers.
    //   Скрывается при zoom < BG_DETAIL_MIN_ZOOM → ~80% меньше draw calls на zoom-out.
    const gBase = this.add.graphics()
    container.add(gBase)

    // Атмосфера (ореол) — общий для большинства архетипов, с вариативным размером
    const showAura =
      sys.archetype !== 'dead' &&
      sys.archetype !== 'mineral' &&
      sys.archetype !== 'desert'
    if (showAura) {
      const auraR = sys.size * (1.3 + rng() * 0.5) // 1.3-1.8
      const auraAlpha = (0.08 + rng() * 0.1) * sys.brightness
      gBase.fillStyle(sys.color, auraAlpha)
      gBase.fillCircle(0, 0, auraR)
      // Иногда — двойной слой ауры
      if (rng() < 0.3) {
        gBase.fillStyle(sys.accent, auraAlpha * 0.7)
        gBase.fillCircle(0, 0, auraR * (0.85 + rng() * 0.1))
      }
    }

    // Базовый «шар» планеты — позиция блика и его смещение варьируются
    gBase.fillStyle(sys.accent, 1)
    gBase.fillCircle(0, 0, sys.size)
    gBase.fillStyle(sys.color, 0.92 + rng() * 0.07)
    const ringOffsetAng = (1.0 + rng() * 0.6) * Math.PI // верхне-левый ±
    const ringOffsetMag = sys.size * (0.08 + rng() * 0.08)
    gBase.fillCircle(
      Math.cos(ringOffsetAng) * ringOffsetMag,
      Math.sin(ringOffsetAng) * ringOffsetMag,
      sys.size * (0.88 + rng() * 0.06),
    )

    // Детальный Graphics — все остальные узоры. Регистрируется для LOD-toggle.
    const g = this.add.graphics()
    container.add(g)
    this.bgArchetypeGfx.push(g)

    // Архетип-специфичная деталировка с большим количеством rng-вариаций.
    // Phase 7: для 9 hot archetypes — sub-variants (3 на каждый).
    // ВАЖНО: variant choice — первый rng() после baseRotation, signature builder
    // (buildTextureSignature) ТОЧНО реплицирует этот порядок.
    const D = DPR
    const baseRotation = rng() * Math.PI * 2 // случайный «поворот» паттерна
    // variant — общий для всех hot archetypes; для остальных variant игнорируется
    const variant = Math.floor(rng() * 3)
    switch (sys.archetype) {
      case 'gas_giant': {
        if (variant === 0) {
          // banded — текущая логика (полосы + штормы)
          const bands = 2 + Math.floor(rng() * 5)
          for (let i = 0; i < bands; i++) {
            const yOff = (i - bands / 2 + 0.5) * sys.size * (0.25 + rng() * 0.2)
            const w =
              sys.size * (1.4 + rng() * 0.4 - Math.abs(yOff / sys.size) * 0.4)
            const h = sys.size * (0.08 + rng() * 0.18)
            const tint = rng() < 0.5 ? sys.accent : sys.color
            g.fillStyle(tint, 0.4 + rng() * 0.3)
            g.fillEllipse(0, yOff, w, h)
          }
          const storms = Math.floor(rng() * 4)
          for (let i = 0; i < storms; i++) {
            const ax = (rng() - 0.5) * sys.size * 0.7
            const ay = (rng() - 0.5) * sys.size * 0.5
            const sw = sys.size * (0.15 + rng() * 0.25)
            const sh = sw * (0.5 + rng() * 0.4)
            g.fillStyle(sys.accent, 0.7 + rng() * 0.25)
            g.fillEllipse(ax, ay, sw, sh)
            if (rng() < 0.5) {
              g.fillStyle(0xffffff, 0.3)
              g.fillEllipse(ax - sw * 0.15, ay - sh * 0.2, sw * 0.4, sh * 0.3)
            }
          }
        } else if (variant === 1) {
          // spotted — 6-12 круглых пятен разного размера
          const spots = 6 + Math.floor(rng() * 7)
          for (let i = 0; i < spots; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * rng() * 0.7
            const r = sys.size * (0.08 + rng() * 0.15)
            g.fillStyle(rng() < 0.5 ? sys.color : sys.accent, 0.5 + rng() * 0.4)
            g.fillCircle(Math.cos(ang) * dist, Math.sin(ang) * dist, r)
          }
        } else {
          // storm — 1 большой ураган в центре + 2 полосы
          g.fillStyle(sys.accent, 0.85)
          g.fillEllipse(0, 0, sys.size * 0.7, sys.size * 0.45)
          g.fillStyle(0xffffff, 0.4)
          g.fillEllipse(
            -sys.size * 0.1,
            -sys.size * 0.05,
            sys.size * 0.45,
            sys.size * 0.25,
          )
          g.fillStyle(sys.color, 0.5)
          g.fillEllipse(0, -sys.size * 0.55, sys.size * 1.4, sys.size * 0.18)
          g.fillEllipse(0, sys.size * 0.55, sys.size * 1.4, sys.size * 0.18)
        }
        break
      }
      case 'gas_ringed': {
        if (variant === 0) {
          // banded-rings — текущая логика
          const bands = 2 + Math.floor(rng() * 3)
          for (let i = 0; i < bands; i++) {
            const yOff = (i - bands / 2 + 0.5) * sys.size * (0.3 + rng() * 0.2)
            g.fillStyle(rng() < 0.5 ? sys.accent : sys.color, 0.5 + rng() * 0.2)
            g.fillEllipse(
              0,
              yOff,
              sys.size * (1.4 + rng() * 0.4),
              sys.size * (0.12 + rng() * 0.15),
            )
          }
          const ringGfx = this.add.graphics()
          const ringRotation = (rng() - 0.5) * 60
          const subRings = 1 + Math.floor(rng() * 3)
          for (let i = 0; i < subRings; i++) {
            const ringScale = 2.4 + i * 0.25 + rng() * 0.3
            ringGfx.lineStyle(
              (2 + rng() * 2) * D,
              i % 2 === 0 ? sys.color : sys.accent,
              0.4 + rng() * 0.4,
            )
            ringGfx.strokeEllipse(
              0,
              0,
              sys.size * ringScale,
              sys.size * (0.4 + rng() * 0.5),
            )
          }
          ringGfx.angle = ringRotation
          container.add(ringGfx)
        } else if (variant === 1) {
          // wide-disk — широкий плоский диск + минимум полос
          g.fillStyle(sys.accent, 0.5)
          g.fillEllipse(0, 0, sys.size * 0.5, sys.size * 1.5) // вертикальный овал
          const ringGfx = this.add.graphics()
          const ringRotation = (rng() - 0.5) * 30
          // Один очень широкий диск
          ringGfx.fillStyle(sys.color, 0.4 + rng() * 0.2)
          ringGfx.fillEllipse(
            0,
            0,
            sys.size * 3.2,
            sys.size * (0.7 + rng() * 0.3),
          )
          ringGfx.fillStyle(sys.accent, 0.6)
          ringGfx.fillEllipse(0, 0, sys.size * 2.6, sys.size * 0.3)
          // отверстие в центре (через темнее эллипс)
          ringGfx.fillStyle(0x000000, 0.5)
          ringGfx.fillEllipse(0, 0, sys.size * 1.4, sys.size * 0.18)
          ringGfx.angle = ringRotation
          container.add(ringGfx)
        } else {
          // multi-ring — 4-5 узких колец разного размера
          const ringGfx = this.add.graphics()
          const ringRotation = (rng() - 0.5) * 70
          const N = 4 + Math.floor(rng() * 2)
          for (let i = 0; i < N; i++) {
            const rs = 1.8 + i * 0.3 + rng() * 0.2
            ringGfx.lineStyle(
              (1 + rng() * 1.5) * D,
              i % 2 === 0 ? sys.color : sys.accent,
              0.5 + rng() * 0.3,
            )
            ringGfx.strokeEllipse(
              0,
              0,
              sys.size * rs,
              sys.size * (0.3 + rng() * 0.3),
            )
          }
          ringGfx.angle = ringRotation
          container.add(ringGfx)
        }
        break
      }
      case 'ice': {
        if (variant === 0) {
          // patchy — текущая (ледяные пятна + полярные шапки)
          const patches = 3 + Math.floor(rng() * 5)
          for (let i = 0; i < patches; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.15 + rng() * 0.55)
            const sr = sys.size * (0.06 + rng() * 0.18)
            g.fillStyle(0xffffff, 0.5 + rng() * 0.4)
            g.fillCircle(Math.cos(ang) * dist, Math.sin(ang) * dist, sr)
          }
          if (rng() < 0.6) {
            g.fillStyle(0xffffff, 0.8)
            g.fillEllipse(
              0,
              -sys.size * 0.7,
              sys.size * (0.5 + rng() * 0.4),
              sys.size * 0.18,
            )
            g.fillEllipse(
              0,
              sys.size * 0.7,
              sys.size * (0.4 + rng() * 0.5),
              sys.size * 0.16,
            )
          }
          g.fillStyle(0xffffff, 0.5 + rng() * 0.3)
          const bx = (rng() - 0.5) * sys.size * 0.6
          const by = (rng() - 0.5) * sys.size * 0.6
          g.fillCircle(bx, by, sys.size * (0.12 + rng() * 0.12))
        } else if (variant === 1) {
          // crystalline — грани кристалла
          g.lineStyle(1.5 * D, 0xa5f3fc, 0.8)
          const facets = 5 + Math.floor(rng() * 4)
          for (let i = 0; i < facets; i++) {
            const ang = baseRotation + (i / facets) * Math.PI * 2
            g.lineBetween(
              0,
              0,
              Math.cos(ang) * sys.size * 0.85,
              Math.sin(ang) * sys.size * 0.85,
            )
          }
          // блики на гранях
          for (let i = 0; i < facets; i++) {
            const ang = baseRotation + (i / facets) * Math.PI * 2 + 0.3
            const r = sys.size * 0.55
            g.fillStyle(0xffffff, 0.4 + rng() * 0.3)
            g.fillCircle(
              Math.cos(ang) * r,
              Math.sin(ang) * r,
              sys.size * (0.06 + rng() * 0.06),
            )
          }
          g.fillStyle(0xffffff, 0.6)
          g.fillCircle(0, 0, sys.size * 0.25)
        } else {
          // glacial — трещины во льду
          g.lineStyle(2 * D, 0xbae6fd, 0.6)
          const cracks = 3 + Math.floor(rng() * 3)
          for (let i = 0; i < cracks; i++) {
            const startAng = rng() * Math.PI * 2
            const startR = sys.size * 0.2
            let px = Math.cos(startAng) * startR,
              py = Math.sin(startAng) * startR
            for (let s = 0; s < 4; s++) {
              const a = startAng + (rng() - 0.5) * 0.6
              const r = startR + ((sys.size * 0.7 - startR) * (s + 1)) / 4
              const x = Math.cos(a) * r,
                y = Math.sin(a) * r
              g.lineBetween(px, py, x, y)
              px = x
              py = y
            }
          }
          // Несколько снежных пятен
          const patches = 2 + Math.floor(rng() * 3)
          for (let i = 0; i < patches; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.2 + rng() * 0.4)
            g.fillStyle(0xffffff, 0.5 + rng() * 0.3)
            g.fillCircle(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.07 + rng() * 0.1),
            )
          }
        }
        break
      }
      case 'ocean': {
        if (variant === 0) {
          // cloudy — облака + материки (текущая)
          const clouds = 2 + Math.floor(rng() * 5)
          for (let i = 0; i < clouds; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.25 + rng() * 0.55)
            g.fillStyle(0xffffff, 0.3 + rng() * 0.3)
            g.fillEllipse(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.4 + rng() * 0.5),
              sys.size * (0.15 + rng() * 0.2),
            )
          }
          const continents = Math.floor(rng() * 4)
          for (let i = 0; i < continents; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.1 + rng() * 0.45)
            g.fillStyle(sys.accent, 0.55 + rng() * 0.3)
            g.fillEllipse(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.4 + rng() * 0.4),
              sys.size * (0.25 + rng() * 0.3),
            )
          }
        } else if (variant === 1) {
          // calm — простой синий gradient + минимум deталей
          g.fillStyle(0xffffff, 0.18)
          g.fillEllipse(0, -sys.size * 0.4, sys.size * 1.6, sys.size * 0.5)
          g.fillStyle(0xffffff, 0.12)
          g.fillEllipse(0, sys.size * 0.3, sys.size * 1.4, sys.size * 0.3)
          // Тонкий блик
          g.fillStyle(0xffffff, 0.3 + rng() * 0.2)
          g.fillEllipse(
            -sys.size * 0.3,
            -sys.size * 0.2,
            sys.size * 0.4,
            sys.size * 0.15,
          )
        } else {
          // archipelago — много маленьких островов
          const islands = 8 + Math.floor(rng() * 6)
          for (let i = 0; i < islands; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.15 + rng() * 0.6)
            g.fillStyle(sys.accent, 0.6 + rng() * 0.3)
            g.fillCircle(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.05 + rng() * 0.1),
            )
          }
          // Тонкие следы волн
          g.fillStyle(0xffffff, 0.2)
          g.fillEllipse(0, 0, sys.size * 1.5, sys.size * 0.08)
          g.fillEllipse(0, sys.size * 0.4, sys.size * 1.3, sys.size * 0.07)
        }
        break
      }
      case 'desert': {
        if (variant === 0) {
          // dunes — текущая (полосы дюн + оазисы)
          const dunes = 2 + Math.floor(rng() * 4)
          for (let i = 0; i < dunes; i++) {
            const yOff = (i - dunes / 2 + 0.5) * sys.size * (0.25 + rng() * 0.2)
            g.fillStyle(sys.accent, 0.3 + rng() * 0.3)
            g.fillEllipse(
              0,
              yOff,
              sys.size * (1.3 + rng() * 0.4),
              sys.size * (0.08 + rng() * 0.1),
            )
          }
          if (rng() < 0.4) {
            g.fillStyle(0x16a34a, 0.5)
            const ox = (rng() - 0.5) * sys.size * 0.7
            const oy = (rng() - 0.5) * sys.size * 0.7
            g.fillCircle(ox, oy, sys.size * (0.06 + rng() * 0.1))
          }
        } else if (variant === 1) {
          // canyon — глубокие линии-каньоны
          g.lineStyle((1.5 + rng() * 1) * D, 0x78350f, 0.6)
          const canyons = 3 + Math.floor(rng() * 3)
          for (let i = 0; i < canyons; i++) {
            const ang =
              baseRotation + (i / canyons) * Math.PI * 2 + (rng() - 0.5) * 0.3
            let px = Math.cos(ang) * sys.size * 0.2
            let py = Math.sin(ang) * sys.size * 0.2
            for (let s = 1; s <= 4; s++) {
              const a = ang + (rng() - 0.5) * 0.4
              const r = sys.size * (0.2 + (s / 4) * 0.65)
              const x = Math.cos(a) * r,
                y = Math.sin(a) * r
              g.lineBetween(px, py, x, y)
              px = x
              py = y
            }
          }
          // Несколько песчаных пятен
          for (let i = 0; i < 3; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * rng() * 0.5
            g.fillStyle(sys.accent, 0.4 + rng() * 0.3)
            g.fillCircle(
              Math.cos(a) * d,
              Math.sin(a) * d,
              sys.size * (0.08 + rng() * 0.1),
            )
          }
        } else {
          // oasis — большой зелёный оазис в центре + кольцо песка
          g.fillStyle(0x16a34a, 0.7)
          g.fillCircle(0, 0, sys.size * (0.25 + rng() * 0.15))
          g.fillStyle(0x86efac, 0.5)
          g.fillCircle(0, 0, sys.size * 0.15)
          // Окружающая дюна-кольцо
          g.lineStyle(2 * D, sys.accent, 0.5)
          g.strokeCircle(0, 0, sys.size * (0.5 + rng() * 0.15))
          // 2-3 малых оазиса вокруг
          const small = 2 + Math.floor(rng() * 2)
          for (let i = 0; i < small; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * (0.55 + rng() * 0.25)
            g.fillStyle(0x16a34a, 0.5)
            g.fillCircle(
              Math.cos(a) * d,
              Math.sin(a) * d,
              sys.size * (0.05 + rng() * 0.07),
            )
          }
        }
        break
      }
      case 'lava': {
        // Тёмная корка — общая для всех variant'ов
        g.fillStyle(0x171717, 0.4 + rng() * 0.3)
        g.fillCircle(0, 0, sys.size * 0.95)
        if (variant === 0) {
          // cracked — текущая (трещины + очаги)
          g.lineStyle((1.5 + rng() * 1.5) * D, sys.color, 0.85 + rng() * 0.15)
          const cracks = 3 + Math.floor(rng() * 6)
          for (let i = 0; i < cracks; i++) {
            const ang =
              baseRotation + (i / cracks) * Math.PI * 2 + (rng() - 0.5) * 0.5
            const startR = sys.size * (0.1 + rng() * 0.2)
            const endR = sys.size * (0.7 + rng() * 0.25)
            if (rng() < 0.4) {
              const midR = (startR + endR) / 2
              const midAng = ang + (rng() - 0.5) * 0.3
              g.beginPath()
              g.moveTo(Math.cos(ang) * startR, Math.sin(ang) * startR)
              g.lineTo(Math.cos(midAng) * midR, Math.sin(midAng) * midR)
              g.lineTo(Math.cos(ang) * endR, Math.sin(ang) * endR)
              g.strokePath()
            } else {
              g.lineBetween(
                Math.cos(ang) * startR,
                Math.sin(ang) * startR,
                Math.cos(ang) * endR,
                Math.sin(ang) * endR,
              )
            }
          }
          const pools = 1 + Math.floor(rng() * 3)
          for (let i = 0; i < pools; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * rng() * 0.6
            g.fillStyle(sys.color, 0.8)
            g.fillCircle(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.06 + rng() * 0.15),
            )
          }
        } else if (variant === 1) {
          // volcanoes — точечные вулканы (большие очаги с выпуклым свечением)
          const volcanoes = 3 + Math.floor(rng() * 3)
          for (let i = 0; i < volcanoes; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.2 + rng() * 0.55)
            const cx = Math.cos(ang) * dist
            const cy = Math.sin(ang) * dist
            // Кратер
            g.fillStyle(0x171717, 0.7)
            g.fillCircle(cx, cy, sys.size * (0.12 + rng() * 0.06))
            // Лава внутри
            g.fillStyle(sys.color, 0.95)
            g.fillCircle(cx, cy, sys.size * (0.08 + rng() * 0.05))
            // Свечение
            g.fillStyle(0xfde047, 0.6)
            g.fillCircle(cx, cy, sys.size * 0.04)
          }
          // Тонкие свечения по поверхности
          for (let i = 0; i < 4; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * rng() * 0.5
            g.fillStyle(sys.color, 0.4)
            g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, sys.size * 0.04)
          }
        } else {
          // flowing — реки лавы (длинные изогнутые потоки)
          g.lineStyle((2.5 + rng() * 1.5) * D, sys.color, 0.9)
          const rivers = 2 + Math.floor(rng() * 3)
          for (let r = 0; r < rivers; r++) {
            const startAng = rng() * Math.PI * 2
            let px = Math.cos(startAng) * sys.size * 0.1
            let py = Math.sin(startAng) * sys.size * 0.1
            for (let s = 1; s <= 6; s++) {
              const a = startAng + Math.sin(s * 0.7) * 0.5
              const radius = sys.size * (0.1 + (s / 6) * 0.7)
              const x = Math.cos(a) * radius,
                y = Math.sin(a) * radius
              g.lineBetween(px, py, x, y)
              px = x
              py = y
            }
          }
          // Жёлтые блики на потоках
          g.lineStyle(0.8 * D, 0xfde047, 0.7)
          for (let i = 0; i < 3; i++) {
            const a = rng() * Math.PI * 2
            const r1 = sys.size * (0.2 + rng() * 0.3)
            const r2 = sys.size * (0.5 + rng() * 0.3)
            g.lineBetween(
              Math.cos(a) * r1,
              Math.sin(a) * r1,
              Math.cos(a) * r2,
              Math.sin(a) * r2,
            )
          }
        }
        break
      }
      case 'forest': {
        if (variant === 0) {
          // patches — текущая (материки + реки)
          const continents = 3 + Math.floor(rng() * 5)
          for (let i = 0; i < continents; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.1 + rng() * 0.5)
            g.fillStyle(sys.accent, 0.5 + rng() * 0.3)
            const w = sys.size * (0.3 + rng() * 0.5)
            const h = sys.size * (0.2 + rng() * 0.35)
            g.fillEllipse(Math.cos(ang) * dist, Math.sin(ang) * dist, w, h)
          }
          if (rng() < 0.5) {
            g.lineStyle(1.5 * D, 0x2563eb, 0.5)
            for (let i = 0; i < 2; i++) {
              const a = rng() * Math.PI * 2
              g.lineBetween(
                Math.cos(a) * sys.size * 0.7,
                Math.sin(a) * sys.size * 0.7,
                Math.cos(a + Math.PI) * sys.size * 0.4,
                Math.sin(a + Math.PI) * sys.size * 0.4,
              )
            }
          }
        } else if (variant === 1) {
          // biomes — несколько разноцветных биомов (тропики/тундра/степь)
          const biomeColors = [0x16a34a, 0x4ade80, 0x65a30d, 0xa3e635]
          const biomes = 4 + Math.floor(rng() * 2)
          for (let i = 0; i < biomes; i++) {
            const ang = (i / biomes) * Math.PI * 2 + rng() * 0.4
            const dist = sys.size * (0.25 + rng() * 0.35)
            const tint = biomeColors[Math.floor(rng() * biomeColors.length)]
            g.fillStyle(tint, 0.5 + rng() * 0.3)
            g.fillEllipse(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.35 + rng() * 0.3),
              sys.size * (0.25 + rng() * 0.2),
            )
          }
          // Тонкие облачка
          for (let i = 0; i < 2; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * rng() * 0.5
            g.fillStyle(0xffffff, 0.3)
            g.fillEllipse(
              Math.cos(a) * d,
              Math.sin(a) * d,
              sys.size * 0.3,
              sys.size * 0.1,
            )
          }
        } else {
          // jungle — плотный покров с тёмными прожилками
          g.fillStyle(sys.accent, 0.7)
          g.fillCircle(0, 0, sys.size * 0.85)
          // Тёмные прожилки джунглей
          g.lineStyle(1.5 * D, 0x14532d, 0.6)
          const veins = 5 + Math.floor(rng() * 4)
          for (let i = 0; i < veins; i++) {
            const ang = rng() * Math.PI * 2
            const r1 = sys.size * 0.1
            const r2 = sys.size * (0.6 + rng() * 0.2)
            let px = Math.cos(ang) * r1,
              py = Math.sin(ang) * r1
            for (let s = 1; s <= 3; s++) {
              const a = ang + (rng() - 0.5) * 0.5
              const r = r1 + (r2 - r1) * (s / 3)
              const x = Math.cos(a) * r,
                y = Math.sin(a) * r
              g.lineBetween(px, py, x, y)
              px = x
              py = y
            }
          }
          // Светлые проплешины
          for (let i = 0; i < 3; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * (0.3 + rng() * 0.3)
            g.fillStyle(0xa3e635, 0.5)
            g.fillCircle(
              Math.cos(a) * d,
              Math.sin(a) * d,
              sys.size * (0.05 + rng() * 0.07),
            )
          }
        }
        break
      }
      case 'mineral': {
        if (variant === 0) {
          // faceted — текущая (грани + жилы)
          g.lineStyle((0.8 + rng() * 1) * D, 0xffffff, 0.4 + rng() * 0.3)
          const facets = 3 + Math.floor(rng() * 5)
          for (let i = 0; i < facets; i++) {
            const ang = baseRotation + (i / facets) * Math.PI * 2
            g.lineBetween(
              0,
              0,
              Math.cos(ang) * sys.size * (0.7 + rng() * 0.2),
              Math.sin(ang) * sys.size * (0.7 + rng() * 0.2),
            )
          }
          const veins = 2 + Math.floor(rng() * 3)
          for (let i = 0; i < veins; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * rng() * 0.5
            g.fillStyle(sys.color, 0.7 + rng() * 0.2)
            g.fillCircle(
              Math.cos(ang) * dist,
              Math.sin(ang) * dist,
              sys.size * (0.08 + rng() * 0.13),
            )
          }
        } else if (variant === 1) {
          // veined — преимущественно жилы металла без граней
          const veinLines = 4 + Math.floor(rng() * 3)
          g.lineStyle((1.2 + rng()) * D, sys.color, 0.7)
          for (let i = 0; i < veinLines; i++) {
            const a1 = rng() * Math.PI * 2
            const r1 = sys.size * 0.1
            let px = Math.cos(a1) * r1,
              py = Math.sin(a1) * r1
            for (let s = 1; s <= 4; s++) {
              const a = a1 + (rng() - 0.5) * 0.7
              const r = r1 + (sys.size * 0.7 - r1) * (s / 4)
              const x = Math.cos(a) * r,
                y = Math.sin(a) * r
              g.lineBetween(px, py, x, y)
              px = x
              py = y
            }
          }
          // Несколько ярких узлов на жилах
          for (let i = 0; i < 4; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * (0.2 + rng() * 0.4)
            g.fillStyle(0xfde047, 0.7)
            g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, sys.size * 0.05)
          }
        } else {
          // raw — необработанная неравномерная поверхность с вкраплениями
          // Тёмные неровности
          for (let i = 0; i < 8; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * rng() * 0.7
            g.fillStyle(0x1f2937, 0.5)
            g.fillCircle(
              Math.cos(a) * d,
              Math.sin(a) * d,
              sys.size * (0.06 + rng() * 0.08),
            )
          }
          // Яркие кристаллы
          const crystals = 5 + Math.floor(rng() * 4)
          for (let i = 0; i < crystals; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * rng() * 0.65
            const x = Math.cos(a) * d,
              y = Math.sin(a) * d
            const r = sys.size * (0.04 + rng() * 0.07)
            g.fillStyle(sys.color, 0.85)
            g.fillTriangle(
              x,
              y - r,
              x - r * 0.7,
              y + r * 0.5,
              x + r * 0.7,
              y + r * 0.5,
            )
          }
        }
        break
      }
      case 'dead': {
        if (variant === 0) {
          // cratered — текущая (множество кратеров)
          const craters = 5 + Math.floor(rng() * 6)
          for (let i = 0; i < craters; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * (0.1 + rng() * 0.7)
            const r = sys.size * (0.05 + rng() * 0.18)
            g.fillStyle(sys.accent, 0.7 + rng() * 0.3)
            g.fillCircle(Math.cos(ang) * dist, Math.sin(ang) * dist, r)
            if (rng() < 0.4) {
              g.lineStyle(1 * D, 0x000000, 0.35)
              g.strokeCircle(
                Math.cos(ang) * dist,
                Math.sin(ang) * dist,
                r * 0.85,
              )
            }
            g.fillStyle(0xffffff, 0.1 + rng() * 0.15)
            g.fillCircle(
              Math.cos(ang) * dist - r * 0.35,
              Math.sin(ang) * dist - r * 0.35,
              r * 0.5,
            )
          }
        } else if (variant === 1) {
          // scarred — крупные шрамы и трещины
          g.lineStyle((1.5 + rng() * 1.5) * D, 0x4b5563, 0.7)
          const scars = 4 + Math.floor(rng() * 3)
          for (let i = 0; i < scars; i++) {
            const a1 = rng() * Math.PI * 2
            const a2 = a1 + Math.PI + (rng() - 0.5) * 0.8
            const r = sys.size * 0.65
            g.lineBetween(
              Math.cos(a1) * r,
              Math.sin(a1) * r,
              Math.cos(a2) * r,
              Math.sin(a2) * r,
            )
          }
          // 2-3 крупных кратера
          for (let i = 0; i < 3; i++) {
            const a = rng() * Math.PI * 2
            const d = sys.size * (0.3 + rng() * 0.3)
            const r = sys.size * (0.1 + rng() * 0.1)
            g.fillStyle(0x111827, 0.6)
            g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, r)
            g.lineStyle(1 * D, 0x000000, 0.5)
            g.strokeCircle(Math.cos(a) * d, Math.sin(a) * d, r)
          }
        } else {
          // bare — редкие мелкие кратеры, гладкая монотонная поверхность
          const craters = 2 + Math.floor(rng() * 3)
          for (let i = 0; i < craters; i++) {
            const ang = rng() * Math.PI * 2
            const dist = sys.size * rng() * 0.6
            const r = sys.size * (0.03 + rng() * 0.07)
            g.fillStyle(sys.accent, 0.6)
            g.fillCircle(Math.cos(ang) * dist, Math.sin(ang) * dist, r)
          }
          // Тонкая текстура
          g.fillStyle(0x000000, 0.1)
          g.fillEllipse(0, sys.size * 0.4, sys.size * 1.2, sys.size * 0.15)
          g.fillEllipse(0, -sys.size * 0.4, sys.size * 1.0, sys.size * 0.12)
        }
        break
      }
      case 'toxic': {
        // Облака яда + пузыри + waste
        const clouds = 2 + Math.floor(rng() * 4)
        for (let i = 0; i < clouds; i++) {
          const ang = rng() * Math.PI * 2
          const dist = sys.size * (0.2 + rng() * 0.55)
          const cloudColor = rng() < 0.5 ? 0x86efac : 0xfde68a
          g.fillStyle(cloudColor, 0.3 + rng() * 0.25)
          g.fillEllipse(
            Math.cos(ang) * dist,
            Math.sin(ang) * dist,
            sys.size * (0.4 + rng() * 0.4),
            sys.size * (0.15 + rng() * 0.25),
          )
        }
        // Пузыри разных размеров
        const bubbles = 1 + Math.floor(rng() * 4)
        for (let i = 0; i < bubbles; i++) {
          const ang = rng() * Math.PI * 2
          const dist = sys.size * rng() * 0.55
          g.fillStyle(sys.color, 0.65 + rng() * 0.25)
          g.fillCircle(
            Math.cos(ang) * dist,
            Math.sin(ang) * dist,
            sys.size * (0.08 + rng() * 0.18),
          )
          g.fillStyle(0xffffff, 0.25)
          g.fillCircle(
            Math.cos(ang) * dist - sys.size * 0.04,
            Math.sin(ang) * dist - sys.size * 0.04,
            sys.size * 0.05,
          )
        }
        break
      }
      case 'plasma': {
        // Случайное количество лучей
        const rays = 4 + Math.floor(rng() * 6)
        g.lineStyle((1.5 + rng() * 2) * D, sys.color, 0.7 + rng() * 0.3)
        for (let i = 0; i < rays; i++) {
          const ang =
            baseRotation + (i / rays) * Math.PI * 2 + (rng() - 0.5) * 0.4
          const innerR = sys.size * (0.4 + rng() * 0.2)
          const outerR = sys.size * (1.0 + rng() * 0.5)
          g.lineBetween(
            Math.cos(ang) * innerR,
            Math.sin(ang) * innerR,
            Math.cos(ang) * outerR,
            Math.sin(ang) * outerR,
          )
        }
        // Многослойное ядро
        g.fillStyle(sys.color, 0.85 + rng() * 0.15)
        g.fillCircle(0, 0, sys.size * (0.55 + rng() * 0.2))
        g.fillStyle(0xffffff, 0.7 + rng() * 0.25)
        g.fillCircle(0, 0, sys.size * (0.25 + rng() * 0.18))
        break
      }
      case 'binary': {
        // Два соприкасающихся шара разных размеров
        const r1 = sys.size * (0.45 + rng() * 0.2)
        const r2 = sys.size * (0.4 + rng() * 0.2)
        const offset1 = sys.size * (0.3 + rng() * 0.2)
        const ang = baseRotation
        const cx1 = Math.cos(ang) * -offset1
        const cy1 = Math.sin(ang) * -offset1
        const cx2 = Math.cos(ang) * offset1
        const cy2 = Math.sin(ang) * offset1
        g.fillStyle(sys.color, 0.9 + rng() * 0.1)
        g.fillCircle(cx1, cy1, r1)
        // Второй шар — отдельный hue
        const altPalette = generatePalette(sys.archetype, rng)
        g.fillStyle(altPalette.color, 0.9 + rng() * 0.1)
        g.fillCircle(cx2, cy2, r2)
        // Перешеек/гало
        g.fillStyle(0xffffff, 0.2 + rng() * 0.2)
        g.fillEllipse(0, 0, sys.size * (0.3 + rng() * 0.2), sys.size * 0.15)
        break
      }
    }

    // === УНИВЕРСАЛЬНЫЕ МОДИФИКАТОРЫ ПОВЕРХ ===
    // Случайные дополнения: процент планет получают неожиданные элементы,
    // чтобы планеты одного архетипа выглядели РАЗНЫМИ.
    // Phase 7: 6 новых modifier'ов добавлены первыми (их флаги в signature).

    // Phase 7 #1: Surface lines — тонкие меридианы по поверхности (15%)
    if (rng() < 0.15) {
      g.lineStyle(0.6 * D, sys.color, 0.4)
      const lines = 2 + Math.floor(rng() * 3)
      for (let i = 0; i < lines; i++) {
        const yOff = (i - lines / 2 + 0.5) * sys.size * 0.35
        const w = sys.size * Math.cos(((yOff / sys.size) * Math.PI) / 2) * 1.6
        if (w > 0) g.strokeEllipse(0, yOff, w, sys.size * 0.12)
      }
    }

    // Phase 7 #2: Gradient bands — плавный gradient полосы (12%)
    if (rng() < 0.12) {
      const bandY = (rng() - 0.5) * sys.size * 0.5
      for (let i = 0; i < 5; i++) {
        g.fillStyle(rng() < 0.5 ? sys.color : sys.accent, 0.05 + i * 0.03)
        g.fillEllipse(0, bandY, sys.size * 1.6, sys.size * (0.15 - i * 0.02))
      }
    }

    // Phase 7 #3: Multi-color spots — кластеры мелких пятен случайных hue (15%)
    if (rng() < 0.15) {
      const colors = [0xfde047, 0xa5f3fc, 0x86efac, 0xfca5a5, 0xc4b5fd]
      const clusters = 1 + Math.floor(rng() * 2)
      for (let c = 0; c < clusters; c++) {
        const cAng = rng() * Math.PI * 2
        const cDist = sys.size * (0.3 + rng() * 0.4)
        const cx = Math.cos(cAng) * cDist
        const cy = Math.sin(cAng) * cDist
        const tint = colors[Math.floor(rng() * colors.length)]
        for (let i = 0; i < 3 + Math.floor(rng() * 3); i++) {
          const dx = (rng() - 0.5) * sys.size * 0.3
          const dy = (rng() - 0.5) * sys.size * 0.3
          g.fillStyle(tint, 0.5 + rng() * 0.3)
          g.fillCircle(cx + dx, cy + dy, sys.size * (0.04 + rng() * 0.06))
        }
      }
    }

    // Phase 7 #4: Stacked rings — 2-3 кольца разного диаметра/наклона (8%)
    if (
      sys.archetype !== 'gas_ringed' &&
      sys.archetype !== 'binary' &&
      rng() < 0.08
    ) {
      const n = 2 + Math.floor(rng() * 2)
      for (let i = 0; i < n; i++) {
        const ringGfx = this.add.graphics()
        ringGfx.lineStyle(
          (0.8 + rng()) * D,
          i % 2 === 0 ? sys.color : sys.accent,
          0.3 + rng() * 0.3,
        )
        ringGfx.strokeEllipse(
          0,
          0,
          sys.size * (2.0 + i * 0.4),
          sys.size * (0.3 + rng() * 0.4),
        )
        ringGfx.angle = (rng() - 0.5) * 90
        container.add(ringGfx)
      }
    }

    // Phase 7 #5: Asymmetric atmosphere — aura эллипсом / капсулой (20%)
    if (showAura && rng() < 0.2) {
      const ax = sys.size * (1.6 + rng() * 0.4)
      const ay = sys.size * (1.0 + rng() * 0.3)
      g.fillStyle(sys.color, 0.08 * sys.brightness)
      g.fillEllipse(0, 0, ax * 2, ay * 2)
    }

    // Phase 7 #6: Color speckle — мелкие пиксели-точки случайных hue по поверхности (25%)
    if (rng() < 0.25) {
      const N = 8 + Math.floor(rng() * 12)
      for (let i = 0; i < N; i++) {
        const ang = rng() * Math.PI * 2
        const r = sys.size * Math.sqrt(rng()) * 0.85
        const tint = rng() < 0.5 ? sys.color : sys.accent
        g.fillStyle(tint, 0.4 + rng() * 0.4)
        g.fillCircle(
          Math.cos(ang) * r,
          Math.sin(ang) * r,
          (0.5 + rng() * 1) * D,
        )
      }
    }

    // Кратер на не-dead планете (12%)
    if (sys.archetype !== 'dead' && rng() < 0.12) {
      const ang = rng() * Math.PI * 2
      const dist = sys.size * (0.3 + rng() * 0.5)
      const cr = sys.size * (0.08 + rng() * 0.12)
      g.fillStyle(0x000000, 0.5)
      g.fillCircle(Math.cos(ang) * dist, Math.sin(ang) * dist, cr)
    }

    // Тонкое кольцо у любой планеты (~22%) — может быть очень тонкое или толстое
    if (
      sys.archetype !== 'gas_ringed' &&
      sys.archetype !== 'binary' &&
      rng() < 0.22
    ) {
      const ringGfx = this.add.graphics()
      const ringW = (0.8 + rng() * 2.5) * D
      const ringAlpha = 0.3 + rng() * 0.5
      const ringTint =
        rng() < 0.6 ? sys.color : rng() < 0.5 ? sys.accent : 0xffffff
      ringGfx.lineStyle(ringW, ringTint, ringAlpha)
      ringGfx.strokeEllipse(
        0,
        0,
        sys.size * (2.0 + rng() * 0.8),
        sys.size * (0.3 + rng() * 0.6),
      )
      ringGfx.angle = (rng() - 0.5) * 90
      container.add(ringGfx)
      // Иногда — двойное кольцо
      if (rng() < 0.3) {
        ringGfx.lineStyle(ringW * 0.6, ringTint, ringAlpha * 0.7)
        ringGfx.strokeEllipse(
          0,
          0,
          sys.size * (2.5 + rng() * 0.5),
          sys.size * (0.4 + rng() * 0.4),
        )
      }
    }

    // Тёмный пояс в виде эллипса (12%)
    if (rng() < 0.12) {
      g.fillStyle(0x000000, 0.15 + rng() * 0.15)
      g.fillEllipse(
        0,
        (rng() - 0.5) * sys.size * 0.4,
        sys.size * (1.3 + rng() * 0.4),
        sys.size * (0.06 + rng() * 0.08),
      )
    }

    // Яркое пятно (~12%) — бури, огни цивилизации
    if (rng() < 0.12) {
      const spotColor = [0xfde047, 0xffffff, 0xa5f3fc, 0xfca5a5, 0xc4b5fd][
        Math.floor(rng() * 5)
      ]
      const ang = rng() * Math.PI * 2
      const dist = sys.size * rng() * 0.6
      g.fillStyle(spotColor, 0.5 + rng() * 0.3)
      g.fillCircle(
        Math.cos(ang) * dist,
        Math.sin(ang) * dist,
        sys.size * (0.05 + rng() * 0.1),
      )
      // Иногда — кластер огоньков
      if (rng() < 0.5) {
        for (let i = 0; i < 2 + Math.floor(rng() * 3); i++) {
          const ang2 = ang + (rng() - 0.5) * 0.6
          const dist2 = dist + (rng() - 0.5) * sys.size * 0.2
          g.fillStyle(spotColor, 0.4 + rng() * 0.3)
          g.fillCircle(
            Math.cos(ang2) * dist2,
            Math.sin(ang2) * dist2,
            sys.size * (0.03 + rng() * 0.05),
          )
        }
      }
    }

    // Тёмная сторона (полусфера тени) — 35% планет получают 3D-эффект
    if (rng() < 0.35) {
      const shadowAng = rng() * Math.PI * 2
      const sx = Math.cos(shadowAng) * sys.size * 0.35
      const sy = Math.sin(shadowAng) * sys.size * 0.35
      g.fillStyle(0x000000, 0.18 + rng() * 0.15)
      g.fillCircle(sx, sy, sys.size * (0.85 + rng() * 0.1))
    }

    // Мини-блик (~50%) для объёма — позиция и размер вариативны
    if (rng() < 0.5) {
      const blickAng = (1.0 + rng() * 0.8) * Math.PI // верхне-левый сектор
      const blickDist = sys.size * (0.35 + rng() * 0.2)
      g.fillStyle(0xffffff, 0.15 + rng() * 0.2)
      g.fillEllipse(
        Math.cos(blickAng) * blickDist,
        Math.sin(blickAng) * blickDist,
        sys.size * (0.3 + rng() * 0.25),
        sys.size * (0.2 + rng() * 0.15),
      )
    }

    // === ФИНАЛЬНЫЕ ТРАНСФОРМАЦИИ G — главный источник разнообразия ===
    // Каждая планета получает случайный поворот всего рисунка + асимметричный scale.
    // Это означает что две планеты одного архетипа НЕ выглядят одинаково.
    g.rotation = rng() * Math.PI * 2
    const aspectX = 0.85 + rng() * 0.3 // 0.85-1.15
    const aspectY = 0.85 + rng() * 0.3
    g.scaleX = aspectX
    g.scaleY = aspectY

    // Спутник у некоторых планет — обновляется в общем update-loop scene,
    // чтобы один раз проверить zoom-порог и пропустить орбит-калькуляцию при отдалении.
    if (sys.hasMoon) {
      const moon = this.add.circle(
        sys.size * 1.4,
        -sys.size * 0.3,
        sys.size * 0.18,
        0xe5e7eb,
        0.85,
      )
      container.add(moon)
      this.moons.push({
        obj: moon,
        angle: rng() * Math.PI * 2,
        radius: sys.size * 1.5,
        speed: 0.3 + rng() * 0.3,
      })
    }

    // Маркер обитаемости — над планетой значок цивилизации
    if (sys.isInhabited) {
      // Контур-кольцо подсвечивает обитаемую планету
      g.lineStyle(1.5 * DPR, 0xfde047, 0.6)
      g.strokeCircle(0, 0, sys.size + 4 * DPR)
      // Значок цивилизации
      const civIcons = ['🏛', '📡', '⚙', '🛰', '🏯', '🪐']
      const icon = civIcons[Math.floor(rng() * civIcons.length)]
      const tag = this.add.text(0, -sys.size - 14 * DPR, icon, {
        fontSize: 14 * DPR,
      })
      tag.setOrigin(0.5)
      container.add(tag)
    }

    // Idle-анимации у фоновых планет ОТКЛЮЧЕНЫ — было 454 активных tween (227 × 2),
    // что создавало просадки FPS при zoom. Только для главных рас оставлены анимации.
    // Исключение: ~4% от 1000 фоновых планет (≈40) получают очень медленное вращение
    // (60-120s/оборот). Отдельный rng от seed — не влияет на порядок rng() выше,
    // на котором завязан texture signature.
    const rotRng = mulberry32((sys.rngSeed ^ 0xdeadbeef) >>> 0)
    if (rotRng() < 0.04) {
      const dir = rotRng() < 0.5 ? -1 : 1
      const periodMs = 60000 + Math.floor(rotRng() * 60000)
      this.tweens.add({
        targets: container,
        rotation: dir * Math.PI * 2,
        duration: periodMs,
        repeat: -1,
        ease: 'Linear',
      })
    }
    void rng // подавить unused warning

    // Интерактивность для всех планет — тапы вызывают squish + эмоцию
    const baseR = sys.size + 6 * DPR
    const hitArea = new Phaser.Geom.Circle(0, 0, baseR)
    container.setInteractive(hitArea, Phaser.Geom.Circle.Contains)
    let downTime = 0
    let downX = 0,
      downY = 0
    let springTween: Phaser.Tweens.Tween | null = null
    container.on('pointerdown', (p: Phaser.Input.Pointer) => {
      downTime = Date.now()
      downX = p.x
      downY = p.y
    })
    container.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dt = Date.now() - downTime
      const moved = Math.abs(p.x - downX) + Math.abs(p.y - downY)
      if (dt < 300 && moved < 8 * DPR) {
        this.tapHandledThisFrame = true
        eventBus.emit('starmap:planet-select', {
          planetId: sys.id,
          name: sys.name,
          archetype: (sys as BgSystem).archetype ?? '',
        })
        this.handlePlanetPress(sys)
        this.selectSystem(sys)
        // BG: показать модалку с именем через 400ms
        this.scheduleBgNamePopup(sys)
        // Spring-анимация: squish по вертикали → bounce, как у лягушек
        if (springTween) {
          springTween.stop()
          springTween = null
        }
        container.scaleY = 1.0
        springTween = this.tweens.add({
          targets: container,
          scaleY: 0.78,
          duration: 55,
          ease: 'Power2.easeIn',
          onComplete: () => {
            springTween = this.tweens.add({
              targets: container,
              scaleY: 1.0,
              duration: 150,
              ease: 'Back.easeOut',
              onComplete: () => {
                springTween = null
              },
            })
          },
        })
      }
    })

    this.systemSprites.set(sys.id, container)
    // Регистрируем для batch-toggle interactive по zoom
    this.bgInteractiveContainers.push(container)
    // BG-планеты получают LOD: при zoom < BG_PLANET_MIN_ZOOM скрываются полностью
    this.cullableData.push({
      obj: container,
      x: sys.x,
      y: sys.y,
      r: sys.size * 2,
      lodMinZoom: BG_PLANET_MIN_ZOOM,
    })
    // Адаптивный hit-area — растёт при zoom-out, чтобы было удобно тапать
    this.mainPlanetHits.push({ container, baseR, circle: hitArea })
  }

  // worldToDom — extracted в './starmap/helpers.ts' (Phase 20-01).

  // ============== PHASER POPOVER ==============

  private closePhaserPopover() {
    if (this.popover) {
      this.popover.destroy(true)
      this.popover = undefined
    }
  }

  // === BG NAME POPUP — простая модалка с именем планеты ===
  private closeBgNamePopup() {
    if (this.bgNamePopupTimer) {
      this.bgNamePopupTimer.remove()
      this.bgNamePopupTimer = undefined
    }
    if (this.bgNamePopup) {
      this.bgNamePopup.destroy(true)
      this.bgNamePopup = undefined
    }
  }

  // Открывает popup с именем BG-планеты с задержкой (даём анимации сыграть).
  private scheduleBgNamePopup(sys: BgSystem) {
    this.closeBgNamePopup()
    // Задержка ~400ms чтобы не наслаивать на анимацию клика
    this.bgNamePopupTimer = this.time.delayedCall(400, () => {
      this.openBgNamePopup(sys)
    })
  }

  private openBgNamePopup(sys: BgSystem) {
    const PADDING_X = 14 * DPR
    const PADDING_Y = 8 * DPR
    const offsetY = -(sys.size + 70 * DPR) // над планетой

    const container = this.add.container(sys.x, sys.y + offsetY)
    container.setDepth(1500)
    this.bgNamePopup = container

    // Текст имени
    const nameText = this.add.text(0, 0, sys.name, {
      fontFamily: 'Russo One, system-ui, sans-serif',
      fontSize: `${13 * DPR}px`,
      color: '#fef9d7',
      stroke: '#1f2a14',
      strokeThickness: 2 * DPR,
    })
    nameText.setOrigin(0.5, 0.5)

    // Подпись типа (resource/hostile/empty + archetype)
    const typeLabel = `${sys.type} · ${sys.archetype}`
    const subText = this.add.text(0, 14 * DPR, typeLabel, {
      fontFamily: 'Nunito, system-ui, sans-serif',
      fontSize: `${9 * DPR}px`,
      color: '#a3e635',
    })
    subText.setOrigin(0.5, 0.5)

    // Фон-капсула
    const w = Math.max(nameText.width, subText.width) + PADDING_X * 2
    const h = nameText.height + subText.height + PADDING_Y * 2 + 4
    const bg = this.add.graphics()
    bg.fillStyle(0x1f2a14, 0.92)
    bg.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 8 * DPR)
    bg.lineStyle(1.5 * DPR, 0xa3e635, 0.6)
    bg.strokeRoundedRect(-w / 2, -h / 2 + 4, w, h, 8 * DPR)

    container.add(bg)
    container.add(nameText)
    container.add(subText)

    // Кнопка действия под капсулой: «Изучить» если здесь, «Лететь» иначе.
    const shipState = useGameStore.getState().ship
    const isCurrentPlanet =
      shipState?.state === 'docked' && shipState.planetId === sys.id
    const isInTransit = shipState?.state === 'transit'
    const BTN_W = 76 * DPR
    const BTN_H = 22 * DPR
    const BTN_Y = h / 2 + 4 + 6 * DPR + BTN_H / 2

    if (isCurrentPlanet) {
      const canInvestigate =
        (useGameStore.getState().crew?.missionsToday ?? 0) < DAILY_CAP
      const btnBg = this.add.graphics()
      btnBg.fillStyle(canInvestigate ? 0xd97706 : 0x374151, 1)
      btnBg.fillRoundedRect(
        -BTN_W / 2,
        BTN_Y - BTN_H / 2,
        BTN_W,
        BTN_H,
        5 * DPR,
      )
      if (canInvestigate) {
        btnBg.lineStyle(1.5 * DPR, 0xfbbf24, 0.7)
        btnBg.strokeRoundedRect(
          -BTN_W / 2,
          BTN_Y - BTN_H / 2,
          BTN_W,
          BTN_H,
          5 * DPR,
        )
        btnBg.setInteractive(
          new Phaser.Geom.Rectangle(
            -BTN_W / 2,
            BTN_Y - BTN_H / 2,
            BTN_W,
            BTN_H,
          ),
          Phaser.Geom.Rectangle.Contains,
        )
        let btnDownTime = 0
        btnBg.on(
          'pointerdown',
          (
            _p: unknown,
            _lx: unknown,
            _ly: unknown,
            ev: Phaser.Types.Input.EventData,
          ) => {
            btnDownTime = Date.now()
            ev.stopPropagation()
          },
        )
        btnBg.on(
          'pointerup',
          (
            _p: unknown,
            _lx: unknown,
            _ly: unknown,
            ev: Phaser.Types.Input.EventData,
          ) => {
            ev.stopPropagation()
            if (Date.now() - btnDownTime < 400) {
              this.tapHandledThisFrame = true
              const ok = useGameStore
                .getState()
                .investigatePlanet(sys.id, 'good')
              if (ok)
                eventBus.emit('cosmic:toast', {
                  type: 'generic',
                  msg: '📦 Бокс получен!',
                })
              this.closeBgNamePopup()
            }
          },
        )
      }
      const btnText = this.add.text(
        0,
        BTN_Y,
        canInvestigate ? '🔬 Изучить' : '⏱ Устал',
        {
          fontFamily: 'Nunito, system-ui, sans-serif',
          fontSize: `${9 * DPR}px`,
          color: canInvestigate ? '#ffffff' : '#9ca3af',
          fontStyle: 'bold',
        },
      )
      btnText.setOrigin(0.5, 0.5)
      container.add(btnBg)
      container.add(btnText)
    } else if (!isInTransit) {
      const btnBg = this.add.graphics()
      btnBg.fillStyle(0x16a34a, 1)
      btnBg.fillRoundedRect(
        -BTN_W / 2,
        BTN_Y - BTN_H / 2,
        BTN_W,
        BTN_H,
        5 * DPR,
      )
      btnBg.lineStyle(1.5 * DPR, 0x4ade80, 0.7)
      btnBg.strokeRoundedRect(
        -BTN_W / 2,
        BTN_Y - BTN_H / 2,
        BTN_W,
        BTN_H,
        5 * DPR,
      )
      btnBg.setInteractive(
        new Phaser.Geom.Rectangle(-BTN_W / 2, BTN_Y - BTN_H / 2, BTN_W, BTN_H),
        Phaser.Geom.Rectangle.Contains,
      )
      let btnDownTime = 0
      btnBg.on(
        'pointerdown',
        (
          _p: unknown,
          _lx: unknown,
          _ly: unknown,
          ev: Phaser.Types.Input.EventData,
        ) => {
          btnDownTime = Date.now()
          ev.stopPropagation()
        },
      )
      btnBg.on(
        'pointerup',
        (
          _p: unknown,
          _lx: unknown,
          _ly: unknown,
          ev: Phaser.Types.Input.EventData,
        ) => {
          ev.stopPropagation()
          if (Date.now() - btnDownTime < 400) {
            this.tapHandledThisFrame = true
            this.closeBgNamePopup()
            useGameStore.getState().sendShipTo(sys.id)
          }
        },
      )
      const btnText = this.add.text(0, BTN_Y, '🚀 Лететь', {
        fontFamily: 'Nunito, system-ui, sans-serif',
        fontSize: `${9 * DPR}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      btnText.setOrigin(0.5, 0.5)
      container.add(btnBg)
      container.add(btnText)
    }

    // Blocking zone — absorbs taps on the popup background so they don't fall
    // through to the planet container underneath (which would re-schedule the popup).
    // Zone at index 0 (lowest depth) → receives events AFTER buttons (buttons
    // already call ev.stopPropagation(), so zone only fires for background taps).
    {
      const ZONE_TOP = -(h / 2 + PADDING_Y)
      const ZONE_BOTTOM = BTN_Y + BTN_H / 2 + PADDING_Y
      const blockZone = this.add.zone(
        0,
        (ZONE_TOP + ZONE_BOTTOM) / 2,
        w + PADDING_X * 2,
        ZONE_BOTTOM - ZONE_TOP,
      )
      blockZone.setInteractive()
      blockZone.on(
        'pointerdown',
        (
          _p: unknown,
          _lx: unknown,
          _ly: unknown,
          ev: Phaser.Types.Input.EventData,
        ) => {
          this.tapHandledThisFrame = true
          ev.stopPropagation()
        },
      )
      blockZone.on(
        'pointerup',
        (
          _p: unknown,
          _lx: unknown,
          _ly: unknown,
          ev: Phaser.Types.Input.EventData,
        ) => {
          this.tapHandledThisFrame = true
          ev.stopPropagation()
        },
      )
      container.addAt(blockZone, 0)
    }

    // Compensation zoom — popup всегда фиксированного размера на экране
    const cam = this.cameras.main
    container.setScale(Math.max(0.3, 1 / cam.zoom))

    // Appear-анимация: fade-in + slight slide вверх
    container.setAlpha(0)
    container.y += 6 * DPR
    this.tweens.add({
      targets: container,
      alpha: 1,
      y: container.y - 6 * DPR,
      duration: 220,
      ease: 'Cubic.easeOut',
    })

    // Auto-close через 3.5 сек
    this.bgNamePopupTimer = this.time.delayedCall(3500, () => {
      if (!this.bgNamePopup) return
      this.tweens.add({
        targets: this.bgNamePopup,
        alpha: 0,
        duration: 200,
        onComplete: () => this.closeBgNamePopup(),
      })
    })
  }

  private openPhaserPopover(race: Race, placement: 'below' | 'above') {
    this.closePhaserPopover()
    const sign = placement === 'below' ? 1 : -1
    // Все размеры — в physical pixels (× DPR), потом scale-compensation вернёт screen-size
    const ARROW_OFFSET = 32 * DPR * sign
    const ARROW_H = 14 * DPR
    const ARROW_W = 11 * DPR
    const PANEL_W = 200 * DPR
    const PANEL_H = 190 * DPR
    const panelStart =
      placement === 'below'
        ? ARROW_OFFSET + ARROW_H
        : ARROW_OFFSET - ARROW_H - PANEL_H

    // Container привязан к world-coords планеты. setScale(1/zoom) каждый кадр.
    const container = this.add.container(race.x, race.y)
    container.setDepth(1500)
    this.popover = container

    // Стрелка — двойной слой (тёмный border + кремовая заливка)
    const arrow = this.add.graphics()
    if (placement === 'below') {
      arrow.fillStyle(0x4d6b1f, 1)
      arrow.fillTriangle(
        0,
        ARROW_OFFSET,
        -ARROW_W,
        ARROW_OFFSET + ARROW_H,
        ARROW_W,
        ARROW_OFFSET + ARROW_H,
      )
      arrow.fillStyle(0xf5fbe9, 1)
      arrow.fillTriangle(
        0,
        ARROW_OFFSET + 4,
        -ARROW_W * 0.65,
        ARROW_OFFSET + ARROW_H,
        ARROW_W * 0.65,
        ARROW_OFFSET + ARROW_H,
      )
    } else {
      arrow.fillStyle(0x4d6b1f, 1)
      arrow.fillTriangle(
        0,
        ARROW_OFFSET,
        -ARROW_W,
        ARROW_OFFSET - ARROW_H,
        ARROW_W,
        ARROW_OFFSET - ARROW_H,
      )
      arrow.fillStyle(0xf5fbe9, 1)
      arrow.fillTriangle(
        0,
        ARROW_OFFSET - 4,
        -ARROW_W * 0.65,
        ARROW_OFFSET - ARROW_H,
        ARROW_W * 0.65,
        ARROW_OFFSET - ARROW_H,
      )
    }
    container.add(arrow)

    // Панель — кремовый ff-panel со стилем
    const panel = this.add.graphics()
    // Глубокая тень снизу
    panel.fillStyle(0x2f4413, 1)
    panel.fillRoundedRect(
      -PANEL_W / 2 - 3,
      panelStart - 3,
      PANEL_W + 6,
      PANEL_H + 12,
      14,
    )
    // Outer border
    panel.fillStyle(0x4d6b1f, 1)
    panel.fillRoundedRect(
      -PANEL_W / 2 - 3,
      panelStart - 3,
      PANEL_W + 6,
      PANEL_H + 6,
      14,
    )
    // Inner panel
    panel.fillStyle(0xf5fbe9, 1)
    panel.fillRoundedRect(
      -PANEL_W / 2 + 1,
      panelStart + 1,
      PANEL_W - 2,
      PANEL_H - 2,
      12,
    )
    // Inset highlight
    panel.fillStyle(0xf7ffe0, 0.5)
    panel.fillRoundedRect(-PANEL_W / 2 + 3, panelStart + 3, PANEL_W - 6, 4, 4)
    container.add(panel)

    // Заголовок
    const title = this.add.text(0, panelStart + 14 * DPR, race.name, {
      fontFamily: 'Russo One, system-ui, sans-serif',
      fontSize: `${18 * DPR}px`,
      color: '#dc2626',
      stroke: '#ffffff',
      strokeThickness: 3 * DPR,
    })
    title.setOrigin(0.5, 0)
    container.add(title)

    // Тип
    const typeLabel = TYPE_LABELS[race.type] || race.type
    const subtitle = this.add.text(0, panelStart + 42 * DPR, typeLabel, {
      fontFamily: 'Nunito, system-ui, sans-serif',
      fontSize: `${12 * DPR}px`,
      color: '#4d6b1f',
      fontStyle: 'bold',
    })
    subtitle.setOrigin(0.5, 0)
    container.add(subtitle)

    // Кнопки — в стиле ff-btn
    const btnX = 0
    const btnY1 = panelStart + 70 * DPR
    const btnH = 32 * DPR
    const btnGap = 6 * DPR
    const btnW = PANEL_W - 18 * DPR

    const btn1 = this.makePhaserButton(
      btnX,
      btnY1,
      btnW,
      btnH,
      '📡',
      'Связаться',
      0xbef264,
      0x65a30d,
      0x365314,
      0xffffff,
    )
    btn1.on('pointerdown', () => {
      this.tapHandledThisFrame = true
    })
    btn1.on('pointerup', () => {
      this.tapHandledThisFrame = true
      console.log('connect', race.id)
    })
    container.add(btn1)

    const btn2 = this.makePhaserButton(
      btnX,
      btnY1 + btnH + btnGap,
      btnW,
      btnH,
      '🚀',
      'Скаут',
      0xfde047,
      0xd97706,
      0x78350f,
      0x3a2207,
    )
    btn2.on('pointerdown', () => {
      this.tapHandledThisFrame = true
    })
    btn2.on('pointerup', () => {
      this.tapHandledThisFrame = true
      console.log('send', race.id)
    })
    container.add(btn2)

    const btn3 = this.makePhaserButton(
      btnX,
      btnY1 + (btnH + btnGap) * 2,
      btnW,
      btnH,
      '📋',
      'Описание',
      0xc4b5fd,
      0x7c3aed,
      0x3b0764,
      0xffffff,
    )
    btn3.on('pointerdown', () => {
      this.tapHandledThisFrame = true
    })
    btn3.on('pointerup', () => {
      this.tapHandledThisFrame = true
      console.log('info', race.id)
    })
    container.add(btn3)

    // Невидимая interactive zone на всю панель — защита от закрытия при клике
    // на саму модалку (между/вокруг кнопок).
    const panelZone = this.add.zone(
      0,
      panelStart + PANEL_H / 2,
      PANEL_W,
      PANEL_H + ARROW_H + 4,
    )
    panelZone.setOrigin(0.5)
    panelZone.setInteractive()
    panelZone.on('pointerdown', () => {
      this.tapHandledThisFrame = true
    })
    panelZone.on('pointerup', () => {
      this.tapHandledThisFrame = true
    })
    container.add(panelZone)

    // Сразу применяем компенсацию zoom — иначе при первом рендере popover мигнёт большим
    container.setScale(1 / this.cameras.main.zoom)
  }

  // Phaser-кнопка в стиле ff-btn (двойной border, gradient, fontFamily Russo One)
  private makePhaserButton(
    x: number,
    y: number,
    w: number,
    h: number,
    emoji: string,
    label: string,
    fromColor: number,
    toColor: number,
    borderColor: number,
    textColor: number,
  ): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y)

    // Тень снизу
    const shadow = this.add.graphics()
    shadow.fillStyle(borderColor, 1)
    shadow.fillRoundedRect(-w / 2, -h / 2, w, h + 4, 10)
    btn.add(shadow)

    // Border
    const border = this.add.graphics()
    border.fillStyle(borderColor, 1)
    border.fillRoundedRect(-w / 2, -h / 2, w, h, 10)
    btn.add(border)

    // Заливка (имитация градиента двумя половинами)
    const fill = this.add.graphics()
    fill.fillStyle(fromColor, 1)
    fill.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.55, 8)
    fill.fillStyle(toColor, 1)
    fill.fillRoundedRect(-w / 2 + 2, -h / 2 + h * 0.45, w - 4, h * 0.55 - 2, 8)
    // Highlight сверху
    fill.fillStyle(0xffffff, 0.35)
    fill.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, 3, 6)
    btn.add(fill)

    // Эмодзи слева
    const emojiText = this.add.text(-w / 2 + 16 * DPR, 0, emoji, {
      fontSize: `${16 * DPR}px`,
    })
    emojiText.setOrigin(0.5, 0.5)
    btn.add(emojiText)

    // Текст
    const labelText = this.add.text(-w / 2 + 36 * DPR, 0, label, {
      fontFamily: 'Russo One, system-ui, sans-serif',
      fontSize: `${13 * DPR}px`,
      color: textColor === 0xffffff ? '#ffffff' : '#3a2207',
    })
    labelText.setOrigin(0, 0.5)
    btn.add(labelText)

    // Interactive
    btn.setSize(w, h)
    btn.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    )
    return btn
  }

  private selectSystem(sys: Race | BgSystem) {
    if (this.selectionMarker) this.selectionMarker.destroy()
    const m = this.add.graphics()
    const sz = sys.size || 14 * DPR
    m.lineStyle(2 * DPR, 0xffd700, 1)
    m.strokeCircle(sys.x, sys.y, sz + 14 * DPR)
    m.lineStyle(1 * DPR, 0xffd700, 0.5)
    m.strokeCircle(sys.x, sys.y, sz + 22 * DPR)
    m.setDepth(15)
    this.selectionMarker = m
    this.tweens.add({
      targets: m,
      alpha: { from: 1, to: 0.4 },
      yoyo: true,
      repeat: -1,
      duration: 700,
      ease: 'Sine.easeInOut',
    })

    // Для главной расы — открываем Phaser-popover (внутри scene, в world coords).
    const isMain = MAIN_RACES.some((r) => r.id === sys.id)
    if (isMain) {
      this.selectedMainRaceId = sys.id
      // Placement: предпочитаем 'below', но если снизу не помещается — пробуем 'above'.
      // Считаем место относительно реальных границ #game-canvas (учитывает top/bottom bars).
      const planetCenter = worldToDom(this, sys.x, sys.y)
      const canvasRect = this.game.canvas.getBoundingClientRect()
      // Реальная высота popover в screen px: panel(190) + arrow(14) + offset(32) + запас
      const POPOVER_HEIGHT = 260
      const SAFE_MARGIN = 12
      const spaceBelow = canvasRect.bottom - planetCenter.y - SAFE_MARGIN
      const spaceAbove = planetCenter.y - canvasRect.top - SAFE_MARGIN
      const placement: 'below' | 'above' =
        spaceBelow >= POPOVER_HEIGHT
          ? 'below'
          : spaceAbove >= POPOVER_HEIGHT
            ? 'above'
            : spaceBelow >= spaceAbove
              ? 'below'
              : 'above'
      this.openPhaserPopover(sys as Race, placement)
      // Если открыли main popover — закрываем BG name popup (не наслаиваем)
      this.closeBgNamePopup()
    } else {
      this.selectedMainRaceId = null
      this.closePhaserPopover()
    }

    const sprite = this.systemSprites.get(sys.id)
    if (sprite) {
      this.tweens.killTweensOf(sprite)
      this.tweens.add({
        targets: sprite,
        scaleY: 0.85,
        scaleX: 1.15,
        duration: 100,
        yoyo: true,
        ease: 'Power2',
        onComplete: () => {
          this.tweens.add({
            targets: sprite,
            scale: { from: 1.05, to: 1 },
            duration: 200,
            ease: 'Back.easeOut',
            onComplete: () => {
              this.tweens.add({
                targets: sprite,
                scale: { from: 0.97, to: 1.03 },
                duration: 2500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
              })
            },
          })
        },
      })
    }

    // Главные расы — по их type, фоновые — по архетипу
    const emojiMap: Record<string, string> = {
      // Главные первичные
      home: '🐸',
      crystal: '💎',
      rocky: '🪨',
      ancient: '⏳',
      mystic: '🔮',
      organic: '🌿',
      forge: '🔥',
      military: '⚔️',
      destroyed: '💔',
      // Расширение — 7 новых рас
      crystal_bio: '🌸',
      mechano: '⚙️',
      energy: '⚡',
      mist: '🌫️',
      aquatic: '🌊',
      shadow: '🌑',
      aerial: '☁️',
      // Архетипы фоновых
      gas_giant: '🌀',
      gas_ringed: '🪐',
      ice: '❄️',
      ocean: '🌊',
      desert: '🏜️',
      lava: '🌋',
      forest: '🌲',
      mineral: '⛏️',
      dead: '💀',
      toxic: '☠️',
      plasma: '☀️',
      binary: '⚡',
    }
    const archKey = (sys as BgSystem).archetype
    const emoji = emojiMap[archKey] || emojiMap[sys.type] || '?'
    const float = this.add.text(sys.x, sys.y - sz - 8 * DPR, emoji, {
      fontSize: 22 * DPR,
    })
    float.setOrigin(0.5)
    float.setDepth(80)
    this.tweens.add({
      targets: float,
      y: sys.y - sz - 50 * DPR,
      alpha: { from: 1, to: 0 },
      duration: 1400,
      ease: 'Sine.easeOut',
      onComplete: () => float.destroy(),
    })
  }

  // ============== УПРАВЛЕНИЕ ==============

  private setupControls() {
    this.input.setTopOnly(false)

    let isDragging = false
    let lastX = 0,
      lastY = 0
    let initialPinchDist: number | null = null
    let initialZoom = 1
    // Инерция камеры: сохраняем velocity при drag, применяем после pointerup
    let velX = 0,
      velY = 0
    let lastMoveTime = 0
    const VEL_THRESHOLD = 0.005 // px/ms — ниже считаем что остановились
    const FRICTION_PER_16MS = 0.92 // насколько velocity сохраняется за ~кадр
    let tapDownX = 0,
      tapDownY = 0
    let tapDownTime = 0

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      isDragging = true
      lastX = p.x
      lastY = p.y
      velX = 0
      velY = 0
      // Drag cancels follow mode
      if (this.followingShip) {
        this.followingShip = false
        eventBus.emit('starmap:follow-changed', { following: false })
      }
      lastMoveTime = Date.now()
      initialPinchDist = null
      // Сброс tap-флага. Если планета его не выставит до pointerup и не было drag —
      // на pointerup закроем popover (тап в пустое место карты).
      this.tapHandledThisFrame = false
      tapDownX = p.x
      tapDownY = p.y
      tapDownTime = Date.now()
    })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const ps = this.input.manager.pointers.filter(
        (pt) => pt.active && pt.isDown,
      )
      const cam = this.cameras.main
      if (ps.length === 2) {
        const dx = ps[0].x - ps[1].x
        const dy = ps[0].y - ps[1].y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (initialPinchDist == null) {
          initialPinchDist = d
          initialZoom = cam.zoom
        } else {
          const ratio = d / initialPinchDist
          cam.setZoom(
            Phaser.Math.Clamp(initialZoom * ratio, this.getMinZoom(), 1.8),
          )
          // Re-clamp center после изменения zoom
          this.setCameraCenter(this.camCenterX, this.camCenterY)
          this.scheduleBoundsUpdate()
        }
        velX = 0
        velY = 0
      } else if (isDragging && ps.length === 1) {
        const dx = p.x - lastX
        const dy = p.y - lastY
        const now = Date.now()
        const dt = Math.max(1, now - lastMoveTime)
        // Накопление velocity + движение камеры через единую API setCameraCenter
        const instantVX = dx / dt
        const instantVY = dy / dt
        velX = velX * 0.6 + instantVX * 0.4
        velY = velY * 0.6 + instantVY * 0.4
        const dxWorld = dx / cam.zoom
        const dyWorld = dy / cam.zoom
        const result = this.setCameraCenter(
          this.camCenterX - dxWorld,
          this.camCenterY - dyWorld,
        )
        if (result.hitX) velX = 0
        if (result.hitY) velY = 0
        lastX = p.x
        lastY = p.y
        lastMoveTime = now
        initialPinchDist = null
      }
    })

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      isDragging = false
      initialPinchDist = null
      // Если клик был быстрым, без перемещения и НЕ был перехвачен interactive объектом
      // (планета/звезда) — закрываем popover (тап в пустое место).
      const dt = Date.now() - tapDownTime
      const moved = Math.abs(p.x - tapDownX) + Math.abs(p.y - tapDownY)
      if (!this.tapHandledThisFrame && dt < 300 && moved < 8 * DPR) {
        // Тап в пустое место карты — закрываем popover'ы.
        // Сбрасываем счётчик нажатий → следующий тап на планету снова
        // запустит уникальную анимацию (как на первом нажатии).
        this.currentPressedPlanetId = null
        if (this.selectedMainRaceId) {
          this.selectedMainRaceId = null
          this.closePhaserPopover()
        }
        this.closeBgNamePopup()
      }
    })

    // Inertia — двигаем камеру через единую setCameraCenter() с автоматическим clamp.
    // Дополнительный «hard re-center» каждый кадр: на всякий случай, если что-то снаружи
    // меняет scroll (Phaser internals, resize и т.п.) — заявляем целевую позицию заново.
    this.events.on('update', (_t: number, dt: number) => {
      // Ship follow mode — overrides inertia/drag
      if (this.followingShip && this.shipSprite) {
        velX = 0
        velY = 0
        this.setCameraCenter(this.shipSprite.worldX, this.shipSprite.worldY)
        return
      }
      // Inertia только когда не идёт активный drag
      if (!isDragging) {
        const speed = Math.sqrt(velX * velX + velY * velY)
        if (speed >= VEL_THRESHOLD) {
          const cam = this.cameras.main
          const dxWorld = (velX * dt) / cam.zoom
          const dyWorld = (velY * dt) / cam.zoom
          const result = this.setCameraCenter(
            this.camCenterX - dxWorld,
            this.camCenterY - dyWorld,
          )
          if (result.hitX) velX = 0
          if (result.hitY) velY = 0
          const decay = Math.pow(FRICTION_PER_16MS, dt / 16)
          velX *= decay
          velY *= decay
        } else {
          velX = 0
          velY = 0
          // Жёсткий re-center каждый кадр — гарантия что Phaser не "уехал" сам.
          // Это идемпотентная операция: если уже на месте — ничего не меняет.
          this.setCameraCenter(this.camCenterX, this.camCenterY)
        }
      }
    })

    this.input.on(
      'wheel',
      (
        _p: Phaser.Input.Pointer,
        _gos: Phaser.GameObjects.GameObject[],
        _dx: number,
        dy: number,
      ) => {
        const cam = this.cameras.main
        const factor = dy > 0 ? 0.9 : 1.1
        cam.setZoom(
          Phaser.Math.Clamp(cam.zoom * factor, this.getMinZoom(), 1.8),
        )
        // Re-clamp center: пределы изменились с zoom, текущая позиция могла стать невалидной
        this.setCameraCenter(this.camCenterX, this.camCenterY)
        this.scheduleBoundsUpdate()
      },
    )
  }

  // ============== ЖИВЫЕ АНИМАЦИИ ==============

  // Чёрная дыра в центре вселенной (0, 0). Чёрное ядро + светящийся
  // аккреционный диск + лучи света + гало.
  // @ts-expect-error temporarily unused — раскомментируй вызов в create() если нужна обратно
  private setupBlackHole() {
    const cx = 0,
      cy = 0
    const coreR = 220 * DPR

    // Гало убрано по запросу — было слишком расплывчато (блюрило экран)
    const halo = this.add.graphics() // пустой placeholder для совместимости
    halo.setDepth(-70)

    // Аккреционный диск — наклонённый эллипс с градиентными полосами, вращается
    const disk = this.add.graphics()
    disk.fillStyle(0xfbbf24, 0.7)
    disk.fillEllipse(0, 0, coreR * 5.2, coreR * 1.4)
    disk.fillStyle(0xf97316, 0.65)
    disk.fillEllipse(0, 0, coreR * 4.6, coreR * 1.1)
    disk.fillStyle(0xfff7ed, 0.5)
    disk.fillEllipse(0, 0, coreR * 3.8, coreR * 0.8)
    disk.fillStyle(0xa78bfa, 0.4)
    disk.fillEllipse(0, 0, coreR * 3.0, coreR * 0.55)
    // Прорезь в центре диска (чтобы ядро было видно как тёмная точка)
    disk.fillStyle(0x000000, 1)
    disk.fillEllipse(0, 0, coreR * 2, coreR * 0.4)
    disk.x = cx
    disk.y = cy
    disk.angle = -22
    disk.setDepth(-60)
    // Вращение диска убрано по запросу

    // Сами лучи света — 8 радиальных лучей
    const rays = this.add.graphics()
    rays.lineStyle(3 * DPR, 0xfde047, 0.35)
    for (let i = 0; i < 8; i++) {
      const θ = (i * Math.PI) / 4
      rays.lineBetween(
        cx + Math.cos(θ) * coreR * 1.6,
        cy + Math.sin(θ) * coreR * 1.6,
        cx + Math.cos(θ) * coreR * 6,
        cy + Math.sin(θ) * coreR * 6,
      )
    }
    rays.setDepth(-65)
    // Все анимации убраны — чёрная дыра статична

    // Чёрное ядро (event horizon) — над диском
    const core = this.add.graphics()
    core.fillStyle(0x000000, 1)
    core.fillCircle(cx, cy, coreR * 0.7)
    // Тонкое внутреннее свечение по краю
    core.lineStyle(2 * DPR, 0xfff7ed, 0.7)
    core.strokeCircle(cx, cy, coreR * 0.72)
    core.lineStyle(1 * DPR, 0xfde047, 0.5)
    core.strokeCircle(cx, cy, coreR * 0.82)
    core.setDepth(-55)

    // Пульсации ядра/гало убраны — чёрная дыра полностью статична

    // Регистрируем для culling
    this.cullableData.push({ obj: halo, x: cx, y: cy, r: coreR * 4 })
    this.cullableData.push({ obj: disk, x: cx, y: cy, r: coreR * 3 })
    this.cullableData.push({ obj: rays, x: cx, y: cy, r: coreR * 6 })
    this.cullableData.push({ obj: core, x: cx, y: cy, r: coreR })
  }

  // @ts-expect-error temporarily unused — раскомментируй вызов и привяжи к HOME world coords
  private setupHomeOrbiter() {
    const orbiter = this.add.text(0, 0, '🐸', { fontSize: 18 * DPR })
    orbiter.setOrigin(0.5)
    orbiter.setDepth(50)
    // Интерактивность лягушки — тап даёт сердечко
    orbiter.setInteractive(
      new Phaser.Geom.Rectangle(-12 * DPR, -12 * DPR, 24 * DPR, 24 * DPR),
      Phaser.Geom.Rectangle.Contains,
    )
    let dt0 = 0,
      dx0 = 0,
      dy0 = 0
    orbiter.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dt0 = Date.now()
      dx0 = p.x
      dy0 = p.y
    })
    orbiter.on('pointerup', (p: Phaser.Input.Pointer) => {
      const elapsed = Date.now() - dt0
      const moved = Math.abs(p.x - dx0) + Math.abs(p.y - dy0)
      if (elapsed < 300 && moved < 8 * DPR) {
        this.tapHandledThisFrame = true
        this.popEmojiAt(orbiter.x, orbiter.y, '💚', orbiter)
      }
    })
    let angle = 0
    const radius = 95 * DPR
    this.events.on('update', (_t: number, dt: number) => {
      angle += (dt / 1000) * 0.6
      orbiter.x = Math.cos(angle) * radius
      orbiter.y = Math.sin(angle) * radius
      orbiter.scaleX = Math.cos(angle) > 0 ? 1 : -1
    })

    const dust = this.add.circle(0, 0, 2 * DPR, 0xfde047, 0.85)
    dust.setDepth(50)
    let angle2 = Math.PI
    const radius2 = 130 * DPR
    this.events.on('update', (_t: number, dt: number) => {
      angle2 += (dt / 1000) * 0.4
      dust.x = Math.cos(angle2) * radius2
      dust.y = Math.sin(angle2) * radius2
    })

    const rings = this.add.graphics()
    rings.lineStyle(1 * DPR, 0x7dd3fc, 0.2)
    rings.strokeCircle(0, 0, radius)
    rings.lineStyle(1 * DPR, 0xfde047, 0.15)
    rings.strokeCircle(0, 0, radius2)
    rings.setDepth(40)
  }

  private setupCosmicDust() {
    const dustRng = mulberry32(SEED + 3)
    // Космическая пыль — каждая частица tween. Снижено с 140.
    for (let i = 0; i < 50; i++) {
      const startX = (dustRng() - 0.5) * WORLD_SIZE * 2
      const startY = (dustRng() - 0.5) * WORLD_SIZE * 2
      const dx = (dustRng() - 0.5) * 200 * DPR
      const dy = (dustRng() - 0.5) * 200 * DPR
      const alpha = 0.2 + dustRng() * 0.4
      const color = [0xa5f3fc, 0xfde047, 0xc4b5fd, 0xfecaca][
        Math.floor(dustRng() * 4)
      ]
      const dust = this.add.circle(
        startX,
        startY,
        (0.8 + dustRng() * 1.2) * DPR,
        color,
        alpha,
      )
      dust.setDepth(-50)
      this.tweens.add({
        targets: dust,
        x: startX + dx,
        y: startY + dy,
        duration: 18000 + dustRng() * 18000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
      // Радиус culling-сферы должен охватывать tween-движение
      this.cullableData.push({ obj: dust, x: startX, y: startY, r: 300 * DPR })
    }
  }

  // @ts-expect-error temporarily unused — re-enable in create() when planet dialogues land
  private setupSignalPulses() {
    const links: [{ x: number; y: number }, Race][] = [
      [{ x: 0, y: 0 }, this.findRace('bliks')!],
      [{ x: 0, y: 0 }, this.findRace('drave')!],
      [{ x: 0, y: 0 }, this.findRace('cairn')!],
      [{ x: 0, y: 0 }, this.findRace('lyor')!],
      [this.findRace('bliks')!, this.findRace('cairn')!],
      [this.findRace('drave')!, this.findRace('veran')!],
      [this.findRace('cairn')!, this.findRace('tor')!],
      [this.findRace('lyor')!, this.findRace('veran')!],
      [this.findRace('veran')!, this.findRace('tor')!],
    ]

    links.forEach(([from, to], idx) => {
      const sendSignal = () => {
        const colors = [0x00d4ff, 0xfde047, 0xa5f3fc]
        const color = colors[idx % 3]
        const dot = this.add.circle(from.x, from.y, 3 * DPR, color, 1)
        dot.setDepth(20)
        const halo = this.add.circle(from.x, from.y, 8 * DPR, color, 0.4)
        halo.setDepth(19)
        this.tweens.add({
          targets: [dot, halo],
          x: to.x,
          y: to.y,
          duration: 1800 + Math.random() * 800,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.tweens.add({
              targets: [dot, halo],
              alpha: 0,
              scale: 3,
              duration: 300,
              onComplete: () => {
                dot.destroy()
                halo.destroy()
              },
            })
          },
        })
      }
      // Базовая задержка 1000мс + ступенчато по индексу — чтобы не вспыхнуть при открытии сцены
      this.time.delayedCall(1000 + idx * 600, () => {
        sendSignal()
        this.time.addEvent({
          delay: 4000 + Math.random() * 5000,
          loop: true,
          callback: sendSignal,
        })
      })
    })
  }

  private setupRandomSignals() {
    const interactive = MAIN_RACES.filter(
      (r) => r.id !== 'home' && r.id !== 'relict',
    )
    const signal = () => {
      const race = interactive[Math.floor(Math.random() * interactive.length)]
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(i * 200, () => {
          const ring = this.add.graphics()
          ring.lineStyle(2 * DPR, race.color, 0.7)
          ring.strokeCircle(0, 0, race.size + 10 * DPR)
          ring.x = race.x
          ring.y = race.y
          ring.setDepth(15)
          this.tweens.add({
            targets: ring,
            scale: 2.4,
            alpha: 0,
            duration: 1400,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy(),
          })
        })
      }
      const tag = this.add.text(race.x, race.y - race.size - 18 * DPR, '📡', {
        fontSize: 16 * DPR,
      })
      tag.setOrigin(0.5)
      tag.setDepth(70)
      this.tweens.add({
        targets: tag,
        y: race.y - race.size - 36 * DPR,
        alpha: { from: 1, to: 0 },
        duration: 1500,
        onComplete: () => tag.destroy(),
      })
    }
    this.time.addEvent({
      delay: 6000,
      loop: true,
      callback: () => {
        signal()
        if (Math.random() < 0.25) this.time.delayedCall(800, signal)
      },
    })
  }

  private setupTorRing() {
    const tor = this.findRace('tor')
    if (!tor) return
    const container = this.systemSprites.get('tor')
    if (!container) return
    const ring = this.add.graphics()
    ring.lineStyle(2 * DPR, 0xfca5a5, 0.6)
    ring.strokeCircle(0, 0, tor.size + 18 * DPR)
    ring.lineStyle(1 * DPR, 0xfca5a5, 0.3)
    ring.strokeCircle(0, 0, tor.size + 24 * DPR)
    ring.setDepth(5)
    container.add(ring)
    this.tweens.add({
      targets: ring,
      angle: 360,
      duration: 18000,
      repeat: -1,
      ease: 'Linear',
    })
  }

  private setupVeranLightning() {
    const veran = this.findRace('veran')
    if (!veran) return
    const flash = () => {
      const lightning = this.add.graphics()
      lightning.lineStyle(2 * DPR, 0xc4b5fd, 1)
      const numBolts = 3 + Math.floor(Math.random() * 3)
      for (let i = 0; i < numBolts; i++) {
        const ang = Math.random() * Math.PI * 2
        let x = Math.cos(ang) * (veran.size + 6 * DPR)
        let y = Math.sin(ang) * (veran.size + 6 * DPR)
        lightning.beginPath()
        lightning.moveTo(x, y)
        for (let j = 0; j < 4; j++) {
          x += Math.cos(ang) * 8 * DPR + (Math.random() - 0.5) * 6 * DPR
          y += Math.sin(ang) * 8 * DPR + (Math.random() - 0.5) * 6 * DPR
          lightning.lineTo(x, y)
        }
        lightning.strokePath()
      }
      lightning.x = veran.x
      lightning.y = veran.y
      lightning.setDepth(12)
      this.tweens.add({
        targets: lightning,
        alpha: 0,
        duration: 250,
        onComplete: () => lightning.destroy(),
      })
    }
    this.time.addEvent({
      delay: 4500,
      loop: true,
      callback: () => {
        if (Math.random() < 0.55) {
          flash()
          if (Math.random() < 0.4) this.time.delayedCall(120, flash)
        }
      },
    })
  }

  private setupRelictMourning() {
    const relict = this.findRace('relict')
    if (!relict) return
    this.time.addEvent({
      delay: 1800,
      loop: true,
      callback: () => {
        const particle = this.add.circle(
          relict.x + (Math.random() - 0.5) * relict.size,
          relict.y + relict.size * 0.3,
          1.5 * DPR,
          0xa5f3fc,
          0.7,
        )
        particle.setDepth(11)
        this.tweens.add({
          targets: particle,
          y: relict.y - (60 + Math.random() * 30) * DPR,
          x: particle.x + (Math.random() - 0.5) * 20 * DPR,
          alpha: 0,
          duration: 3500,
          ease: 'Sine.easeOut',
          onComplete: () => particle.destroy(),
        })
      },
    })
  }

  private findRace(id: string) {
    return MAIN_RACES.find((r) => r.id === id)
  }

  shutdown() {
    this.closePhaserPopover()
    this.nebula?.destroy()
    this.nebula = undefined
  }

  // Лёгкая реакция на тап по второстепенному объекту (звезда, лягушка-спутник)
  private popEmojiAt(
    x: number,
    y: number,
    emoji: string,
    target?: Phaser.GameObjects.GameObject,
  ) {
    if (target) {
      this.tweens.killTweensOf(target)
      this.tweens.add({
        targets: target,
        scaleY: 0.85,
        scaleX: 1.15,
        duration: 100,
        yoyo: true,
        ease: 'Power2',
      })
    }
    const t = this.add.text(x, y, emoji, { fontSize: 22 * DPR })
    t.setOrigin(0.5)
    t.setDepth(80)
    this.tweens.add({
      targets: t,
      y: y - 40 * DPR,
      alpha: { from: 1, to: 0 },
      duration: 1000,
      ease: 'Sine.easeOut',
      onComplete: () => t.destroy(),
    })
  }
}
