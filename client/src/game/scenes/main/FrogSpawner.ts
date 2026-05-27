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
    if (tier > 0) {
      scene.ensureFrogTextureLoaded(level, tier, () => {
        body.setTexture(textureKeyForLevel(level, tier))
      })
    }
    body.scaleY = 1.0
    // Tint уже запечён в SVG при preload (replace #ffffff → cfg.tint hex).
    // Цветные элементы (короны, узоры) сохраняют собственные цвета.
    body.setInteractive({ useHandCursor: true })
    scene.input.setDraggable(body)

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
        const type = rollPoopType(frog.level)
        scene.spawnAutoPoop(frog, type)
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

    body.on('dragstart', (pointer: Phaser.Input.Pointer) => {
      dragStartX = pointer.x
      dragStartY = pointer.y
      prevDragX = pointer.x
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

      // Move to target
      scene.tweens.add({
        targets: frog.container,
        x: toX,
        y: toY,
        duration: 200,
        ease: 'Power2.easeOut',
        onComplete: () => {
          if (frog.isDragging) return

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
