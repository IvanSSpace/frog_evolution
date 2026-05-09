// Phase 20-05 (Wave 5): Camera controller extracted from StarMapScene.ts.
// Owns: camera target position (world coords), bounds-clamped centerOn, zoom-aware
// hit-area updates for main planets, throttled bounds rescheduling.
//
// Public API:
//   - setCenter(x, y): { hitX, hitY } — единая точка управления камерой.
//     Clamps target to world bounds (учитывая half-viewport size при текущем zoom),
//     обновляет camCenterX/camCenterY и вызывает cam.centerOn(). Возвращает hit-флаги
//     для обнуления velocity при упирании в границу (используется в ControlsController).
//   - getMinZoom() — минимальный «cover» zoom (вселенная заполняет экран).
//   - updatePlanetHitAreas() — пересчёт hit-area радиусов главных планет под current zoom.
//   - scheduleBoundsUpdate() — throttled rAF-обёртка над updatePlanetHitAreas().
//   - centerX / centerY (getters) — read-only доступ к текущей цели камеры.
//
// Coupling:
//   - Читает scene.cameras.main + scene.mainPlanetHits (package-public field, заполняется
//     в renderSystem).
//   - WORLD_SIZE/DPR — module-level константы, синхронизированы с StarMapScene.ts.

import type Phaser from 'phaser'
import type { StarMapScene } from '../StarMapScene'

const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))
// Размер мира — 7000 от центра (полный 14000). Должен совпадать с константой
// в StarMapScene.ts. Single source of truth: оставляем здесь дубль (как в helpers.ts),
// чтобы CameraController был независимым модулем без cyclic imports.
const WORLD_SIZE = 7000 * DPR

export class CameraController {
  // Целевая позиция центра камеры в world coords. Управляем через setCenter().
  // Phaser scroll выводится из этой позиции через centerOn() каждый раз.
  public camCenterX = 0
  public camCenterY = 0

  private hitAreasScheduled = false

  constructor(private scene: StarMapScene) {}

  /** Read-only доступ к текущей цели камеры. */
  get centerX(): number {
    return this.camCenterX
  }
  get centerY(): number {
    return this.camCenterY
  }

  // ЕДИНАЯ ТОЧКА управления камерой: все компоненты вызывают это.
  // Возвращает true если значение упёрлось в границу (для обнуления velocity).
  setCenter(
    targetX: number,
    targetY: number,
  ): { hitX: boolean; hitY: boolean } {
    const cam = this.scene.cameras.main
    const halfViewW = cam.width / cam.zoom / 2
    const halfViewH = cam.height / cam.zoom / 2
    const boundHalfW = Math.max(WORLD_SIZE - halfViewW, 0)
    const boundHalfH = Math.max(WORLD_SIZE - halfViewH, 0)
    const clampedX = Math.max(-boundHalfW, Math.min(boundHalfW, targetX))
    const clampedY = Math.max(-boundHalfH, Math.min(boundHalfH, targetY))
    const hitX = clampedX !== targetX
    const hitY = clampedY !== targetY
    this.camCenterX = clampedX
    this.camCenterY = clampedY
    cam.centerOn(clampedX, clampedY)
    return { hitX, hitY }
  }

  // Минимальный zoom — «cover»: вселенная заполняет экран по длинной оси.
  // Это исключает появление чёрного пространства за её пределами.
  getMinZoom(): number {
    const cam = this.scene.cameras.main
    const worldFull = WORLD_SIZE * 2
    return Math.max(cam.width / worldFull, cam.height / worldFull)
  }

  // Адаптивный hit-area для главных планет — чем сильнее zoom-out,
  // тем больше зона тапа в мировых координатах (фиксированно ~32px на экране).
  updatePlanetHitAreas(): void {
    const cam: Phaser.Cameras.Scene2D.Camera = this.scene.cameras.main
    const minScreenR = 32 * DPR
    const minWorldR = minScreenR / cam.zoom
    for (const h of this.scene.mainPlanetHits) {
      const newR = Math.max(h.baseR, minWorldR)
      h.circle.radius = newR
    }
  }

  // Hit-areas обновляются throttled — не критично для визуала
  scheduleBoundsUpdate(): void {
    if (this.hitAreasScheduled) return
    this.hitAreasScheduled = true
    requestAnimationFrame(() => {
      this.hitAreasScheduled = false
      this.updatePlanetHitAreas()
    })
  }
}
