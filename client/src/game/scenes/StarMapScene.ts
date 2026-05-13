import Phaser from 'phaser'
import { eventBus } from '../../store/eventBus'
// FLOOR TEST imports neutered:
// import { attachNebulaBackground } from '../effects/NebulaBackground'
// import { violetRing } from '../effects/presets'
import type { NebulaBackgroundHandle } from '../effects/NebulaBackground'
import planetMap from '../data/planetMap.json'
import {
  DPR,
  WORLD_SIZE,
  SEED,
  MOON_FADE_START,
  MOON_FADE_END,
  BG_PLANET_MIN_ZOOM,
  BG_DETAIL_MIN_ZOOM,
  BG_INTERACTIVE_MIN_ZOOM,
  MAIN_RACES,
} from './starmap/planetarium'
import { ShipController } from './starmap/shipController'
// ShipSprite/ShipState — теперь только внутри shipController.ts (Phase 20-04, Wave 4).
import {
  setupStarfield,
  drawLines,
  buildBgBatch,
  renderSystem,
} from './starmap/starfield'
import { CoordinatesHUDController } from './starmap/coordinatesHUD'
import { CameraController } from './starmap/cameraController'
import { ControlsController } from './starmap/controlsController'
import { PopoverController } from './starmap/popovers'
// 96 comp* импортов и DAILY_CAP/useGameStore — теперь только в popovers.ts
// (Phase 20-04, Wave 4: extracted playUniqueAnimation/runAnimComponent/openBgNamePopup).
// deriveModulations, hashId, effectiveSeed, animRng — теперь только в SeedRefinementEngine.
import type { Race, BgSystem, PlanetMapEntry } from './starmap/types'
import { mulberry32 } from './starmap/helpers'
import { SeedRefinementEngine } from './starmap/seedRefinement/engine'
// import { setupCosmicDust } from './starmap/ambient/cosmicDust' // отключено

import { setupRandomSignals } from './starmap/ambient/randomSignals'
import { setupTorRing } from './starmap/ambient/torRing'
import { setupVeranLightning } from './starmap/ambient/veranLightning'
import { setupRelictMourning } from './starmap/ambient/relictMourning'
import { LODManager } from './starmap/lod/lodManager'
import { PlanetRenderer } from './starmap/rendering/planetRenderer'
// import { devWarn } from '../../utils/devLog' // FLOOR TEST: nebula off

// Phaser-сцена Звёздной карты. Запускается рядом с MainScene через scene-manager.
// Ничего о gameStore не знает — это «декоративная карта» для просмотра системы
// и (в будущем) удобной навигации Скаутов.

// DPR / WORLD_SIZE / SEED / MOON_FADE_* / BG_*_MIN_ZOOM / MAIN_RACES /
// ARCHETYPE_HUES / hslToHex / generatePalette — extracted в `./starmap/planetarium.ts`
// (StarMapScene refactor, step 2). Здесь оставлены только сцена-локальные константы.

// Сколько всего обитаемых планет (16 главных + 51 фоновая обитаемая)
const TOTAL_INHABITED = 67

// NAMES_POOL устарел — теперь имена берутся из BG_NAME_POOL (data/planetNames.ts).
// Перемешиваются seed-shuffle в generateBackgroundSystems → каждая планета
// получает уникальное стабильное имя.
//
// TYPE_LABELS, mulberry32, Archetype, BgSystem, Race, PlanetMapEntry — extracted
// в `./starmap/types.ts` и `./starmap/helpers.ts` (Phase 20-01).

// TYPE_TO_ARCHETYPES и ARCHETYPE_SIZES перенесены в скрипт регенерации
// (/tmp/starmap_dump.cjs). Используются только для регенерации planetMap.json.
//
// Генерация фоновых планет перенесена в data/planetMap.json (источник истины).
// Скрипт перегенерации: /tmp/starmap_dump.cjs (запускать при изменении SEED/MIN_TO_DIST/etc).
// Чтобы изменить позицию/цвет/имя конкретной планеты — правь planetMap.json напрямую.

