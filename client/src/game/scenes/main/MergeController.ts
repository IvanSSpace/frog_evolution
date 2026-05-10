// Phase 21-02 (Wave 2): Merge / feed / carrier-merge controller, extracted
// from MainScene.ts.
//
// Owns: classifyDropTarget routing → standard/feed/carrier-merge,
// vortex anim, post-merge spawn, cross-location fly-away effect, plus
// shared visual helpers (flashAt, spawnVortexParticles, spawnFloatingText).
//
// Public API:
//   - performMerge(a, b, cx, cy): top-level entry — routes to feed/carrier/standard
//   - performCarrierMerge(a, b, cx, cy): two stabilized carriers → 1 carrier
//   - performFeed(carrier, sacrifice, cx, cy): consume regular frog → roll outcome
//   - playCrossLocationFlyAway(x, y, level): ghost-fly anim when frog goes to other location
//   - findMergeTarget(x, y, level, exclude): radius search for merge pair
//   - findClosestSameLevelPair(): magnet pair search across all frogs
//   - hasMergeablePair(): boolean wrapper for the above
//   - spawnVortexParticles(cx, cy, duration): merge vortex particles
//   - flashAt(x, y): merge/box flash circle
//   - spawnFloatingText(x, y, text, _type): floating "+N" or label
//   - locationName(id): RU название локации (используется в fly-away label)
//
// Coupling: класс хранит ссылку на MainScene + FrogSpawner. Использует
// scene.frogs (read), scene.overlayManager, scene.input. Вызывает spawner
// для spiralFrogTo / removeFrog / spawnFrog / startIdleAnim.

import Phaser from 'phaser'
import { useGameStore } from '../../../store/gameStore'
import { eventBus } from '../../../store/eventBus'
import {
  FROG_LEVELS,
  MAX_LEVEL,
  textureKeyForLevel,
  type PoopType,
} from '../../config/frogs'
import { hapticImpact, hapticNotification } from '../../../utils/telegram'
import { mergeEffect } from '../../effects/elements/mergeEffect'
import { classifyDropTarget } from '../../../utils/carrierFeed'
import i18next from 'i18next'
import type { Element } from '../../../store/cosmic/types'
import { devLog, devWarn } from '../../../utils/devLog'
import { BASE_SCALE, DPR, MERGE_RADIUS, type FrogData } from './types'
import type { MainScene } from '../MainScene'
import type { FrogSpawner } from './FrogSpawner'

export class MergeController {
  private scene: MainScene
  private spawner: FrogSpawner

  constructor(scene: MainScene, spawner: FrogSpawner) {
    this.scene = scene
    this.spawner = spawner
  }

