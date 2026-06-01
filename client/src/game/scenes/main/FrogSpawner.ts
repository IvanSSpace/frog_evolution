// Phase 21-01 (Wave 1): Frog spawn / lifecycle / motion controller, extracted
// from MainScene.ts.
//
// Owns: создание FrogData (container + body + handlers), idle/dash tweens,
// removeFrog cleanup, spiral-to-center motion, rebindCarriers (cross-session
// frogId match).
//
// Public API:
//   - spawnFrog(x, y, level): спавнит лягушку, возвращает FrogData
//   - spawnLocationFrogs(): спавнит лягушек current location из store
//   - startIdleAnim(frog): bobbing tween
//   - scheduleNextDash(frog): random-delay dash trigger
//   - performDash(frog): jump anim
//   - removeFrog(frog): cleanup + array remove + overlay release
//   - spiralFrogTo(frog, cx, cy, duration): vortex collapse motion (used by merge)
//   - rebindCarriers(): после rehydrate match carriers↔live frogs by level
//
// Coupling: класс хранит ссылку на MainScene, читает/мутирует scene.frogs,
// scene.overlayManager, scene.selectionLayer, scene.cachedSerumDragActive,
// scene.isLocationTransitioning. Вызывает scene.findMergeTarget,
// scene.performMerge, scene.onFrogTapped, scene.spawnAutoPoop,
// scene.syncEntityCount — для них scene держит package-public method'ы.

import Phaser from 'phaser'
import { useGameStore } from '../../../store/gameStore'
import { eventBus } from '../../../store/eventBus'
import {
  textureKeyForLevel,
  rollPoopType,
  POOP_INTERVAL_MS,
} from '../../config/frogs'
// Phase 22: serumEligibility deleted — simple inline check
import { ELEMENT_TINT } from '../../../components/CosmicHub/ElementGrid'
import {
  BASE_SCALE,
  DASH_RADIUS,
  DPR,
  FIELD_PAD_X,
  FIELD_PAD_Y,
  FIELD_PAD_Y_BOTTOM,
  tintToHex,
  type FrogData,
} from './types'
import type { MainScene } from '../MainScene'

export class FrogSpawner {
  private scene: MainScene

  constructor(scene: MainScene) {
    this.scene = scene
  }

  // Случайная позиция в пределах игрового поля (с лёгким отступом от края).
  // Дублирована в MainScene.randomFieldPos — оставляем здесь helper'ом, чтобы
  // spawnLocationFrogs не зависел от scene.
  private randomFieldPos(): { x: number; y: number } {
    const { width, height } = this.scene.scale
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
  spawnLocationFrogs() {
    const state = useGameStore.getState()
    const locId = state.currentLocation
    const levels = state.locationFrogs[locId - 1] ?? []
    if (levels.length === 0) return
    levels.forEach((lvl) => {
      const { x, y } = this.randomFieldPos()
      this.spawnFrog(x, y, lvl)
    })
  }

  /**
   * После спавна лягушек — перепривязывает CarrierData.frogId к живым лягушкам.
   * Нужно при перезагрузке страницы: старые session-only frogId стали невалидны,
   * но carrier.level совпадает с уровнем лягушки → матчим по уровню.
   */
  rebindCarriers(): void {
    const carriers = useGameStore.getState().carriers
    if (carriers.length === 0) return
    const liveFrogIds = new Set(this.scene.frogs.map((f) => f.id))
    const staleCarriers = carriers.filter((c) => !liveFrogIds.has(c.frogId))
    if (staleCarriers.length === 0) return

    // Build set of already-bound frog IDs to avoid double-binding
    const boundIds = new Set(
      carriers.filter((c) => liveFrogIds.has(c.frogId)).map((c) => c.frogId),
    )

    const updated = carriers.map((c) => {
      if (liveFrogIds.has(c.frogId)) return c
      const carrierLevel = c.level ?? 1
      // Normal: match by level. Debug carriers (frogId='debug:el:loc'): any free frog.
      const match =
        this.scene.frogs.find(
          (f) => f.level === carrierLevel && !boundIds.has(f.id),
        ) ??
        (c.frogId.startsWith('debug:')
          ? this.scene.frogs.find((f) => !boundIds.has(f.id))
          : undefined)
      if (!match) return c
      boundIds.add(match.id)
      return { ...c, frogId: match.id }
    })

    useGameStore.setState({ carriers: updated })
    this.scene.overlayManager?.markDirty()
  }

  spawnFrog(
    x: number,
    y: number,
    level: number = 1,
    tierOverride?: number,
  ): FrogData {
    const scene = this.scene
    const container = scene.add.container(x, y)
    container.setScale(BASE_SCALE)

    // Tier текущей эволюции лягушки этого уровня (0/1/2). Используем t0 как
    // стартовую текстуру (она преcaches'ится в preload), потом подгружаем t1/t2
    // через ensureFrogTextureLoaded и swap'аем setTexture.
    // tierOverride — для dev helpers (__spawnTierRow), bypass'ит store lookup.
    const tier =
      typeof tierOverride === 'number'
        ? Math.max(0, Math.min(2, Math.floor(tierOverride)))
        : (useGameStore.getState().frogTiers[level - 1] ?? 0)
    const body = scene.add.image(0, 0, textureKeyForLevel(level, 0))
    // Drop-shadow: дубль body, сплошной чёрный силуэт, под body, сдвинут влево-вниз.
    const shadow = scene.add.image(-5, 6, textureKeyForLevel(level, 0))
    // Phaser 4: tintFill — флаг silhouette-режима. Тип не экспонирован, каст.
    shadow.setTint(0x000000)
    ;(shadow as unknown as { tintFill: boolean }).tintFill = true
    shadow.setAlpha(0.4)
    if (tier > 0) {
      scene.ensureFrogTextureLoaded(level, tier, () => {
        const key = textureKeyForLevel(level, tier)
        body.setTexture(key)
        shadow.setTexture(key)
      })
    }
    body.scaleY = 1.0
    // Tint уже запечён в SVG при preload (replace #ffffff → cfg.tint hex).
    // Цветные элементы (короны, узоры) сохраняют собственные цвета.
    // Чуть увеличенная зона захвата (~12% padding) — прощает мелкие промахи.
    const hitPadW = body.width * 0.12
    const hitPadH = body.height * 0.12
    body.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(
        -hitPadW,
        -hitPadH,
        body.width + hitPadW * 2,
        body.height + hitPadH * 2,
      ),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    })
    scene.input.setDraggable(body)

