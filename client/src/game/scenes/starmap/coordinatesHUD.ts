// Phase 20-04 (Wave 4): per-frame update loop + HUD data extracted from StarMapScene.ts.
// Controller-class — owns FPS smoothing window. Reads/writes scene's package-public
// fields (cullableData, zoomCompStars, moons, bgArchetypeGfx, bgBatchGfx,
// bgInteractiveEnabled, bgInteractiveContainers, mainLinesGfx, mainLinesLastZoom,
// hudFps, hudVisible, hudTotal).
//
// Public API:
//   - setup(): subscribes to scene.events.on('update'). Per-frame:
//     1. Smooth FPS (30-frame rolling avg) → write hudFps
//     2. Spike detector (>50ms frame → console warn)
//     3. Manual culling tick (every 6 frames) — frustum + LOD-cut → write hudVisible/hudTotal
//     4. Zoom-comp scaling for sparkle stars
//     5. Main connection lines re-draw on zoom change >2%
//     6. BG detail LOD toggle (zoom threshold)
//     7. BG batch graphics visibility (extreme zoom-out)
//     8. BG interactive enable/disable (hit-test overhead optimization)
//     9. Moon orbit animation + fade-in
//
// HUD values consumed by React via getStarMapHUD() in src/game/index.ts —
// reads scene.hudFps/hudVisible/hudTotal directly. Controller writes to those fields,
// preserves existing API contract.
//
// Despite the name "CoordinatesHUD", this is the central per-frame update tick.
// Имя сохранено из исторического: первая версия HUD-overlay рисовала координаты в Phaser.

import Phaser from 'phaser'
import type { StarMapScene } from '../StarMapScene'
import { redrawMainLines } from './starfield'
import { devWarn } from '../../../utils/devLog'

// DPR больше не используется напрямую — margin теперь % от viewport.
// const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))

export interface CoordinatesHUDConfig {
  /** Минимальный zoom при котором рисуется детализация BG-планет. */
  bgDetailMinZoom: number
  /** Минимальный zoom при котором BG-планеты видны как контейнеры (vs. batch). */
  bgPlanetMinZoom: number
  /** Минимальный zoom при котором BG-планеты кликабельны. */
  bgInteractiveMinZoom: number
  /** Начало fade-in спутников (alpha 0 ниже). */
  moonFadeStart: number
  /** Конец fade-in спутников (alpha 1 выше). */
  moonFadeEnd: number
}

export class CoordinatesHUDController {
  private scene: StarMapScene
  private config: CoordinatesHUDConfig

  constructor(scene: StarMapScene, config: CoordinatesHUDConfig) {
    this.scene = scene
    this.config = config
  }

