import Phaser from 'phaser'
import {
  useGameStore,
  getDropIntervalMs,
  getMagnetSpawnInterval,
  getMagnetDuration,
  getMagnetMergesPerCycle,
  getLocationById,
} from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import {
  FROG_LEVELS,
  MAX_LEVEL,
  textureKeyForLevel,
  getTargetIncomePerSec,
  type PoopType,
} from '../config/frogs'
import { hapticImpact, hapticNotification } from '../../utils/telegram'
import { FrogOverlayManager } from '../effects/FrogOverlayManager'
import { burstEffect } from '../effects/elements/burstEffect'
import { SerumSelectionLayer } from '../effects/SerumSelectionLayer'
import { ELEMENT_TINT } from '../../components/CosmicHub/ElementGrid'
import { isEligible, getEligibilityHint } from '../../utils/serumEligibility'
import i18next from 'i18next'
import type { Element, Rarity } from '../../store/cosmic/types'
import { devLog } from '../../utils/devLog'
import {
  BASE_SCALE,
  DPR,
  FIELD_PAD_X,
  FIELD_PAD_Y,
  FIELD_PAD_Y_BOTTOM,
  MAX_PENDING_BOXES,
  MERGE_RADIUS,
  TEXTURE_QUALITY,
  mapKeyForLocation,
  tintToHex,
  type BoxData,
  type FrogData,
  type MagnetData,
} from './main/types'
import { FrogSpawner } from './main/FrogSpawner'
import { MergeController } from './main/MergeController'
import { BoxController } from './main/BoxController'
import { PoopController } from './main/PoopController'

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
  // используются BoxController + transition handler.
  boxes: BoxData[] = []
  private boxProgressMs = 0
  boxOpenCount = 0
  private pendingBoxCount = 0

  private magnets: MagnetData[] = []
  private magnetSpawnMs = 0

  // Phase 21-03 (Wave 3): poops package-public — мутируется PoopController.
  // Живые какашки на сцене — трекаем чтобы переносить в oldContainer при переходе локации
  poops: Phaser.GameObjects.Image[] = []

  private prevLocation = 1
  isLocationTransitioning = false
  private bg!: Phaser.GameObjects.Image
  // Аккумулятор для фонового дохода с лягушек неактивных локаций
  // (на текущей локации монеты приходят через настоящие какашки visible-лягушек)
  private bgIncomeAccum = 0

  // Phase 12: overlay manager для carrier-лягушек.
  overlayManager: FrogOverlayManager | null = null

  // Phase 14: serum selection layer (зелёные halo + red flash).
  selectionLayer: SerumSelectionLayer | null = null
  private unsubSerum: (() => void) | null = null
  cachedSerumDragActive = false
  // Phase 14: SERUM-11 desktop drag — haptic-rate-limit на hover eligible.
  private lastHaptiHover = false

  // Phase 21-01 (Wave 1): frog spawn / motion / lifecycle в отдельном controller'е.
  private spawner!: FrogSpawner

  // Phase 21-02 (Wave 2): merge / feed / carrier-merge в отдельном controller'е.
  private merge!: MergeController

  // Phase 21-03 (Wave 3): box drop / open в отдельном controller'е.
  private box!: BoxController

  // Phase 21-03 (Wave 3): auto-poop drops в отдельном controller'е.
  private poop!: PoopController

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
    // Подписка на смену локации — очищаем поле и спавним лягушек новой локации
    eventBus.on('location:changed', this.onLocationChanged)
    // DEV: удалить всех лягушат с текущего поля
    eventBus.on('dev:clearAllFrogs', this.onDevClearAllFrogs)

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
    this.rebindCarriers()

    // Phase 14: serum selection layer + subscribe на serumDragActive.
    this.selectionLayer = new SerumSelectionLayer(this)
    this.subscribeSerumState()

    // Phase 14: background tap cancels selection (тап в пустое место).
    this.input.on('pointerdown', this.onPointerDownGlobal, this)

    // Phase 14: desktop Pointer Events DnD secondary mode.
    eventBus.on('cosmic:serum-pointer-move', this.onSerumPointerMove)
    eventBus.on('cosmic:serum-pointer-up', this.onSerumPointerUp)

    // Phase 12 dev: expose scene для smoke-helpers (window.__listFrogIds()).
    if (import.meta.env.DEV) {
      const w = window as unknown as { __mainScene?: MainScene }
      w.__mainScene = this
    }
  }

  // Phase 14: subscribe на serumDragActive + selectedSerum.
  // На каждый change → пересчитать eligible set + show/hide halos.
  private subscribeSerumState() {
    if (this.unsubSerum) {
      this.unsubSerum()
      this.unsubSerum = null
    }
    this.unsubSerum = useGameStore.subscribe((state) => {
      const active = state.serumDragActive
      const dragChanged = active !== this.cachedSerumDragActive
      this.cachedSerumDragActive = active

      if (active) {
        const sel = state.selectedSerum
        if (!sel) {
          this.selectionLayer?.hide()
          return
        }
        const eligible = this.frogs.filter((f) =>
          isEligible(
            { id: f.id, level: f.level },
            sel.element,
            sel.rarity,
            state.carriers,
          ),
        )
        this.selectionLayer?.show(
          eligible.map((f) => ({
            id: f.id,
            container: f.container,
            body: f.body,
          })),
          tintToHex(ELEMENT_TINT[sel.element]),
        )
      } else if (dragChanged) {
        // Just deactivated — hide halos.
        this.selectionLayer?.hide()
        this.lastHaptiHover = false
      }
    })
  }

  // Phase 14: tap в пустое место (нет game object под pointer'ом) → cancel selection.
  private onPointerDownGlobal = (
    _pointer: Phaser.Input.Pointer,
    currentlyOver: Phaser.GameObjects.GameObject[],
  ) => {
    if (!useGameStore.getState().serumDragActive) return
    // Если тап попал в любой interactive object (frog body) — пускай handler frog'и отрабатывает.
    if (currentlyOver.length > 0) return
    // Тап в пустое место — cancel selection.
    useGameStore.getState().setSerumDragActive(false)
    eventBus.emit('cosmic:cancel-serum')
  }

  // Случайная позиция в пределах игрового поля (с лёгким отступом от края)
  private randomFieldPos(): { x: number; y: number } {
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

  // Полная очистка поля при смене локации
  private clearField() {
    // Phase 12: dispose overlay manager до уничтожения frog containers,
    // иначе pool будет держать висячие references на destroyed overlays.
    this.overlayManager?.dispose()
    this.overlayManager = null

    // Phase 14: dispose selection layer (kill tweens + destroy halos).
    this.selectionLayer?.dispose()
    this.selectionLayer = null
    // Сбрасываем active selection — новая локация не должна наследовать halos.
    if (this.cachedSerumDragActive) {
      useGameStore.getState().setSerumDragActive(false)
      this.cachedSerumDragActive = false
    }
    this.lastHaptiHover = false

    // Лягушки
    for (const frog of [...this.frogs]) {
      frog.poopTimer?.remove()
      frog.poopTimer = null
      this.tweens.killTweensOf(frog.container)
      this.tweens.killTweensOf(frog.body)
      frog.container.destroy()
    }
    this.frogs = []

    // Коробки
    for (const box of [...this.boxes]) {
      this.tweens.killTweensOf(box.img)
      box.img.destroy()
    }
    this.boxes = []

    // Магниты (если были)
    for (const m of [...this.magnets]) {
      this.tweens.killTweensOf(m.emoji)
      m.emoji.destroy()
    }
    this.magnets = []

    // Какашки (если остались)
    for (const p of [...this.poops]) {
      this.tweens.killTweensOf(p)
      p.destroy()
    }
    this.poops = []

    this.boxProgressMs = 0
    this.boxOpenCount = 0
    useGameStore.getState().setRareBoxProgress(0)
    this.magnetSpawnMs = 0
    this.syncEntityCount()
  }

  // Dual-container переход между локациями.
  // Старая локация уходит за границы экрана, новая раскрывается из центра
  // (или наоборот). Обе карты отрисованы одновременно — выглядит как «зум
  // через слой» в фильмах.
  //
  // Going UP   (Болото → Лес → ... → Космос):
  //   Старая (1.0 → 0.18) сжимается в точку в центре.
  //   Новая (стартует на 6.0 — почти невидима за пределами экрана) → 1.0.
  //
  // Going DOWN (Космос → ... → Болото):
  //   Старая (1.0 → 6.0 + alpha → 0) разлетается за пределы экрана.
  //   Новая (0.18 → 1.0) была маленькой картой в центре, разрастается на весь экран.
  // DEV: удаление всех лягушек с активного поля. Стор уже занулил locationFrogs;
  // здесь убираем оставшиеся спрайты (на других локациях лягушки и так не созданы).
  private onDevClearAllFrogs = () => {
    for (const frog of [...this.frogs]) {
      this.tweens.killTweensOf(frog.container)
      this.tweens.killTweensOf(frog.body)
      this.removeFrog(frog)
    }
  }

  private onLocationChanged = ({ id }: { id: number }) => {
    const oldLoc = this.prevLocation
    const newLoc = id
    this.prevLocation = newLoc
    if (oldLoc === newLoc) return

    // Если уже идёт переход — снапаем его до конца и стартуем новый
    if (this.isLocationTransitioning) {
      this.tweens.killTweensOf(this.cameras.main)
      this.cameras.main.setZoom(1)
      this.clearField()
      this.spawnLocationFrogs()
      // Phase 12: re-create manager после snap-cleanup и спавна новых frogs.
      this.overlayManager = new FrogOverlayManager(this, () => this.frogs)
      this.rebindCarriers()
      // Phase 14: re-create selection layer (clearField его dispose'нул).
      this.selectionLayer = new SerumSelectionLayer(this)
      this.isLocationTransitioning = false
      this.input.enabled = true
    }

    this.isLocationTransitioning = true
    this.input.enabled = false
    eventBus.emit('location:transitionStart', { from: oldLoc, to: newLoc })

    const goingUp = newLoc > oldLoc
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2

    // 1. Магниты эфемерны — убиваем сразу
    for (const m of [...this.magnets]) {
      this.tweens.killTweensOf(m.emoji)
      m.emoji.destroy()
    }
    this.magnets = []

    // Если уходим с болота — фиксируем в pending, чтобы при возврате восстановились.
    // Сами img коробок улетают вместе с oldContainer (см. ниже), так что юзер видит
    // их анимирующимися с локацией, а не пропадающими внезапно.
    if (oldLoc === 1 && this.boxes.length > 0) {
      this.pendingBoxCount = Math.min(
        this.pendingBoxCount + this.boxes.length,
        MAX_PENDING_BOXES,
      )
    }

    // Phase 12: dispose overlay manager ДО reparent старых лягушек.
    // oldContainer.destroy(true) в onComplete уничтожит всех потомков, включая
    // overlay.container если он сидит внутри frog.container. Чтобы pool не
    // держал висячих ссылок, drainAll сразу здесь, а после спавна новых лягушек
    // создаём manager заново.
    this.overlayManager?.dispose()
    this.overlayManager = null

    // Phase 14: dispose selection layer и сбросить active selection (halos сидят
    // внутри frog.container, который попадает в oldContainer.destroy(true)).
    this.selectionLayer?.dispose()
    this.selectionLayer = null
    if (this.cachedSerumDragActive) {
      useGameStore.getState().setSerumDragActive(false)
      this.cachedSerumDragActive = false
    }
    this.lastHaptiHover = false

    // 2. Заворачиваем старых лягушек + коробки + фон в oldContainer (за центром экрана)
    const oldContainer = this.add.container(cx, cy)
    // Фон — кладём первым (нижний по списку → нижний по depth внутри контейнера)
    const oldBg = this.bg
    oldContainer.add(oldBg)
    oldBg.x = 0
    oldBg.y = 0
    // Затем лягушки — поверх фона
    const oldFrogs = [...this.frogs]
    for (const f of oldFrogs) {
      this.tweens.killTweensOf(f.container)
      this.tweens.killTweensOf(f.body)
      if (f.poopTimer) f.poopTimer.paused = true
      const wx = f.container.x
      const wy = f.container.y
      oldContainer.add(f.container)
      f.container.x = wx - cx
      f.container.y = wy - cy
    }
    // Убираем из живого списка — старые лягушки больше не часть сцены
    this.frogs = []

    // Коробки — туда же, чтобы плыли вместе с локацией.
    // oldContainer.destroy(true) в onComplete уничтожит их img автоматически.
    const oldBoxes = [...this.boxes]
    for (const b of oldBoxes) {
      this.tweens.killTweensOf(b.img)
      const wx = b.img.x
      const wy = b.img.y
      oldContainer.add(b.img)
      b.img.x = wx - cx
      b.img.y = wy - cy
    }
    this.boxes = []

    // Живые какашки — туда же. Их fade-tweens убиваются, onComplete не сработает,
    // поэтому очищаем массив здесь; img уничтожатся через oldContainer.destroy(true).
    const oldPoops = [...this.poops]
    for (const p of oldPoops) {
      this.tweens.killTweensOf(p)
      const wx = p.x
      const wy = p.y
      oldContainer.add(p)
      p.x = wx - cx
      p.y = wy - cy
    }
    this.poops = []

    // 3. Спавним новых лягушек внутрь newContainer + добавляем СВОЙ фон
    const newContainer = this.add.container(cx, cy)
    // Going down: стартуем буквально с точки (0.005), чтобы поле «появилось из ниоткуда»
    const newStartScale = goingUp ? 8 : 0.005
    newContainer.setScale(newStartScale)
    newContainer.setAlpha(0) // плавно проявится в начале перехода
    // Свежий фон для новой локации
    const newBg = this.add.image(0, 0, mapKeyForLocation(newLoc))
    newBg.setDisplaySize(width, height)
    newContainer.add(newBg)

    const state = useGameStore.getState()
    const levels = state.locationFrogs[newLoc - 1] ?? []
    if (levels.length > 0) {
      levels.forEach((lvl) => {
        const { x: wx, y: wy } = this.randomFieldPos()
        const frog = this.spawnFrog(wx, wy, lvl)
        // Замораживаем: убиваем idle-tween, паузим какашки.
        // Dash на новых лягушках сам пропустится через флаг isLocationTransitioning.
        this.tweens.killTweensOf(frog.body)
        this.tweens.killTweensOf(frog.container)
        frog.body.scaleY = 1.0
        if (frog.poopTimer) frog.poopTimer.paused = true
        // Перемещаем frog.container внутрь newContainer и переводим в локальные координаты
        newContainer.add(frog.container)
        frog.container.x = wx - cx
        frog.container.y = wy - cy
      })
    }

    // Если возвращаемся на болото с накопленными pending-коробками — спавним
    // ДО анимации и переносим в newContainer, чтобы они плыли вместе с лягушками
    // (а не появлялись внезапно после завершения transition).
    if (newLoc === 1 && this.pendingBoxCount > 0) {
      while (this.pendingBoxCount > 0 && this.canSpawnBox()) {
        this.pendingBoxCount--
        this.spawnBox(false, true)
        const box = this.boxes[this.boxes.length - 1]
        const wx = box.img.x
        const wy = box.img.y
        newContainer.add(box.img)
        box.img.x = wx - cx
        box.img.y = wy - cy
      }
    }

    // 4. Слой-порядок: при подъёме старая остаётся ВПЕРЕДИ (мы видим как она
    // сжимается в точку, а новая «обнимает» её сзади). При спуске наоборот —
    // новая ВПЕРЕДИ (мы зумимся внутрь маленькой карты, проходим сквозь старую).
    if (goingUp) {
      oldContainer.setDepth(200)
      newContainer.setDepth(100)
    } else {
      newContainer.setDepth(200)
      oldContainer.setDepth(100)
    }

    // 5. Анимация — снапная и одинаковая в обе стороны
    const duration = 450
    // При подъёме старое сжимается почти в точку, при спуске — растёт за экран
    const oldEndScale = goingUp ? 0.01 : 8

    // Камера фиксирована на зум 1 — «масштаб» делают контейнеры
    this.cameras.main.setZoom(1)

    // Масштаб старой и новой — синхронно, на всю длительность, плавно
    this.tweens.add({
      targets: oldContainer,
      scale: oldEndScale,
      duration,
      ease: 'Sine.easeInOut',
    })

    // Альфа старой — снимаем только в самом конце, когда контейнер уже
    // практически точка. До этого видим как поле сжимается в одну точку.
    this.tweens.add({
      targets: oldContainer,
      alpha: 0,
      duration: duration * 0.22,
      delay: duration * 0.78,
      ease: 'Sine.easeIn',
    })

    // Плавный fade-in новой локации в первой трети перехода
    this.tweens.add({
      targets: newContainer,
      alpha: 1,
      duration: duration * 0.35,
      ease: 'Sine.easeOut',
    })

    this.tweens.add({
      targets: newContainer,
      scale: 1,
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Уничтожаем старый контейнер вместе со всеми его потомками (включая oldBg)
        oldContainer.destroy(true)

        // Поднимаем детей newContainer обратно на корневой уровень сцены,
        // переводя их в мировые координаты.
        const children = [...newContainer.list]
        for (const child of children) {
          const c = child as
            | Phaser.GameObjects.Container
            | Phaser.GameObjects.Image
          const lx = c.x
          const ly = c.y
          newContainer.remove(c, false)
          this.add.existing(c)
          c.x = lx + cx
          c.y = ly + cy
        }
        newContainer.destroy(false)

        // Новый фон становится текущим, ставим depth -1 чтобы был под лягушками
        newBg.setDepth(-1)
        this.bg = newBg

        // Возобновляем idle-анимацию и таймеры какашек у новых лягушек
        for (const f of this.frogs) {
          if (f.poopTimer) f.poopTimer.paused = false
          this.startIdleAnim(f)
        }

        // Phase 12: пересоздаём overlay manager ПОСЛЕ возврата лягушек в scene root
        // (manager attach'ает overlay.container внутрь frog.container).
        this.overlayManager = new FrogOverlayManager(this, () => this.frogs)
        this.rebindCarriers()
        // Phase 14: пересоздаём selection layer (subscribe уже active в create()).
        this.selectionLayer = new SerumSelectionLayer(this)

        this.input.enabled = true
        this.isLocationTransitioning = false
        this.boxProgressMs = 0
        this.boxOpenCount = 0
        useGameStore.getState().setRareBoxProgress(0)
        this.magnetSpawnMs = 0
        this.syncEntityCount()

        // Pending-коробки уже спавнились ДО анимации внутри newContainer
        // и сейчас вернулись в мир вместе с остальными детьми контейнера.
        // Остаток pending выльется в update() по мере освобождения слотов.

        eventBus.emit('location:transitionEnd', { id: newLoc })
      },
    })
  }

  // Phase 21-01: spawnFrog/idle/dash/scheduleNext перенесены в FrogSpawner.
  // Эти thin-wrapper'ы оставлены для существующих внутренних call-site
  // (onFrogPurchased, rareCrate handler, performMerge spawn-after-vortex,
  // performFeed spawn newFrog, performCarrierMerge, onBoxTapped, debugSpawnAllCarriers).
  private spawnFrog(x: number, y: number, level: number = 1): FrogData {
    return this.spawner.spawnFrog(x, y, level)
  }

  private startIdleAnim(frog: FrogData) {
    this.spawner.startIdleAnim(frog)
  }

  // Phase 21-01: package-public — вызывается FrogSpawner (dragend handler).
  onFrogTapped(
    frog: FrogData,
    tapX: number = frog.container.x,
    tapY: number = frog.container.y,
  ) {
    // Phase 14: serum selection mode переопределяет normal tap behavior
    // (apply / mis-tap вместо merge / coin / burst).
    if (useGameStore.getState().serumDragActive) {
      this.handleSerumTap(frog)
      return
    }

    // Тап-мердж: ищем рядом с точкой тапа другую лягушку того же уровня
    if (frog.level < MAX_LEVEL) {
      const target = this.findMergeTarget(tapX, tapY, frog.level, frog)
      if (target) {
        this.performMerge(frog, target, tapX, tapY)
        return
      }
    }

    // Лёгкая вибрация на тап по лягушке
    hapticImpact('light')

    // Тап = +1 монета (не зависит от уровня), отдельно от какашек
    useGameStore.getState().addGold(1)
    this.spawnFloatingText(
      frog.container.x,
      frog.container.y - 20 * DPR,
      '+1',
      'regular',
    )

    // ELEMENT-10: element-burst при тапе на carrier-лягушку.
    // Читаем из store — не зависим от overlayManager internals.
    {
      const carriers = useGameStore.getState().carriers
      const carrier = carriers.find((c) => c.frogId === frog.id)
      if (carrier) {
        burstEffect(this, frog.container, carrier.element as Element)
      }
    }

    this.tweens.killTweensOf(frog.body)
    frog.body.scaleY = 1.0
    this.tweens.add({
      targets: frog.body,
      scaleY: 0.78,
      duration: 55,
      ease: 'Power2.easeIn',
      onComplete: () => {
        this.tweens.add({
          targets: frog.body,
          scaleY: 1.0,
          duration: 150,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (!frog.isMoving && !frog.isMerging) this.startIdleAnim(frog)
          },
        })
      },
    })
  }

  // ============== PHASE 14: SERUM TAP-TO-SELECT ==============

  /** Tap по frog'е в selection mode → eligible→apply, ineligible→mis-tap. */
  private handleSerumTap(frog: FrogData) {
    const state = useGameStore.getState()
    const sel = state.selectedSerum
    if (!sel) {
      // Race condition fallback — clear selection.
      useGameStore.getState().setSerumDragActive(false)
      return
    }

    const eligible = isEligible(
      { id: frog.id, level: frog.level },
      sel.element,
      sel.rarity,
      state.carriers,
    )

    if (!eligible) {
      // SERUM-07: mis-tap → red flash + error toast + haptic error.
      // Selection остаётся active — юзер может попробовать другую лягушку.
      this.selectionLayer?.flashRed({
        id: frog.id,
        container: frog.container,
        body: frog.body,
      })
      hapticNotification('error')
      this.emitMisTapToast(sel.rarity)
      return
    }

    // SERUM-09: eligible → 2-сек pulse + carrier создан.
    this.applySerumToFrog(frog, sel.element, sel.rarity)
  }

  /** Helper: build mis-tap toast message via i18next + emit. */
  private emitMisTapToast(rarity: Rarity) {
    const hint = getEligibilityHint(rarity)
    const locKey =
      ['swamp', 'forest', 'continent', 'planet'][hint.locationId - 1] ?? 'swamp'
    const locationLabel = i18next.t(`cosmic_hub.serums.location_${locKey}`)
    eventBus.emit('cosmic:toast', {
      type: 'serum-mistap',
      msg: i18next.t('cosmic_hub.serums.mis_tap_msg', {
        level: hint.level,
        location: locationLabel,
      }),
    })
  }

  /** Apply serum: 2-сек pulse + burst at midpoint + atomic store mutation + toast. */
  private applySerumToFrog(frog: FrogData, element: Element, rarity: Rarity) {
    // Lock from tap during animation — переиспользуем isMerging флаг
    // (existing блоки respect его: poop, drag, magnet target check).
    frog.isMerging = true
    this.tweens.killTweensOf(frog.body)

    // 2-секундная pulse: scale 1.0 → 1.15 → 1.0 (yoyo, 1 cycle).
    this.tweens.add({
      targets: frog.body,
      scaleY: 1.15,
      scaleX: 1.15,
      duration: 1000,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        frog.isMerging = false
        // Возобновить idle, если frog ещё на сцене.
        if (this.frogs.includes(frog) && !frog.isMoving)
          this.startIdleAnim(frog)
      },
    })

    // Burst effect at midpoint (1с) — драматичность apply (ELEMENT-10 reuse).
    this.time.delayedCall(1000, () => {
      if (!this.frogs.includes(frog)) return // killed mid-anim
      burstEffect(this, frog.container, element)
    })

    // Atomic mutation: clears selection, decrements serum, adds carrier.
    // FrogOverlayManager (Phase 12) автоматически нарисует overlay tier через subscribe.
    useGameStore.getState().applySerum(frog.id, element, rarity, frog.level)

    hapticNotification('success')

    // SERUM-10: success toast с undo action (4 сек window).
    eventBus.emit('cosmic:toast', {
      type: 'serum-applied',
      msg: i18next.t('cosmic_hub.serums.applied'),
      action: {
        label: i18next.t('cosmic_hub.serums.undo_label'),
        onClick: () => {
          // Undo: removeCarrier + addSerum обратно (atomic — два action'а на разные slices).
          useGameStore.getState().removeCarrier(frog.id)
          useGameStore.getState().addSerum(element, rarity, 1)
        },
      },
      duration: 4000,
    })
  }

  /** Helper: client coords → world point. */
  private clientToWorld(clientX: number, clientY: number): Phaser.Math.Vector2 {
    const canvas = this.game.canvas
    const rect = canvas.getBoundingClientRect()
    const cx = clientX - rect.left
    const cy = clientY - rect.top
    return this.cameras.main.getWorldPoint(cx, cy)
  }

  /** Helper: find frog в snap radius (80 * DPR) от world point. */
  private findFrogAt(worldX: number, worldY: number): FrogData | null {
    const SNAP = 80 * DPR
    let hit: FrogData | null = null
    let bestDist = SNAP
    for (const f of this.frogs) {
      const d = Phaser.Math.Distance.Between(
        worldX,
        worldY,
        f.container.x,
        f.container.y,
      )
      if (d <= bestDist) {
        hit = f
        bestDist = d
      }
    }
    return hit
  }

  /** Phase 14 SERUM-11: desktop drag move — haptic medium при hover eligible. */
  private onSerumPointerMove = (p: { x: number; y: number }) => {
    const state = useGameStore.getState()
    if (!state.serumDragActive || !state.selectedSerum) return
    const sel = state.selectedSerum

    const wp = this.clientToWorld(p.x, p.y)
    const hit = this.findFrogAt(wp.x, wp.y)

    if (hit) {
      const eligible = isEligible(
        { id: hit.id, level: hit.level },
        sel.element,
        sel.rarity,
        state.carriers,
      )
      if (eligible && !this.lastHaptiHover) {
        hapticImpact('medium')
        this.lastHaptiHover = true
      } else if (!eligible) {
        // Reset hover state — позволит haptic re-fire при следующем eligible.
        this.lastHaptiHover = false
      }
    } else {
      this.lastHaptiHover = false
    }
  }

  /** Phase 14 SERUM-11: desktop drag release — apply / mis-tap / cancel. */
  private onSerumPointerUp = (p: { x: number; y: number }) => {
    const state = useGameStore.getState()
    if (!state.serumDragActive || !state.selectedSerum) return
    const sel = state.selectedSerum

    this.lastHaptiHover = false

    const wp = this.clientToWorld(p.x, p.y)
    const hit = this.findFrogAt(wp.x, wp.y)

    if (!hit) {
      // Drop в пустое — cancel selection, серум не списан.
      useGameStore.getState().setSerumDragActive(false)
      return
    }

    const eligible = isEligible(
      { id: hit.id, level: hit.level },
      sel.element,
      sel.rarity,
      state.carriers,
    )

    if (eligible) {
      this.applySerumToFrog(hit, sel.element, sel.rarity)
    } else {
      // Mis-tap — red flash + error toast, selection остаётся (как в tap-flow).
      this.selectionLayer?.flashRed({
        id: hit.id,
        container: hit.container,
        body: hit.body,
      })
      hapticNotification('error')
      this.emitMisTapToast(sel.rarity)
    }
  }

  // ============== КАКАШКИ (auto-collect) ==============
  // Phase 21-03: spawnAutoPoop перенесён в PoopController.

  // Phase 21-01/21-03: package-public — вызывается FrogSpawner (poopTimer callback).
  spawnAutoPoop(frog: FrogData, type: PoopType) {
    this.poop.spawnAutoPoop(frog, type)
  }

  // spawnFloatingText перенесён в MergeController (Phase 21-02). Внутри MainScene
  // вызывается через тонкий wrapper this.spawnFloatingTextDelegate.

  // ============== МЕРДЖ ==============
  // Phase 21-02: вся merge-логика (standard / feed / carrier-merge), find-target,
  // vortex/flash/floating-text, locationName, fly-away — в MergeController.
  // Тонкие wrapper'ы здесь нужны двум источникам:
  //   1) FrogSpawner вызывает scene.findMergeTarget / scene.performMerge из
  //      drag-handler'ов (ему дешевле звать через scene, чем хранить ref на merge).
  //   2) Внутри MainScene `playCrossLocationFlyAway` ещё вызывается из
  //      onFrogPurchased / rareCrate handler'ов, magnet handlers вызывают
  //      hasMergeablePair / findClosestSameLevelPair.

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

  private spawnFloatingText(
    x: number,
    y: number,
    text: string,
    type: PoopType,
  ) {
    this.merge.spawnFloatingText(x, y, text, type)
  }

  private hasMergeablePair(): boolean {
    return this.merge.hasMergeablePair()
  }

  private findClosestSameLevelPair() {
    return this.merge.findClosestSameLevelPair()
  }

  private removeFrog(frog: FrogData) {
    this.spawner.removeFrog(frog)
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
  // findClosestSameLevelPair / hasMergeablePair жили здесь до Phase 21-02
  // (использовались только Magnet'ом). Сейчас в MergeController; вызываем
  // через тонкие wrapper'ы выше.

  private spawnMagnet(level: number) {
    const pair = this.findClosestSameLevelPair()
    if (!pair) return

    const [a, b] = pair

    // Освобождаем пару от их текущих движений чтобы магнит чисто тянул
    for (const f of [a, b]) {
      this.tweens.killTweensOf(f.container)
      f.isMoving = false
    }

    const x = (a.container.x + b.container.x) / 2
    const y = (a.container.y + b.container.y) / 2
    const duration = getMagnetDuration(level)

    const container = this.add.container(x, y)
    container.setDepth(99000)

    const emoji = this.add.text(0, 0, '🧲', { fontSize: `${30 * DPR}px` })
    emoji.setOrigin(0.5)
    container.add(emoji)
    container.setScale(0)

    // Pop-in
    this.tweens.add({
      targets: container,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    })

    // Лёгкая пульсация эмодзи
    this.tweens.add({
      targets: emoji,
      scale: 1.12,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    const magnet: MagnetData = {
      container,
      emoji,
      x,
      y,
      expiresAt: Date.now() + duration,
      pair,
      mergesDone: 0,
      mergesTarget: getMagnetMergesPerCycle(level),
    }
    this.magnets.push(magnet)
  }

  private removeMagnet(magnet: MagnetData) {
    this.magnets = this.magnets.filter((m) => m !== magnet)
    this.tweens.killTweensOf(magnet.emoji)
    this.tweens.killTweensOf(magnet.container)
    this.tweens.add({
      targets: magnet.container,
      scale: 0,
      alpha: 0,
      duration: 180,
      ease: 'Power2.easeIn',
      onComplete: () => magnet.container.destroy(),
    })
  }

  private updateMagnets() {
    const now = Date.now()

    // Сбрасываем флаг притяжения — переустановим у целевой пары
    for (const f of this.frogs) f.isAttracted = false

    for (const m of [...this.magnets]) {
      if (now >= m.expiresAt) {
        this.removeMagnet(m)
        continue
      }

      const [a, b] = m.pair

      // Если кто-то из пары уничтожен / в drag / merge — отменяем магнит
      if (
        !this.frogs.includes(a) ||
        !this.frogs.includes(b) ||
        a.isDragging ||
        a.isMerging ||
        b.isDragging ||
        b.isMerging
      ) {
        this.removeMagnet(m)
        continue
      }

      // Притягиваем именно эту пару к точке магнита
      const pull = 0.06
      a.container.x = Phaser.Math.Linear(a.container.x, m.x, pull)
      a.container.y = Phaser.Math.Linear(a.container.y, m.y, pull)
      b.container.x = Phaser.Math.Linear(b.container.x, m.x, pull)
      b.container.y = Phaser.Math.Linear(b.container.y, m.y, pull)
      a.isAttracted = true
      b.isAttracted = true

      // Когда сошлись — мерджим в точке магнита
      const d = Phaser.Math.Distance.Between(
        a.container.x,
        a.container.y,
        b.container.x,
        b.container.y,
      )
      if (d < MERGE_RADIUS * 0.7) {
        this.performMerge(a, b, m.x, m.y)
        m.mergesDone += 1

        if (m.mergesDone >= m.mergesTarget) {
          this.removeMagnet(m)
          continue
        }

        // Ищем следующую пару — если есть, переезжаем магнит к ней
        const next = this.findClosestSameLevelPair()
        if (!next) {
          this.removeMagnet(m)
          continue
        }
        const [na, nb] = next
        for (const f of [na, nb]) {
          this.tweens.killTweensOf(f.container)
          f.isMoving = false
        }
        const newX = (na.container.x + nb.container.x) / 2
        const newY = (na.container.y + nb.container.y) / 2
        m.pair = next
        m.x = newX
        m.y = newY
        // Плавный полёт магнита к новой паре
        this.tweens.add({
          targets: m.container,
          x: newX,
          y: newY,
          duration: 220,
          ease: 'Power2.easeOut',
        })
      }
    }
  }

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
    if (
      !serumPaused &&
      location.magnetEnabled &&
      magnetLevel > 0 &&
      store.magnetEnabled
    ) {
      this.magnetSpawnMs += delta
      const spawnInt = getMagnetSpawnInterval(magnetLevel)
      if (this.magnetSpawnMs >= spawnInt) {
        if (this.hasMergeablePair() && this.magnets.length === 0) {
          this.spawnMagnet(magnetLevel)
          this.magnetSpawnMs = 0
        } else {
          // Замираем на 100% и ждём появления пары
          this.magnetSpawnMs = spawnInt
        }
      }
    } else {
      this.magnetSpawnMs = 0
    }
    // Phase 14: останавливаем активные магниты во время selection.
    if (!serumPaused && this.magnets.length > 0) this.updateMagnets()

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
    eventBus.off('location:changed', this.onLocationChanged)
    eventBus.off('dev:clearAllFrogs', this.onDevClearAllFrogs)
    eventBus.off('rareCrate:claim')
    // Phase 12: освобождаем все overlay'ы и dropAll pool.
    this.overlayManager?.dispose()
    this.overlayManager = null
    // Phase 14: cleanup selection layer + subscribe + DnD listeners.
    this.selectionLayer?.dispose()
    this.selectionLayer = null
    this.unsubSerum?.()
    this.unsubSerum = null
    eventBus.off('cosmic:serum-pointer-move', this.onSerumPointerMove)
    eventBus.off('cosmic:serum-pointer-up', this.onSerumPointerUp)
    this.input.off('pointerdown', this.onPointerDownGlobal, this)
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
