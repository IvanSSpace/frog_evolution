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
// pendingBoxCount, boxProgressMs, isLocationTransitioning,
// prevLocation, overlayManager, selectionLayer, cachedSerumDragActive,
// lastHaptiHover. Эти поля все package-public (см. MainScene class header).
// Вызывает spawner.spawnFrog/spawnLocationFrogs/rebindCarriers/removeFrog/
// startIdleAnim, magnet.clearAll/resetSpawnTimer, box.canSpawnBox/spawnBox.

import { useGameStore } from '../../../store/gameStore'
import { eventBus } from '../../../store/eventBus'
import { FrogOverlayManager } from '../../effects/FrogOverlayManager'
import { SerumSelectionLayer } from '../../effects/SerumSelectionLayer'
import { elementOverlayPool } from '../../effects/elementOverlayPool'
import { mapKeyForLocation } from './types'
import type { MainScene } from '../MainScene'
import type { FrogSpawner } from './FrogSpawner'
import type { MagnetController } from './MagnetController'
import type { BoxController } from './BoxController'
export class LocationTransition {
  private scene: MainScene
  private spawner: FrogSpawner
  private magnet: MagnetController
  // 2026-05-28: in-memory кеш позиций лягушек на локациях. На выходе с
  // локации снапшотим [level,x,y] всех живых frog'ов, на возврате — если
  // levels из store совпадают с кешем по длине и порядку, восстанавливаем
  // те же позиции. Иначе fallback на randomFieldPos. Не персистится (live-
  // only в рамках сессии); цель — убрать "телепортацию" при быстром
  // переключении между локациями.
  private positionCache = new Map<
    number,
    Array<{ level: number; x: number; y: number }>
  >()

  constructor(
    scene: MainScene,
    spawner: FrogSpawner,
    magnet: MagnetController,
    _box: BoxController,
  ) {
    this.scene = scene
    this.spawner = spawner
    this.magnet = magnet
  }

  // Фон для dual-container перехода. Двухзонные локации (Болото/Лес) используют
  // высокую 2size-картинку (height*2), смещённую так, чтобы в кадр (height)
  // попадала половина нужной зоны: frogs → верх, buildings → низ. Прочие
  // локации — обычный full-screen фон через mapKeyForLocation.
  private createTransitionBg(
    locId: number,
    zone: 'frogs' | 'buildings',
    width: number,
    height: number,
  ): Phaser.GameObjects.Image {
    const scene = this.scene
    const twoZoneKey =
      locId === 1
        ? 'toxic_map2size'
        : locId === 2
          ? 'toxic_map2_2size'
          : locId === 3
            ? 'toxic_map3_2size'
            : null
    if (twoZoneKey) {
      const img = scene.add.image(0, 0, twoZoneKey)
      img.setDisplaySize(width, height * 2)
      img.setTint(0xc4c8c4) // SYNC с MainScene — затемнение фона
      // Локальный y внутри container'а (центр = центр экрана): +height/2
      // опускает картинку так, что верхняя половина заполняет кадр (frogs);
      // -height/2 поднимает → видна нижняя половина (buildings).
      img.y = zone === 'buildings' ? -height / 2 : height / 2
      return img
    }
    const img = scene.add.image(0, 0, mapKeyForLocation(locId))
    img.setDisplaySize(width, height)
    img.setTint(0xc4c8c4) // SYNC с MainScene — затемнение фона
    return img
  }

