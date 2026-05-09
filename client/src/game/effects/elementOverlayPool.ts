// Phase 12/13: elementOverlayPool — singleton pool для FrogElementOverlay.
// Реализует acquire/release semantics (REQ ELEMENT-06):
//   - acquire(scene, element, tier) → re-uses idle overlay из pool по ключу `${element}:${tier}`,
//     или создаёт новый.
//   - release(overlay)              → detach() + push в правильный bucket (НЕ destroy).
//   - drainAll()                    → dispose() всех (вызывает manager при scene shutdown).
//
// Phase 13: pool разбит по составному ключу (element, tier) — overlays разных tier
// не смешиваются, что минимизирует idle-restart при acquire.

import type Phaser from 'phaser'
import type { Element } from '../../store/cosmic/types'
import type { ElementTier } from './elements/types'
import { FrogElementOverlay } from './FrogElementOverlay'

class ElementOverlayPool {
  private pool: Map<string, FrogElementOverlay[]> = new Map()
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

  acquire(
    scene: Phaser.Scene,
    element: Element,
    tier: ElementTier = 'dormant',
  ): FrogElementOverlay {
    this.bindScene(scene)
    const key = `${element}:${tier}`
    const bucket = this.pool.get(key) ?? []

    // Пропускаем уничтоженные overlays (их container мог быть destroy'd вместе с frog-контейнером)
    let overlay: FrogElementOverlay | undefined
    while (bucket.length > 0) {
      const candidate = bucket.pop()!
      if (candidate.container.active) {
        overlay = candidate
        break
      }
      // destroyed — просто дропаем (GC возьмёт)
    }
    if (bucket.length === 0) this.pool.delete(key)
    else this.pool.set(key, bucket)

    const result = overlay ?? new FrogElementOverlay(scene)
    this.active.add(result)
    return result
  }

  release(overlay: FrogElementOverlay): void {
    if (!this.active.has(overlay)) return
    this.active.delete(overlay)

    // Если container уничтожен Phaser (frog merge destroyed host container) —
    // не добавляем в pool: orb.geom уже null, attach() упадёт.
    if (!overlay.container.active) {
      overlay.detach() // noop-safe: detach проверяет container.active внутри
      return
    }

    const key = `${overlay.element}:${overlay.tier}`
    overlay.detach()
    const bucket = this.pool.get(key) ?? []
    bucket.push(overlay)
    this.pool.set(key, bucket)
  }

  drainAll(): void {
    for (const o of this.active) o.dispose()
    for (const bucket of this.pool.values()) {
      for (const o of bucket) o.dispose()
    }
    this.active.clear()
    this.pool.clear()
    this.scene = null
  }

  get totalActive(): number {
    return this.active.size
  }
  get totalPooled(): number {
    let n = 0
    for (const b of this.pool.values()) n += b.length
    return n
  }
}

export const elementOverlayPool = new ElementOverlayPool()