export class StarMapScene extends Phaser.Scene {
  // Phase 20-04 (Wave 4): несколько полей переведены с `private` на package-public,
  // потому что starmap/starfield.ts и starmap/coordinatesHUD.ts читают/мутируют их
  // напрямую (free functions / controller class) — TS не имеет `friend`/`internal`,
  // поэтому это эквивалент package-private. Не используются вне starmap/* модулей.
  allSystems: (Race | BgSystem)[] = []
  systemSprites = new Map<string, Phaser.GameObjects.Container>()
  // selectionMarker мигрировал в PopoverController (Phase 20-04, Wave 4).
  // Phase 20-XX: LOD-state (cullableData, cullTickCounter, bgArchetypeGfx,
  // bgBatchGfx, bgInteractiveContainers, bgInteractiveEnabled, moons, zoomCompStars)
  // вынесен в LODManager. Консьюмеры (coordinatesHUD/starfield/planetRenderer)
  // обращаются напрямую через scene.lod.X — делегаторы удалены.
  // lod создаётся в create() ДО renderSystem (а тот пушит в lod.cullableData/moons/etc).
  lod!: LODManager

  // Адаптивный hit-area для главных планет (тап по ним удобен на любом зуме)
  mainPlanetHits: Array<{
    container: Phaser.GameObjects.Container
    baseR: number
    circle: Phaser.Geom.Circle
  }> = []
  // Phase 20-05 (Wave 5): camera target/clamp + hit-area sizing вынесены в CameraController.
  // camera.camCenterX/Y, camera.setCenter, camera.getMinZoom, camera.updatePlanetHitAreas,
  // camera.scheduleBoundsUpdate — все внешние call-sites идут через this.camera.
  camera!: CameraController
  // ID выбранной для popover расы (Phaser-popover в той же scene, в world-coords).
  // Phase 20-04 (Wave 4): package-public — ControlsController сбрасывает на тап в пустоту.
  selectedMainRaceId: string | null = null
  private popover?: Phaser.GameObjects.Container
  // bgNamePopup/bgNamePopupTimer мигрировали в PopoverController (Phase 20-04, Wave 4).
  private nebula?: NebulaBackgroundHandle
  // eventBus handler refs — нужны для off() в shutdown(). Без этого слушатели
  // утекают при каждом open/close StarMap и накапливаются.
  private onEbPopoverClose?: () => void
  private onEbCenterHome?: () => void
  private onEbGotoShip?: () => void
  // Линии связи между главными расами + кэш edges для перерисовки при изменении zoom.
  mainLinesGfx: Phaser.GameObjects.Graphics | null = null
  mainLinesEdges: Array<{
    ax: number
    ay: number
    bx: number
    by: number
  }> = []
  mainLinesLastZoom = -1
  // Состояние счётчика тапов на каждую планету. Уникальная анимация срабатывает
  // на первом нажатии после смены/перерыва, потом раз в 2-6 нажатий.
  // Phase 20-04 (Wave 4): package-public — PopoverController читает/мутирует,
  // ControlsController сбрасывает currentPressedPlanetId на тап-в-пустоту.
  planetPressState = new Map<string, { count: number; threshold: number }>()
  currentPressedPlanetId: string | null = null
  // Флаг: текущий pointerup перехвачен interactive объектом (планетой/звездой).
  // Используется глобальным pointerup'ом для определения «тап в пустое место».
  tapHandledThisFrame = false