    container.add(shadow) // сначала тень — она под body в z-order
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
      dashTimer: null,
      // Phase 12: stable id для match с CarrierData.frogId.
      id: `frog-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    }
    scene.frogs.push(frog)
    scene.syncEntityCount()
    // Phase 12: новая лягушка может быть carrier — сообщаем manager пере-проверить.
    scene.overlayManager?.markDirty()
    // Phase 14: если selection active — пере-вычислить eligible set
    // (новая лягушка может или не может быть eligible).
    if (scene.cachedSerumDragActive) {
      const state = useGameStore.getState()
      if (state.serumDragActive && state.selectedSerum) {
        const sel = state.selectedSerum
        // Phase 22: eligible = any frog that is not already a carrier
        const eligible = scene.frogs.filter(
          (f) => !state.carriers.some((c) => c.frogId === f.id),
        )
        scene.selectionLayer?.show(
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
    frog.poopTimer = scene.time.addEvent({
      delay: POOP_INTERVAL_MS,
      startAt: Math.random() * POOP_INTERVAL_MS,
      loop: true,
      callback: () => {
        if (frog.isMerging) return
        // Едет в капсулу (isAttracted) / магнит тянет → не какает (визуально).
        if (frog.isAttracted) return
        // Loc2: с шансом 18% лягушка какает фиолетовую слизь (эктоплазму) —
        // лежит на поле, собирается ecto-дроном. Иначе — обычная какашка.
        if (
          useGameStore.getState().currentLocation === 2 &&
          Math.random() < 0.06
        ) {
          scene.spawnEctoPoop(frog)
        } else {
          const type = rollPoopType(frog.level)
          scene.spawnAutoPoop(frog, type)
        }
        // Лёгкое сжатие тела на каждый пук (поверх idle, не блокирует)
        scene.tweens.add({
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
    // 2026-05-30: offset точки захвата относительно центра лягушки. Без него
    // container телепортился центром под палец при pickup. С offset — лягушку
    // можно взять за любую точку модели (как дрон), она держится «за то место».
    let grabOffsetX = 0
    let grabOffsetY = 0

    body.on('dragstart', (pointer: Phaser.Input.Pointer) => {
      dragStartX = pointer.x
      dragStartY = pointer.y
      prevDragX = pointer.x
      grabOffsetX = frog.container.x - pointer.x
      grabOffsetY = frog.container.y - pointer.y
      dragMoved = false
      scene.tweens.killTweensOf(frog.container)
      scene.tweens.killTweensOf(frog.body)
      // Отменяем запланированный прыжок (пауза перед dash или следующий dash) —
      // иначе он сработает после отпускания и лягушка прыгнет к устаревшей цели.
      frog.dashTimer?.remove(false)
      frog.dashTimer = null
      frog.isMoving = true
      frog.isDragging = true
      frog.container.setDepth(99999)

      eventBus.emit('frog:pickup', { level: frog.level })

      // Pickup: быстро 0.8 → вернуть на 1.0
      scene.tweens.add({
        targets: frog.body,
        scaleY: 0.8,
        duration: 60,
        ease: 'Power2.easeIn',
        onComplete: () => {
          scene.tweens.add({
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

      // 2026-05-30: наклон в сторону движения (как дрон-сборщик). lerp к
      // целевому tilt — плавно. Сбрасывается в dragend. 0.15 rad = MAX_TILT
      // дрона. scaleX (flip) отрицателен когда смотрит влево, поэтому tilt
      // домножаем на знак facing — наклон всегда визуально «по ходу».
      const FROG_DRAG_TILT = 0.15
      const facingSign = frog.facingRight ? 1 : -1
      const targetTilt =
        Math.abs(dx) > 0.5 ? Math.sign(dx) * FROG_DRAG_TILT * facingSign : 0
      frog.container.rotation = Phaser.Math.Linear(
        frog.container.rotation,
        targetTilt,
        0.3,
      )

      frog.container.x = pointer.x + grabOffsetX
      frog.container.y = pointer.y + grabOffsetY
      frog.body.x = 0
      frog.body.y = 0
    })

    body.on('dragend', (pointer: Phaser.Input.Pointer) => {
      frog.isDragging = false

      // 2026-05-30: плавно вернуть наклон от drag к 0 (отпустили лягушку).
      scene.tweens.add({
        targets: frog.container,
        rotation: 0,
        duration: 180,
        ease: 'Back.easeOut',
      })

      // Phase 14 (SERUM-06): drop-merge заблокирован во время serum selection.
      // Tap-as-drag-end остаётся (handler ниже route'ит через onFrogTapped → handleSerumTap).
      const serumActive = useGameStore.getState().serumDragActive

      // Сначала проверяем мердж в позиции отпускания пальца.
      // L18+L18 разрешён — MergeController обрабатывает special cosmos sentinel path
      // (markCosmosUnlocked + captain birth cinematic в Phase 24).
      if (!serumActive) {
        const target = scene.findMergeTarget(
          pointer.x,
          pointer.y,
          frog.level,
          frog,
        )
        if (target) {
          eventBus.emit('frog:drop', { level: frog.level, merged: true })
          scene.performMerge(frog, target, pointer.x, pointer.y)
          return
        }
      }

      if (!dragMoved) {
        scene.onFrogTapped(frog, pointer.x, pointer.y)
        return
      }

      eventBus.emit('frog:drop', { level: frog.level, merged: false })

      // Если отпустил за полем — плавно тянем обратно к ближайшей валидной точке
      const margin = 20 * DPR
      const { width, height } = scene.scale
      const minX = FIELD_PAD_X + margin
      const maxX = width - FIELD_PAD_X - margin
      const minY = FIELD_PAD_Y + margin
      const maxY = height - FIELD_PAD_Y_BOTTOM - margin
      const clampedX = Phaser.Math.Clamp(frog.container.x, minX, maxX)
      const clampedY = Phaser.Math.Clamp(frog.container.y, minY, maxY)
      const outOfBounds =
        clampedX !== frog.container.x || clampedY !== frog.container.y

      const playDropSquish = () => {
        scene.tweens.killTweensOf(frog.body)
        scene.tweens.add({
          targets: frog.body,
          scaleY: 0.8,
          duration: 70,
          ease: 'Power2.easeIn',
          onComplete: () => {
            scene.tweens.add({
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
        scene.tweens.add({
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

  startIdleAnim(frog: FrogData) {
    this.scene.tweens.add({
      targets: frog.body,
      scaleY: 0.92,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  scheduleNextDash(frog: FrogData) {
    frog.dashTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(2000, 4000),
      callback: () => this.performDash(frog),
    })
  }

  performDash(frog: FrogData) {
    const scene = this.scene
    if (frog.isMerging) return
    // Во время перехода между локациями — замораживаем, перепланируем после
    if (scene.isLocationTransitioning) {
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

    const { width, height } = scene.scale
    const dist = Phaser.Math.FloatBetween(40 * DPR, DASH_RADIUS)

    const fromX = frog.container.x
    const fromY = frog.container.y

    // 2026-05-30: лёгкий center-bias против скопления в углах. Random-walk без
    // bias дрейфует к краям (clamp прижимает) → толпа в углу. Подмешиваем
    // направление-к-центру с весом пропорциональным удалённости от центра:
    // у центра bias≈0 (чистый рандом, прыгают везде), у края — до 0.4.
    const cx = width / 2
    const cy = (FIELD_PAD_Y + (height - FIELD_PAD_Y_BOTTOM)) / 2
    const halfW = (width - 2 * FIELD_PAD_X) / 2
    const halfH = (height - FIELD_PAD_Y - FIELD_PAD_Y_BOTTOM) / 2
    // Нормализованная удалённость от центра по худшей оси (0 центр, 1 край).
    const edge = Math.min(
      1,
      Math.max(
        Math.abs(fromX - cx) / Math.max(1, halfW),
        Math.abs(fromY - cy) / Math.max(1, halfH),
      ),
    )
    const MAX_BIAS = 0.4
    const bias = edge * MAX_BIAS

    const rndAngle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    let dirX = Math.cos(rndAngle)
    let dirY = Math.sin(rndAngle)
    // Направление к центру (если не в самом центре).
    const toCx = cx - fromX
    const toCy = cy - fromY
    const cLen = Math.hypot(toCx, toCy)
    if (cLen > 1) {
      dirX = dirX * (1 - bias) + (toCx / cLen) * bias
      dirY = dirY * (1 - bias) + (toCy / cLen) * bias
      const dLen = Math.hypot(dirX, dirY) || 1
      dirX /= dLen
      dirY /= dLen
    }

    const toX = Phaser.Math.Clamp(
      fromX + dirX * dist,
      FIELD_PAD_X + 10 * DPR,
      width - FIELD_PAD_X - 10 * DPR,
    )
    const toY = Phaser.Math.Clamp(
      fromY + dirY * dist,
      FIELD_PAD_Y + 10 * DPR,
      height - FIELD_PAD_Y_BOTTOM - 10 * DPR,
    )

    const movingRight = toX >= fromX
    if (movingRight !== frog.facingRight) {
      frog.container.scaleX = (movingRight ? 1 : -1) * BASE_SCALE
      frog.facingRight = movingRight
    }

    frog.isMoving = true
    scene.tweens.killTweensOf(frog.body)

    // Какашки идут по своему таймеру (frog.poopTimer), независимо от прыжка

    // Короткая пауза перед прыжком
    frog.dashTimer = scene.time.delayedCall(350, () => {
      // Лягушку взяли пока шла пауза — отменяем прыжок
      if (frog.isDragging) {
        frog.isMoving = false
        return
      }

      // Stretch during dash
      scene.tweens.add({
        targets: frog.body,
        scaleY: 1.2,
        duration: 120,
        ease: 'Power2.easeOut',
      })

      // Move to target — по дуге: x/y lerp + parabolic lift (4t(1-t)).
      // ARC_HEIGHT — пик подъёма посередине траектории, чуть масштабируется
      // с длиной прыжка (длинный прыжок — выше дуга).
      const ARC_HEIGHT = Math.min(22, 8 + dist * 0.18) * DPR
      const jumpState = { t: 0 }
      scene.tweens.add({
        targets: jumpState,
        t: 1,
        duration: 200,
        ease: 'Power2.easeOut',
        onUpdate: () => {
          // Капсула loc2 «забрала» лягушку (isAttracted) → dash больше НЕ двигает
          // её (иначе борется с маршрутом капсулы — позиция дёргается).
          if (frog.isAttracted) return
          const t = jumpState.t
          frog.container.x = fromX + (toX - fromX) * t
          // Контейнер идёт по земле линейно — тень остаётся на земле.
          frog.container.y = fromY + (toY - fromY) * t
          // Дугу прыжка применяем только к body.y (локально) — тень в
          // контейнере не подскакивает с лягушкой.
          const arc = 4 * t * (1 - t) * ARC_HEIGHT
          frog.body.y = -arc
        },
        onComplete: () => {
          if (frog.isDragging || frog.isAttracted) return

          scene.tweens.killTweensOf(frog.body)

          // Landing squish → settle
          scene.tweens.add({
            targets: frog.body,
            scaleY: 0.8,
            duration: 80,
            ease: 'Power2.easeIn',
            onComplete: () => {
              if (frog.isDragging) return

              scene.tweens.add({
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

  removeFrog(frog: FrogData) {
    const scene = this.scene
    scene.frogs = scene.frogs.filter((f) => f !== frog)
    frog.poopTimer?.remove()
    frog.poopTimer = null
    scene.overlayManager?.releaseForFrog(frog.id)
    frog.container.destroy()
    scene.syncEntityCount()
  }

  spiralFrogTo(frog: FrogData, cx: number, cy: number, duration: number) {
    const startX = frog.container.x
    const startY = frog.container.y
    const startAngle = Math.atan2(startY - cy, startX - cx)
    const startRadius = Math.max(
      Phaser.Math.Distance.Between(startX, startY, cx, cy),
      1,
    )

    const obj = { p: 0 }
    this.scene.tweens.add({
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
    this.scene.tweens.add({
      targets: frog.container,
      rotation: Math.PI * 4,
      scale: 0,
      duration,
      ease: 'Power2.easeIn',
    })
  }
}
