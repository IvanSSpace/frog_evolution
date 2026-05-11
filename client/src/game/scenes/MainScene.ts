import Phaser from 'phaser'
import {
  useGameStore,
  getDropIntervalMs,
  getLocationById,
  ENTITY_CAP,
} from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import {
  FROG_LEVELS,
  textureKeyForLevel,
  getTargetIncomePerSec,
  type PoopType,
} from '../config/frogs'
import { FrogOverlayManager } from '../effects/FrogOverlayManager'
import { SerumSelectionLayer } from '../effects/SerumSelectionLayer'
import type { Element, Rarity } from '../../store/cosmic/types'
import { devLog } from '../../utils/devLog'
import {
  BASE_SCALE,
  DPR,
  FIELD_PAD_X,
  FIELD_PAD_Y,
  FIELD_PAD_Y_BOTTOM,
  MAX_PENDING_BOXES,
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
import { LocationTransition } from './main/LocationTransition'
import { FrogInteraction } from './main/FrogInteraction'

// Буфер offline box drops: App.tsx эмитит 'box:offline-pending' синхронно в
// useEffect, а MainScene.create() регистрирует handler позже (после preload).
// Модульный listener ловит count до того, как scene готова к спавну — create()
// дренирует буфер сразу после spawnLocationFrogs().
let _offlineBoxBuffer = 0
eventBus.on('box:offline-pending', ({ count }: { count: number }) => {
  _offlineBoxBuffer += count
})

export class MainScene extends Phaser.Scene {
  // Phase 21 (Wave 1+): несколько полей переведены с `private` на package-public,
  // потому что main/FrogSpawner.ts (и далее main/MergeController, main/BoxController…)
  // читают/мутируют их напрямую. TS не имеет `friend`/`internal`, поэтому это
  // эквивалент package-private — поля не должны использоваться вне scenes/main/*.
  //
  //   frogs, overlayManager, selectionLayer, cachedSerumDragActive,
  //   isLocationTransitioning  — читает FrogSpawner
  frogs: FrogData[] = []
  // Phase 21-03 (Wave 3): boxes/boxOpenCount/pendingBoxCount пакеджед-public —
  // используются BoxController + LocationTransition.
  boxes: BoxData[] = []
  // Phase 21-05 (Wave 5): boxProgressMs/pendingBoxCount package-public —
  // мутируется LocationTransition (snap-end resets).
  boxProgressMs = 0
  boxOpenCount = 0
  pendingBoxCount = 0

  // Phase 21-04 (Wave 4): magnet state перенесён в MagnetController.

  // Phase 21-03 (Wave 3): poops package-public — мутируется PoopController +
  // LocationTransition (oldContainer reparent).
  // Живые какашки на сцене — трекаем чтобы переносить в oldContainer при переходе локации
  poops: Phaser.GameObjects.Image[] = []

  // Phase 21-05 (Wave 5): prevLocation / bg package-public — мутируется LocationTransition.
  prevLocation = 1
  isLocationTransitioning = false
  bg!: Phaser.GameObjects.Image
  // Аккумулятор для фонового дохода с лягушек неактивных локаций
  // (на текущей локации монеты приходят через настоящие какашки visible-лягушек)
  private bgIncomeAccum = 0

  // Phase 12: overlay manager для carrier-лягушек.
  overlayManager: FrogOverlayManager | null = null

  // Phase 14: serum selection layer (зелёные halo + red flash).
  selectionLayer: SerumSelectionLayer | null = null
  cachedSerumDragActive = false
  // Phase 14: SERUM-11 desktop drag — haptic-rate-limit на hover eligible.
  // Phase 21-05: package-public — мутируется FrogInteraction + LocationTransition.
  lastHaptiHover = false

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

  // Phase 21-05 (Wave 5): location transition (clearField + dual-container zoom).
  private locTransition!: LocationTransition

  // Phase 21-05 (Wave 5): tap / serum-drag handlers + selection subscribe.
  private interaction!: FrogInteraction

  // Camera всегда на зум 1.0 — без камерных трюков, чтобы canvas не «дёргался»
  // и не было чёрной рамки. Эффект «другого масштаба» полностью отрабатывают
  // контейнеры oldContainer / newContainer.

  constructor() {
    super({ key: 'MainScene' })
  }

  preload() {
    // Каждый уровень — свой SVG. Если несколько уровней используют один файл
    // (placeholder), грузим его один раз — textureKeyForLevel переиспользует ключ.
    const loaded = new Set<string>()
    FROG_LEVELS.forEach((cfg, idx) => {
      const level = idx + 1
      const key = textureKeyForLevel(level)
      if (loaded.has(key)) return
      loaded.add(key)
      this.load.svg(key, cfg.path, {
        width: 50 * TEXTURE_QUALITY * cfg.size,
        height: 47 * TEXTURE_QUALITY * cfg.size,
      })
    })

    this.load.svg('goo', '/goo.svg', {
      width: 18 * TEXTURE_QUALITY,
      height: 18 * TEXTURE_QUALITY,
    })
    this.load.image('map', '/map.webp')
    this.load.image('map2', '/map2.webp')
    this.load.image('map3', '/map3.webp')
    this.load.image('map4', '/map4.webp')
    this.load.image('box', '/box.webp')
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

    // Временная рамка игрового поля
    const fieldW = width - FIELD_PAD_X * 2
    const fieldH = height - FIELD_PAD_Y - FIELD_PAD_Y_BOTTOM
    const fieldCenterY = (FIELD_PAD_Y + (height - FIELD_PAD_Y_BOTTOM)) / 2
    this.add
      .rectangle(width / 2, fieldCenterY, fieldW, fieldH)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setFillStyle(0x000000, 0)

    // Подписка на покупку лягушки из магазина
    eventBus.on('frog:purchased', this.onFrogPurchased)
    // Offline box drops: модульный listener (выше класса) пишет в _offlineBoxBuffer
    // с момента загрузки модуля — ловит emit даже если он пришёл до create().
    // Инстанс-handler дренирует буфер при каждом новом emit (маловероятен,
    // но корректно обрабатывает повторные вызовы).
    eventBus.on('box:offline-pending', this.onOfflinePendingBoxes)
    // Phase 21-05: location-changed + dev-clear перенесены в LocationTransition.
    eventBus.on('location:changed', this.locTransition.onLocationChanged)
    eventBus.on('dev:clearAllFrogs', this.locTransition.onDevClearAllFrogs)

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

    // Дренируем offline-drop буфер: боксы которые должны были упасть пока
    // игрок был away (count пришёл в _offlineBoxBuffer через модульный listener).
    this.drainOfflineBoxBuffer()

    // Phase 12: overlay manager — создаётся ПОСЛЕ spawnLocationFrogs так что
    // первый sync видит уже живых лягушек, и для их frogId-match с CarrierData.
    this.overlayManager = new FrogOverlayManager(this, () => this.frogs)
    this.rebindCarriers()

    // Phase 14: serum selection layer + subscribe на serumDragActive.
    this.selectionLayer = new SerumSelectionLayer(this)

    // Phase 21-05: serum subscribe + global pointerdown + desktop DnD listeners
    // — перенесены в FrogInteraction.setup().
    this.interaction.setup()

    // Phase 12 dev: expose scene для smoke-helpers (window.__listFrogIds()).
    if (import.meta.env.DEV) {
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

  // Offline box drops: спавним боксы прямо на поле Болота до лимита ENTITY_CAP.
  // Cap'имся на ENTITY_CAP минус текущее число лягушек на Болоте.
  // Боксы и мегабоксы не persist'ятся, поэтому учитываем только frogs.
  // Остаток сверх cap теряется — поле физически не вмещает больше.
  // Примечание: count уже аккумулирован в _offlineBoxBuffer модульным listener'ом;
  // здесь только дренируем (не добавляем снова, чтобы не задвоить).
  private onOfflinePendingBoxes = (_evt: { count: number }) => {
    this.drainOfflineBoxBuffer()
  }

  private drainOfflineBoxBuffer() {
    if (_offlineBoxBuffer <= 0) return
    const store = useGameStore.getState()
    const bolotoFrogs = store.locationFrogs[0]?.length ?? 0
    const slots = Math.max(0, ENTITY_CAP - bolotoFrogs)
    const toSpawn = Math.min(_offlineBoxBuffer, slots)
    _offlineBoxBuffer = 0
    for (let i = 0; i < toSpawn; i++) {
      if (this.canSpawnBox()) {
        this.spawnBox(false, true) // preLanded — без анимации падения
      } else {
        break
      }
    }
  }

  // Phase 21-01: package-public — вызывается FrogSpawner (after spawn/remove).
  syncEntityCount() {
    useGameStore
      .getState()
      .setEntityCount(this.frogs.length + this.boxes.length)
    this.syncIncomePerSec()
  }

  // Суммарный доход в секунду — со ВСЕХ лягушек на ВСЕХ локациях
  private syncIncomePerSec() {
    const allLocs = useGameStore.getState().locationFrogs
    let total = 0
    for (const arr of allLocs) {
      for (const lvl of arr) total += getTargetIncomePerSec(lvl)
    }
    useGameStore.getState().setIncomePerSec(total)
  }

  // ============== UPDATE ==============

  update(_time: number, delta: number) {
    // Во время перехода между локациями замораживаем всю логику —
    // лягушки в wrapper-контейнере с локальными координатами, любые расчёты
    // позиций выдадут неправильные значения.
    if (this.isLocationTransitioning) return

    const store = useGameStore.getState()

    // Фоновый доход с лягушек на НЕ-текущих локациях.
    // На текущей локации монеты приходят через анимацию какашек у visible-лягушек,
    // фоновые лягушки никогда не видны → начисляем им золото напрямую.
    const currentLocId = store.currentLocation
    let bgIncomePerSec = 0
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

    // На болоте, если в pending остались накопленные коробки — выливаем по мере
    // освобождения слотов (после переноса с другой локации или мерджа лягушек).
    if (isBoloto) {
      while (this.pendingBoxCount > 0 && this.canSpawnBox()) {
        this.pendingBoxCount--
        this.spawnBox(false, true)
      }
    }

    // Заполнен ли «выходной канал»: на болоте — лимит entity, иначе — cap pending
    const outputBlocked = isBoloto
      ? !this.canSpawnBox()
      : this.pendingBoxCount >= MAX_PENDING_BOXES

    // Таймер боксов тикает всегда, спавн только на локации 1
    this.boxProgressMs = Math.min(this.boxProgressMs + delta, intervalMs)
    if (this.boxProgressMs >= intervalMs) {
      let produced = false
      if (isBoloto) {
        if (this.canSpawnBox()) {
          this.spawnBox()
          produced = true
        }
      } else if (this.pendingBoxCount < MAX_PENDING_BOXES) {
        this.pendingBoxCount++
        produced = true
      }
      // Сбрасываем только если реально что-то произвели; иначе залипаем на 100%
      if (produced) this.boxProgressMs = 0
      else this.boxProgressMs = intervalMs
    }
    const progress = Math.min(1, this.boxProgressMs / intervalMs)
    const waiting = this.boxProgressMs >= intervalMs && outputBlocked
    if (Math.abs(store.boxProgress - progress) > 0.005) {
      store.setBoxProgress(progress)
    }
    if (store.boxWaiting !== waiting) {
      store.setBoxWaiting(waiting)
    }

    // Магнит работает только на локации, где это разрешено (сейчас — только Болото L1).
    // Phase 14 (SERUM-06): auto-pause во время serum selection mode.
    const location = getLocationById(store.currentLocation)
    const magnetLevel = store.upgrades.magnet
    const serumPaused = store.serumDragActive
    // Phase 21-04: магнит — controller'ный tick. Phase 14 (SERUM-06): пока активен
    // serum-drag, magnet полностью pause'ится (resetSpawnTimer + не tick).
    if (
      !serumPaused &&
      location.magnetEnabled &&
      magnetLevel > 0 &&
      store.magnetEnabled
    ) {
      this.magnet.tick(magnetLevel, delta)
    } else {
      this.magnet.resetSpawnTimer()
    }

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

    // Какашки auto-collect через onComplete твинов — никакой ручной очистки не нужно
  }

  destroy() {
    eventBus.off('frog:purchased', this.onFrogPurchased)
    eventBus.off('box:offline-pending', this.onOfflinePendingBoxes)
    // Phase 21-05: location handlers живут в LocationTransition; отписываем
    // bound-методы которые регистрировали в create().
    eventBus.off('location:changed', this.locTransition.onLocationChanged)
    eventBus.off('dev:clearAllFrogs', this.locTransition.onDevClearAllFrogs)
    eventBus.off('rareCrate:claim')
    // Phase 12: освобождаем все overlay'ы и dropAll pool.
    this.overlayManager?.dispose()
    this.overlayManager = null
    // Phase 14: cleanup selection layer.
    this.selectionLayer?.dispose()
    this.selectionLayer = null
    // Phase 21-05: subscribe / DnD pointer listeners — в FrogInteraction.teardown().
    this.interaction.teardown()
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
    const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary']
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
      ELEMENTS.forEach((element, i) => {
        const rarity = RARITIES[i % RARITIES.length]
        if (loc === currentLoc) {
          // Spawn real Phaser frog — overlay attaches immediately
          const { x, y } = this.randomFieldPos()
          const frog = this.spawnFrog(x, y, level)
          newLocationFrogs[loc - 1].push(level)
          newCarriers.push({
            frogId: frog.id,
            element,
            rarity,
            feedCount: 0,
            stabilized: false,
            level,
          })
        } else {
          // Store placeholder — rebindCarriers links on navigation
          newLocationFrogs[loc - 1].push(level)
          newCarriers.push({
            frogId: `debug:${element}:${loc}`,
            element,
            rarity,
            feedCount: 0,
            stabilized: false,
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
