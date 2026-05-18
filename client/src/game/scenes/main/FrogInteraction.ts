// Phase 21-05 (Wave 5): Frog interaction controller (tap / serum), extracted
// from MainScene.ts.
//
// Phase 22: serumEligibility.ts deleted + rarity removed.
// Any non-carrier frog of any level can receive a serum (simple check).
//
// Public API:
//   - setup(): подвязывает eventBus + Zustand subscribe; вызывается из MainScene.create()
//     после создания selectionLayer/overlayManager.
//   - teardown(): отписывает всё; вызывается из MainScene.destroy().
//   - onFrogTapped(frog, tapX, tapY): public — вызывается FrogSpawner из dragend.
//
// Coupling: ссылка на MainScene + FrogSpawner + MergeController. Использует
// scene.frogs, scene.selectionLayer, scene.cachedSerumDragActive,
// scene.lastHaptiHover. Вызывает spawner.startIdleAnim,
// merge.findMergeTarget / merge.performMerge / merge.spawnFloatingText.

import Phaser from 'phaser'
import { useGameStore } from '../../../store/gameStore'
import { eventBus } from '../../../store/eventBus'
import { hapticImpact, hapticNotification } from '../../../utils/telegram'
import { burstEffect } from '../../effects/elements/burstEffect'
import { ELEMENT_TINT } from '../../../components/CosmicHub/ElementGrid'
import i18next from 'i18next'
import type { Element } from '../../../store/cosmic/types'
import { DPR, tintToHex, type FrogData } from './types'
import type { MainScene } from '../MainScene'
import type { FrogSpawner } from './FrogSpawner'
import type { MergeController } from './MergeController'

/** Phase 22 + 2026-05-19 rule: серум applies только на L1 frogs which are not yet carriers. */
function isEligible(
  frog: { id: string; level: number },
  carriers: ReadonlyArray<{ frogId: string }>,
): boolean {
  if (frog.level !== 1) return false
  return !carriers.some((c) => c.frogId === frog.id)
}

export class FrogInteraction {
  private scene: MainScene
  private spawner: FrogSpawner
  private merge: MergeController
  private unsubSerum: (() => void) | null = null

  constructor(scene: MainScene, spawner: FrogSpawner, merge: MergeController) {
    this.scene = scene
    this.spawner = spawner
    this.merge = merge
  }

  /**
   * Подвязка handler'ов: subscribe на serumDragActive (selection halo управление),
   * eventBus listener'ы для desktop drag (Phase 14 SERUM-11), глобальный
   * pointerdown handler для cancel-в-пустоту.
   */
  setup(): void {
    this.subscribeSerumState()
    this.scene.input.on('pointerdown', this.onPointerDownGlobal, this)
    eventBus.on('cosmic:serum-pointer-move', this.onSerumPointerMove)
    eventBus.on('cosmic:serum-pointer-up', this.onSerumPointerUp)
  }

  teardown(): void {
    this.unsubSerum?.()
    this.unsubSerum = null
    eventBus.off('cosmic:serum-pointer-move', this.onSerumPointerMove)
    eventBus.off('cosmic:serum-pointer-up', this.onSerumPointerUp)
    this.scene.input.off('pointerdown', this.onPointerDownGlobal, this)
  }

