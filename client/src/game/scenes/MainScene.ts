import Phaser from 'phaser'
import {
  useGameStore,
  getDropIntervalMs,
  getMagnetSpawnInterval,
  getMagnetDuration,
  getMagnetMergesPerCycle,
  getCrateLevel,
  getLocationById,
  getRareBoxThreshold,
} from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import {
  FROG_LEVELS,
  MAX_LEVEL,
  textureKeyForLevel,
  rollPoopType,
  POOP_INTERVAL_MS,
  getTargetIncomePerSec,
  getPoopValueExact,
  stochasticRound,
  type PoopType,
} from '../config/frogs'
import { hapticImpact, hapticNotification } from '../../utils/telegram'
import { FrogOverlayManager } from '../effects/FrogOverlayManager'
import { burstEffect } from '../effects/elements/burstEffect'
import { mergeEffect } from '../effects/elements/mergeEffect'
import { SerumSelectionLayer } from '../effects/SerumSelectionLayer'
import { ELEMENT_TINT } from '../../components/CosmicHub/ElementGrid'
import { isEligible, getEligibilityHint } from '../../utils/serumEligibility'
import { classifyDropTarget } from '../../utils/carrierFeed'
import i18next from 'i18next'
import type { Element, Rarity } from '../../store/cosmic/types'

const tintToHex = (cssHex: string): number =>
  parseInt(cssHex.replace('#', ''), 16)

const mapKeyForLocation = (locId: number): string => {
  if (locId === 2) return 'map2'
  if (locId === 3) return 'map3'
  if (locId === 4) return 'map4'
  return 'map'
}

// Игра рендерится в физических пикселях (window * DPR), CSS-зум 1/DPR в game/index.ts
// Все размеры/координаты ниже задаются в CSS-пикселях, умножение на DPR делается здесь
const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))

const DASH_RADIUS = 70 * DPR
const FIELD_PAD_X = 48 * DPR
const FIELD_PAD_Y = 60 * DPR // верхний отступ от верха канваса
const FIELD_PAD_Y_BOTTOM = 90 * DPR // нижний отступ — крупнее, чтобы лягушки не уходили слишком вниз
const MERGE_RADIUS = 50 * DPR

// Бокс-дропы
const MAX_ENTITIES = 16 // суммарный лимит лягушки + коробки
const MAX_PENDING_BOXES = 8 // cap «отложенных» коробок при отсутствии на болоте
const BOX_FALL_DURATION = 380 // длительность падения (быстрее)
const BOX_DISPLAY_SIZE = 56 * DPR // размер коробки на экране
const BOX_IDLE_INTERVAL = 5500 // период подпрыгивания
const BOX_OPEN_RADIUS = 80 * DPR // радиус разлёта тапа — открывает все коробки рядом

// RARE_BOX_INTERVAL_MS теперь динамический (getRareBoxIntervalMs), база 30с
const RARE_BOX_TINT = 0xffd700
const RARE_BOX_SCALE_MULT = 1.25

// SVG грузится в физических пикселях (CSS * DPR), плюс +50% для запаса
const TEXTURE_QUALITY = DPR * 1.5
const BASE_SCALE = DPR / TEXTURE_QUALITY // = 1/1.5 ≈ 0.667

interface BoxData {
  img: Phaser.GameObjects.Image
  isLanding: boolean
  baseScale: number
  baseY: number
  idleTween: Phaser.Tweens.TweenChain | null
  isRare?: boolean
}

interface MagnetData {
  container: Phaser.GameObjects.Container
  emoji: Phaser.GameObjects.Text
  x: number
  y: number
  expiresAt: number
  pair: [FrogData, FrogData]
  mergesDone: number
  mergesTarget: number
}

interface FrogData {
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Image
  facingRight: boolean
  isMoving: boolean
  isDragging: boolean
  isMerging: boolean
  isAttracted: boolean
  level: number
  poopTimer: Phaser.Time.TimerEvent | null
  // Phase 12: stable cross-session id для match с CarrierData.frogId.
  id: string
}

export class MainScene extends Phaser.Scene {
  private frogs: FrogData[] = []
  private boxes: BoxData[] = []
  private boxProgressMs = 0
  private boxOpenCount = 0
  private pendingBoxCount = 0

  private magnets: MagnetData[] = []
  private magnetSpawnMs = 0

  // Живые какашки на сцене — трекаем чтобы переносить в oldContainer при переходе локации
  private poops: Phaser.GameObjects.Image[] = []

  private prevLocation = 1
  private isLocationTransitioning = false
  private bg!: Phaser.GameObjects.Image
  // Аккумулятор для фонового дохода с лягушек неактивных локаций
  // (на текущей локации монеты приходят через настоящие какашки visible-лягушек)
  private bgIncomeAccum = 0

  // Phase 12: overlay manager для carrier-лягушек.
  private overlayManager: FrogOverlayManager | null = null

