// Phase 21-05 (Wave 5): Location transition controller, extracted from
// MainScene.ts. Это самый coupled-к-scene модуль из всего разбиения —
// transition «трогает» каждый game-object на сцене.
//
// Owns:
//   - clearField(): полная очистка поля при смене локации (frogs, boxes,
//     magnets, poops, overlay, selection-layer, прогресс-каунтеры)
//   - onLocationChanged({id}): event-handler с dual-container zoom-анимацией;
//     заворачивает старые объекты в oldContainer, спавнит новых внутри
//     newContainer, синхронно тyween-ит масштаб/альфу обоих, потом разворачивает
//     newContainer обратно в scene root через add.existing
//   - onDevClearAllFrogs: dev-helper для wipe текущей локации
//
// Public API:
//   - clearField()
//   - onLocationChanged: (() => void) handler-callable (привязывается через eventBus)
//   - onDevClearAllFrogs: () => void
//
// Coupling: класс знает почти всё о scene — frogs, boxes, poops, bg,
// pendingBoxCount, boxProgressMs, boxOpenCount, isLocationTransitioning,
// prevLocation, overlayManager, selectionLayer, cachedSerumDragActive,
// lastHaptiHover. Эти поля все package-public (см. MainScene class header).
// Вызывает spawner.spawnFrog/spawnLocationFrogs/rebindCarriers/removeFrog/
// startIdleAnim, magnet.clearAll/resetSpawnTimer, box.canSpawnBox/spawnBox.

import { useGameStore } from '../../../store/gameStore'
import { eventBus } from '../../../store/eventBus'
import { FrogOverlayManager } from '../../effects/FrogOverlayManager'
import { SerumSelectionLayer } from '../../effects/SerumSelectionLayer'
import { mapKeyForLocation, MAX_PENDING_BOXES } from './types'
import type { MainScene } from '../MainScene'
import type { FrogSpawner } from './FrogSpawner'
import type { MagnetController } from './MagnetController'
import type { BoxController } from './BoxController'

export class LocationTransition {
  private scene: MainScene
  private spawner: FrogSpawner
  private magnet: MagnetController
  private box: BoxController

  constructor(
    scene: MainScene,
    spawner: FrogSpawner,
    magnet: MagnetController,
    box: BoxController,
  ) {
    this.scene = scene
    this.spawner = spawner
    this.magnet = magnet
    this.box = box
  }

  // Полная очистка поля при смене локации
  clearField() {
    const scene = this.scene
    // Phase 12: dispose overlay manager до уничтожения frog containers,
    // иначе pool будет держать висячие references на destroyed overlays.
    scene.overlayManager?.dispose()
    scene.overlayManager = null

    // Phase 14: dispose selection layer (kill tweens + destroy halos).
    scene.selectionLayer?.dispose()
    scene.selectionLayer = null
    // Сбрасываем active selection — новая локация не должна наследовать halos.
    if (scene.cachedSerumDragActive) {
      useGameStore.getState().setSerumDragActive(false)
      scene.cachedSerumDragActive = false
    }
    scene.lastHaptiHover = false

    // Лягушки
    for (const frog of [...scene.frogs]) {
      frog.poopTimer?.remove()
      frog.poopTimer = null
      scene.tweens.killTweensOf(frog.container)
      scene.tweens.killTweensOf(frog.body)
      frog.container.destroy()
    }
    scene.frogs = []

    // Коробки
    for (const box of [...scene.boxes]) {
      scene.tweens.killTweensOf(box.img)
      box.img.destroy()
    }
    scene.boxes = []

    // Магниты (если были)
    this.magnet.clearAll()

    // Какашки (если остались)
    for (const p of [...scene.poops]) {
      scene.tweens.killTweensOf(p)
      p.destroy()
    }
    scene.poops = []

    scene.boxProgressMs = 0
    scene.boxOpenCount = 0
    useGameStore.getState().setRareBoxProgress(0)
    this.magnet.resetSpawnTimer()
    scene.syncEntityCount()
  }

  // Dev: удаление всех лягушек с активного поля. Стор уже занулил locationFrogs;
  // здесь убираем оставшиеся спрайты (на других локациях лягушки и так не созданы).
  onDevClearAllFrogs = () => {
    const scene = this.scene
    for (const frog of [...scene.frogs]) {
      scene.tweens.killTweensOf(frog.container)
      scene.tweens.killTweensOf(frog.body)
      this.spawner.removeFrog(frog)
    }
  }