  // Phase 14: subscribe на serumDragActive + selectedSerum.
  // На каждый change → пересчитать eligible set + show/hide halos.
  private subscribeSerumState() {
    const scene = this.scene
    if (this.unsubSerum) {
      this.unsubSerum()
      this.unsubSerum = null
    }
    this.unsubSerum = useGameStore.subscribe((state) => {
      const active = state.serumDragActive
      const dragChanged = active !== scene.cachedSerumDragActive
      scene.cachedSerumDragActive = active

      if (active) {
        const sel = state.selectedSerum
        if (!sel) {
          scene.selectionLayer?.hide()
          return
        }
        // Phase 22: eligible = any non-carrier frog (any level)
        const eligible = scene.frogs.filter((f) =>
          isEligible({ id: f.id, level: f.level }, state.carriers),
        )
        scene.selectionLayer?.show(
          eligible.map((f) => ({
            id: f.id,
            container: f.container,
            body: f.body,
          })),
          tintToHex(ELEMENT_TINT[sel.element]),
        )
      } else if (dragChanged) {
        // Just deactivated — hide halos.
        scene.selectionLayer?.hide()
        scene.lastHaptiHover = false
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

  onFrogTapped(
    frog: FrogData,
    tapX: number = frog.container.x,
    tapY: number = frog.container.y,
  ) {
    const scene = this.scene
    // Phase 14: serum selection mode переопределяет normal tap behavior
    // (apply / mis-tap вместо merge / coin / burst).
    if (useGameStore.getState().serumDragActive) {
      this.handleSerumTap(frog)
      return
    }

    // Тап-мердж: ищем рядом с точкой тапа другую лягушку того же уровня.
    // L18+L18 разрешён — MergeController обрабатывает special cosmos sentinel path.
    {
      const target = this.merge.findMergeTarget(tapX, tapY, frog.level, frog)
      if (target) {
        this.merge.performMerge(frog, target, tapX, tapY)
        return
      }
    }

    // Лёгкая вибрация на тап по лягушке
    hapticImpact('light')

    // Тап = +1 монета (не зависит от уровня), отдельно от какашек
    useGameStore.getState().addGold(1)
    this.merge.spawnFloatingText(
      frog.container.x,
      frog.container.y - 20 * DPR,
      '+1',
      'regular',
    )

    // ELEMENT-10: element-burst при тапе на carrier-лягушку.
    {
      const carriers = useGameStore.getState().carriers
      const carrier = carriers.find((c) => c.frogId === frog.id)
      if (carrier) {
        burstEffect(scene, frog.container, carrier.element as Element)
      }
    }

    scene.tweens.killTweensOf(frog.body)
    frog.body.scaleY = 1.0
    scene.tweens.add({
      targets: frog.body,
      scaleY: 0.78,
      duration: 55,
      ease: 'Power2.easeIn',
      onComplete: () => {
        scene.tweens.add({
          targets: frog.body,
          scaleY: 1.0,
          duration: 150,
          ease: 'Back.easeOut',
          onComplete: () => {
            if (!frog.isMoving && !frog.isMerging)
              this.spawner.startIdleAnim(frog)
          },
        })
      },
    })
  }

  /** Tap по frog'е в selection mode → eligible→apply, ineligible→mis-tap. */
  private handleSerumTap(frog: FrogData) {
    const scene = this.scene
    const state = useGameStore.getState()
    const sel = state.selectedSerum
    if (!sel) {
      useGameStore.getState().setSerumDragActive(false)
      return
    }

    // Phase 22: eligible = not already a carrier
    const eligible = isEligible(
      { id: frog.id, level: frog.level },
      state.carriers,
    )

    if (!eligible) {
      // SERUM-07: mis-tap → red flash + error toast + haptic error.
      scene.selectionLayer?.flashRed({
        id: frog.id,
        container: frog.container,
        body: frog.body,
      })
      hapticNotification('error')
      eventBus.emit('cosmic:toast', {
        type: 'serum-mistap',
        msg: i18next.t('cosmic_hub.serums.already_carrier'),
      })
      return
    }

    // SERUM-09: eligible → 2-сек pulse + carrier создан.
    this.applySerumToFrog(frog, sel.element)
  }

  /** Apply serum: 2-сек pulse + burst at midpoint + atomic store mutation + toast. */
  private applySerumToFrog(frog: FrogData, element: Element) {
    const scene = this.scene
    frog.isMerging = true
    scene.tweens.killTweensOf(frog.body)

    scene.tweens.add({
      targets: frog.body,
      scaleY: 1.15,
      scaleX: 1.15,
      duration: 1000,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        frog.isMerging = false
        if (scene.frogs.includes(frog) && !frog.isMoving)
          this.spawner.startIdleAnim(frog)
      },
    })

    // Burst effect at midpoint (1с).
    scene.time.delayedCall(1000, () => {
      if (!scene.frogs.includes(frog)) return
      burstEffect(scene, frog.container, element)
    })

    // Atomic mutation: clears selection, decrements serum, adds carrier.
    useGameStore.getState().applySerum(frog.id, element, frog.level)

    hapticNotification('success')

    eventBus.emit('cosmic:toast', {
      type: 'serum-applied',
      msg: i18next.t('cosmic_hub.serums.applied'),
      action: {
        label: i18next.t('cosmic_hub.serums.undo_label'),
        onClick: () => {
          // Undo: removeCarrier + addSerum обратно.
          useGameStore.getState().removeCarrier(frog.id)
          useGameStore.getState().addSerum(element, 1)
        },
      },
      duration: 4000,
    })
  }

  /** Helper: client coords → world point. */
  private clientToWorld(clientX: number, clientY: number): Phaser.Math.Vector2 {
    const scene = this.scene
    const canvas = scene.game.canvas
    const rect = canvas.getBoundingClientRect()
    const cx = clientX - rect.left
    const cy = clientY - rect.top
    return scene.cameras.main.getWorldPoint(cx, cy)
  }

  /** Helper: find frog в snap radius (80 * DPR) от world point. */
  private findFrogAt(worldX: number, worldY: number): FrogData | null {
    const SNAP = 80 * DPR
    let hit: FrogData | null = null
    let bestDist = SNAP
    for (const f of this.scene.frogs) {
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
    const scene = this.scene
    const state = useGameStore.getState()
    if (!state.serumDragActive || !state.selectedSerum) return

    const wp = this.clientToWorld(p.x, p.y)
    const hit = this.findFrogAt(wp.x, wp.y)

    if (hit) {
      const eligible = isEligible(
        { id: hit.id, level: hit.level },
        state.carriers,
      )
      if (eligible && !scene.lastHaptiHover) {
        hapticImpact('medium')
        scene.lastHaptiHover = true
      } else if (!eligible) {
        scene.lastHaptiHover = false
      }
    } else {
      scene.lastHaptiHover = false
    }
  }

  /** Phase 14 SERUM-11: desktop drag release — apply / mis-tap / cancel. */
  private onSerumPointerUp = (p: { x: number; y: number }) => {
    const scene = this.scene
    const state = useGameStore.getState()
    if (!state.serumDragActive || !state.selectedSerum) return
    const sel = state.selectedSerum

    scene.lastHaptiHover = false

    const wp = this.clientToWorld(p.x, p.y)
    const hit = this.findFrogAt(wp.x, wp.y)

    if (!hit) {
      useGameStore.getState().setSerumDragActive(false)
      return
    }

    const eligible = isEligible(
      { id: hit.id, level: hit.level },
      state.carriers,
    )

    if (eligible) {
      this.applySerumToFrog(hit, sel.element)
    } else {
      scene.selectionLayer?.flashRed({
        id: hit.id,
        container: hit.container,
        body: hit.body,
      })
      hapticNotification('error')
      eventBus.emit('cosmic:toast', {
        type: 'serum-mistap',
        msg: i18next.t('cosmic_hub.serums.already_carrier'),
      })
    }
  }
}
