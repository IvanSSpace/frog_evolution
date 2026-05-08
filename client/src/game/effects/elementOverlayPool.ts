// Phase 12: elementOverlayPool — singleton pool для FrogElementOverlay.
// Реализует acquire/release semantics (REQ ELEMENT-06):
//   - acquire(scene, element) → re-uses idle overlay из pool, или создаёт новый.
//   - release(overlay)        → detach() + push в pool (НЕ destroy).
//   - drainAll()              → dispose() всех (вызывает manager при scene shutdown).
//
// Цель: zero destroy/create на каждый carrier-add/remove cycle.

import type Phaser from 'phaser'
import type { Element } from '../../store/cosmic/types'
import { FrogElementOverlay } from './FrogElementOverlay'

class ElementOverlayPool {
  private pool: FrogElementOverlay[] = []
  private active: Set<FrogElementOverlay> = new Set()
  private scene: Phaser.Scene | null = null

  /**
   * Привязка пула к active scene. При смене сцены — drain всех старых overlay
   * (Phaser destroy'ит их сам через scene shutdown, мы должны очистить refs
   * чтобы не держать висячих ссылок).
   */
  bindScene(scene: Phaser.Scene): void {
    if (this.scene && this.scene !== scene) this.drainAll()
    this.scene = scene
  }

  acquire(scene: Phaser.Scene, _element: Element): FrogElementOverlay {
    this.bindScene(scene)
    let overlay = this.pool.pop()
    if (!overlay) overlay = new FrogElementOverlay(scene)
    this.active.add(overlay)
    return overlay
  }

  release(overlay: FrogElementOverlay): void {
    if (!this.active.has(overlay)) return
    overlay.detach()
    this.active.delete(overlay)
    this.pool.push(overlay)
  }

  drainAll(): void {
    for (const o of this.active) o.dispose()
    for (const o of this.pool) o.dispose()
    this.active.clear()
    this.pool = []
    this.scene = null
  }

  get totalActive(): number { return this.active.size }
  get totalPooled(): number { return this.pool.length }
}

export const elementOverlayPool = new ElementOverlayPool()