  // Dual-container переход между локациями.
  // Старая локация уходит за границы экрана, новая раскрывается из центра
  // (или наоборот). Обе карты отрисованы одновременно — выглядит как «зум
  // через слой» в фильмах.
  //
  // Going UP   (Болото → Лес → ... → Планета):
  //   Старая (1.0 → 0.18) сжимается в точку в центре.
  //   Новая (стартует на 6.0 — почти невидима за пределами экрана) → 1.0.
  //
  // Going DOWN (Планета → ... → Болото):
  //   Старая (1.0 → 6.0 + alpha → 0) разлетается за пределы экрана.
  //   Новая (0.18 → 1.0) была маленькой картой в центре, разрастается на весь экран.
  onLocationChanged = ({ id }: { id: number }) => {
    const scene = this.scene
    const oldLoc = scene.prevLocation
    const newLoc = id
    scene.prevLocation = newLoc
    if (oldLoc === newLoc) return

    // Если уже идёт переход — снапаем его до конца и стартуем новый
    if (scene.isLocationTransitioning) {
      scene.tweens.killTweensOf(scene.cameras.main)
      scene.cameras.main.setZoom(1)
      this.clearField()
      this.spawner.spawnLocationFrogs()
      // Phase 12: re-create manager после snap-cleanup и спавна новых frogs.
      scene.overlayManager = new FrogOverlayManager(scene, () => scene.frogs)
      this.spawner.rebindCarriers()
      // Phase 14: re-create selection layer (clearField его dispose'нул).
      scene.selectionLayer = new SerumSelectionLayer(scene)
      scene.isLocationTransitioning = false
      scene.input.enabled = true
    }

    scene.isLocationTransitioning = true
    scene.input.enabled = false
    eventBus.emit('location:transitionStart', { from: oldLoc, to: newLoc })

    const goingUp = newLoc > oldLoc
    const { width, height } = scene.scale
    const cx = width / 2
    const cy = height / 2

    // 1. Магниты эфемерны — убиваем сразу
    this.magnet.clearAll()

    // Если уходим с болота — фиксируем в pending, чтобы при возврате восстановились.
    // Сами img коробок улетают вместе с oldContainer (см. ниже), так что юзер видит
    // их анимирующимися с локацией, а не пропадающими внезапно.
    if (oldLoc === 1 && scene.boxes.length > 0) {
      scene.pendingBoxCount = Math.min(
        scene.pendingBoxCount + scene.boxes.length,
        MAX_PENDING_BOXES,
      )
    }

    // Phase 12: dispose overlay manager ДО reparent старых лягушек.
    // oldContainer.destroy(true) в onComplete уничтожит всех потомков, включая
    // overlay.container если он сидит внутри frog.container. Чтобы pool не
    // держал висячих ссылок, drainAll сразу здесь, а после спавна новых лягушек
    // создаём manager заново.
    scene.overlayManager?.dispose()
    scene.overlayManager = null

    // Phase 14: dispose selection layer и сбросить active selection (halos сидят
    // внутри frog.container, который попадает в oldContainer.destroy(true)).
    scene.selectionLayer?.dispose()
    scene.selectionLayer = null
    if (scene.cachedSerumDragActive) {
      useGameStore.getState().setSerumDragActive(false)
      scene.cachedSerumDragActive = false
    }
    scene.lastHaptiHover = false

    // 2. Заворачиваем старых лягушек + коробки + фон в oldContainer (за центром экрана)
    const oldContainer = scene.add.container(cx, cy)
    // Фон — кладём первым (нижний по списку → нижний по depth внутри контейнера)
    const oldBg = scene.bg
    oldContainer.add(oldBg)
    oldBg.x = 0
    oldBg.y = 0
    // Затем лягушки — поверх фона
    const oldFrogs = [...scene.frogs]
    for (const f of oldFrogs) {
      scene.tweens.killTweensOf(f.container)
      scene.tweens.killTweensOf(f.body)
      if (f.poopTimer) f.poopTimer.paused = true
      const wx = f.container.x
      const wy = f.container.y
      oldContainer.add(f.container)
      f.container.x = wx - cx
      f.container.y = wy - cy
    }
    // Убираем из живого списка — старые лягушки больше не часть сцены
    scene.frogs = []

    // Коробки — туда же, чтобы плыли вместе с локацией.
    // oldContainer.destroy(true) в onComplete уничтожит их img автоматически.
    const oldBoxes = [...scene.boxes]
    for (const b of oldBoxes) {
      scene.tweens.killTweensOf(b.img)
      const wx = b.img.x
      const wy = b.img.y
      oldContainer.add(b.img)
      b.img.x = wx - cx
      b.img.y = wy - cy
    }
    scene.boxes = []

    // Живые какашки — туда же. Их fade-tweens убиваются, onComplete не сработает,
    // поэтому очищаем массив здесь; img уничтожатся через oldContainer.destroy(true).
    const oldPoops = [...scene.poops]
    for (const p of oldPoops) {
      scene.tweens.killTweensOf(p)
      const wx = p.x
      const wy = p.y
      oldContainer.add(p)
      p.x = wx - cx
      p.y = wy - cy
    }
    scene.poops = []

    // 3. Спавним новых лягушек внутрь newContainer + добавляем СВОЙ фон
    const newContainer = scene.add.container(cx, cy)
    // Going down: стартуем буквально с точки (0.005), чтобы поле «появилось из ниоткуда»
    const newStartScale = goingUp ? 8 : 0.005
    newContainer.setScale(newStartScale)
    newContainer.setAlpha(0) // плавно проявится в начале перехода
    // Свежий фон для новой локации
    const newBg = scene.add.image(0, 0, mapKeyForLocation(newLoc))
    newBg.setDisplaySize(width, height)
    newContainer.add(newBg)

    const state = useGameStore.getState()
    const levels = state.locationFrogs[newLoc - 1] ?? []
    if (levels.length > 0) {
      levels.forEach((lvl) => {
        const { x: wx, y: wy } = scene.randomFieldPos()
        const frog = this.spawner.spawnFrog(wx, wy, lvl)
        // Замораживаем: убиваем idle-tween, паузим какашки.
        // Dash на новых лягушках сам пропустится через флаг isLocationTransitioning.
        scene.tweens.killTweensOf(frog.body)
        scene.tweens.killTweensOf(frog.container)
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
    if (newLoc === 1 && scene.pendingBoxCount > 0) {
      while (scene.pendingBoxCount > 0 && this.box.canSpawnBox()) {
        scene.pendingBoxCount--
        this.box.spawnBox(false, true)
        const lastBox = scene.boxes[scene.boxes.length - 1]
        const wx = lastBox.img.x
        const wy = lastBox.img.y
        newContainer.add(lastBox.img)
        lastBox.img.x = wx - cx
        lastBox.img.y = wy - cy
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
    scene.cameras.main.setZoom(1)

    // Масштаб старой и новой — синхронно, на всю длительность, плавно
    scene.tweens.add({
      targets: oldContainer,
      scale: oldEndScale,
      duration,
      ease: 'Sine.easeInOut',
    })

    // Альфа старой — снимаем только в самом конце, когда контейнер уже
    // практически точка. До этого видим как поле сжимается в одну точку.
    scene.tweens.add({
      targets: oldContainer,
      alpha: 0,
      duration: duration * 0.22,
      delay: duration * 0.78,
      ease: 'Sine.easeIn',
    })

    // Плавный fade-in новой локации в первой трети перехода
    scene.tweens.add({
      targets: newContainer,
      alpha: 1,
      duration: duration * 0.35,
      ease: 'Sine.easeOut',
    })

    scene.tweens.add({
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
          scene.add.existing(c)
          c.x = lx + cx
          c.y = ly + cy
        }
        newContainer.destroy(false)

        // Новый фон становится текущим, ставим depth -1 чтобы был под лягушками
        newBg.setDepth(-1)
        scene.bg = newBg

        // Возобновляем idle-анимацию и таймеры какашек у новых лягушек
        for (const f of scene.frogs) {
          if (f.poopTimer) f.poopTimer.paused = false
          this.spawner.startIdleAnim(f)
        }

        // Phase 12: пересоздаём overlay manager ПОСЛЕ возврата лягушек в scene root
        // (manager attach'ает overlay.container внутрь frog.container).
        scene.overlayManager = new FrogOverlayManager(scene, () => scene.frogs)
        this.spawner.rebindCarriers()
        // Phase 14: пересоздаём selection layer (subscribe уже active в create()).
        scene.selectionLayer = new SerumSelectionLayer(scene)

        scene.input.enabled = true
        scene.isLocationTransitioning = false
        scene.boxProgressMs = 0
        scene.boxOpenCount = 0
        useGameStore.getState().setRareBoxProgress(0)
        this.magnet.resetSpawnTimer()
        scene.syncEntityCount()

        // Pending-коробки уже спавнились ДО анимации внутри newContainer
        // и сейчас вернулись в мир вместе с остальными детьми контейнера.
        // Остаток pending выльется в update() по мере освобождения слотов.

        eventBus.emit('location:transitionEnd', { id: newLoc })
      },
    })
  }
}