  findMergeTarget(
    x: number,
    y: number,
    level: number,
    exclude: FrogData,
  ): FrogData | null {
    let best: FrogData | null = null
    let bestDist = MERGE_RADIUS
    for (const other of this.scene.frogs) {
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

  // Ищет ближайшую пару лягушек одного уровня — кандидата для магнита
  findClosestSameLevelPair(): [FrogData, FrogData] | null {
    const byLevel = new Map<number, FrogData[]>()
    for (const f of this.scene.frogs) {
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

  hasMergeablePair(): boolean {
    return this.findClosestSameLevelPair() !== null
  }

  performMerge(a: FrogData, b: FrogData, cx: number, cy: number) {
    const scene = this.scene
    // Phase 17 (CARRIER-03/10): classify drop target before vortex.
    const carriers = useGameStore.getState().carriers
    const cls = classifyDropTarget(
      { aId: a.id, aLevel: a.level, bId: b.id, bLevel: b.level },
      carriers,
    )
    devLog('[performMerge]', cls.kind, {
      aId: a.id,
      bId: b.id,
      carrierIds: carriers.map((c) => c.frogId),
    })

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

    if (cls.kind === 'blocked-stabilized') {
      eventBus.emit('cosmic:toast', {
        type: 'generic',
        msg: i18next.t('cosmic_hub.carrier.merge_blocked_stabilized'),
      })
      hapticNotification('error')
      return
    }

    if (cls.kind === 'no-match') {
      devWarn('[performMerge] no-match unexpected', { a: a.id, b: b.id })
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
    scene.tweens.killTweensOf(a.container)
    scene.tweens.killTweensOf(a.body)
    scene.tweens.killTweensOf(b.container)
    scene.tweens.killTweensOf(b.body)
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

    this.spawner.spiralFrogTo(a, cx, cy, VORTEX_DURATION)
    this.spawner.spiralFrogTo(b, cx, cy, VORTEX_DURATION)
    this.spawnVortexParticles(cx, cy, VORTEX_DURATION)

    // ELEMENT-11: pre-capture carrier info ДО delayedCall — к моменту срабатывания
    // callback'а removeFrog(a)/(b) могут уже отработать и убрать carrier из store.
    const carriersSnap = useGameStore.getState().carriers
    const cA = carriersSnap.find((c) => c.frogId === a.id)
    const cB = carriersSnap.find((c) => c.frogId === b.id)
    const sameElementMerge: Element | null =
      cA && cB && cA.element === cB.element ? (cA.element as Element) : null

    scene.time.delayedCall(VORTEX_DURATION, () => {
      const oldLevel = a.level
      this.spawner.removeFrog(a)
      this.spawner.removeFrog(b)
      this.flashAt(cx, cy)

      // ELEMENT-11: same-element merge anim — поверх обычной flashAt.
      if (sameElementMerge) {
        mergeEffect(scene, cx, cy, sameElementMerge)
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

      scene.time.delayedCall(60, () => {
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
          const newFrog = this.spawner.spawnFrog(cx, cy, newLevel)
          newFrog.container.setScale(0)
          scene.tweens.add({
            targets: newFrog.container,
            scale: BASE_SCALE * 1.2,
            duration: 160,
            ease: 'Back.easeOut',
            onComplete: () => {
              scene.tweens.add({
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
  performFeed(carrier: FrogData, sacrifice: FrogData, cx: number, cy: number) {
    const scene = this.scene
    carrier.isMerging = true
    sacrifice.isMerging = true
    carrier.isMoving = true
    sacrifice.isMoving = true
    scene.tweens.killTweensOf(carrier.container)
    scene.tweens.killTweensOf(carrier.body)
    scene.tweens.killTweensOf(sacrifice.container)
    scene.tweens.killTweensOf(sacrifice.body)
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
    this.spawner.spiralFrogTo(carrier, cx, cy, VORTEX_DURATION)
    this.spawner.spiralFrogTo(sacrifice, cx, cy, VORTEX_DURATION)
    this.spawnVortexParticles(cx, cy, VORTEX_DURATION)

    scene.time.delayedCall(VORTEX_DURATION, () => {
      // Kill spiral tweens immediately: TimeManager fires before TweenManager in
      // the same frame, so if the tween's last frame fires after this callback,
      // it would overwrite setScale(BASE_SCALE) in fail/stabilize paths → carrier invisible.
      scene.tweens.killTweensOf(carrier.container)
      scene.tweens.killTweensOf(sacrifice.container)

      const oldLevel = sacrifice.level
      this.spawner.removeFrog(sacrifice)
      const store0 = useGameStore.getState()
      store0.removeFrogFromLocation(store0.currentLocation, oldLevel)

      this.flashAt(cx, cy)

      // Atomic feed — store mutates carrier + maybe emits stabilization event.
      const outcome = useGameStore.getState().feedCarrier(carrier.id)
      devLog(
        '[performFeed] feedCarrier result:',
        outcome,
        'carrierId:',
        carrier.id,
      )

      if (!outcome) {
        // Defensive: carrier disappeared between drag-end and apply.
        carrier.isMerging = false
        carrier.isMoving = false
        carrier.container.setDepth(carrier.container.y)
        this.spawner.startIdleAnim(carrier)
        return
      }

      if (outcome.result === 'success') {
        // Replace carrier visual: remove old, spawn new at +1 level.
        // Carrier-evolved frog всегда остаётся в текущей локации (не улетает cross-location).
        const newLevel = outcome.newLevel
        const oldCarrierLevel = carrier.level
        this.spawner.removeFrog(carrier)
        const storeS = useGameStore.getState()
        storeS.removeFrogFromLocation(storeS.currentLocation, oldCarrierLevel)
        storeS.addFrogToLocation(storeS.currentLocation, newLevel)

        const newFrog = this.spawner.spawnFrog(cx, cy, newLevel)
        // Transfer carrier.frogId на newFrog.id.
        const carriersNow = useGameStore.getState().carriers.slice()
        const idx = carriersNow.findIndex((c) => c.frogId === carrier.id)
        if (idx >= 0) {
          carriersNow[idx] = { ...carriersNow[idx], frogId: newFrog.id }
          useGameStore.setState({ carriers: carriersNow })
          // Немедленный sync overlay — новый frog получает element-цвет до setScale(0),
          // иначе overlay прицепится лишь через кадр и pop-in начнётся без элемент-тинта.
          scene.overlayManager?.syncNow()
          devLog(
            '[performFeed] frogId transferred to newFrog',
            newFrog.id,
            'overlayActiveCount:',
            scene.overlayManager?.activeCount,
          )
        } else {
          devWarn(
            '[performFeed] carrier frogId transfer failed, orphaned carrier',
            carrier.id,
          )
        }
        newFrog.container.setScale(0)
        scene.tweens.add({
          targets: newFrog.container,
          scale: BASE_SCALE * 1.2,
          duration: 160,
          ease: 'Back.easeOut',
          onComplete: () => {
            scene.tweens.add({
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
        scene.input.setDraggable(carrier.body)
        this.spawner.startIdleAnim(carrier)
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
        scene.input.setDraggable(carrier.body)
        this.spawner.startIdleAnim(carrier)
        hapticImpact('heavy')
      }

      // Force overlay re-sync — level / stabilized changed.
      scene.overlayManager?.markDirty()
    })
  }

  /**
   * Phase 17 (CARRIER-10): merge two stabilized same-element same-level carriers
   * → 1 new carrier на level+1 с S-bucket guaranteed ceiling. Plays mergeEffect.
   */
  performCarrierMerge(a: FrogData, b: FrogData, cx: number, cy: number) {
    const scene = this.scene
    a.isMerging = true
    b.isMerging = true
    a.isMoving = true
    b.isMoving = true
    scene.tweens.killTweensOf(a.container)
    scene.tweens.killTweensOf(a.body)
    scene.tweens.killTweensOf(b.container)
    scene.tweens.killTweensOf(b.body)
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
    this.spawner.spiralFrogTo(a, cx, cy, VORTEX_DURATION)
    this.spawner.spiralFrogTo(b, cx, cy, VORTEX_DURATION)
    this.spawnVortexParticles(cx, cy, VORTEX_DURATION)

    // Pre-capture carrier element для mergeEffect.
    const carriersSnap = useGameStore.getState().carriers
    const carrierA = carriersSnap.find((c) => c.frogId === a.id)
    const element = carrierA?.element

    scene.time.delayedCall(VORTEX_DURATION, () => {
      const oldLevel = a.level
      const store = useGameStore.getState()

      this.spawner.removeFrog(a)
      this.spawner.removeFrog(b)
      store.removeFrogFromLocation(store.currentLocation, oldLevel)
      store.removeFrogFromLocation(store.currentLocation, oldLevel)

      this.flashAt(cx, cy)
      if (element) mergeEffect(scene, cx, cy, element)

      const newLevel = Math.min(oldLevel + 1, MAX_LEVEL)
      const newCfg = FROG_LEVELS[newLevel - 1]
      store.addFrogToLocation(newCfg.location, newLevel)

      const isCrossLocation = newCfg.location !== store.currentLocation

      scene.time.delayedCall(60, () => {
        if (isCrossLocation) {
          this.playCrossLocationFlyAway(cx, cy, newLevel)
          eventBus.emit('cosmic:toast', {
            type: 'generic',
            msg: i18next.t('cosmic_hub.carrier.merge_cross_location_warn'),
            duration: 3000,
          })
          return
        }
        const newFrog = this.spawner.spawnFrog(cx, cy, newLevel)
        newFrog.container.setScale(0)
        scene.tweens.add({
          targets: newFrog.container,
          scale: BASE_SCALE * 1.2,
          duration: 160,
          ease: 'Back.easeOut',
          onComplete: () => {
            scene.tweens.add({
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
          devWarn(
            '[performCarrierMerge] mergeCarriers returned null — defensive',
          )
        }

        scene.overlayManager?.markDirty()
        hapticNotification('success')

        const wasNew = store.markDiscovered(newLevel)
        if (wasNew) eventBus.emit('frog:discovered', { level: newLevel })
      })
    })
  }

  // Анимация: большая полупрозрачная лягушка увеличивается и исчезает за 0.5с
  playCrossLocationFlyAway(x: number, y: number, level: number) {
    const scene = this.scene
    const cfg = FROG_LEVELS[level - 1]
    const ghost = scene.add.image(x, y, textureKeyForLevel(level))
    ghost.setTint(cfg.tint)
    ghost.setScale(BASE_SCALE)
    ghost.setAlpha(0.2)
    ghost.setDepth(99999)

    scene.tweens.add({
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

  locationName(id: number): string {
    switch (id) {
      case 1:
        return 'Болото'
      case 2:
        return 'Лес'
      case 3:
        return 'Континент'
      case 4:
        return 'Планета'
      default:
        return ''
    }
  }

  spawnVortexParticles(cx: number, cy: number, duration: number) {
    const scene = this.scene
    const COUNT = 12
    for (let i = 0; i < COUNT; i++) {
      const baseAngle = (i / COUNT) * Math.PI * 2
      const startRadius = (50 + Math.random() * 30) * DPR
      const px = cx + Math.cos(baseAngle) * startRadius
      const py = cy + Math.sin(baseAngle) * startRadius

      const particle = scene.add.circle(px, py, 3 * DPR, 0xffffaa, 0.85)
      particle.setDepth(99998)

      const obj = { p: 0 }
      scene.tweens.add({
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

  flashAt(x: number, y: number) {
    const scene = this.scene
    const flash = scene.add.circle(x, y, 12 * DPR, 0xffffff, 1)
    flash.setDepth(99999)
    scene.tweens.add({
      targets: flash,
      scale: 4,
      alpha: 0,
      duration: 220,
      ease: 'Power2.easeOut',
      onComplete: () => flash.destroy(),
    })
  }

  spawnFloatingText(x: number, y: number, text: string, _type: PoopType) {
    const scene = this.scene
    // Все цифры — золотые, очень мелкие, медленно поднимаются
    const t = scene.add.text(x, y, text, {
      fontFamily: 'Russo One, sans-serif',
      fontSize: `${11 * DPR}px`,
      color: '#fde047',
      stroke: '#3a2207',
      strokeThickness: 2.5 * DPR,
    })
    t.setOrigin(0.5)
    t.setDepth(99998)

    // Сначала летит вверх без затухания
    scene.tweens.add({
      targets: t,
      y: y - 32 * DPR,
      duration: 1800,
      ease: 'Sine.easeOut',
    })
    // Затухание стартует позже и идёт быстрее, продолжая полёт
    scene.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1000,
      duration: 700,
      ease: 'Sine.easeIn',
      onComplete: () => t.destroy(),
    })
  }
}