  // Phase 14: serum selection layer (зелёные halo + red flash).
  private selectionLayer: SerumSelectionLayer | null = null
  private unsubSerum: (() => void) | null = null
  private cachedSerumDragActive = false
  // Phase 14: SERUM-11 desktop drag — haptic-rate-limit на hover eligible.
  private lastHaptiHover = false

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
    this.load.image('map', '/map.png')
    this.load.image('map2', '/map2.webp')
    this.load.image('map3', '/map3.webp')
    this.load.image('map4', '/map4.webp')
    this.load.image('box', '/box.webp')
  }

  create() {
    const { width, height } = this.scale

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

  // Спавнит лягушек текущей локации из store на хаотичных позициях
  private spawnLocationFrogs() {
    const state = useGameStore.getState()
    const locId = state.currentLocation
    const levels = state.locationFrogs[locId - 1] ?? []
    if (levels.length === 0) return
    levels.forEach((lvl) => {
      const { x, y } = this.randomFieldPos()
      this.spawnFrog(x, y, lvl)
    })
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

  private spawnFrog(x: number, y: number, level: number = 1): FrogData {
    const container = this.add.container(x, y)
    container.setScale(BASE_SCALE)

    const body = this.add.image(0, 0, textureKeyForLevel(level))
    body.scaleY = 1.0
    body.setTint(FROG_LEVELS[level - 1].tint)
    body.setInteractive({ useHandCursor: true })
    this.input.setDraggable(body)

    container.add(body)

    const frog: FrogData = {
      container,
      body,
      facingRight: true,
      isMoving: false,
      isDragging: false,
      isMerging: false,
      isAttracted: false,
      level,
      poopTimer: null,
      // Phase 12: stable id для match с CarrierData.frogId.
      id: `frog-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    }
    this.frogs.push(frog)
    this.syncEntityCount()
    // Phase 12: новая лягушка может быть carrier — сообщаем manager пере-проверить.
    this.overlayManager?.markDirty()
    // Phase 14: если selection active — пере-вычислить eligible set
    // (новая лягушка может или не может быть eligible).
    if (this.cachedSerumDragActive) {
      const state = useGameStore.getState()
      if (state.serumDragActive && state.selectedSerum) {
        const sel = state.selectedSerum
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
      }
    }

    // Лягушка какает по своему таймеру 1.7с — независимо от прыжка/драга
    // startAt со случайным смещением — чтобы лягушки какали вразнобой, а не синхронно
    frog.poopTimer = this.time.addEvent({
      delay: POOP_INTERVAL_MS,
      startAt: Math.random() * POOP_INTERVAL_MS,
      loop: true,
      callback: () => {
        if (frog.isMerging) return
        const type = rollPoopType(frog.level)
        this.spawnAutoPoop(frog, type)
        // Лёгкое сжатие тела на каждый пук (поверх idle, не блокирует)
        this.tweens.add({
          targets: frog.body,
          scaleY: 0.85,
          duration: 70,
          yoyo: true,
          ease: 'Power2.easeIn',
        })
      },
    })

    let dragMoved = false
    let dragStartX = 0
    let dragStartY = 0
    let prevDragX = 0

    body.on('dragstart', (pointer: Phaser.Input.Pointer) => {
      dragStartX = pointer.x
      dragStartY = pointer.y
      prevDragX = pointer.x
      dragMoved = false
      this.tweens.killTweensOf(frog.container)
      this.tweens.killTweensOf(frog.body)
      frog.isMoving = true
      frog.isDragging = true
      frog.container.setDepth(99999)

      eventBus.emit('frog:pickup', { level: frog.level })

      // Pickup: быстро 0.8 → вернуть на 1.0
      this.tweens.add({
        targets: frog.body,
        scaleY: 0.8,
        duration: 60,
        ease: 'Power2.easeIn',
        onComplete: () => {
          this.tweens.add({
            targets: frog.body,
            scaleY: 1.0,
            duration: 120,
            ease: 'Power2.easeOut',
          })
        },
      })

      // Какание идёт по своему таймеру (frog.poopTimer) — драг его не блокирует
    })

    body.on('drag', (pointer: Phaser.Input.Pointer) => {
      if (
        Phaser.Math.Distance.Between(
          dragStartX,
          dragStartY,
          pointer.x,
          pointer.y,
        ) > 8
      ) {
        dragMoved = true
      }

      const dx = pointer.x - prevDragX
      if (Math.abs(dx) > 2) {
        const movingRight = dx > 0
        if (movingRight !== frog.facingRight) {
          frog.container.scaleX = (movingRight ? 1 : -1) * BASE_SCALE
          frog.facingRight = movingRight
        }
      }
      prevDragX = pointer.x

      frog.container.x = pointer.x
      frog.container.y = pointer.y
      frog.body.x = 0
      frog.body.y = 0
    })

    body.on('dragend', (pointer: Phaser.Input.Pointer) => {
      frog.isDragging = false

      // Phase 14 (SERUM-06): drop-merge заблокирован во время serum selection.
      // Tap-as-drag-end остаётся (handler ниже route'ит через onFrogTapped → handleSerumTap).
      const serumActive = useGameStore.getState().serumDragActive

      // Сначала проверяем мердж в позиции отпускания пальца
      if (!serumActive && frog.level < MAX_LEVEL) {
        const target = this.findMergeTarget(
          pointer.x,
          pointer.y,
          frog.level,
          frog,
        )
        if (target) {
          eventBus.emit('frog:drop', { level: frog.level, merged: true })
          this.performMerge(frog, target, pointer.x, pointer.y)
          return
        }
      }

      if (!dragMoved) {
        this.onFrogTapped(frog, pointer.x, pointer.y)
        return
      }

      eventBus.emit('frog:drop', { level: frog.level, merged: false })

      // Если отпустил за полем — плавно тянем обратно к ближайшей валидной точке
      const margin = 20 * DPR
      const { width, height } = this.scale
      const minX = FIELD_PAD_X + margin
      const maxX = width - FIELD_PAD_X - margin
      const minY = FIELD_PAD_Y + margin
      const maxY = height - FIELD_PAD_Y_BOTTOM - margin
      const clampedX = Phaser.Math.Clamp(frog.container.x, minX, maxX)
      const clampedY = Phaser.Math.Clamp(frog.container.y, minY, maxY)
      const outOfBounds =
        clampedX !== frog.container.x || clampedY !== frog.container.y

      const playDropSquish = () => {
        this.tweens.killTweensOf(frog.body)
        this.tweens.add({
          targets: frog.body,
          scaleY: 0.8,
          duration: 70,
          ease: 'Power2.easeIn',
          onComplete: () => {
            this.tweens.add({
              targets: frog.body,
              scaleY: 1.0,
              duration: 220,
              ease: 'Back.easeOut',
              onComplete: () => {
                frog.isMoving = false
                this.startIdleAnim(frog)
                this.scheduleNextDash(frog)
              },
            })
          },
        })
      }

      if (outOfBounds) {
        // Плавно подтягиваем к границе, потом drop squish
        this.tweens.add({
          targets: frog.container,
          x: clampedX,
          y: clampedY,
          duration: 280,
          ease: 'Power2.easeOut',
          onComplete: playDropSquish,
        })
      } else {
        playDropSquish()
      }
    })

    this.startIdleAnim(frog)
    this.scheduleNextDash(frog)

    return frog
  }

  private startIdleAnim(frog: FrogData) {
    this.tweens.add({
      targets: frog.body,
      scaleY: 0.92,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private scheduleNextDash(frog: FrogData) {
    this.time.addEvent({
      delay: Phaser.Math.Between(2000, 4000),
      callback: () => this.performDash(frog),
    })
  }

  private performDash(frog: FrogData) {
    if (frog.isMerging) return
    // Во время перехода между локациями — замораживаем, перепланируем после
    if (this.isLocationTransitioning) {
      this.scheduleNextDash(frog)
      return
    }
    if (frog.isAttracted) {
      this.scheduleNextDash(frog)
      return
    }
    if (frog.isMoving) {
      this.scheduleNextDash(frog)
      return
    }

    const { width, height } = this.scale
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const dist = Phaser.Math.FloatBetween(40 * DPR, DASH_RADIUS)

    const fromX = frog.container.x
    const fromY = frog.container.y
    const toX = Phaser.Math.Clamp(
      fromX + Math.cos(angle) * dist,
      FIELD_PAD_X + 10 * DPR,
      width - FIELD_PAD_X - 10 * DPR,
    )
    const toY = Phaser.Math.Clamp(
      fromY + Math.sin(angle) * dist,
      FIELD_PAD_Y + 10 * DPR,
      height - FIELD_PAD_Y_BOTTOM - 10 * DPR,
    )

    const movingRight = toX >= fromX
    if (movingRight !== frog.facingRight) {
      frog.container.scaleX = (movingRight ? 1 : -1) * BASE_SCALE
      frog.facingRight = movingRight
    }

    frog.isMoving = true
    this.tweens.killTweensOf(frog.body)

    // Какашки идут по своему таймеру (frog.poopTimer), независимо от прыжка

    // Короткая пауза перед прыжком
    this.time.delayedCall(350, () => {
      // Лягушку взяли пока шла пауза — отменяем прыжок
      if (frog.isDragging) {
        frog.isMoving = false
        return
      }

      // Stretch during dash
      this.tweens.add({
        targets: frog.body,
        scaleY: 1.2,
        duration: 120,
        ease: 'Power2.easeOut',
      })

      // Move to target
      this.tweens.add({
        targets: frog.container,
        x: toX,
        y: toY,
        duration: 200,
        ease: 'Power2.easeOut',
        onComplete: () => {
          if (frog.isDragging) return

          this.tweens.killTweensOf(frog.body)

          // Landing squish → settle
          this.tweens.add({
            targets: frog.body,
            scaleY: 0.8,
            duration: 80,
            ease: 'Power2.easeIn',
            onComplete: () => {
              if (frog.isDragging) return

              this.tweens.add({
                targets: frog.body,
                scaleY: 1.0,
                duration: 180,
                ease: 'Back.easeOut',
                onComplete: () => {
                  if (frog.isDragging) return
                  frog.isMoving = false
                  this.startIdleAnim(frog)
                  this.scheduleNextDash(frog)
                },
              })
            },
          })
        },
      })
    })
  }

  private onFrogTapped(
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

  private spawnAutoPoop(frog: FrogData, type: PoopType) {
    const x = frog.container.x
    const y = frog.container.y
    const facingRight = frog.facingRight
    // Сумма вычисляется по точной цели уровня (target/sec × interval),
    // округляется стохастически — среднее за время точно матчит target.
    const value = stochasticRound(getPoopValueExact(frog.level))

    // Размер у всех типов одинаковый, но крупнее базы
    const finalScale = BASE_SCALE * 1.3

    // Положение приземления какашки — отдельно по X и Y, индекс = уровень-1
    // horizDistByLevel — насколько далеко по ГОРИЗОНТАЛИ от лягушки (положительное — назад от неё)
    // vertOffsetByLevel — насколько НИЖЕ центра лягушки приземлится (положительное — вниз, отрицательное — вверх)
    const horizDistByLevel = [20, 26, 34, 40, 42, 42] // L1..L6
    const vertOffsetByLevel = [14, 16, 16, 20, 10, 26] // L1..L6

    const horizDist =
      (horizDistByLevel[Math.min(frog.level - 1, 5)] ?? 28) * DPR
    const vertOffset =
      (vertOffsetByLevel[Math.min(frog.level - 1, 5)] ?? 16) * DPR

    const behindX = x + (facingRight ? -10 * DPR : 10 * DPR)
    const startY = y + 6 * DPR
    const img = this.add.image(behindX, startY, 'goo')
    img.setAlpha(0)
    img.setScale(0.4 * finalScale)
    this.poops.push(img)

    // Phase 1: какашка появляется сзади и приземляется на (landX, landY)
    const landX = behindX + (facingRight ? -horizDist : horizDist)
    const landY = y + vertOffset

    this.tweens.add({
      targets: img,
      x: landX,
      y: landY,
      alpha: 1,
      scale: finalScale,
      duration: 220,
      ease: 'Power2.easeOut',
      onComplete: () => {
        // Какашка статична, медленно тает на месте.
        // Если стохастический round дал 0 (для совсем малых таргетов) — без денег и цифры,
        // визуал какашки всё равно показываем.
        if (value > 0) {
          useGameStore.getState().addGold(value)
          eventBus.emit('goo:collected', { value })
          this.spawnFloatingText(landX, landY - 22 * DPR, `+${value}`, type)
        }

        this.tweens.add({
          targets: img,
          alpha: 0,
          duration: 1100,
          ease: 'Sine.easeIn',
          onComplete: () => {
            this.poops = this.poops.filter((p) => p !== img)
            img.destroy()
          },
        })
      },
    })
  }

  private spawnFloatingText(
    x: number,
    y: number,
    text: string,
    _type: PoopType,
  ) {
    // Все цифры — золотые, очень мелкие, медленно поднимаются
    const t = this.add.text(x, y, text, {
      fontFamily: 'Russo One, sans-serif',
      fontSize: `${11 * DPR}px`,
      color: '#fde047',
      stroke: '#3a2207',
      strokeThickness: 2.5 * DPR,
    })
    t.setOrigin(0.5)
    t.setDepth(99998)

    // Сначала летит вверх без затухания
    this.tweens.add({
      targets: t,
      y: y - 32 * DPR,
      duration: 1800,
      ease: 'Sine.easeOut',
    })
    // Затухание стартует позже и идёт быстрее, продолжая полёт
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1000,
      duration: 700,
      ease: 'Sine.easeIn',
      onComplete: () => t.destroy(),
    })
  }

  // ============== МЕРДЖ ==============

  private findMergeTarget(
    x: number,
    y: number,
    level: number,
    exclude: FrogData,
  ): FrogData | null {
    let best: FrogData | null = null
    let bestDist = MERGE_RADIUS
    for (const other of this.frogs) {
      if (other === exclude) continue
      if (other.isMerging || other.isDragging) continue
      if (other.level !== level) continue
      const d = Phaser.Math.Distance.Between(
        x,
        y,
        other.container.x,
        other.container.y,
      )
      if (d <= bestDist) {
        bestDist = d
        best = other
      }
    }
    return best
  }

  private performMerge(a: FrogData, b: FrogData, cx: number, cy: number) {
    // Phase 17 (CARRIER-03/10): classify drop target before vortex.
    const carriers = useGameStore.getState().carriers
    const cls = classifyDropTarget(
      { aId: a.id, aLevel: a.level, bId: b.id, bLevel: b.level },
      carriers,
    )

    if (cls.kind === 'blocked-unstabilized') {
      eventBus.emit('cosmic:toast', {
        type: 'generic',
        msg: i18next.t('cosmic_hub.carrier.merge_blocked_unstabilized'),
      })
      hapticNotification('error')
      return
    }

    if (cls.kind === 'blocked-mismatch') {
      eventBus.emit('cosmic:toast', {
        type: 'generic',
        msg: i18next.t('cosmic_hub.carrier.merge_blocked_mismatch'),
      })
      hapticNotification('error')
      return
    }

    if (cls.kind === 'no-match') {
      console.warn('[performMerge] no-match unexpected', { a: a.id, b: b.id })
      return
    }

    if (cls.kind === 'feed' && cls.carrierFrogId) {
      const carrierFrog = a.id === cls.carrierFrogId ? a : b
      const sacrificeFrog = a.id === cls.carrierFrogId ? b : a
      this.performFeed(carrierFrog, sacrificeFrog, cx, cy)
      return
    }

    if (cls.kind === 'carrier-merge') {
      this.performCarrierMerge(a, b, cx, cy)
      return
    }

    // === Existing standard-merge logic ===
    // Заморозка: убрать лягушек из активных, отключить инпут, прервать твины
    a.isMerging = true
    b.isMerging = true
    a.isMoving = true
    b.isMoving = true
    this.tweens.killTweensOf(a.container)
    this.tweens.killTweensOf(a.body)
    this.tweens.killTweensOf(b.container)
    this.tweens.killTweensOf(b.body)
    a.body.disableInteractive()
    b.body.disableInteractive()
    a.poopTimer?.remove()
    a.poopTimer = null
    b.poopTimer?.remove()
    b.poopTimer = null

    eventBus.emit('merge:happened', { level: a.level })

    // Заметная вибрация на мердж
    hapticImpact('medium')

    const VORTEX_DURATION = 350
    a.container.setDepth(99997)
    b.container.setDepth(99997)

    this.spiralFrogTo(a, cx, cy, VORTEX_DURATION)
    this.spiralFrogTo(b, cx, cy, VORTEX_DURATION)
    this.spawnVortexParticles(cx, cy, VORTEX_DURATION)

    // ELEMENT-11: pre-capture carrier info ДО delayedCall — к моменту срабатывания
    // callback'а removeFrog(a)/(b) могут уже отработать и убрать carrier из store.
    const carriersSnap = useGameStore.getState().carriers
    const cA = carriersSnap.find((c) => c.frogId === a.id)
    const cB = carriersSnap.find((c) => c.frogId === b.id)
    const sameElementMerge: Element | null =
      cA && cB && cA.element === cB.element ? (cA.element as Element) : null

    this.time.delayedCall(VORTEX_DURATION, () => {
      const oldLevel = a.level
      this.removeFrog(a)
      this.removeFrog(b)
      this.flashAt(cx, cy)

      // ELEMENT-11: same-element merge anim — поверх обычной flashAt.
      if (sameElementMerge) {
        mergeEffect(this, cx, cy, sameElementMerge)
      }

      const newLevel = Math.min(a.level + 1, MAX_LEVEL)
      const newCfg = FROG_LEVELS[newLevel - 1]
      const store = useGameStore.getState()
      const currentLocId = store.currentLocation

      // Синкаем store: −2 старых уровня в текущей локации
      store.removeFrogFromLocation(currentLocId, oldLevel)
      store.removeFrogFromLocation(currentLocId, oldLevel)
      // +1 новый уровень в его родной локации (может отличаться от текущей)
      store.addFrogToLocation(newCfg.location, newLevel)

      const isCrossLocation = newCfg.location !== currentLocId

      this.time.delayedCall(60, () => {
        if (isCrossLocation) {
          // Лягушка улетает в свою локацию
          this.playCrossLocationFlyAway(cx, cy, newLevel)
          eventBus.emit('cosmic:toast', {
            type: 'generic',
            msg: i18next.t('cosmic_hub.carrier.merge_cross_location_warn'),
            duration: 3000,
          })
        } else {
          // Обычный pop-in
          const newFrog = this.spawnFrog(cx, cy, newLevel)
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

        // Discovery (всегда)
        const wasNew = store.markDiscovered(newLevel)
        if (wasNew) eventBus.emit('frog:discovered', { level: newLevel })
      })
    })
  }

  /**
   * Phase 17 (CARRIER-03/04): feed carrier — sacrifice regular same-level frog → roll outcome.
   * Vortex anim + delayed apply через store.feedCarrier action.
   *
   * После outcome:
   *   - 'success': carrier replaced spawned upgraded frog (transfer carrier.frogId)
   *   - 'fail': sacrifice consumed; carrier resumes idle на месте
   *   - 'stabilize': StabilizationModal triggered через eventBus (Plan 17-04)
   */
  private performFeed(
    carrier: FrogData,
    sacrifice: FrogData,
    cx: number,
    cy: number,
  ) {
    carrier.isMerging = true
    sacrifice.isMerging = true
    carrier.isMoving = true
    sacrifice.isMoving = true
    this.tweens.killTweensOf(carrier.container)
    this.tweens.killTweensOf(carrier.body)
    this.tweens.killTweensOf(sacrifice.container)
    this.tweens.killTweensOf(sacrifice.body)
    carrier.body.disableInteractive()
    sacrifice.body.disableInteractive()
    carrier.poopTimer?.remove()
    carrier.poopTimer = null
    sacrifice.poopTimer?.remove()
    sacrifice.poopTimer = null

    hapticImpact('medium')

    const VORTEX_DURATION = 350
    carrier.container.setDepth(99997)
    sacrifice.container.setDepth(99997)
    this.spiralFrogTo(carrier, cx, cy, VORTEX_DURATION)
    this.spiralFrogTo(sacrifice, cx, cy, VORTEX_DURATION)
    this.spawnVortexParticles(cx, cy, VORTEX_DURATION)

    this.time.delayedCall(VORTEX_DURATION, () => {
      const oldLevel = sacrifice.level
      this.removeFrog(sacrifice)
      const store0 = useGameStore.getState()
      store0.removeFrogFromLocation(store0.currentLocation, oldLevel)

      this.flashAt(cx, cy)

      // Atomic feed — store mutates carrier + maybe emits stabilization event.
      const outcome = useGameStore.getState().feedCarrier(carrier.id)

      if (!outcome) {
        // Defensive: carrier disappeared between drag-end and apply.
        carrier.isMerging = false
        carrier.isMoving = false
        carrier.container.setDepth(carrier.container.y)
        this.startIdleAnim(carrier)
        return
      }

      if (outcome.result === 'success') {
        // Replace carrier visual: remove old, spawn new at +1 level.
        // Carrier-evolved frog всегда остаётся в текущей локации (не улетает cross-location).
        const newLevel = outcome.newLevel
        const oldCarrierLevel = carrier.level
        this.removeFrog(carrier)
        const storeS = useGameStore.getState()
        storeS.removeFrogFromLocation(storeS.currentLocation, oldCarrierLevel)
        storeS.addFrogToLocation(storeS.currentLocation, newLevel)

        const newFrog = this.spawnFrog(cx, cy, newLevel)
        // Transfer carrier.frogId на newFrog.id.
        const carriersNow = useGameStore.getState().carriers.slice()
        const idx = carriersNow.findIndex((c) => c.frogId === carrier.id)
        if (idx >= 0) {
          carriersNow[idx] = { ...carriersNow[idx], frogId: newFrog.id }
          useGameStore.setState({ carriers: carriersNow })
        }
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
        hapticNotification('success')

        const wasNew = storeS.markDiscovered(newLevel)
        if (wasNew) eventBus.emit('frog:discovered', { level: newLevel })
      } else if (outcome.result === 'fail') {
        // Carrier stays at (cx, cy). Unlock + resume idle.
        carrier.isMerging = false
        carrier.isMoving = false
        carrier.container.setRotation(0)
        carrier.container.setScale(BASE_SCALE)
        carrier.container.x = cx
        carrier.container.y = cy
        carrier.body.setInteractive({ useHandCursor: true })
        this.input.setDraggable(carrier.body)
        this.startIdleAnim(carrier)
        hapticNotification('error')
        eventBus.emit('cosmic:toast', {
          type: 'generic',
          msg: i18next.t('cosmic_hub.carrier.feed_fail'),
          duration: 1500,
        })
      } else {
        // 'stabilize' — carrier остаётся, modal triggered через eventBus.
        carrier.isMerging = false
        carrier.isMoving = false
        carrier.container.setRotation(0)
        carrier.container.setScale(BASE_SCALE)
        carrier.container.x = cx
        carrier.container.y = cy
        carrier.body.setInteractive({ useHandCursor: true })
        this.input.setDraggable(carrier.body)
        this.startIdleAnim(carrier)
        hapticImpact('heavy')
      }

      // Force overlay re-sync — level / stabilized changed.
      this.overlayManager?.markDirty()
    })
  }

  /**
   * Phase 17 (CARRIER-10): merge two stabilized same-element same-level carriers
   * → 1 new carrier на level+1 с S-bucket guaranteed ceiling. Plays mergeEffect.
   */
  private performCarrierMerge(
    a: FrogData,
    b: FrogData,
    cx: number,
    cy: number,
  ) {
    a.isMerging = true
    b.isMerging = true
    a.isMoving = true
    b.isMoving = true
    this.tweens.killTweensOf(a.container)
    this.tweens.killTweensOf(a.body)
    this.tweens.killTweensOf(b.container)
    this.tweens.killTweensOf(b.body)
    a.body.disableInteractive()
    b.body.disableInteractive()
    a.poopTimer?.remove()
    a.poopTimer = null
    b.poopTimer?.remove()
    b.poopTimer = null

    eventBus.emit('merge:happened', { level: a.level })
    hapticImpact('medium')

    const VORTEX_DURATION = 350
    a.container.setDepth(99997)
    b.container.setDepth(99997)
    this.spiralFrogTo(a, cx, cy, VORTEX_DURATION)
    this.spiralFrogTo(b, cx, cy, VORTEX_DURATION)
    this.spawnVortexParticles(cx, cy, VORTEX_DURATION)

    // Pre-capture carrier element для mergeEffect.
    const carriersSnap = useGameStore.getState().carriers
    const carrierA = carriersSnap.find((c) => c.frogId === a.id)
    const element = carrierA?.element

    this.time.delayedCall(VORTEX_DURATION, () => {
      const oldLevel = a.level
      const store = useGameStore.getState()

      this.removeFrog(a)
      this.removeFrog(b)
      store.removeFrogFromLocation(store.currentLocation, oldLevel)
      store.removeFrogFromLocation(store.currentLocation, oldLevel)

      this.flashAt(cx, cy)
      if (element) mergeEffect(this, cx, cy, element)

      const newLevel = Math.min(oldLevel + 1, MAX_LEVEL)
      const newCfg = FROG_LEVELS[newLevel - 1]
      store.addFrogToLocation(newCfg.location, newLevel)

      const isCrossLocation = newCfg.location !== store.currentLocation

      this.time.delayedCall(60, () => {
        if (isCrossLocation) {
          this.playCrossLocationFlyAway(cx, cy, newLevel)
          eventBus.emit('cosmic:toast', {
            type: 'generic',
            msg: i18next.t('cosmic_hub.carrier.merge_cross_location_warn'),
            duration: 3000,
          })
          return
        }
        const newFrog = this.spawnFrog(cx, cy, newLevel)
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

        // Atomic store merge — removes both old carriers, adds new with S-bucket
        // ceiling, sets bestiary bit.
        const merged = useGameStore
          .getState()
          .mergeCarriers(a.id, b.id, newFrog.id)
        if (!merged) {
          console.warn(
            '[performCarrierMerge] mergeCarriers returned null — defensive',
          )
        }

        this.overlayManager?.markDirty()
        hapticNotification('success')

        const wasNew = store.markDiscovered(newLevel)
        if (wasNew) eventBus.emit('frog:discovered', { level: newLevel })
      })
    })
  }

  // Анимация: большая полупрозрачная лягушка увеличивается и исчезает за 0.5с
  private playCrossLocationFlyAway(x: number, y: number, level: number) {
    const cfg = FROG_LEVELS[level - 1]
    const ghost = this.add.image(x, y, textureKeyForLevel(level))
    ghost.setTint(cfg.tint)
    ghost.setScale(BASE_SCALE)
    ghost.setAlpha(0.2)
    ghost.setDepth(99999)

    this.tweens.add({
      targets: ghost,
      scale: BASE_SCALE * 6,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => ghost.destroy(),
    })

    // Плавающий текст с именем локации
    this.spawnFloatingText(
      x,
      y - 40 * DPR,
      `→ ${this.locationName(cfg.location)}`,
      'huge' as PoopType,
    )
  }

  private locationName(id: number): string {
    switch (id) {
      case 1:
        return 'Болото'
      case 2:
        return 'Лес'
      case 3:
        return 'Земля'
      case 4:
        return 'Космос'
      default:
        return ''
    }
  }

  private spiralFrogTo(
    frog: FrogData,
    cx: number,
    cy: number,
    duration: number,
  ) {
    const startX = frog.container.x
    const startY = frog.container.y
    const startAngle = Math.atan2(startY - cy, startX - cx)
    const startRadius = Math.max(
      Phaser.Math.Distance.Between(startX, startY, cx, cy),
      1,
    )

    const obj = { p: 0 }
    this.tweens.add({
      targets: obj,
      p: 1,
      duration,
      ease: 'Power2.easeIn',
      onUpdate: () => {
        const a = startAngle + obj.p * Math.PI * 4 // 2 полных оборота
        const r = startRadius * (1 - obj.p)
        frog.container.x = cx + Math.cos(a) * r
        frog.container.y = cy + Math.sin(a) * r
      },
    })

    // Вращение вокруг своей оси и схлопывание
    this.tweens.add({
      targets: frog.container,
      rotation: Math.PI * 4,
      scale: 0,
      duration,
      ease: 'Power2.easeIn',
    })
  }

  private spawnVortexParticles(cx: number, cy: number, duration: number) {
    const COUNT = 12
    for (let i = 0; i < COUNT; i++) {
      const baseAngle = (i / COUNT) * Math.PI * 2
      const startRadius = (50 + Math.random() * 30) * DPR
      const px = cx + Math.cos(baseAngle) * startRadius
      const py = cy + Math.sin(baseAngle) * startRadius

      const particle = this.add.circle(px, py, 3 * DPR, 0xffffaa, 0.85)
      particle.setDepth(99998)

      const obj = { p: 0 }
      this.tweens.add({
        targets: obj,
        p: 1,
        duration,
        ease: 'Power2.easeIn',
        onUpdate: () => {
          const a = baseAngle + obj.p * Math.PI * 3
          const r = startRadius * (1 - obj.p)
          particle.x = cx + Math.cos(a) * r
          particle.y = cy + Math.sin(a) * r
          particle.setAlpha(0.85 * (1 - obj.p))
        },
        onComplete: () => particle.destroy(),
      })
    }
  }

  private flashAt(x: number, y: number) {
    const flash = this.add.circle(x, y, 12 * DPR, 0xffffff, 1)
    flash.setDepth(99999)
    this.tweens.add({
      targets: flash,
      scale: 4,
      alpha: 0,
      duration: 220,
      ease: 'Power2.easeOut',
      onComplete: () => flash.destroy(),
    })
  }

  private removeFrog(frog: FrogData) {
    this.frogs = this.frogs.filter((f) => f !== frog)
    frog.poopTimer?.remove()
    frog.poopTimer = null
    this.overlayManager?.releaseForFrog(frog.id)
    frog.container.destroy()
    this.syncEntityCount()
  }

  // ============== БОКС-ДРОПЫ ==============

  private canSpawnBox(): boolean {
    return this.frogs.length + this.boxes.length < MAX_ENTITIES
  }

  private spawnBox(isRare = false, preLanded = false) {
    const { width, height } = this.scale
    const x = Phaser.Math.Between(
      FIELD_PAD_X + 40 * DPR,
      width - FIELD_PAD_X - 40 * DPR,
    )
    const targetY = Phaser.Math.Between(
      FIELD_PAD_Y + 40 * DPR,
      height - FIELD_PAD_Y_BOTTOM - 40 * DPR,
    )

    // Стартуем выше канваса — коробка просто влетает в кадр без fade.
    // Если preLanded — стартуем сразу на целевой Y, без анимации падения.
    const startY = preLanded ? targetY : -BOX_DISPLAY_SIZE
    const img = this.add.image(x, startY, 'box')
    img.setDisplaySize(BOX_DISPLAY_SIZE, BOX_DISPLAY_SIZE)
    img.setDepth(targetY) // сразу высокий depth чтобы не перекрывалось лягушками
    if (isRare) {
      img.setTint(RARE_BOX_TINT)
      img.setDisplaySize(
        BOX_DISPLAY_SIZE * RARE_BOX_SCALE_MULT,
        BOX_DISPLAY_SIZE * RARE_BOX_SCALE_MULT,
      )
    }
    const baseScale = img.scaleX

    const box: BoxData = {
      img,
      isLanding: !preLanded,
      baseScale,
      baseY: targetY,
      idleTween: null,
      isRare,
    }
    this.boxes.push(box)
    this.syncEntityCount()

    // Инпут вешаем сразу, во время падения handler игнорирует через isLanding
    img.setInteractive({ useHandCursor: true })
    img.on('pointerdown', () => {
      if (box.isLanding) return
      hapticImpact('medium')
      // Открываем тапнутую коробку + все приземлившиеся в радиусе
      const cx = box.img.x
      const cy = box.img.y
      const targets: BoxData[] = []
      for (const b of this.boxes) {
        if (b.isLanding) continue
        const d = Phaser.Math.Distance.Between(cx, cy, b.img.x, b.img.y)
        if (d <= BOX_OPEN_RADIUS) targets.push(b)
      }
      for (const t of targets) this.onBoxTapped(t)
    })

    if (preLanded) {
      this.startBoxIdleAnim(box)
      return
    }

    this.tweens.add({
      targets: img,
      y: targetY,
      duration: BOX_FALL_DURATION,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Squash при приземлении
        this.tweens.add({
          targets: img,
          scaleY: baseScale * 0.7,
          scaleX: baseScale * 1.15,
          duration: 80,
          yoyo: true,
          ease: 'Power2',
          onComplete: () => {
            img.scaleX = baseScale
            img.scaleY = baseScale
            box.isLanding = false
            this.startBoxIdleAnim(box)
          },
        })
      },
    })
  }

  private startBoxIdleAnim(box: BoxData) {
    const { baseScale, baseY } = box
    const jumpHeight = 7 * DPR

    const cycle = () => {
      if (!box.img.active || !this.boxes.includes(box)) return

      box.idleTween = this.tweens.chain({
        targets: box.img,
        tweens: [
          // Squash перед прыжком: шире, ниже
          {
            scaleX: baseScale * 1.12,
            scaleY: baseScale * 0.88,
            duration: 100,
            ease: 'Power2.easeIn',
          },
          // Подпрыг + растяжка вверх
          {
            scaleX: baseScale * 0.96,
            scaleY: baseScale * 1.06,
            y: baseY - jumpHeight,
            duration: 150,
            ease: 'Power2.easeOut',
          },
          // Приземление: снова squash
          {
            scaleX: baseScale * 1.1,
            scaleY: baseScale * 0.9,
            y: baseY,
            duration: 80,
            ease: 'Power2.easeIn',
          },
          // Settle к норме
          {
            scaleX: baseScale,
            scaleY: baseScale,
            duration: 100,
            ease: 'Back.easeOut',
          },
        ],
        onComplete: () => {
          box.idleTween = null
          this.time.delayedCall(BOX_IDLE_INTERVAL, cycle)
        },
      })
    }

    // Первая пауза перед первым прыжком
    this.time.delayedCall(BOX_IDLE_INTERVAL, cycle)
  }

  private onBoxTapped(box: BoxData) {
    if (box.isLanding) return
    if (!box.img.active) return

    const x = box.img.x
    const y = box.img.y
    const baseScale = box.baseScale

    this.boxes = this.boxes.filter((b) => b !== box)
    this.syncEntityCount()
    this.tweens.killTweensOf(box.img)
    box.idleTween = null
    box.img.disableInteractive()

    // Коробка увеличивается и исчезает
    this.tweens.add({
      targets: box.img,
      scaleX: baseScale * 1.4,
      scaleY: baseScale * 1.4,
      alpha: 0,
      rotation: 0.4,
      duration: 220,
      ease: 'Power2.easeOut',
      onComplete: () => box.img.destroy(),
    })

    // Частицы взрыва
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4
      const dist = (40 + Math.random() * 30) * DPR
      const p = this.add.circle(x, y, 3 * DPR, 0xc8a572, 0.9)
      p.setDepth(99998)
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist + 25 * DPR,
        alpha: 0,
        duration: 350,
        ease: 'Power2.easeOut',
        onComplete: () => p.destroy(),
      })
    }

    // Camera shake + flash
    this.cameras.main.shake(120, 0.005)
    this.flashAt(x, y)

    if (box.isRare) {
      eventBus.emit('rareCrate:opened', {
        x,
        y,
        minLevel: 1,
        maxLevel: MAX_LEVEL,
      })
      return
    }

    // Считаем открытые обычные боксы → мега-бокс каждые N открытий (только на Болоте)
    const storeForCount = useGameStore.getState()
    if (storeForCount.currentLocation === 1) {
      this.boxOpenCount++
      const threshold = getRareBoxThreshold(storeForCount.upgrades.rareBoxSpeed)
      if (this.boxOpenCount >= threshold && this.canSpawnBox()) {
        this.spawnBox(true)
        this.boxOpenCount = 0
        storeForCount.setRareBoxProgress(0)
      } else {
        storeForCount.setRareBoxProgress(
          Math.min(this.boxOpenCount / threshold, 1),
        )
      }
    }

    // Спавн лягушки. На Болоте (loc 1) применяется crateQuality, на других локациях — minLevel.
    this.time.delayedCall(0, () => {
      const state = useGameStore.getState()
      const loc = getLocationById(state.currentLocation)
      const frogLevel =
        loc.id === 1 ? getCrateLevel(state.upgrades.crateQuality) : loc.minLevel
      const newFrog = this.spawnFrog(x, y, frogLevel)
      state.addFrogToLocation(loc.id, frogLevel)
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

    // Освободившийся слот подхватит сам update() — не нужно дёргать вручную
  }

  // ============== МАГНИТ ==============

  // Ищет ближайшую пару лягушек одного уровня — кандидата для магнита
  private findClosestSameLevelPair(): [FrogData, FrogData] | null {
    const byLevel = new Map<number, FrogData[]>()
    for (const f of this.frogs) {
      if (f.isMerging || f.isDragging || f.isAttracted) continue
      if (f.level >= MAX_LEVEL) continue
      const arr = byLevel.get(f.level) ?? []
      arr.push(f)
      byLevel.set(f.level, arr)
    }

    let bestPair: [FrogData, FrogData] | null = null
    let bestDist = Infinity
    for (const frogs of byLevel.values()) {
      if (frogs.length < 2) continue
      for (let i = 0; i < frogs.length; i++) {
        for (let j = i + 1; j < frogs.length; j++) {
          const a = frogs[i]
          const b = frogs[j]
          const d = Phaser.Math.Distance.Between(
            a.container.x,
            a.container.y,
            b.container.x,
            b.container.y,
          )
          if (d < bestDist) {
            bestDist = d
            bestPair = [a, b]
          }
        }
      }
    }
    return bestPair
  }

  private hasMergeablePair(): boolean {
    return this.findClosestSameLevelPair() !== null
  }

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

  private syncEntityCount() {
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
}
