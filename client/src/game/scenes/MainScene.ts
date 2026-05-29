import Phaser from 'phaser'
import { useGameStore, getDropIntervalMs } from '../../store/gameStore'
import { magnetKeyForLocation } from '../config/upgrades'
import { eventBus } from '../../store/eventBus'
import {
  FROG_LEVELS,
  textureKeyForLevel,
  getTargetIncomePerSec,
  type PoopType,
} from '../config/frogs'
import { FrogOverlayManager } from '../effects/FrogOverlayManager'
import { ElementAuraOverlay } from '../effects/ElementAuraOverlay'
import { playAscensionTween } from '../effects/CarrierAscensionTween'
import { CaptainBirthEffect } from '../effects/CaptainBirthEffect'
import {
  fireSpec,
  waterSpec,
  forestSpec,
  toxicSpec,
  plasmaSpec,
  crystalSpec,
  desertSpec,
  gasSpec,
  ringSpec,
  binarySpec,
} from '../effects/elementAuraSpecs'
import { SerumSelectionLayer } from '../effects/SerumSelectionLayer'
import type { Element } from '../../store/cosmic/types'
import { devLog } from '../../utils/devLog'
import {
  BASE_SCALE,
  DPR,
  FIELD_PAD_X,
  FIELD_PAD_Y,
  FIELD_PAD_Y_BOTTOM,
  TEXTURE_QUALITY,
  mapKeyForLocation,
  type BoxData,
  type FrogData,
} from './main/types'
import { FrogSpawner } from './main/FrogSpawner'
import { MergeController } from './main/MergeController'
import { BoxController } from './main/BoxController'
import { PoopController } from './main/PoopController'
import { MagnetController } from './main/MagnetController'
import { DroneController } from './main/DroneController'
import { FactoryController } from './main/FactoryController'
import { LocationTransition } from './main/LocationTransition'
import { FrogInteraction } from './main/FrogInteraction'


const SWIPE_SLOP = 90 * DPR   // палец должен сдвинуться на столько, прежде чем начнётся скролл
const SWIPE_FLICK_V = 0.5   // |velocity.y| (px/ms) выше — считаем фликом, переключаем по направлению


export class MainScene extends Phaser.Scene {
  // Phase 21 (Wave 1+): несколько полей переведены с `private` на package-public,
  // потому что main/FrogSpawner.ts (и далее main/MergeController, main/BoxController…)
  // читают/мутируют их напрямую. TS не имеет `friend`/`internal`, поэтому это
  // эквивалент package-private — поля не должны использоваться вне scenes/main/*.
  //
  //   frogs, overlayManager, selectionLayer, cachedSerumDragActive,
  //   isLocationTransitioning  — читает FrogSpawner
  frogs: FrogData[] = []
  // Phase 21-03 (Wave 3): boxes/pendingBoxCount пакеджед-public —
  // используются BoxController + LocationTransition.
  boxes: BoxData[] = []
  // Phase 21-05 (Wave 5): boxProgressMs package-public —
  // мутируется LocationTransition (snap-end resets).
  boxProgressMs = 0

  // Phase 21-04 (Wave 4): magnet state перенесён в MagnetController.

  // Phase 21-03 (Wave 3): poops package-public — мутируется PoopController +
  // LocationTransition (oldContainer reparent).
  // Живые какашки на сцене — трекаем чтобы переносить в oldContainer при переходе локации
  poops: Phaser.GameObjects.Image[] = []

  // Phase 21-05 (Wave 5): prevLocation / bg package-public — мутируется LocationTransition.
  prevLocation = 1
  isLocationTransitioning = false
  bg!: Phaser.GameObjects.Image
  // Two-zone loc1: tall background covering frogs zone (top) + buildings zone (bottom).
  private loc1Bg!: Phaser.GameObjects.Image
  private currentZone: 'frogs' | 'buildings' = 'frogs'
  // Аккумулятор для фонового дохода с лягушек неактивных локаций
  // (на текущей локации монеты приходят через настоящие какашки visible-лягушек)
  private bgIncomeAccum = 0

  // Phase 12: overlay manager для carrier-лягушек.
  overlayManager: FrogOverlayManager | null = null

  // Phase 22: Phaser-native fire aura overlay (baked radial gradient textures).
  // Phaser-native aura'ы для carrier'ов разных элементов. Рисуются прямо
  // в сцене под лягушкой, без bridge через DOM. Каждый элемент имеет свой
  // визуальный паттерн (пламя/ripples/листья/токсичные облака).
  // Package-public — LocationTransition пересоздаёт массив после dual-container animation.
  elementAuras: ElementAuraOverlay[] = []

  // Phase 14: serum selection layer (зелёные halo + red flash).
  selectionLayer: SerumSelectionLayer | null = null
  cachedSerumDragActive = false
  // Phase 14: SERUM-11 desktop drag — haptic-rate-limit на hover eligible.
  // Phase 21-05: package-public — мутируется FrogInteraction + LocationTransition.
  lastHaptiHover = false

  // Swipe detection state for vertical zone switching (loc1 only).
  private swipeArmed = false
  private swipePanning = false
  private swipeStartY = 0
  private swipeStartScrollY = 0

  // Phase 21-01 (Wave 1): frog spawn / motion / lifecycle в отдельном controller'е.
  private spawner!: FrogSpawner

  // Phase 21-02 (Wave 2): merge / feed / carrier-merge в отдельном controller'е.
  private merge!: MergeController

  // Phase 21-03 (Wave 3): box drop / open в отдельном controller'е.
  private box!: BoxController

