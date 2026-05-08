// Phase 12: FrogElementOverlay — Phaser-native overlay над лягушкой-carrier.
// Содержит маленький Graphics-орб над головой + idle-particle через primitive
// (Phase 9 effects/anim/shared) каждые 3 секунды (dormant tier).
// Phase 13 расширит до awakened tiers (common/rare/epic/legendary).

import type Phaser from 'phaser'
import type { Element } from '../../store/cosmic/types'
import type { ElementTier, OverlayLifecycle } from './elements/types'
import { ELEMENT_TINTS } from './elements/elementTints'
import { scheduleDormantIdle } from './elements/dormantPresets'

// Высота "над головой" — 32px без DPR. DPR применяется снаружи через container scale.
const ORB_OFFSET_Y = -32
const ORB_RADIUS = 4
const ORB_DEPTH = 50  // выше body, ниже UI overlay

export class FrogElementOverlay {
  readonly container: Phaser.GameObjects.Container
  element: Element = 'fire'
  tier: ElementTier = 'dormant'
  hostFrogId: string | null = null

  private orb: Phaser.GameObjects.Arc
  private idleLifecycle: OverlayLifecycle | null = null
  private appliedTintToBody: Phaser.GameObjects.Image | null = null
  private prevBodyTint: number | null = null

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0)
    this.container.setVisible(false)
    this.container.setDepth(ORB_DEPTH)

    // Малый круг над головой — основная "значок-носитель" метка.
    this.orb = scene.add.circle(0, ORB_OFFSET_Y, ORB_RADIUS, 0xffffff, 0.85)
    this.orb.setStrokeStyle(1, 0xffffff, 0.4)
    this.container.add(this.orb)
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
  ): void {
    this.hostFrogId = frogId
    this.element = element
    this.tier = 'dormant'

    const tint = ELEMENT_TINTS[element]
    this.orb.setFillStyle(tint, 0.85)
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

    // Start idle preset.
    const sceneRef = host.scene as Phaser.Scene
    this.idleLifecycle = scheduleDormantIdle(sceneRef, this.container, element)
  }

  /**
   * Отцепить от лягушки. Восстанавливает tint лягушки. Container остаётся живым,
   * возвращается в scene-level — pool может его повторно acquire'нуть.
   */
  detach(): void {
    this.idleLifecycle?.dispose()
    this.idleLifecycle = null

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
