// Phase 12: FrogElementOverlay — Phaser-native overlay над лягушкой-carrier.
// Содержит маленький Graphics-орб над головой + idle-particle через primitive
// (Phase 9 effects/anim/shared) каждые 3 секунды (dormant tier).
// Phase 13: расширили до 5-tier (dormant + 4 awakened). attach() принимает tier,
// setTier() меняет idle на живом overlay без detach/re-attach.

import type Phaser from 'phaser'
import type { Element } from '../../store/cosmic/types'
import type { ElementTier, OverlayLifecycle } from './elements/types'
import { ELEMENT_TINTS } from './elements/elementTints'
import { scheduleDormantIdle } from './elements/dormantPresets'
import { scheduleAwakenedIdle } from './elements/awakenedPresets'

// Высота "над головой" — 32px без DPR. DPR применяется снаружи через container scale.
const ORB_OFFSET_Y = -32
const ORB_DEPTH = 50  // выше body, ниже UI overlay

// Tier-specific orb radius (Phase 13).
function orbRadiusForTier(tier: ElementTier): number {
  switch (tier) {
    case 'dormant': return 4
    case 'common': return 5
    case 'rare': return 6
    case 'epic': return 7
    case 'legendary': return 8
  }
}

export class FrogElementOverlay {
  readonly container: Phaser.GameObjects.Container
  element: Element = 'fire'
  tier: ElementTier = 'dormant'
  hostFrogId: string | null = null
  // Phase 17 (CARRIER-09): locked = stabilized carrier overlay фиксирован,
  // syncCarriers не должен пересоздавать overlay когда tier равно carrier.rarity.
  locked = false

  private orb: Phaser.GameObjects.Arc
  private idleLifecycle: OverlayLifecycle | null = null
  private appliedTintToBody: Phaser.GameObjects.Image | null = null
  private prevBodyTint: number | null = null

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0)
    this.container.setVisible(false)
    this.container.setDepth(ORB_DEPTH)

    // Малый круг над головой — основная "значок-носитель" метка.
    // Default radius — dormant. attach() обновит размер по tier.
    this.orb = scene.add.circle(0, ORB_OFFSET_Y, orbRadiusForTier('dormant'), 0xffffff, 0.85)
    this.orb.setStrokeStyle(1, 0xffffff, 0.4)
    this.container.add(this.orb)
  }

  /**
   * Запускает idle-цикл для текущего (element, tier) поверх контейнера.
   * Выкидывает предыдущий lifecycle если был.
   */
  private startIdleForTier(scene: Phaser.Scene, tier: ElementTier): void {
    this.idleLifecycle?.dispose()
    this.idleLifecycle = null
    if (tier === 'dormant') {
      this.idleLifecycle = scheduleDormantIdle(scene, this.container, this.element)
    } else {
      this.idleLifecycle = scheduleAwakenedIdle(scene, this.container, this.element, tier)
    }
  }

  /**
   * Поменять tier на живом overlay без detach/re-attach. Container и tint лягушки
   * сохраняются; только idle переключается. Используется dev helper'ом и Phase 17
   * (carrier evolution: dormant→awakened после стабилизации).
   */
  /**
   * Phase 17 (CARRIER-09): lock/unlock visual tier.
   * lock=true → FrogOverlayManager.syncCarriers НЕ будет пересчитывать tier
   * (даже если carrier.rarity сменится — defensive).
   */
  setLocked(locked: boolean): void {
    this.locked = locked
  }

  setTier(newTier: ElementTier): void {
    if (this.tier === newTier) return
    this.tier = newTier
    // Обновить визуал орба под новый tier.
    const radius = orbRadiusForTier(newTier)
    // Phaser.GameObjects.Arc имеет .setRadius (с phaser 3.50+); используем напрямую через radius prop.
    this.orb.setRadius(radius)
    this.orb.setAlpha(newTier === 'dormant' ? 0.85 : 1.0)
    const scene = this.container.scene as Phaser.Scene | null
    if (!scene || !this.container.active) return
    this.startIdleForTier(scene, newTier)
  }

  /**
   * Прицепить overlay к лягушке. Container reparent'ится в host frog container
   * чтобы автоматически следовать за движением лягушки.
   *
   * Сохраняет prev tint лягушки → восстанавливает в detach().
   */
  attach(
    host: Phaser.GameObjects.Container,
    body: Phaser.GameObjects.Image,
    frogId: string,
    element: Element,
    tier: ElementTier = 'dormant',
  ): void {
    this.hostFrogId = frogId
    this.element = element
    this.tier = tier

    // Update orb size per tier (Phase 13).
    const orbRadius = orbRadiusForTier(tier)
    this.orb.setRadius(orbRadius)

    const tint = ELEMENT_TINTS[element]
    const orbAlpha = tier === 'dormant' ? 0.85 : 1.0
    this.orb.setFillStyle(tint, orbAlpha)
    this.orb.setStrokeStyle(1, tint, 0.4)

    // Apply tint to frog body (preserve previous so detach can restore).
    // Phase 12 only handles regular tint (4-corner same color via setTint).
    // tintFill mode не используется существующим MainScene кодом, так что не сохраняем.
    this.prevBodyTint = body.tintTopLeft
    body.setTint(tint)
    this.appliedTintToBody = body

    // Reparent overlay container into host frog container.
    // Container уже добавлен в scene root в constructor — снимаем оттуда сначала.
    if (this.container.parentContainer) {
      this.container.parentContainer.remove(this.container, false)
    } else {
      // Если container на корневом уровне scene — снимаем из displayList.
      const sceneRoot = (this.container.scene as Phaser.Scene | null)
      if (sceneRoot) sceneRoot.children.remove(this.container)
    }
    host.add(this.container)
    this.container.setPosition(0, 0)
    this.container.setVisible(true)
    this.container.setDepth(ORB_DEPTH)

    // Start idle preset for the requested tier.
    const sceneRef = host.scene as Phaser.Scene
    this.startIdleForTier(sceneRef, tier)
  }

  /**
   * Отцепить от лягушки. Восстанавливает tint лягушки. Container остаётся живым,
   * возвращается в scene-level — pool может его повторно acquire'нуть.
   */
  detach(): void {
    this.idleLifecycle?.dispose()
    this.idleLifecycle = null
    // Phase 17 (CARRIER-09): reset on detach (pool cleanliness).
    this.locked = false

    if (this.appliedTintToBody) {
      // Если body всё ещё активен — восстанавливаем tint. Если уже destroy'ен —
      // молча пропускаем (frog был удалён, body.destroy() забрал tint вместе с ним).
      const stillActive = this.appliedTintToBody.active && this.appliedTintToBody.scene
      if (stillActive) {
        if (this.prevBodyTint != null && this.prevBodyTint !== 0xffffff) {
          this.appliedTintToBody.setTint(this.prevBodyTint)
        } else {
          this.appliedTintToBody.clearTint()
        }
      }
      this.appliedTintToBody = null
      this.prevBodyTint = null
    }

    this.hostFrogId = null
    this.container.setVisible(false)

    // Reparent back to scene-level so pool can keep it alive without a frog parent.
    const scene = this.container.scene as Phaser.Scene | null
    if (scene) {
      this.container.parentContainer?.remove(this.container, false)
      // Только добавляем обратно если container ещё активен и не destroyed.
      if (this.container.active) {
        scene.add.existing(this.container)
        this.container.setPosition(0, 0)
      }
    }
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v)
  }

  /** Полное уничтожение — pool вызывает при scene transition. */
  dispose(): void {
    this.detach()
    if (this.container.active) {
      this.container.destroy(true)
    }
  }
}