  // Phase 21-03 (Wave 3): auto-poop drops в отдельном controller'е.
  private poop!: PoopController

  // Phase 21-04 (Wave 4): magnet system в отдельном controller'е (state + tick).
  private magnet!: MagnetController

  // Дрон автосбора (autoCollect upgrade). Существует только на локации 1.
  private drone!: DroneController

  // Фабрика (статичный спрайт). Только на локации 1.
  private factory!: FactoryController

  // Phase 21-05 (Wave 5): location transition (clearField + dual-container zoom).
  // Package-public — game/index.ts вызывает runOpen/CloseStarMapTransition при
  // переключении на/со Звёздной карты.
  locTransition!: LocationTransition

  // Phase 21-05 (Wave 5): tap / serum-drag handlers + selection subscribe.
  private interaction!: FrogInteraction

  // Camera всегда на зум 1.0 — без камерных трюков, чтобы canvas не «дёргался»
  // и не было чёрной рамки. Эффект «другого масштаба» полностью отрабатывают
  // контейнеры oldContainer / newContainer.

  constructor() {
    super({ key: 'MainScene' })
  }

  preload() {
    // Каждый уровень: загружаем SVG как raw текст, потом на FILE_COMPLETE
    // заменяем все `fill #ffffff` на cfg.tint hex и регистрируем blob URL
    // под обычным texture key. setTint в spawnFrog мы НЕ вызываем —
    // tint уже запечён, цветные элементы (корона, узоры) остаются нетронутыми.
    const loaded = new Set<string>()
    FROG_LEVELS.forEach((cfg, idx) => {
      const level = idx + 1
      const key = textureKeyForLevel(level)
      if (loaded.has(key)) return
      loaded.add(key)
      this.load.text(`frog_raw_text_${level}`, cfg.path)
    })

    this.load.on(
      Phaser.Loader.Events.FILE_COMPLETE,
      (key: string, _type: string, data: unknown) => {
        const m = key.match(/^frog_raw_text_(\d+)$/)
        if (!m) return
        const level = Number(m[1])
        const cfg = FROG_LEVELS[level - 1]
        if (!cfg || typeof data !== 'string') return
        const tintHex = '#' + cfg.tint.toString(16).padStart(6, '0')
        const recolored = data
          .replace(/fill:\s*#ffffff/gi, `fill:${tintHex}`)
          .replace(/fill="#ffffff"/gi, `fill="${tintHex}"`)
          .replace(/fill="#fff"/gi, `fill="${tintHex}"`)
        const blob = new Blob([recolored], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        this.load.svg(textureKeyForLevel(level), url, {
          width: 50 * TEXTURE_QUALITY * cfg.size,
          height: 47 * TEXTURE_QUALITY * cfg.size,
        })
      },
    )

    this.load.svg('goo', '/goo.svg', {
      width: 18 * TEXTURE_QUALITY,
      height: 18 * TEXTURE_QUALITY,
    })
    this.load.image('map', '/maps/map.webp')
    this.load.image('map2', '/maps/map2.webp')
    this.load.image('map3', '/maps/map3.webp')
    this.load.image('map4', '/maps/map4.webp')
    // 2026-05-28: тестовые toxic_mapN для всех локаций (см. mapKeyForLocation).
    this.load.image('toxic_map', '/maps/toxic_map.webp')
    this.load.image('toxic_map2', '/maps/toxic_map2.webp')
    this.load.image('toxic_map3', '/maps/toxic_map3-v2.png')
    this.load.image('toxic_map4', '/maps/toxic_map4.webp')
    this.load.image('box', '/box.webp')
    this.load.image('magnet', '/magnet.png')
    this.load.image('goo_collector', '/goo_collector.png')
    this.load.image('factory3_shadow', '/factory/factory3_shadow.png')
    this.load.image('toxic_map2size', '/maps/toxic_map2size.png')
  }

  /**
   * On-demand загрузка SVG для t1/t2 эволюционных тиров.
   * Базовый t0 уже загружен в preload(). Для t1/t2 — pull SVG как text,
   * перекрашиваем (replace #ffffff → cfg.tint) и регистрируем под tier-key.
   * Если уже зарегистрирован — мгновенный callback.
   */
  ensureFrogTextureLoaded(
    level: number,
    tier: number,
    onReady: () => void,
  ): void {
    const t = Math.max(0, Math.min(2, Math.floor(tier)))
    const key = textureKeyForLevel(level, t)
    if (this.textures.exists(key)) {
      onReady()
      return
    }
    const cfg = FROG_LEVELS[level - 1]
    if (!cfg) {
      onReady()
      return
    }
    // 2026-05-28: путь к tier-SVG берём из cfg.path (для swap L7↔L8 модельки).
    // Раньше был хардкод frog${level}_t${t}.svg → tier эволюции прыгала на
    // оригинальный номер вместо swapped.
    const path = cfg.path.replace(/_t0\.svg$/, `_t${t}.svg`)
    // Через fetch — обходим Phaser loader queue (он завершён к этому моменту,
    // на новые .load.* нужен .start() и т.д., проще fetch напрямую).
    fetch(path)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`404 ${path}`))))
      .then((svg) => {
        const tintHex = '#' + cfg.tint.toString(16).padStart(6, '0')
        const recolored = svg
          .replace(/fill:\s*#ffffff/gi, `fill:${tintHex}`)
          .replace(/fill="#ffffff"/gi, `fill="${tintHex}"`)
          .replace(/fill="#fff"/gi, `fill="${tintHex}"`)
        const blob = new Blob([recolored], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        this.load.svg(key, url, {
          width: 50 * TEXTURE_QUALITY * cfg.size,
          height: 47 * TEXTURE_QUALITY * cfg.size,
        })
        this.load.once(Phaser.Loader.Events.COMPLETE, () => onReady())
        this.load.start()
      })
      .catch(() => {
        // SVG ещё не существует — продолжаем с t0 (текущей текстурой).
        onReady()
      })
  }

  create() {
    const { width, height } = this.scale

    // Phase 21-01 (Wave 1): инициализируем spawner до первого spawnLocationFrogs.
    this.spawner = new FrogSpawner(this)
    // Phase 21-02 (Wave 2): merge controller — spawner-зависимая (spiralFrogTo/spawnFrog).
    this.merge = new MergeController(this, this.spawner)
    // Phase 21-03 (Wave 3): box (spawn + open) и poop (auto-drop) controller'ы.
    this.box = new BoxController(this, this.spawner, this.merge)
    this.poop = new PoopController(this, this.merge)
    // Phase 21-04 (Wave 4): magnet controller — нужен merge.findClosestSameLevelPair / performMerge.
    this.magnet = new MagnetController(this, this.merge)
    // Дрон автосбора — box.onBoxTapped открывает обычные боксы на Болоте.
    this.drone = new DroneController(this, this.box)
    // Фабрика — статичный спрайт на локации 1.
    this.factory = new FactoryController(this)
    // Phase 21-05 (Wave 5): location-transition + interaction controllers.
    this.locTransition = new LocationTransition(
      this,
      this.spawner,
      this.magnet,
      this.box,
    )
    this.interaction = new FrogInteraction(this, this.spawner, this.merge)

    // Зум-переход красиво смотрится только если за пределами поля чёрный, а не серый
    this.cameras.main.setBackgroundColor(0x0b1a0b)
    this.prevLocation = useGameStore.getState().currentLocation
    this.cameras.main.setZoom(1)

    this.bg = this.add.image(
      width / 2,
      height / 2,
      mapKeyForLocation(this.prevLocation),
    )
    this.bg.setDisplaySize(width, height)
    this.bg.setDepth(-1) // фон всегда под лягушками
    this.bg.setTint(0xc4c8c4) // 2026-05-28: затемнение фона — контраст с лягушками

    // Two-zone loc1 background (frogs top + buildings bottom).
    this.loc1Bg = this.add.image(width / 2, height, 'toxic_map2size')
    this.loc1Bg.setDisplaySize(width, height * 2)
    this.loc1Bg.setDepth(-1)
    this.loc1Bg.setTint(0xc4c8c4)
    this.loc1Bg.setVisible(false)

    this.configureWorld(useGameStore.getState().currentLocation)

    // DEV-only: визуализация границ игрового поля; production билд не показывает.
    if (import.meta.env.DEV) {
      const fieldW = width - FIELD_PAD_X * 2
      const fieldH = height - FIELD_PAD_Y - FIELD_PAD_Y_BOTTOM
      const fieldCenterY = (FIELD_PAD_Y + (height - FIELD_PAD_Y_BOTTOM)) / 2
      this.add
        .rectangle(width / 2, fieldCenterY, fieldW, fieldH)
        .setStrokeStyle(2, 0xffffff, 0.35)
        .setFillStyle(0x000000, 0)
    }

    // Two-zone: transition reset + post-settle reconfigure + toggle handler.
    eventBus.on('location:transitionStart', this.onTransitionStart)
    eventBus.on('location:transitionEnd', this.onTransitionEnd)
    eventBus.on('field:toggleZone', this.onToggleZone)

    // Подписка на покупку лягушки из магазина
    eventBus.on('frog:purchased', this.onFrogPurchased)

    // Reactive update визуала лягушек на поле при апгрейде tier'а в магазине.
    // Слушаем frogTiers diff — если для уровня tier вырос, перегружаем sprite
    // у всех live-frogs этого level через ensureFrogTextureLoaded.
    const prevTiers = [...useGameStore.getState().frogTiers]
    const unsubTiers = useGameStore.subscribe((state) => {
      const next = state.frogTiers
      for (let i = 0; i < next.length; i++) {
        const prev = prevTiers[i] ?? 0
        const cur = next[i] ?? 0
        if (cur === prev) continue
        prevTiers[i] = cur
        const level = i + 1
        this.ensureFrogTextureLoaded(level, cur, () => {
          const key = textureKeyForLevel(level, cur)
          for (const f of this.frogs) {
            if (f.level === level) f.body.setTexture(key)
          }
        })
      }
    })
    this.events.once(Phaser.Scenes.Events.DESTROY, () => unsubTiers())
    // Phase 21-05: location-changed + dev-clear перенесены в LocationTransition.
    eventBus.on('location:changed', this.locTransition.onLocationChanged)
    eventBus.on('dev:clearAllFrogs', this.locTransition.onDevClearAllFrogs)
    // Plan 22-03: carrier ascension visual hook.
    eventBus.on('cosmic:carrier-ascended', this.onCarrierAscended)
    // Plan 22-05: cosmic shop «Cosmic Box» purchase → spawn 3 L7 frogs at random.
    eventBus.on('cosmic:cosmic-box-purchased', this.onCosmicBoxPurchased)

    // Phase 24 Plan 24-02: cinematic при 'captain:birth-start'
    // (emit'ит MergeController в Plan 24-04 при первом L18+L18 normal merge).
    // Listener живёт всю жизнь scene; uninstall — в destroy() ниже.
    // Idempotent: install() сам снимает старый handler перед регистрацией.
    CaptainBirthEffect.install(this)

    eventBus.on('rareCrate:claim', ({ level }) => {
      const store = useGameStore.getState()
      const cfg = FROG_LEVELS[level - 1]
      const targetLocation = cfg.location
      const currentLocation = store.currentLocation
      store.addFrogToLocation(targetLocation, level)

      if (targetLocation !== currentLocation) {
        const { width, height } = this.scale
        const cx = width / 2
        const cy = (FIELD_PAD_Y + (height - FIELD_PAD_Y_BOTTOM)) / 2
        this.playCrossLocationFlyAway(cx, cy, level)
        return
      }

      const { x, y } = this.randomFieldPos()
      const newFrog = this.spawnFrog(x, y, level)
      newFrog.container.setScale(0)
      this.tweens.add({
        targets: newFrog.container,
        scale: BASE_SCALE * 1.2,
        duration: 160,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: newFrog.container,
            scale: BASE_SCALE,
            duration: 100,
            ease: 'Power2.easeOut',
          })
        },
      })
    })

    this.spawnLocationFrogs()

    // Phase 12: overlay manager — создаётся ПОСЛЕ spawnLocationFrogs так что
    // первый sync видит уже живых лягушек, и для их frogId-match с CarrierData.
    this.overlayManager = new FrogOverlayManager(this, () => this.frogs)
    this.createElementAuras()
    this.rebindCarriers()

    // Phase 14: serum selection layer + subscribe на serumDragActive.
    this.selectionLayer = new SerumSelectionLayer(this)

    // Phase 21-05: serum subscribe + global pointerdown + desktop DnD listeners
    // — перенесены в FrogInteraction.setup().
    this.interaction.setup()

    // Swipe detection для vertical zone switch (loc1 frogs ↔ buildings).
    this.input.on('pointerdown', this.onSwipePointerDown, this)
    this.input.on('pointermove', this.onSwipePointerMove, this)
    this.input.on('pointerup', this.onSwipePointerUp, this)

    // Phase 12 dev: expose scene для smoke-helpers (window.__listFrogIds()).
    // Phase 23 Plan 23-05: expose в production тоже — OnboardingController (React)
    // нуждается в scene reference чтобы spawn'ить Phaser ConfettiBurst при
    // 'location:unlocked'. React/Phaser bridge: scene публичная, но трогать
    // только из bridge-points (overlay/celebration), не для game state.
    {
      const w = window as unknown as { __mainScene?: MainScene }
      w.__mainScene = this
    }
  }

  // Phase 21-05: subscribeSerumState / onPointerDownGlobal перенесены в FrogInteraction.

  // Phase 21-05: package-public — используется LocationTransition (newContainer
  // spawn). Остаётся в scene потому что rareCrate handler в create() тоже
  // использует, и там удобнее чем пробрасывать через controller.
  randomFieldPos(): { x: number; y: number } {
    const { width, height } = this.scale
    const margin = 40 * DPR
    const x = Phaser.Math.Between(
      FIELD_PAD_X + margin,
      width - FIELD_PAD_X - margin,
    )
    const y = Phaser.Math.Between(
      FIELD_PAD_Y + margin,
      height - FIELD_PAD_Y_BOTTOM - margin,
    )
    return { x, y }
  }

  // Phase 21-01: тонкий wrapper над FrogSpawner — оставлен для совместимости
  // с существующими call-site внутри MainScene (create, onLocationChanged).
  private spawnLocationFrogs() {
    this.spawner.spawnLocationFrogs()
  }

  private rebindCarriers(): void {
    this.spawner.rebindCarriers()
  }

  /**
   * Создаёт/пересоздаёт массив element aura overlays. Вызывается из create()
   * и из LocationTransition.onLocationChanged.onComplete (после того как старые
   * auras были перенесены в oldContainer и уничтожены вместе с ним).
   */
  createElementAuras(): void {
    this.elementAuras = [
      new ElementAuraOverlay(this, () => this.frogs, 'fire', fireSpec),
      new ElementAuraOverlay(this, () => this.frogs, 'water', waterSpec),
      new ElementAuraOverlay(this, () => this.frogs, 'forest', forestSpec),
      new ElementAuraOverlay(this, () => this.frogs, 'toxic', toxicSpec),
      new ElementAuraOverlay(this, () => this.frogs, 'plasma', plasmaSpec),
      new ElementAuraOverlay(this, () => this.frogs, 'crystal', crystalSpec),
      new ElementAuraOverlay(this, () => this.frogs, 'desert', desertSpec),
      new ElementAuraOverlay(this, () => this.frogs, 'gas', gasSpec),
      new ElementAuraOverlay(this, () => this.frogs, 'ring', ringSpec),
      new ElementAuraOverlay(this, () => this.frogs, 'binary', binarySpec),
    ]
  }

  // Phase 21-05: clearField / onLocationChanged / onDevClearAllFrogs перенесены
  // в LocationTransition (см. main/LocationTransition.ts).

  // Phase 21-01: spawnFrog/idle/dash/scheduleNext перенесены в FrogSpawner.
  // Эти thin-wrapper'ы оставлены для существующих внутренних call-site
  // (onFrogPurchased, rareCrate handler, performMerge spawn-after-vortex,
  // performFeed spawn newFrog, performCarrierMerge, onBoxTapped, debugSpawnAllCarriers).
  private spawnFrog(x: number, y: number, level: number = 1): FrogData {
    return this.spawner.spawnFrog(x, y, level)
  }

  // Phase 21-01/21-05: package-public — вызывается FrogSpawner (dragend handler).
  // Реализация в FrogInteraction.
  onFrogTapped(
    frog: FrogData,
    tapX: number = frog.container.x,
    tapY: number = frog.container.y,
  ) {
    this.interaction.onFrogTapped(frog, tapX, tapY)
  }

  // Phase 21-05: SERUM tap/apply/mis-tap helpers + clientToWorld/findFrogAt +
  // desktop pointer-move/up handlers перенесены в FrogInteraction.

  // ============== КАКАШКИ (auto-collect) ==============
  // Phase 21-03: spawnAutoPoop перенесён в PoopController.

  // Phase 21-01/21-03: package-public — вызывается FrogSpawner (poopTimer callback).
  spawnAutoPoop(frog: FrogData, type: PoopType) {
    this.poop.spawnAutoPoop(frog, type)
  }

  // ============== МЕРДЖ ==============
  // Phase 21-02: вся merge-логика (standard / feed / carrier-merge), find-target,
  // vortex/flash/floating-text, locationName, fly-away — в MergeController.
  // Тонкие wrapper'ы здесь нужны для:
  //   1) FrogSpawner вызывает scene.findMergeTarget / scene.performMerge из
  //      drag-handler'ов (ему дешевле звать через scene, чем хранить ref на merge).
  //   2) playCrossLocationFlyAway ещё вызывается из onFrogPurchased / rareCrate
  //      handler'ов в create().

  // Phase 21-01/21-02: package-public — используется FrogSpawner (dragend handler).
  findMergeTarget(
    x: number,
    y: number,
    level: number,
    exclude: FrogData,
  ): FrogData | null {
    return this.merge.findMergeTarget(x, y, level, exclude)
  }

  // Phase 21-01/21-02: package-public — вызывается FrogSpawner (dragend handler).
  performMerge(a: FrogData, b: FrogData, cx: number, cy: number) {
    this.merge.performMerge(a, b, cx, cy)
  }

  private playCrossLocationFlyAway(x: number, y: number, level: number) {
    this.merge.playCrossLocationFlyAway(x, y, level)
  }

  // ============== БОКС-ДРОПЫ ==============
  // Phase 21-03: вся box-логика (spawn / land / idle / tap) перенесена в
  // BoxController. Wrapper'ы canSpawnBox / spawnBox используются в
  // update()-loop'е и в onLocationChanged (pending-spawn).

  private canSpawnBox(): boolean {
    return this.box.canSpawnBox()
  }

  private spawnBox(isRare = false, preLanded = false) {
    this.box.spawnBox(isRare, preLanded)
    // 2026-05-30: фабрика «выстреливает» squash'ем при реальном дропе с неба
    // (preLanded=false). Лор: бокс вылетает из трубы фабрики снизу → падает.
    // factory.pulse() сам no-op если спрайт скрыт (не Болото).
    if (!preLanded) this.factory?.pulse()
  }

  // ============== МАГНИТ ==============
  // Phase 21-04: вся логика (spawn / update / remove + state) в MagnetController.

  // ============== ПОКУПКА ЛЯГУШЕК ==============

  private onFrogPurchased = ({ level }: { level: number }) => {
    const { width, height } = this.scale
    const cfg = FROG_LEVELS[level - 1]
    const store = useGameStore.getState()
    const targetLocation = cfg.location
    const currentLocation = store.currentLocation

    // Лягушка всегда «приписывается» к своей родной локации в store
    store.addFrogToLocation(targetLocation, level)

    if (targetLocation !== currentLocation) {
      // Куплена лягушка с другой локации — показываем призрачную анимацию по центру поля
      const cx = width / 2
      const cy = (FIELD_PAD_Y + (height - FIELD_PAD_Y_BOTTOM)) / 2
      this.playCrossLocationFlyAway(cx, cy, level)
      return
    }

    // На своей локации — обычный спавн на случайной позиции с pop-in
    const x = Phaser.Math.Between(
      FIELD_PAD_X + 30 * DPR,
      width - FIELD_PAD_X - 30 * DPR,
    )
    const y = Phaser.Math.Between(
      FIELD_PAD_Y + 30 * DPR,
      height - FIELD_PAD_Y_BOTTOM - 30 * DPR,
    )
    const newFrog = this.spawnFrog(x, y, level)
    newFrog.container.setScale(0)
    this.tweens.add({
      targets: newFrog.container,
      scale: BASE_SCALE * 1.2,
      duration: 160,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: newFrog.container,
          scale: BASE_SCALE,
          duration: 100,
          ease: 'Power2.easeOut',
        })
      },
    })
  }

  // Plan 22-03: carrier ascension visual hook.
  // Триггерится из ascendCarrier action (после удаления carrier из store).
  // Находит live frog по frogId и проигрывает ~1.5s tween (scale up + alpha → 0
  // + rise + aura pulse). По завершению — removeFrog освобождает сцену.
  // Edge case: cross-location carrier (synthetic frogId) → frog не найден →
  // tween не запускается, аура ярко исчезает в фоне (store mutation уже произошла).
  private onCarrierAscended = ({
    frogId,
    element,
  }: {
    frogId: string
    element: Element
  }) => {
    const frog = this.frogs.find((f) => f.id === frogId)
    if (!frog) {
      // Cross-location ascension или race с removeFrog — no visual.
      return
    }
    // Освобождаем overlay явно ДО tween, чтобы aura не двигалась с лягушкой
    // и не оставалась после destroy (FrogOverlayManager subscribe тоже его
    // освободит когда увидит carrier removed из store, но мы делаем это
    // syncronously для надёжности).
    this.overlayManager?.releaseForFrog(frogId)

    // Помечаем чтобы merge/drag не цеплял ascending лягушку.
    frog.isMerging = true
    frog.isMoving = true
    frog.poopTimer?.remove()
    frog.poopTimer = null
    this.tweens.killTweensOf(frog.container)
    this.tweens.killTweensOf(frog.body)
    frog.body.disableInteractive()

    playAscensionTween(this, frog.container, element, () => {
      // Container уже фактически уничтожен внутри tween (alpha=0 + destroy);
      // здесь — clean removal из scene.frogs и syncEntityCount.
      this.spawner.removeFrog(frog)
    })
  }

  // Plan 22-05: cosmic shop «Cosmic Box» purchase → spawn 3 L7 frogs.
  // Placeholder spawn behavior (балансировка позже): L7 заранее, на random позициях
  // в пределах поля. Также добавляем в store.locationFrogs для текущей локации,
  // чтобы при reload они персистились (а не только визуально).
  private onCosmicBoxPurchased = () => {
    const store = useGameStore.getState()
    const currentLoc = store.currentLocation
    const SPAWN_LEVEL = 7
    for (let i = 0; i < 3; i++) {
      const { x, y } = this.randomFieldPos()
      const newFrog = this.spawnFrog(x, y, SPAWN_LEVEL)
      store.addFrogToLocation(currentLoc, SPAWN_LEVEL)
      // Pop-in анимация (CSS-free, Phaser tween — Phaser legal).
      newFrog.container.setScale(0)
      this.tweens.add({
        targets: newFrog.container,
        scale: BASE_SCALE * 1.2,
        duration: 200,
        delay: i * 80,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: newFrog.container,
            scale: BASE_SCALE,
            duration: 120,
            ease: 'Power2.easeOut',
          })
        },
      })
    }
  }

  // Phase 21-01: package-public — вызывается FrogSpawner (after spawn/remove).
  syncEntityCount() {
    useGameStore
      .getState()
      .setEntityCount(this.frogs.length + this.boxes.length)
    this.syncIncomePerSec()
  }

  // Суммарный доход в секунду — со ВСЕХ лягушек на ВСЕХ локациях + L18 absolute bonus.
  // 2026-05-18: l18AbsoluteBonusPerSec (passive ghost-frog income от first L18+L18
  // merge) включается в total так чтобы Header показывал combined display.
  private syncIncomePerSec() {
    const state = useGameStore.getState()
    let total = state.l18AbsoluteBonusPerSec
    for (const arr of state.locationFrogs) {
      for (const lvl of arr) total += getTargetIncomePerSec(lvl)
    }
    state.setIncomePerSec(total)
  }

  // ============== UPDATE ==============

  override update(_time: number, delta: number) {
    const storeForTimer = useGameStore.getState()
    // Таймер бокса тикает даже во время перехода локаций — UI-иконка не должна
    // замирать на переключении. Спавн/pending логику пропускаем (см. ниже).
    {
      const intervalMs = getDropIntervalMs(storeForTimer.upgrades.dropSpeed)
      this.boxProgressMs = Math.min(this.boxProgressMs + delta, intervalMs)
      const cappedProgress = Math.min(1, this.boxProgressMs / intervalMs)
      if (storeForTimer.boxProgress !== cappedProgress) {
        storeForTimer.setBoxProgress(cappedProgress)
      }
    }

    // 2026-05-30: дрон + фабрика показываются ДО transition-gate, чтобы
    // появляться синхронно с лягушками (которые спавнятся в transition-
    // handler'е), а не через секунду после unfreeze. Только статичный show —
    // движение дрона (tick) остаётся ниже gate.
    {
      const locId = storeForTimer.currentLocation
      if (locId === 1) {
        this.factory.show()
        if ((storeForTimer.upgrades.autoCollect ?? 0) > 0) {
          this.drone.ensureSpawned()
        }
      } else {
        this.factory.hide()
        this.drone.despawn()
      }
    }

    // Во время перехода между локациями замораживаем всю логику —
    // лягушки в wrapper-контейнере с локальными координатами, любые расчёты
    // позиций выдадут неправильные значения.
    if (this.isLocationTransitioning) return

    const store = useGameStore.getState()

    // Фоновый доход с лягушек на НЕ-текущих локациях + L18 absolute bonus.
    // На текущей локации монеты приходят через анимацию какашек у visible-лягушек,
    // фоновые лягушки никогда не видны → начисляем им золото напрямую.
    // 2026-05-18: l18AbsoluteBonusPerSec (от first L18+L18 merge) тикает здесь
    // как ghost-frog income (см. gameStore). Multiplier applies через addGold.
    const currentLocId = store.currentLocation
    let bgIncomePerSec = store.l18AbsoluteBonusPerSec
    store.locationFrogs.forEach((arr, idx) => {
      const locId = idx + 1
      if (locId === currentLocId) return
      for (const lvl of arr) bgIncomePerSec += getTargetIncomePerSec(lvl)
    })
    if (bgIncomePerSec > 0) {
      this.bgIncomeAccum += bgIncomePerSec * (delta / 1000)
      if (this.bgIncomeAccum >= 1) {
        const whole = Math.floor(this.bgIncomeAccum)
        store.addGold(whole)
        this.bgIncomeAccum -= whole
      }
    }

    // Динамический интервал из апгрейда "Скорость дропа"
    const intervalMs = getDropIntervalMs(store.upgrades.dropSpeed)
    const isBoloto = currentLocId === 1

    // Спавн без очереди: раз в интервал спавним РОВНО один бокс — только на Болоте
    // и только если есть свободный слот. Никаких pending/offline-накоплений: таймер
    // просто тикает, переполнение интервала не копится.
    const outputBlocked = isBoloto && !this.canSpawnBox()
    if (this.boxProgressMs >= intervalMs) {
      if (isBoloto && this.canSpawnBox()) {
        this.spawnBox()
        this.boxProgressMs = 0
      } else if (!isBoloto) {
        // Не на Болоте боксов нет — сбрасываем таймер, ничего не копим.
        this.boxProgressMs = 0
      } else {
        // Болото, но поле заполнено — ждём слот (waiting), очередь не растёт.
        this.boxProgressMs = intervalMs
      }
    }
    const progress = Math.min(1, this.boxProgressMs / intervalMs)
    const waiting = this.boxProgressMs >= intervalMs && outputBlocked
    if (Math.abs(store.boxProgress - progress) > 0.005) {
      store.setBoxProgress(progress)
    }
    if (store.boxWaiting !== waiting) {
      store.setBoxWaiting(waiting)
    }

    // Магнит per-location. 2026-05-23: для L2/L3 свои upgrade-ключи (magnet2/magnet3),
    // покупка открывается после cosmos. Активен если level > 0 (gate сам собой через
    // отсутствие покупки). Phase 14 (SERUM-06): auto-pause во время serum selection.
    const magnetKey = magnetKeyForLocation(store.currentLocation)
    const magnetLevel = store.upgrades[magnetKey]
    const serumPaused = store.serumDragActive
    if (!serumPaused && magnetLevel > 0 && store.magnetEnabled) {
      this.magnet.tick(magnetLevel, delta)
    } else {
      this.magnet.resetSpawnTimer()
    }

    // Дрон автосбора — движение/сбор. Lifecycle (spawn/despawn по локации)
    // управляется блоком выше transition-gate. Здесь только tick при активных
    // условиях; при serum-pause дрон просто замирает (не despawn).
    const autoCollectLevel = store.upgrades.autoCollect
    if (currentLocId === 1 && autoCollectLevel > 0 && !serumPaused) {
      this.drone.tick(autoCollectLevel, delta)
    }

    // Фабрика show/hide — тоже в блоке выше transition-gate.

    // Depth sort: чем ниже лягушка/коробка, тем она поверх
    for (const frog of this.frogs) {
      if (!frog.isDragging && !frog.isMerging) {
        frog.container.setDepth(frog.container.y)
      }
    }
    for (const box of this.boxes) {
      box.img.setDepth(box.baseY)
    }

    // Phase 12: тикаем overlay manager (sync carriers + viewport culling).
    this.overlayManager?.tick()

    // Phase 22: Phaser-native element aura'ы (baked radial gradient textures).
    for (const aura of this.elementAuras) aura.tick()

    // Какашки auto-collect через onComplete твинов — никакой ручной очистки не нужно
  }

  private configureWorld(locId: number): void {
    const { width, height } = this.scale
    if (locId === 1) {
      this.loc1Bg.setVisible(true)
      this.bg.setVisible(false)
      this.cameras.main.setBounds(0, 0, width, height * 2)
    } else {
      this.loc1Bg.setVisible(false)
      this.bg.setVisible(true)
      this.cameras.main.setBounds(0, 0, width, height)
    }
    this.cameras.main.setScroll(0, 0)
    this.currentZone = 'frogs'
    eventBus.emit('field:zoneChanged', { zone: 'frogs' })
  }

  private onTransitionStart = () => {
    const { width, height } = this.scale
    this.tweens.killTweensOf(this.cameras.main)
    this.cameras.main.setScroll(0, 0)
    this.currentZone = 'frogs'
    this.loc1Bg.setVisible(false)
    this.bg.setVisible(true)
    this.cameras.main.setBounds(0, 0, width, height)
    eventBus.emit('field:zoneChanged', { zone: 'frogs' })
  }

  private onTransitionEnd = ({ id }: { id: number }) => {
    this.configureWorld(id)
  }

  private setZone(zone: 'frogs' | 'buildings'): void {
    if (useGameStore.getState().currentLocation !== 1) return
    if (this.currentZone === zone) return
    const { height } = this.scale
    this.currentZone = zone
    this.tweens.killTweensOf(this.cameras.main)
    this.tweens.add({
      targets: this.cameras.main,
      scrollY: zone === 'buildings' ? height : 0,
      duration: 420,
      ease: 'Sine.easeInOut',
    })
    eventBus.emit('field:zoneChanged', { zone })
  }

  private onToggleZone = () => {
    if (useGameStore.getState().currentLocation !== 1) return
    this.setZone(this.currentZone === 'frogs' ? 'buildings' : 'frogs')
  }

  private onSwipePointerDown = (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
    if (
      useGameStore.getState().currentLocation !== 1 ||
      this.isLocationTransitioning ||
      useGameStore.getState().serumDragActive ||
      currentlyOver.length !== 0
    ) {
      this.swipeArmed = false
      return
    }
    this.swipeArmed = true
    this.swipePanning = false
    this.swipeStartY = pointer.y
    this.swipeStartScrollY = this.cameras.main.scrollY
    this.tweens.killTweensOf(this.cameras.main)
  }

  private onSwipePointerMove = (pointer: Phaser.Input.Pointer) => {
    if (!this.swipeArmed || !pointer.isDown) return
    if (!this.swipePanning) {
      if (Math.abs(pointer.y - this.swipeStartY) < SWIPE_SLOP) return
      // порог пройден — начинаем пан, перезаякориваемся чтобы не было скачка
      this.swipePanning = true
      this.swipeStartY = pointer.y
      this.swipeStartScrollY = this.cameras.main.scrollY
    }
    const { height } = this.scale
    const ns = Phaser.Math.Clamp(this.swipeStartScrollY - (pointer.y - this.swipeStartY), 0, height)
    this.cameras.main.setScroll(0, ns)
  }

  private onSwipePointerUp = (pointer: Phaser.Input.Pointer) => {
    if (!this.swipeArmed) return
    const wasPanning = this.swipePanning
    this.swipeArmed = false
    this.swipePanning = false
    if (!wasPanning) return
    const { height } = this.scale
    const vy = pointer.velocity.y
    let target: number
    if (vy < -SWIPE_FLICK_V) {
      target = height            // флик вверх → зона строений (низ)
    } else if (vy > SWIPE_FLICK_V) {
      target = 0                 // флик вниз → зона лягушек (верх)
    } else {
      target = this.cameras.main.scrollY < height / 2 ? 0 : height   // медленно → ближайшая
    }
    const zone: 'frogs' | 'buildings' = target === 0 ? 'frogs' : 'buildings'
    this.currentZone = zone
    this.tweens.killTweensOf(this.cameras.main)
    this.tweens.add({ targets: this.cameras.main, scrollY: target, duration: 220, ease: 'Sine.easeOut' })
    eventBus.emit('field:zoneChanged', { zone })
  }

  destroy() {
    eventBus.off('location:transitionStart', this.onTransitionStart)
    eventBus.off('location:transitionEnd', this.onTransitionEnd)
    eventBus.off('field:toggleZone', this.onToggleZone)
    this.input.off('pointerdown', this.onSwipePointerDown, this)
    this.input.off('pointermove', this.onSwipePointerMove, this)
    this.input.off('pointerup', this.onSwipePointerUp, this)
    eventBus.off('frog:purchased', this.onFrogPurchased)
    // Phase 21-05: location handlers живут в LocationTransition; отписываем
    // bound-методы которые регистрировали в create().
    eventBus.off('location:changed', this.locTransition.onLocationChanged)
    eventBus.off('dev:clearAllFrogs', this.locTransition.onDevClearAllFrogs)
    eventBus.off('rareCrate:claim')
    eventBus.off('cosmic:carrier-ascended', this.onCarrierAscended)
    // Plan 22-05: shop cosmic-box event handler cleanup.
    eventBus.off('cosmic:cosmic-box-purchased', this.onCosmicBoxPurchased)
    // Phase 24 Plan 24-02: снимаем global captain:birth-start handler.
    CaptainBirthEffect.uninstall()
    // Phase 12: освобождаем все overlay'ы и dropAll pool.
    this.overlayManager?.dispose()
    this.overlayManager = null
    // Phase 22: dispose element aura overlay'ев (release tweens + canvas children).
    for (const aura of this.elementAuras) aura.dispose()
    this.elementAuras = []
    // Phase 14: cleanup selection layer.
    this.selectionLayer?.dispose()
    this.selectionLayer = null
    // Дрон автосбора — despawn при уничтожении сцены.
    this.drone?.despawn()
    // Фабрика — destroy при уничтожении сцены.
    this.factory?.destroy()
    // Phase 21-05: subscribe / DnD pointer listeners — в FrogInteraction.teardown().
    this.interaction.teardown()
    // Phase 23 Plan 23-05: очищаем window.__mainScene reference
    // (выставлено в create() для React→Phaser bridge).
    {
      const w = window as unknown as { __mainScene?: MainScene }
      if (w.__mainScene === this) delete w.__mainScene
    }
  }

  // Dev-only: spawn one frog per element on ALL 4 locations.
  // Current location: real Phaser objects (visible immediately).
  // Other locations: stored in locationFrogs + carrier placeholder IDs ('debug:el:loc').
  // rebindCarriers links placeholders to real frogs when user navigates there.
  debugSpawnAllCarriers(): void {
    const ELEMENTS: Array<Element> = [
      'fire',
      'ice',
      'water',
      'forest',
      'toxic',
      'plasma',
      'crystal',
      'desert',
      'gas',
      'ring',
      'binary',
    ]
    // Representative level per location
    const LOC_LEVEL: Record<number, number> = { 1: 1, 2: 7, 3: 13, 4: 19 }

    const store = useGameStore.getState()
    const currentLoc = store.currentLocation
    const newCarriers = [...store.carriers]
    const newLocationFrogs = store.locationFrogs.map((a) => [
      ...a,
    ]) as number[][]

    for (let loc = 1; loc <= 4; loc++) {
      const level = LOC_LEVEL[loc]
      ELEMENTS.forEach((element) => {
        if (loc === currentLoc) {
          // Spawn real Phaser frog — overlay attaches immediately
          const { x, y } = this.randomFieldPos()
          const frog = this.spawnFrog(x, y, level)
          newLocationFrogs[loc - 1].push(level)
          // Phase 22: carrier = { frogId, element, level } only
          newCarriers.push({
            frogId: frog.id,
            element,
            level,
          })
        } else {
          // Store placeholder — rebindCarriers links on navigation
          newLocationFrogs[loc - 1].push(level)
          newCarriers.push({
            frogId: `debug:${element}:${loc}`,
            element,
            level,
          })
        }
      })
    }

    useGameStore.setState({
      carriers: newCarriers,
      locationFrogs: newLocationFrogs,
    })
    this.overlayManager?.markDirty()
    devLog('[debug] spawned 16 carrier frogs on each of 4 locations (64 total)')
  }

}
