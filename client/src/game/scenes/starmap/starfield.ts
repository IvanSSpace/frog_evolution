// Phase 20-04 (Wave 4): starfield + connection lines + sparkles + bg batch
// extracted from StarMapScene.ts. Free functions с явной зависимостью от scene
// (типизирована как StarMapScene). Functions read/write package-public scene fields:
//   cullableData, mainPlanetHits, allSystems, mainLinesGfx, mainLinesEdges,
//   mainLinesLastZoom, bgBatchGfx, zoomCompStars, tapHandledThisFrame.
//
// Public API:
//   - setupStarfield(scene): далёкие/средние/крупные звёзды, кластеризация вокруг планет
//   - drawLines(scene, mainRaces): K-nearest neighbor связи между главными расами
//   - redrawMainLines(scene): re-draw линий с zoom-compensated thickness
//   - buildBgBatch(scene): 1-draw-call звёздное небо для zoom < BG_PLANET_MIN_ZOOM
//   - renderSystem(scene, sys): dispatcher → scene.planetRenderer.renderMain/renderBg
//   - createSparkleAt(scene, x, y, size, rng): 8-конечная sparkle-звёздочка над планетой
//
// Design rationale: free functions без state — все массивы/Graphics живут на сцене,
// функции добавляют в них через scene.add.* и push в scene-fields. Никакой
// собственной state у модуля нет.

import Phaser from 'phaser'
import type { StarMapScene } from '../StarMapScene'
import type { Race, BgSystem } from './types'
import { mulberry32 } from './helpers'

const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))

// ============== STARFIELD ==============

export function setupStarfield(
  scene: StarMapScene,
  opts: { worldSize: number; seed: number },
): void {
  const { worldSize, seed } = opts
  const bgRng = mulberry32(seed + 1)
  // Far stars (2000 микро-точек) и mid stars (200 мерцающих) убраны по запросу.
  // -200 infinite tweens, -2200 GameObjects из cullableData.

  // Близкие крупные с лучами и tween-анимациями. Снижено с 40.
  for (let i = 0; i < 16; i++) {
    const x = (bgRng() - 0.5) * worldSize * 1.6
    const y = (bgRng() - 0.5) * worldSize * 1.6
    const color = [0xfff7ed, 0xa5f3fc, 0xfed7aa][Math.floor(bgRng() * 3)]
    const g = scene.add.graphics()
    g.fillStyle(color, 0.9)
    g.fillCircle(0, 0, 2.5 * DPR)
    g.lineStyle(1 * DPR, color, 0.5)
    g.lineBetween(-6 * DPR, 0, 6 * DPR, 0)
    g.lineBetween(0, -6 * DPR, 0, 6 * DPR)
    g.x = x
    g.y = y
    g.setDepth(-85)
    scene.tweens.add({
      targets: g,
      angle: 360,
      duration: 30000 + bgRng() * 30000,
      repeat: -1,
      ease: 'Linear',
    })
    scene.tweens.add({
      targets: g,
      alpha: { from: 0.6, to: 1 },
      duration: 2200 + bgRng() * 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    scene.lod.cullableData.push({ obj: g, x, y, r: 12 * DPR })
    // Тап по звезде — вспышка + ⭐
    const starBaseR = 14 * DPR
    const starHit = new Phaser.Geom.Circle(0, 0, starBaseR)
    g.setInteractive(starHit, Phaser.Geom.Circle.Contains)
    let dt = 0,
      dx = 0,
      dy = 0
    g.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dt = Date.now()
      dx = p.x
      dy = p.y
    })
    g.on('pointerup', (p: Phaser.Input.Pointer) => {
      const elapsed = Date.now() - dt
      const moved = Math.abs(p.x - dx) + Math.abs(p.y - dy)
      if (elapsed < 300 && moved < 8 * DPR) {
        scene.tapHandledThisFrame = true
        scene.popEmojiAt(x, y, '⭐', g)
      }
    })
    scene.mainPlanetHits.push({
      container: g as unknown as Phaser.GameObjects.Container,
      baseR: starBaseR,
      circle: starHit,
    })
  }
}

// ============== СВЯЗИ И СИСТЕМЫ ==============

