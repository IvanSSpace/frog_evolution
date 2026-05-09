// Phase 12: FrogOverlayManager — синхронизирует cosmicSlice.carriers ↔ overlays.
//
// Обязанности (REQ ELEMENT-07, PERF-02, PERF-03):
//   1. На каждое изменение carriers — пересчитать набор active overlays.
//   2. Hard cap 4 visible: при 5+ carriers выбираем top-4 closest to camera, остальные release'аются.
//   3. Off-screen culling каждые 6 кадров: лягушки вне viewport → setVisible(false).
//   4. На scene shutdown — release всех overlays + drainAll pool.

import type Phaser from 'phaser'
import { useGameStore } from '../../store/gameStore'
import {
  ELEMENTS,
  RARITIES,
  type CarrierData,
  type Element,
} from '../../store/cosmic/types'
import { elementOverlayPool } from './elementOverlayPool'
import type { FrogElementOverlay } from './FrogElementOverlay'
import type { ElementTier } from './elements/types'

// PERF-02: hard cap visible overlays.
const HARD_CAP_VISIBLE = 4

// PERF-03: off-screen viewport culling cadence.
const CULL_FRAME_INTERVAL = 6

// T-12-01: validation set против tampered localStorage carriers.
const VALID_ELEMENTS: ReadonlySet<string> = new Set<string>(ELEMENTS)
// T-13-04: validation rarity → tier (Rarity ⊂ awakened ElementTier).
const VALID_RARITIES: ReadonlySet<string> = new Set<string>(RARITIES)

/** Resolve carrier.rarity → ElementTier с защитой от tampered store. */
function tierFromCarrier(carrier: CarrierData): ElementTier {
  if (VALID_RARITIES.has(carrier.rarity)) return carrier.rarity as ElementTier
  console.warn(
    '[FrogOverlayManager] invalid rarity in carrier (tampered?)',
    carrier,
  )
  return 'dormant'
}

export interface FrogLike {
  id: string
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Image
}

export type FrogProvider = () => FrogLike[]

export class FrogOverlayManager {
  private scene: Phaser.Scene
  private getFrogs: FrogProvider
  private active = new Map<string, FrogElementOverlay>()
  private unsubStore: (() => void) | null = null
  private frame = 0
  private dirty = true
  private lastCarriersSnapshot: CarrierData[] = []
  private disposed = false

  constructor(scene: Phaser.Scene, getFrogs: FrogProvider) {
    this.scene = scene
    this.getFrogs = getFrogs
    elementOverlayPool.bindScene(scene)

    const initial = useGameStore.getState().carriers
    this.lastCarriersSnapshot = initial
    this.dirty = true

    // Subscribe to carriers changes. Простая reference equality — addCarrier/removeCarrier
    // создают новый array, так что reference change надёжно сигналит mutation.
    this.unsubStore = useGameStore.subscribe((state) => {
      if (this.disposed) return
      if (state.carriers !== this.lastCarriersSnapshot) {
        this.lastCarriersSnapshot = state.carriers
        this.dirty = true
      }
    })
  }

  /** Tick из MainScene.update(). */
  tick(): void {
    if (this.disposed) return
    this.frame++
    if (this.dirty) {
      this.syncCarriers(this.lastCarriersSnapshot)
      this.dirty = false
    }
    if (this.frame % CULL_FRAME_INTERVAL === 0) this.applyCulling()
  }

  /** Force re-sync (например, после spawnFrog где FrogData.id появился позже carriers). */
  markDirty(): void {
    this.dirty = true
  }