  // Phase 7: override-карта для main races (которым нельзя мутировать rngSeed как BG).
  // Заполняется в seedEngine.refineAnims/refineSounds при коллизиях signatures.
  // Phase 20-04 (Wave 4): package-public — PopoverController читает через animRng helper.
  // Phase 20-XX: само хранилище и refine-методы вынесены в SeedRefinementEngine.
  // Геттер делегирует в engine — popovers.ts продолжает работать без изменений.
  get mainSeedOverride(): Map<string, number> {
    return this.seedEngine.mainSeedOverride
  }
  // Создаётся в create() ПЕРЕД первым вызовом seedEngine.refineAll(...).
  private seedEngine!: SeedRefinementEngine

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
  // Phase 20-04 (Wave 4): package-public — PopoverController.playUniqueAnimation
  // и getAnimationDurationMs читают, buildAnimSignature (в scene) тоже читает.
  readonly THEME_COMPONENTS: Record<string, number[]> = {
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

  // Phase 16: Ship singleton — Phaser-native ракетка с trail.
  // Auto-spawn в create() через ensureShipExists. Subscribed на cosmicSlice.ship.
  // Phase 20-04 (Wave 4): Lifecycle вынесен в ShipController.
  private shipController!: ShipController
  // Phase 20-04 (Wave 4): popover/popup + tap orchestration вынесены в PopoverController.
  // Package-public — ControlsController и pointerup-handlers вызывают методы напрямую.
  popoverController!: PopoverController
  // Phase 20-05 (Wave 5): pointer/wheel/drag/inertia/follow-ship вынесены в ControlsController.
  // Хранится как field только для reference; subscriptions cleanup через Phaser scene shutdown.
  private controls!: ControlsController
  // Phase 20-XX (StarMapScene refactor, step 4): renderMainPlanet/renderBgPoint
  // вынесены в PlanetRenderer. Public — starfield.ts (renderSystem dispatcher) вызывает
  // scene.planetRenderer.renderMain / renderBg напрямую (TS не имеет `friend`).
  planetRenderer!: PlanetRenderer

  constructor() {
    super({ key: 'StarMapScene' })
  }

  preload() {
    this.load.image('spaceShip', '/spaceShip.webp')
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000)
    // Стартуем с alpha 0 — game/index.ts сделает fade-in после create.
    this.cameras.main.setAlpha(0)

    // FLOOR TEST: nebula отключена.
    // try { ... attachNebulaBackground ... } catch { ... }

    // Starfield перенесён ниже — нужны this.allSystems для кластеризации звёзд

    // Источник истины для всех планет — planetMap.json. Координаты/размеры в DPR-units
    // (DPR=1 base) → умножаем на real DPR в runtime.
    const bg: BgSystem[] = (planetMap.planets as PlanetMapEntry[])
      .filter((p) => p.kind === 'bg')
      .map(
        (p): BgSystem => ({
          id: p.id,
          name: p.name,
          x: p.x * DPR,
          y: p.y * DPR,
          // bg-планеты в JSON имеют только 'resource' | 'hostile' | 'empty' (см. generate_planet_map)
          type: p.type as BgSystem['type'],
          archetype: p.archetype as BgSystem['archetype'],
          color: p.color,
          accent: p.accent,
          size: p.size * DPR,
          brightness: p.brightness as number,
          hasMoon: p.hasMoon as boolean,
          rngSeed: p.rngSeed as number,
        }),
      )

    // Помечаем 51 случайную фоновую как обитаемую (16 главных + 51 = 67 всего обитаемых)
    const inhabitedNeeded = Math.max(0, TOTAL_INHABITED - MAIN_RACES.length)
    const rngI = mulberry32(SEED + 99)
    const indices = bg.map((_, i) => i).sort(() => rngI() - 0.5)
    for (let i = 0; i < Math.min(inhabitedNeeded, indices.length); i++) {
      bg[indices[i]].isInhabited = true
    }
    this.allSystems = [...MAIN_RACES, ...bg]

    // Phase 7: глобальная уникальность signatures.
    // ВАЖНО: refineTextures() ДОЛЖЕН вызываться ПЕРЕД refineAnims() —
    // мутация rngSeed для текстур инвалидирует animation signatures, текстуры идут первыми.
    // Phase 8: refineSounds() — третий pass (texture → anim → sound).
    // Каждый pass conservative для следующего; sound mutation использует разную константу
    // (0xc2b2ae3d) чтобы не пересекаться с anim (0x9e3779b9) и texture (0x85ebca6b).
    // Phase 8 plan 06: anim+sound refine могут изменить rngSeed → редко создают
    // новую texture коллизию (наблюдение: 1 collision из 984 после первого прогона).
    // Второй проход texture refine стабилизирует pipeline до 984/984 unique.
    // Anim/sound signatures не страдают: повторная texture mutation использует
    // ту же константу 0x85ebca6b которую refineAnims учитывает в своих
    // signature space (88+ comp × strict params, миллионы вариантов).
    // Phase 20-XX: вся pipeline вынесена в SeedRefinementEngine.refineAll().
    this.seedEngine = new SeedRefinementEngine(this.THEME_COMPONENTS)
    this.seedEngine.refineAll(this.allSystems)

    // Phase 20-XX: LODManager owns LOD-state (cullableData/moons/bgArchetypeGfx/etc).
    // Должен быть создан ДО setupStarfield/renderSystem/buildBgBatch/setupCosmicDust —
    // все они пушат в коллекции через scene.X (делегаты на this.lod.X).
    this.lod = new LODManager({
      MOON_FADE_START,
      MOON_FADE_END,
      BG_DETAIL_MIN_ZOOM,
      BG_INTERACTIVE_MIN_ZOOM,
      BG_PLANET_MIN_ZOOM,
    })

    // Phase 20-05 (Wave 5): CameraController — должен быть создан до setCameraCenter
    // (вызывается ниже на старте + используется ControlsController в setup).
    // Использует scene.mainPlanetHits (заполняется renderSystem) — обращение только
    // в updatePlanetHitAreas, который вызывается ПОСЛЕ renderSystem в create().
    this.camera = new CameraController(this)

    // Phase 20-04 (Wave 4): popover/tap orchestration controller — должен быть
    // создан ДО renderSystem, потому что pointerup handlers внутри renderMain/Bg
    // вызывают this.popoverController.{handlePlanetPress,selectSystem,scheduleBgNamePopup}.
    this.popoverController = new PopoverController(this)

    // Starfield — после генерации систем, чтобы кластеризовать звёзды вокруг планет
    setupStarfield(this, { worldSize: WORLD_SIZE, seed: SEED })

    // STEP 1: connection lines включены
    drawLines(this, MAIN_RACES)

    // Phase 20-XX (step 4): PlanetRenderer instance — должен быть создан ДО renderSystem
    // (диспетчер вызывает scene.planetRenderer.renderMain/renderBg). Инстанцируется
    // после seedEngine/lod/popoverController, поскольку методы рендера читают через
    // this.scene.X (cullableData, moons, bgArchetypeGfx, popoverController, и т.д.).
    this.planetRenderer = new PlanetRenderer(this)

    // STEP 4+5: все планеты включены (16 main + 435 BG = 451 total)
    for (const sys of this.allSystems) renderSystem(this, sys, MAIN_RACES)
    buildBgBatch(this)

    // Камера: ставим zoom 1.0 и центрируем на HOME (родной планете).
    // Координаты HOME — из planetMap.json, поэтому камера автоматически
    // подстраивается если HOME перемещён в JSON.
    const home = MAIN_RACES.find((r) => r.id === 'home') ?? MAIN_RACES[0]
    this.cameras.main.setZoom(1.0)
    this.camera.setCenter(home.x, home.y)
    this.camera.updatePlanetHitAreas()

    // Сброс выбранной планеты при закрытии popover извне.
    // Handler сохранён как поле — нужен для off() в shutdown().
    this.onEbPopoverClose = () => {
      this.selectedMainRaceId = null
    }
    eventBus.on('starmap:popover-close', this.onEbPopoverClose)

    // Центрирование камеры на HOME с плавным tween (повторный клик по кнопке открытия StarMap)
    this.onEbCenterHome = () => {
      const homeRace = MAIN_RACES.find((r) => r.id === 'home') ?? MAIN_RACES[0]
      const cam = this.cameras.main
      // Плавный zoom-back до 1.0 + центрирование на HOME
      this.tweens.add({
        targets: {
          z: cam.zoom,
          x: this.camera.centerX,
          y: this.camera.centerY,
        },
        z: 1.0,
        x: homeRace.x,
        y: homeRace.y,
        duration: 700,
        ease: 'Cubic.easeInOut',
        onUpdate: (tw) => {
          const t = tw.targets[0] as { x: number; y: number; z: number }
          cam.setZoom(t.z)
          this.camera.setCenter(t.x, t.y)
          // Hit-areas зависят от zoom — обновляем по ходу tween, иначе после
          // завершения hit-area остаётся гигантской (от прежнего малого zoom).
          this.camera.scheduleBoundsUpdate()
        },
        onComplete: () => {
          this.camera.updatePlanetHitAreas() // финальное обновление под точный zoom 1.0
        },
      })
    }
    eventBus.on('starmap:centerHome', this.onEbCenterHome)

    // Центрирование камеры на текущую позицию корабля (без follow-mode)
    this.onEbGotoShip = () => {
      const shipSprite = this.shipController.sprite
      if (!shipSprite) {
        return
      }
      const cam = this.cameras.main
      this.tweens.add({
        targets: {
          z: cam.zoom,
          x: this.camera.centerX,
          y: this.camera.centerY,
        },
        z: 1.0,
        x: shipSprite.worldX,
        y: shipSprite.worldY,
        duration: 700,
        ease: 'Cubic.easeInOut',
        onUpdate: (tween) => {
          const tgt = tween.targets[0] as { z: number; x: number; y: number }
          cam.setZoom(tgt.z)
          this.camera.setCenter(tgt.x, tgt.y)
          this.camera.scheduleBoundsUpdate()
        },
        onComplete: () => {
          this.camera.updatePlanetHitAreas()
        },
      })
    }
    eventBus.on('starmap:goto-ship', this.onEbGotoShip)

    // Живые анимации (ambient effects). Вынесены в starmap/ambient/* (Wave 3).
    // Космическая пыль убрана — perf trade-off, визуально не критично.
    // setupCosmicDust(this, {
    //   worldSize: WORLD_SIZE,
    //   seed: SEED,
    //   register: (obj, x, y, r, lodMinZoom) =>
    //     this.lod.cullableData.push({ obj, x, y, r, lodMinZoom }),
    // })
    // FLOOR TEST: все ambient effects отключены
    // setupRandomSignals(this, MAIN_RACES)
    // setupTorRing(this, MAIN_RACES, this.systemSprites)
    // setupVeranLightning(this, MAIN_RACES)
    // setupRelictMourning(this, MAIN_RACES)
    void setupRandomSignals
    void setupTorRing
    void setupVeranLightning
    void setupRelictMourning

    // Phase 20-04 (Wave 4): per-frame update tick + HUD данных делегированы CoordinatesHUDController.
    new CoordinatesHUDController(this, {
      bgDetailMinZoom: BG_DETAIL_MIN_ZOOM,
      bgPlanetMinZoom: BG_PLANET_MIN_ZOOM,
      bgInteractiveMinZoom: BG_INTERACTIVE_MIN_ZOOM,
      moonFadeStart: MOON_FADE_START,
      moonFadeEnd: MOON_FADE_END,
    }).setup()

    // Phaser-popover scale-compensation. Применяется в PRE_RENDER чтобы scale
    // соответствовал текущему cam.zoom синхронно с render (без 1-frame lag).
    this.events.on(Phaser.Scenes.Events.PRE_RENDER, () => {
      if (this.popover) {
        this.popover.setScale(1 / this.cameras.main.zoom)
      }
    })

    // Phase 16: Ship singleton (REQ SHIP-02..06).
    // Phase 20-04 (Wave 4): lifecycle делегирован ShipController.
    this.shipController = new ShipController(this)
    this.shipController.setup()

    // Phase 20-05 (Wave 5): pointer/wheel/drag/inertia + follow-ship cancellation.
    // Создаём ПОСЛЕ ShipController — ControlsController хранит на него ref.
    this.controls = new ControlsController(
      this,
      this.camera,
      this.shipController,
    )
    this.controls.setup()

    // Phase 16: cleanup на shutdown — destroy ship + unsubscribe store.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.shipController.teardown(),
    )
    this.events.once(Phaser.Scenes.Events.DESTROY, () =>
      this.shipController.teardown(),
    )
  }

  // setupShipSprite/teardownShipSprite/applyShipState — extracted в './starmap/shipController.ts' (Phase 20-04, Wave 4).

  // updatePlanetHitAreas / getMinZoom / setCameraCenter / scheduleBoundsUpdate
  // — extracted в './starmap/cameraController.ts' (Phase 20-05, Wave 5).
  // Все вызовы делегируются через this.camera (CameraController instance).

  // ============== TEMP DEBUG HUD ==============
  // HUD теперь через React (см. StarMapHUD компонент в App.tsx).
  // Здесь только сохраняем данные в публичные поля сцены.
  hudFps = 60
  hudVisible = 0
  hudTotal = 0

  // setupCoordinatesHUD — extracted в './starmap/coordinatesHUD.ts' (Phase 20-04, Wave 4).
  // CoordinatesHUDController пишет в hudFps/hudVisible/hudTotal каждый кадр.

  // ============== ФОНЫ ==============
  // setupStarfield/drawLines/redrawMainLines/buildBgBatch/renderSystem/createSparkleAt
  // — extracted в './starmap/starfield.ts' (Phase 20-04, Wave 4).

  // ============== УНИКАЛЬНЫЕ АНИМАЦИИ ПЛАНЕТ ==============
  // handlePlanetPress/getAnimationDurationMs/playUniqueAnimation/runAnimComponent
  // и константа COMP_DURATIONS_MS — extracted в './starmap/popovers.ts' (Phase 20-04, Wave 4).
  // PopoverController owns tap orchestration; THEME_COMPONENTS остаётся на сцене,
  // т.к. buildAnimSignature (для refineAnimSeeds, ниже) тоже его читает.

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
  //
  // Phase 20-XX: вынесено в './starmap/seedRefinement/engine.ts'.
  // SeedRefinementEngine хранит mainSeedOverride и реализует refineAll() —
  // композитный pipeline texture → anim → sound → texture (последний pass
  // стабилизирует редкие texture коллизии после anim/sound mutation).
  // hashId — extracted в './starmap/helpers.ts' (Phase 20-01).

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

  // Phase 20-XX (StarMapScene refactor, step 4): renderMainPlanet — extracted в
  // './starmap/rendering/planetRenderer.ts'. Вызывается через scene.planetRenderer.renderMain.

  // Phase 20-XX (StarMapScene refactor, step 4): renderBgPoint — extracted в
  // './starmap/rendering/planetRenderer.ts'. Вызывается через scene.planetRenderer.renderBg.

  // worldToDom — extracted в './starmap/helpers.ts' (Phase 20-01).

  // ============== PHASER POPOVER ==============

  // Phase 20-05 (Wave 5): package-public — ControlsController вызывает на тап-в-пустоту.
  closePhaserPopover() {
    if (this.popover) {
      this.popover.destroy(true)
      this.popover = undefined
    }
  }

  // closeBgNamePopup/scheduleBgNamePopup/openBgNamePopup/selectSystem
  // — extracted в './starmap/popovers.ts' (Phase 20-04, Wave 4).

  // ============== УПРАВЛЕНИЕ ==============
  // setupControls (pointer/wheel/drag/inertia + follow-ship cancel)
  // — extracted в './starmap/controlsController.ts' (Phase 20-05, Wave 5).

  shutdown() {
    this.closePhaserPopover()
    this.nebula?.destroy()
    this.nebula = undefined
    // Cleanup leaks (perf audit findings #4, #5):
    // — eventBus подписки удерживают reference на старую инстанцию scene
    // — scene.time.delayedCall цепочки (sparkle/signals/lightning) самовоспроизводятся
    //   вечно. removeAllEvents() убирает их все.
    // — tweens нужно явно убить иначе они держат references на destroyed objects.
    if (this.onEbPopoverClose) {
      eventBus.off('starmap:popover-close', this.onEbPopoverClose)
      this.onEbPopoverClose = undefined
    }
    if (this.onEbCenterHome) {
      eventBus.off('starmap:centerHome', this.onEbCenterHome)
      this.onEbCenterHome = undefined
    }
    if (this.onEbGotoShip) {
      eventBus.off('starmap:goto-ship', this.onEbGotoShip)
      this.onEbGotoShip = undefined
    }
    this.time.removeAllEvents()
    this.tweens.killAll()
  }

  // Лёгкая реакция на тап по второстепенному объекту (звезда, лягушка-спутник)
  // Phase 20-04 (Wave 4): package-public — вызывается из starfield.ts (free function).
  popEmojiAt(
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