export function drawLines(scene: StarMapScene, mainRaces: Race[]): void {
  // Соединяем каждую расу с её K ближайшими соседями ИЗ MAIN_RACES.
  // Толщина линий компенсирует zoom через redrawMainLines() в update-loop —
  // при отдалении линии остаются видимыми (плавно растут).
  const K = 3
  const drawn = new Set<string>()
  scene.mainLinesEdges = []
  for (const race of mainRaces) {
    const others = mainRaces
      .filter((r) => r.id !== race.id)
      .map((r) => ({ r, d: Math.hypot(r.x - race.x, r.y - race.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, K)
    for (const { r } of others) {
      const key = race.id < r.id ? `${race.id}|${r.id}` : `${r.id}|${race.id}`
      if (drawn.has(key)) continue
      drawn.add(key)
      scene.mainLinesEdges.push({ ax: race.x, ay: race.y, bx: r.x, by: r.y })
    }
  }
  scene.mainLinesGfx = scene.add.graphics()
  scene.mainLinesGfx.setDepth(-50)
  redrawMainLines(scene) // initial draw
}

// Пере-рисовывает линии связи с толщиной, компенсирующей текущий zoom.
// Вызывается из update-loop когда zoom изменился (с throttling).
// Цель: линии плавно растут при отдалении камеры, остаются видимыми.
export function redrawMainLines(scene: StarMapScene): void {
  if (!scene.mainLinesGfx) return
  const zoom = scene.cameras.main.zoom
  // Smooth zoom compensation. При zoom=1 → толщина 2*DPR. При zoom=0.05 → ~24*DPR.
  // sqrt сглаживает рост — иначе линии бы стали гигантскими при сильном отдалении.
  const zoomComp = 1 / Math.max(0.05, Math.sqrt(zoom))
  const thickness = 2 * DPR * Math.max(1, zoomComp)
  const alpha = 0.55
  scene.mainLinesGfx.clear()
  scene.mainLinesGfx.lineStyle(thickness, 0x67e8f9, alpha)
  for (const e of scene.mainLinesEdges) {
    scene.mainLinesGfx.lineBetween(e.ax, e.ay, e.bx, e.by)
  }
  scene.mainLinesLastZoom = zoom
}

// Batch-рендер всех 434 BG как точек в одном Graphics.
// Используется на zoom < BG_PLANET_MIN_ZOOM (звёздное небо). Не кликабелен.
// 1 draw call вместо 434 — огромная экономия на сильном отдалении.
export function buildBgBatch(scene: StarMapScene): void {
  const gfx = scene.add.graphics()
  gfx.setDepth(-80)
  gfx.setVisible(false) // visible toggle через update
  for (const sys of scene.allSystems) {
    if (!('archetype' in sys)) continue // только BG, не main
    // Двухслойная точка чтобы соответствовать визуалу детальной планеты на LOD-границе:
    // — outer faint halo (имитирует ауру детального рендера, sys.size * 1.4)
    // — inner solid disk (соответствует базовому шару, sys.size * 1.0)
    // Раньше было sys.size * 0.6 — точка была вдвое меньше планеты, скачок при
    // пересечении LOD-порога бросался в глаза.
    gfx.fillStyle(sys.color, 0.18)
    gfx.fillCircle(sys.x, sys.y, sys.size * 1.4)
    gfx.fillStyle(sys.color, 0.85)
    gfx.fillCircle(sys.x, sys.y, sys.size * 1.0)
  }
  scene.lod.bgBatchGfx = gfx
}

// Dispatcher: main planet → planetRenderer.renderMain, bg planet → planetRenderer.renderBg.
// Тонкая обёртка чтобы scene.create() мог вызывать единым callsite.
// Phase 20-XX (step 4): renderMainPlanet/renderBgPoint вынесены в PlanetRenderer.
export function renderSystem(
  scene: StarMapScene,
  sys: Race | BgSystem,
  mainRaces: Race[],
): void {
  const isMain = mainRaces.some((m) => m.id === sys.id)
  if (isMain) scene.planetRenderer.renderMain(sys as Race)
  else scene.planetRenderer.renderBg(sys as BgSystem)
}

// Создаёт sparkle-звёздочку (8-конечную) над планетой в world-coords.
// Звёздочки НЕ являются child контейнера — это отдельные Graphics с фиксированной
// позицией в мире, чтобы LOD-скрытие планеты не убивало sparkle (см. BG_PLANET_MIN_ZOOM).
// Между flash'ами alpha=0, активные tweens только на момент мерцания.
export function createSparkleAt(
  scene: StarMapScene,
  planetX: number,
  planetY: number,
  planetSize: number,
  rng: () => number,
): void {
  // 70% белый, 30% жёлтый
  const isYellow = rng() < 0.3
  const c = isYellow
    ? [0xfde047, 0xfbbf24, 0xfacc15][Math.floor(rng() * 3)]
    : [0xffffff, 0xfff7ed, 0xfafafa][Math.floor(rng() * 3)]
  const baseR = (4 + rng() * 4) * DPR

  // 8-конечная sparkle-звезда: 4 длинных луча по осям + 4 коротких по диагонали.
  const longR = baseR
  const shortR = baseR * 0.4
  const innerR = baseR * 0.16
  const points: Phaser.Math.Vector2[] = []
  for (let p = 0; p < 16; p++) {
    const a = (p * Math.PI) / 8 - Math.PI / 2
    let r: number
    if (p % 2 === 1) r = innerR
    else r = p % 4 === 0 ? longR : shortR
    points.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r))
  }

  const star = scene.add.graphics()
  star.setDepth(-87)
  star.fillStyle(c, 1)
  star.fillPoints(points, true)
  // Position: случайная точка ВНУТРИ диска планеты (равномерное распределение по площади
  // через sqrt(rng) для радиуса). Sparkle остаётся в world-coords — при LOD-скрытии
  // планеты-контейнера она остаётся видна как звезда.
  const ang = rng() * Math.PI * 2
  const rad = Math.sqrt(rng()) * planetSize * 0.7
  star.x = planetX + Math.cos(ang) * rad
  star.y = planetY + Math.sin(ang) * rad
  star.setAlpha(0)
  scene.lod.zoomCompStars.push({ obj: star, baseScale: 1 })

  // Flash в редком ритме. 3 типа поведения (rotate/fade/spin) для разнообразия.
  const flashType: 'rotate' | 'fade' | 'spin' = (() => {
    const r = rng()
    if (r < 0.45) return 'rotate'
    if (r < 0.85) return 'fade'
    return 'spin'
  })()

  const triggerFlash = () => {
    if (!star.active) return
    if (flashType === 'rotate') {
      star.setAngle(Math.random() * 360)
      star.setAlpha(0)
      const dur = 600 + Math.random() * 500
      scene.tweens.add({
        targets: star,
        alpha: 1,
        duration: dur * 0.4,
        ease: 'Sine.easeOut',
        onComplete: () => {
          scene.tweens.add({
            targets: star,
            alpha: 0,
            duration: dur * 0.6,
            ease: 'Sine.easeIn',
          })
        },
      })
      scene.tweens.add({
        targets: star,
        angle: star.angle + 180,
        duration: dur,
        ease: 'Linear',
      })
    } else if (flashType === 'fade') {
      star.setAlpha(0)
      const dur = 900 + Math.random() * 800
      scene.tweens.add({
        targets: star,
        alpha: 1,
        duration: dur * 0.4,
        ease: 'Sine.easeOut',
        onComplete: () => {
          scene.tweens.add({
            targets: star,
            alpha: 0,
            duration: dur * 0.6,
            ease: 'Sine.easeIn',
          })
        },
      })
    } else {
      star.setAngle(Math.random() * 360)
      star.setAlpha(0)
      const dur = 2000 + Math.random() * 1000
      scene.tweens.add({
        targets: star,
        alpha: 1,
        duration: dur * 0.3,
        ease: 'Sine.easeOut',
        onComplete: () => {
          scene.tweens.add({
            targets: star,
            alpha: 0,
            duration: dur * 0.7,
            ease: 'Sine.easeIn',
          })
        },
      })
      scene.tweens.add({
        targets: star,
        angle: star.angle + 360,
        duration: dur,
        ease: 'Linear',
      })
    }
  }

  const scheduleNext = () => {
    const wait = 25000 + Math.random() * 35000
    scene.time.delayedCall(wait, () => {
      triggerFlash()
      scheduleNext()
    })
  }
  scene.time.delayedCall(rng() * 30000, () => {
    triggerFlash()
    scheduleNext()
  })
}