  /**
   * Синхронизирует carriers ↔ active overlays:
   *  - acquire для top-4 closest to camera carrier-frogs;
   *  - release для всех, кто выпал из top-4 (или из store целиком).
   */
  private syncCarriers(carriers: CarrierData[]): void {
    const frogs = this.getFrogs()
    const frogById = new Map<string, FrogLike>()
    for (const f of frogs) frogById.set(f.id, f)

    // T-12-01: validate carrier elements; invalid → warn + skip.
    // Compute carrier-frogs that exist (intersection of carriers and live frogs).
    const live: { carrier: CarrierData; frog: FrogLike }[] = []
    for (const c of carriers) {
      if (!VALID_ELEMENTS.has(c.element)) {
        console.warn(
          '[FrogOverlayManager] invalid element in carrier (tampered?)',
          c,
        )
        continue
      }
      const f = frogById.get(c.frogId)
      if (f) live.push({ carrier: c, frog: f })
    }

    // T-12-02: hard cap — prefer first 4 by camera distance (closest first).
    const cam = this.scene.cameras.main
    const cx = cam.scrollX + cam.width / 2
    const cy = cam.scrollY + cam.height / 2
    live.sort((a, b) => {
      const da = (a.frog.container.x - cx) ** 2 + (a.frog.container.y - cy) ** 2
      const db = (b.frog.container.x - cx) ** 2 + (b.frog.container.y - cy) ** 2
      return da - db
    })
    const top = live.slice(0, HARD_CAP_VISIBLE)
    const topIds = new Set<string>(top.map((t) => t.carrier.frogId))

    // Release overlays whose carrier is no longer in top-N OR no longer in store.
    for (const [frogId, overlay] of [...this.active]) {
      if (!topIds.has(frogId)) {
        elementOverlayPool.release(overlay)
        this.active.delete(frogId)
      }
    }

    // Acquire overlays for top carriers that are not yet active.
    for (const { carrier, frog } of top) {
      const tier = tierFromCarrier(carrier)
      const existing = this.active.get(carrier.frogId)
      if (existing) {
        // Element или tier (rarity) сменились → re-acquire через pool так чтобы
        // overlay лёг в правильный bucket. Phase 13: setTier() мог бы переключить
        // idle in-place, но пересборка через pool проще и сохраняет инвариант
        // "active overlay.tier совпадает с overlay.element bucket key".
        const tierChanged = existing.tier !== tier
        // Phase 17 (CARRIER-09): если carrier.stabilized & overlay.locked — НЕ
        // пересоздаём overlay. Tier и element считаются финализированными.
        if (
          existing.locked &&
          carrier.stabilized &&
          existing.element === carrier.element
        ) {
          continue
        }
        if (existing.element !== carrier.element || tierChanged) {
          elementOverlayPool.release(existing)
          this.active.delete(carrier.frogId)
        } else {
          continue
        }
      }
      const element = carrier.element as Element
      const overlay = elementOverlayPool.acquire(this.scene, element, tier)
      overlay.attach(frog.container, frog.body, carrier.frogId, element, tier)
      // Phase 17 (CARRIER-09): lock visual если carrier стабилизировался.
      if (carrier.stabilized) overlay.setLocked(true)
      this.active.set(carrier.frogId, overlay)
    }
  }

  /** PERF-03: off-screen culling. Hides overlays whose host frog лежит вне worldView. */
  private applyCulling(): void {
    const cam = this.scene.cameras.main
    const view = cam.worldView
    for (const [, overlay] of this.active) {
      const host = overlay.container.parentContainer
      if (!host) {
        overlay.setVisible(false)
        continue
      }
      const visible = view.contains(host.x, host.y)
      overlay.setVisible(visible)
    }
  }

  /**
   * Освобождает overlay для конкретной лягушки перед её уничтожением.
   * Вызывается из removeFrog() ДО frog.container.destroy() — это гарантирует
   * что overlay-контейнер отсоединяется от родителя и возвращается в pool
   * живым (а не уничтожается вместе с frog-контейнером как дочерний элемент).
   */
  releaseForFrog(frogId: string): void {
    const overlay = this.active.get(frogId)
    if (!overlay) return
    elementOverlayPool.release(overlay)
    this.active.delete(frogId)
  }

  /** Cleanup при scene shutdown / destroy. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubStore?.()
    this.unsubStore = null
    for (const [, overlay] of this.active) {
      elementOverlayPool.release(overlay)
    }
    this.active.clear()
    elementOverlayPool.drainAll()
  }

  // ============ Dev/test introspection ============
  get activeCount(): number {
    return this.active.size
  }
  get poolStats(): { active: number; pooled: number } {
    return {
      active: elementOverlayPool.totalActive,
      pooled: elementOverlayPool.totalPooled,
    }
  }
}