  setup(): void {
    const scene = this.scene
    const config = this.config
    // Сглаженный FPS — circular buffer (Float32Array) + running sum.
    // Заменяет push/shift/reduce каждый кадр (O(n) + GC давление) на O(1).
    const FPS_WINDOW = 30
    const fpsRing = new Float32Array(FPS_WINDOW)
    let fpsIdx = 0
    let fpsCount = 0
    let fpsSum = 0
    // Кэш для оптимизаций «обновляй только при изменении» — see ниже.
    let prevMoonAlpha = -1
    let prevZoomComp = -1

    scene.events.on('update', (_t: number, dt: number) => {
      const cam = scene.cameras.main

      const instantFps = dt > 0 ? 1000 / dt : 60
      fpsSum -= fpsRing[fpsIdx]
      fpsRing[fpsIdx] = instantFps
      fpsSum += instantFps
      fpsIdx = (fpsIdx + 1) % FPS_WINDOW
      if (fpsCount < FPS_WINDOW) fpsCount++
      const avgFps = fpsSum / fpsCount

      // Spike-детектор: лог в консоль если кадр > 50ms (FPS < 20) — для диагностики лагов.
      // Counter loop вместо .filter() — мы уже во frame spike, не аллоцируем лишнего.
      if (dt > 50) {
        let visibleNow = 0
        const cd = scene.lod.cullableData
        for (let i = 0; i < cd.length; i++) {
          if (cd[i].obj.visible) visibleNow++
        }
        devWarn(
          `[StarMap spike] frame=${dt.toFixed(1)}ms zoom=${cam.zoom.toFixed(3)} visible=${visibleNow}/${cd.length} tweens=${scene.tweens.getTweens().length}`,
        )
      }

      // Culling tick — каждые 6 кадров
      scene.lod.cullTickCounter++
      let visibleCount = 0
      // Cull tick — раз в 12 кадров (раньше 6). 500+ entries × 5/сек = ~2500
      // iterations/сек вместо 5000. Глазом разница невидима т.к. cull при
      // быстром zoom плавно догоняет.
      if (scene.lod.cullTickCounter >= 12) {
        scene.lod.cullTickCounter = 0
        const view = cam.worldView
        // Margin = 30% от viewport ширины/высоты. На far zoom margin огромный
        // в world coords → планеты вдалеке от viewport остаются visible, не
        // моргают при паннинге. На close zoom margin маленький → off-screen
        // планеты культятся нормально, FPS восстанавливается.
        const marginX = view.width * 0.3
        const marginY = view.height * 0.3
        const left = view.left - marginX
        const right = view.right + marginX
        const top = view.top - marginY
        const bottom = view.bottom + marginY
        const curZoom = cam.zoom
        for (const c of scene.lod.cullableData) {
          // LOD-cut: при zoom ниже lodMinZoom объект полностью УБИРАЕТСЯ из
          // display list (не только setVisible). Phaser иначе обходит все 600+
          // скрытых контейнеров каждый кадр — display list iteration cost.
          // При возврате zoom выше порога — addToDisplayList обратно.
          const lodOk = c.lodMinZoom === undefined || curZoom >= c.lodMinZoom
          const wasInList = c.inDisplayList !== false // default true
          if (lodOk && !wasInList) {
            c.obj.addToDisplayList()
            c.inDisplayList = true
          } else if (!lodOk && wasInList) {
            c.obj.removeFromDisplayList()
            c.inDisplayList = false
            continue // объект больше не в дереве — viewport-cull неактуален
          }
          if (!lodOk) continue

          const inView =
            c.x + c.r > left &&
            c.x - c.r < right &&
            c.y + c.r > top &&
            c.y - c.r < bottom
          if (c.obj.visible !== inView) c.obj.setVisible(inView)
          if (inView) visibleCount++
        }
      }

      // Сохраняем для React-HUD overlay
      scene.hudFps = avgFps
      scene.hudVisible = visibleCount
      scene.hudTotal = scene.lod.cullableData.length

      // Компенсация zoom для звёзд-ромбов: при отдалении они растут,
      // при приближении остаются нормального размера. Cap на минимум 1.
      // Loop пропускается если zoom стабилен — было setScale на 450+ объектов
      // каждый кадр даже при идеально неподвижной камере.
      const zoom = scene.cameras.main.zoom
      const zoomComp = Math.max(1, 1 / zoom)
      if (Math.abs(zoomComp - prevZoomComp) > 0.001) {
        prevZoomComp = zoomComp
        for (const s of scene.lod.zoomCompStars) {
          if (s.obj.visible) s.obj.setScale(s.baseScale * zoomComp)
        }
      }

      // Линии связи между главными расами: re-draw с новой толщиной если zoom
      // изменился заметно (>2%). Плавный рост видимости при отдалении.
      if (
        scene.mainLinesGfx &&
        Math.abs(zoom - scene.mainLinesLastZoom) / Math.max(zoom, 0.001) > 0.02
      ) {
        redrawMainLines(scene)
      }

      // LOD деталей BG-планет: при zoom < BG_DETAIL_MIN_ZOOM скрываем archetype-detail
      // Graphics. Видны только базовые шары → ~80% меньше draw calls на zoom-out.
      const detailVisible = zoom >= config.bgDetailMinZoom
      // Update только если состояние изменилось (раз в zoom-переход, не каждый кадр)
      if (
        scene.lod.bgArchetypeGfx.length > 0 &&
        scene.lod.bgArchetypeGfx[0].visible !== detailVisible
      ) {
        for (const gd of scene.lod.bgArchetypeGfx) gd.setVisible(detailVisible)
      }

      // Batch BG: видим при zoom < BG_PLANET_MIN_ZOOM (звёздное небо вместо containers).
      // Когда видим — индивидуальные containers скрыты через manual culling LOD-cut.
      const batchVisible = zoom < config.bgPlanetMinZoom
      if (
        scene.lod.bgBatchGfx &&
        scene.lod.bgBatchGfx.visible !== batchVisible
      ) {
        scene.lod.bgBatchGfx.setVisible(batchVisible)
      }

      // Interactive toggle для BG: при zoom < BG_INTERACTIVE_MIN_ZOOM отключаем
      // input.enabled у всех BG containers — снимает hit-test overhead.
      const wantInteractive = zoom >= config.bgInteractiveMinZoom
      if (scene.lod.bgInteractiveEnabled !== wantInteractive) {
        scene.lod.bgInteractiveEnabled = wantInteractive
        for (const c of scene.lod.bgInteractiveContainers) {
          if (c.input) c.input.enabled = wantInteractive
        }
      }

      // Спутники планет: плавный fade-in между MOON_FADE_START и MOON_FADE_END.
      // alpha 0 при zoom < 0.45, alpha 1 при zoom > 0.55 — плавный crossfade.
      const moonAlpha = Phaser.Math.Clamp(
        (zoom - config.moonFadeStart) /
          (config.moonFadeEnd - config.moonFadeStart),
        0,
        1,
      )
      const moonsActive = moonAlpha > 0.001
      const dtSec = dt / 1000
      const targetMoonAlpha = moonAlpha * 0.85 // 0.85 — базовая alpha спутника
      const moonAlphaChanged =
        Math.abs(targetMoonAlpha - prevMoonAlpha) > 0.001
      if (moonAlphaChanged) prevMoonAlpha = targetMoonAlpha
      for (const m of scene.lod.moons) {
        if (m.obj.visible !== moonsActive) m.obj.setVisible(moonsActive)
        if (!moonsActive) continue
        // setAlpha только при изменении (zoom стабилен → не дёргаем dirty flag).
        if (moonAlphaChanged) m.obj.setAlpha(targetMoonAlpha)
        m.angle += dtSec * m.speed
        m.obj.x = Math.cos(m.angle) * m.radius
        m.obj.y = Math.sin(m.angle) * m.radius * 0.6 // эллиптическая орбита
      }

      // Popover-follower: planet-moved обновляет position для текущего placement.
      // Placement не меняется при follow — фиксируется в момент выбора.
      // ВАЖНО: planet-moved emit перенесён в PRE_RENDER event ниже.
      // Здесь (внутри 'update') scroll/zoom могут быть ещё не финальными —
      // другие update-listeners (inertia, clamp) могут их изменить позже.
      // PRE_RENDER гарантирует финальные значения = синхронно с тем что рисует Phaser.
    })
  }
}