  // Полная очистка поля при смене локации
  clearField() {
    const scene = this.scene
    // Phase 12: dispose overlay manager до уничтожения frog containers,
    // иначе pool будет держать висячие references на destroyed overlays.
    scene.overlayManager?.dispose()
    scene.overlayManager = null

    // Phase 22-fix: ElementAuraOverlay'ы держат aura.container в scene root —
    // dispose() destroy'ит их, иначе они останутся orphaned после очистки frogs.
    for (const aura of scene.elementAuras) aura.dispose()
    scene.elementAuras = []

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
  // Going UP   (Болото → Лес → Континент):
  //   Старая (1.0 → 0.18) сжимается в точку в центре.
  //   Новая (стартует на 6.0 — почти невидима за пределами экрана) → 1.0.
  //
  // Going DOWN (Континент → ... → Болото):
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
      // Phase 22-fix: пересоздаём element aura overlay'и — clearField их не трогает.
      for (const aura of scene.elementAuras) aura.dispose()
      scene.createElementAuras()
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
    // Anchor зума = центр ТЕКУЩЕГО вида (зоны), а не зоны frogs. Если игрок на
    // зоне зданий (камера scrollY=height), зумим её, а не прыгаем на лягушек.
    // transitionFromZone выставлен onTransitionStart (sync emit выше).
    const fromBuildingsZone = scene.transitionFromZone === 'buildings'
    const fromScrollY = fromBuildingsZone ? height : 0
    const cy = fromScrollY + height / 2

    // Магниты НЕ убиваем здесь: иначе collectTransitionSprites(oldLoc) ниже
    // через prepBuildings заново заспавнит их на случайных позициях — видно как
    // дроны «телепортируются» перед зумом. Теперь они, как и сборщики, reparent'ятся
    // в oldContainer с текущими позициями и чистятся releaseBuildingsForTransition
    // + oldContainer.destroy(true).

    // Phase 22-fix: detach overlay manager БЕЗ release/drain. Overlay containers
    // остаются вложенными в frog.container → масштабируются вместе с oldContainer
    // в zoom-анимации (раньше pool.release() делал detach сразу и сывороточный
    // тинт + orb пропадали ДО анимации). pool.active хранит висячие ссылки —
    // вычистим через elementOverlayPool.drainAll() в onComplete после того как
    // oldContainer.destroy(true) убьёт их containers.
    scene.overlayManager?.disposeForTransition()
    scene.overlayManager = null

    // Phase 22-fix: ElementAuraOverlay'ы держат aura.container в scene root
    // и каждый кадр следуют за frog.container.x/y. Если оставить — auras
    // «уплывают» в локальные координаты сжимающегося oldContainer и слетают.
    // Переносим в oldContainer (с пересчётом в локальные координаты), там их
    // уничтожит oldContainer.destroy(true).
    // Подготавливаем oldContainer заранее, чтобы передать aura'м для reparent.
    const oldContainer = scene.add.container(cx, cy)
    for (const aura of scene.elementAuras) {
      aura.reparentForTransition(oldContainer, cx, cy)
    }
    scene.elementAuras = []

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
    // Фон — кладём первым (нижний по списку → нижний по depth внутри контейнера).
    // Строим СВЕЖИЙ фон уходящей локации (нужная половина по зоне выхода)
    // вместо переиспользования persistent scene.bg — тот держит leftover
    // full-screen фон от прошлого перехода. Старый scene.bg сразу уничтожаем:
    // его заменит newBg в onComplete (line scene.bg = newBg).
    const oldBg = this.createTransitionBg(
      oldLoc,
      scene.transitionFromZone,
      width,
      height,
    )
    oldContainer.add(oldBg)
    oldBg.x = 0
    scene.bg.destroy()
    // Затем лягушки — поверх фона
    const oldFrogs = [...scene.frogs]
    // Снапшот позиций для возврата на эту локацию (см. positionCache в шапке).
    this.positionCache.set(
      oldLoc,
      oldFrogs.map((f) => ({
        level: f.level,
        x: f.container.x,
        y: f.container.y,
      })),
    )
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

    // Zone-aware видимость: в зум-анимации показываем только контент ТЕКУЩЕЙ
    // зоны (иначе контент другой зоны «прострелит» через кадр при сжатии до
    // точки). frogs-зона: лягушки/коробки/какашки/дроны; buildings-зона: здания.
    const frogZoneVisible = !fromBuildingsZone
    for (const f of oldFrogs) f.container.setVisible(frogZoneVisible)
    for (const b of oldBoxes) b.img.setVisible(frogZoneVisible)
    for (const p of oldPoops) p.setVisible(frogZoneVisible)

    // Здания + дроны (только Болото) — reparent в oldContainer: замораживаем и
    // зумим вместе с полем (раньше prepBuildings мгновенно прятал/despawn'ил их).
    // Видимость: здания — зона buildings, дроны (живут в зоне frogs) — зона
    // frogs. После reparent контроллеры роняют ссылки: destroy(true) убьёт
    // спрайты, show()/ensureSpawned пересоздадут на возврате.
    if (oldLoc === 1) {
      const { buildings, drones } = scene.collectTransitionSprites(oldLoc)
      for (const b of buildings) {
        const wx = b.x
        const wy = b.y
        oldContainer.add(b)
        b.x = wx - cx
        b.y = wy - cy
        b.setVisible(fromBuildingsZone)
      }
      for (const d of drones) {
        const wx = d.x
        const wy = d.y
        oldContainer.add(d)
        d.x = wx - cx
        d.y = wy - cy
        d.setVisible(frogZoneVisible)
      }
      scene.releaseBuildingsForTransition()
    }

    // 3. Спавним новых лягушек внутрь newContainer + добавляем СВОЙ фон
    const newContainer = scene.add.container(cx, cy)
    // Going down: стартуем буквально с точки (0.005), чтобы поле «появилось из ниоткуда»
    const newStartScale = goingUp ? 8 : 0.005
    newContainer.setScale(newStartScale)
    newContainer.setAlpha(0) // плавно проявится в начале перехода
    // Свежий фон для новой локации. Половина зоны приземления = зона выхода
    // (configureWorld в onTransitionEnd сохраняет её), поэтому двухзонный newBg
    // показывает в зуме ту же половину, на которую сядет камера, и стыка с
    // loc1Bg/loc2Bg не видно (одинаковые пиксели в кадре).
    const newBg = this.createTransitionBg(
      newLoc,
      scene.transitionFromZone,
      width,
      height,
    )
    newContainer.add(newBg)

    const state = useGameStore.getState()
    const levels = state.locationFrogs[newLoc - 1] ?? []
    // Используем сохранённые позиции если кеш совпадает с levels по длине
    // и уровням в том же порядке. Иначе spawn'им в случайные точки.
    const cached = this.positionCache.get(newLoc)
    const useCachedPositions =
      !!cached &&
      cached.length === levels.length &&
      cached.every((c, i) => c.level === levels[i])
    if (levels.length > 0) {
      levels.forEach((lvl, i) => {
        const { x: wx, y: wy } = useCachedPositions
          ? { x: cached![i].x, y: cached![i].y }
          : scene.randomFieldPos()
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
        // Видны в зуме только если приземляемся на зону frogs (иначе они в
        // другой зоне и «прострелят» кадр). Видимость восстановит onComplete.
        frog.container.setVisible(frogZoneVisible)
      })
    }

    // 2026-05-30: здания (фабрика/склад/дрон) на Болоте — reparent в
    // newContainer, чтобы зумились вместе с лягушками. Generic-loop в
    // onComplete вернёт их в scene root (вместе с остальными детьми). Coords
    // переводим в локальные (минус центр). Видимость по зоне приземления:
    // здания — зона buildings, дроны — зона frogs (одинаково с уходящей зоной,
    // т.к. configureWorld сохраняет зону).
    if (newLoc === 1) {
      const { buildings, drones } = scene.collectTransitionSprites(newLoc)
      for (const b of buildings) {
        const wx = b.x
        const wy = b.y
        newContainer.add(b)
        b.x = wx - cx
        b.y = wy - cy
        b.setVisible(fromBuildingsZone)
      }
      for (const d of drones) {
        const wx = d.x
        const wy = d.y
        newContainer.add(d)
        d.x = wx - cx
        d.y = wy - cy
        // Видимость дронов НЕ трогаем: заряжающийся дрон скрыт (на базе),
        // блуждающий — виден. onComplete тоже их не форсит — иначе скрытый
        // заряжающийся дрон показался бы на базе. Контроллер сам управляет.
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
        // Уничтожаем старый контейнер вместе со всеми его потомками
        // (oldBg + frog.containers + box imgs + poops + overlay.containers + aura.containers).
        oldContainer.destroy(true)

        // Phase 22-fix: pool.active хранит ссылки на overlay'и которые только что
        // были destroy'd через oldContainer. Очищаем — pool.acquire() в будущем
        // создаст свежие. drainAll() для уже-мёртвых objects = no-op safe.
        elementOverlayPool.drainAll()

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

        // Восстанавливаем видимость лягушек (в зуме прятались если приземление
        // на зону зданий — иначе «прострелили» бы кадр). Здания/дроны не трогаем:
        // их видимость восстановит prepBuildings/контроллер (заряжающийся дрон
        // должен остаться скрытым на базе).
        for (const f of scene.frogs) f.container.setVisible(true)

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
        // Phase 22-fix: пересоздаём element aura overlay'и — reparentForTransition
        // удалил предыдущие active map, containers уже destroyed через oldContainer.
        scene.createElementAuras()
        this.spawner.rebindCarriers()
        // Phase 14: пересоздаём selection layer (subscribe уже active в create()).
        scene.selectionLayer = new SerumSelectionLayer(scene)

        scene.input.enabled = true
        scene.isLocationTransitioning = false
        this.magnet.resetSpawnTimer()
        scene.syncEntityCount()

        // Pending-коробки уже спавнились ДО анимации внутри newContainer
        // и сейчас вернулись в мир вместе с остальными детьми контейнера.
        // Остаток pending выльется в update() по мере освобождения слотов.

        eventBus.emit('location:transitionEnd', { id: newLoc })
      },
    })
  }

  /**
   * Same dual-container zoom как у onLocationChanged (going-UP направление),
   * но «новая локация» = только map4.webp как промежуточный фон при переходе
   * на Звёздную карту. Лягушки/коробки уходят в точку вместе с фермой,
   * map4 разрастается на полный экран. После этого MainScene.bg = map4
   * (всё прочее на сцене уничтожено) и можно sleep'ать сцену.
   *
   * Возвращает Promise, который резолвится по завершению анимации — owner
   * (game/index.ts) переключает на StarMapScene.
   */
  runOpenStarMapTransition(): Promise<void> {
    return new Promise((resolve) => {
      const scene = this.scene
      if (scene.isLocationTransitioning) {
        scene.tweens.killTweensOf(scene.cameras.main)
        scene.cameras.main.setZoom(1)
        scene.isLocationTransitioning = false
      }
      scene.isLocationTransitioning = true
      scene.input.enabled = false
      scene.prepareStarmapTransition() // зум из зоны frogs (scroll 0)
      eventBus.emit('location:transitionStart', {
        from: scene.prevLocation,
        to: -1,
      })

      const { width, height } = scene.scale
      const cx = width / 2
      const cy = height / 2

      this.magnet.clearAll()

      // Detach overlay manager БЕЗ release (тинт сыворотки сохраняется до destroy)
      scene.overlayManager?.disposeForTransition()
      scene.overlayManager = null

      const oldContainer = scene.add.container(cx, cy)

      // Auras (scene root) → oldContainer
      for (const aura of scene.elementAuras) {
        aura.reparentForTransition(oldContainer, cx, cy)
      }
      scene.elementAuras = []

      scene.selectionLayer?.dispose()
      scene.selectionLayer = null
      if (scene.cachedSerumDragActive) {
        useGameStore.getState().setSerumDragActive(false)
        scene.cachedSerumDragActive = false
      }
      scene.lastHaptiHover = false

      // Bg + frogs + boxes + poops → oldContainer (с пересчётом в локальные коорды)
      const oldBg = scene.bg
      oldContainer.add(oldBg)
      oldBg.x = 0
      oldBg.y = 0

      for (const f of [...scene.frogs]) {
        scene.tweens.killTweensOf(f.container)
        scene.tweens.killTweensOf(f.body)
        if (f.poopTimer) f.poopTimer.paused = true
        const wx = f.container.x
        const wy = f.container.y
        oldContainer.add(f.container)
        f.container.x = wx - cx
        f.container.y = wy - cy
      }
      scene.frogs = []

      for (const b of [...scene.boxes]) {
        scene.tweens.killTweensOf(b.img)
        const wx = b.img.x
        const wy = b.img.y
        oldContainer.add(b.img)
        b.img.x = wx - cx
        b.img.y = wy - cy
      }
      scene.boxes = []

      for (const p of [...scene.poops]) {
        scene.tweens.killTweensOf(p)
        const wx = p.x
        const wy = p.y
        oldContainer.add(p)
        p.x = wx - cx
        p.y = wy - cy
      }
      scene.poops = []

      // newContainer с toxic_map4 как фоном (full screen)
      const newContainer = scene.add.container(cx, cy)
      const newBg = scene.add.image(0, 0, 'toxic_map4')
      newBg.setDisplaySize(width, height)
      newContainer.add(newBg)
      newContainer.setScale(8)
      newContainer.setAlpha(0)

      // Going UP: старая впереди (видим как сжимается), новая сзади
      oldContainer.setDepth(200)
      newContainer.setDepth(100)

      scene.cameras.main.setZoom(1)

      const duration = 450

      scene.tweens.add({
        targets: oldContainer,
        scale: 0.01,
        duration,
        ease: 'Sine.easeInOut',
      })
      scene.tweens.add({
        targets: oldContainer,
        alpha: 0,
        duration: duration * 0.22,
        delay: duration * 0.78,
        ease: 'Sine.easeIn',
      })
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
          oldContainer.destroy(true)
          elementOverlayPool.drainAll()

          // Поднимаем map4 из newContainer на корневой уровень
          const children = [...newContainer.list]
          for (const child of children) {
            const c = child as Phaser.GameObjects.Image
            const lx = c.x
            const ly = c.y
            newContainer.remove(c, false)
            scene.add.existing(c)
            c.x = lx + cx
            c.y = ly + cy
          }
          newContainer.destroy(false)

          newBg.setDepth(-1)
          scene.bg = newBg

          scene.input.enabled = true
          scene.isLocationTransitioning = false
          eventBus.emit('location:transitionEnd', { id: -1 })
          resolve()
        },
      })
    })
  }

  /**
   * Зеркальный к runOpenStarMapTransition: текущий scene.bg = map4 (выставленный
   * при open), возвращаем фактическую локацию targetLocId. Спавним лягушек
   * через FrogSpawner.spawnLocationFrogs внутри newContainer, dual-container
   * scale 0.005 → 1 для новой, map4 разлетается за экран.
   */
  runCloseStarMapTransition(targetLocId: number): Promise<void> {
    return new Promise((resolve) => {
      const scene = this.scene
      if (scene.isLocationTransitioning) {
        scene.tweens.killTweensOf(scene.cameras.main)
        scene.cameras.main.setZoom(1)
        scene.isLocationTransitioning = false
      }
      scene.isLocationTransitioning = true
      scene.input.enabled = false
      scene.prevLocation = targetLocId
      scene.prepareStarmapTransition() // зум из зоны frogs (scroll 0)
      eventBus.emit('location:transitionStart', { from: -1, to: targetLocId })

      const { width, height } = scene.scale
      const cx = width / 2
      const cy = height / 2

      // oldContainer с текущим bg = map4 (на корневом уровне)
      const oldContainer = scene.add.container(cx, cy)
      const oldBg = scene.bg
      oldContainer.add(oldBg)
      oldBg.x = 0
      oldBg.y = 0

      // newContainer с фоном целевой локации + спавнятся frogs
      const newContainer = scene.add.container(cx, cy)
      const newStartScale = 0.005
      newContainer.setScale(newStartScale)
      newContainer.setAlpha(0)
      const newBg = scene.add.image(0, 0, mapKeyForLocation(targetLocId))
      newBg.setDisplaySize(width, height)
      newBg.setTint(0xc4c8c4) // SYNC с MainScene — затемнение фона
      newContainer.add(newBg)

      const state = useGameStore.getState()
      const levels = state.locationFrogs[targetLocId - 1] ?? []
      if (levels.length > 0) {
        levels.forEach((lvl) => {
          const { x: wx, y: wy } = scene.randomFieldPos()
          const frog = this.spawner.spawnFrog(wx, wy, lvl)
          scene.tweens.killTweensOf(frog.body)
          scene.tweens.killTweensOf(frog.container)
          frog.body.scaleY = 1.0
          if (frog.poopTimer) frog.poopTimer.paused = true
          newContainer.add(frog.container)
          frog.container.x = wx - cx
          frog.container.y = wy - cy
        })
      }

      // Going DOWN: новая впереди (зумимся внутрь), старая сзади разлетается
      newContainer.setDepth(200)
      oldContainer.setDepth(100)

      scene.cameras.main.setZoom(1)

      const duration = 450

      scene.tweens.add({
        targets: oldContainer,
        scale: 8,
        duration,
        ease: 'Sine.easeInOut',
      })
      scene.tweens.add({
        targets: oldContainer,
        alpha: 0,
        duration: duration * 0.22,
        delay: duration * 0.78,
        ease: 'Sine.easeIn',
      })
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
          oldContainer.destroy(true) // уничтожает старый map4 sprite

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

          newBg.setDepth(-1)
          scene.bg = newBg

          for (const f of scene.frogs) {
            if (f.poopTimer) f.poopTimer.paused = false
            this.spawner.startIdleAnim(f)
          }

          scene.overlayManager = new FrogOverlayManager(
            scene,
            () => scene.frogs,
          )
          scene.createElementAuras()
          this.spawner.rebindCarriers()
          scene.selectionLayer = new SerumSelectionLayer(scene)

          scene.input.enabled = true
          scene.isLocationTransitioning = false
          this.magnet.resetSpawnTimer()
          scene.syncEntityCount()

          eventBus.emit('location:transitionEnd', { id: targetLocId })
          resolve()
        },
      })
    })
  }
}
