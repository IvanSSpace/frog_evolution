// Phase 23 Plan 23-05 (Beat 4): Phaser confetti burst effect.
//
// Single-shot particle explosion для location unlock celebration.
// 30-50 частиц с location-specific color palette, gravity decay, ~1.2s lifespan.
//
// API: ConfettiBurst.fire({ scene, x, y, palette, count?, lifespanMs?, depth? }).
//
// Texture: генерируется один раз на scene (4x4 white pixel chunk) через
// scene.add.graphics().generateTexture — tint накладывается emitter'ом из palette.
// Этот approach избегает зависимости от ассета-файла confetti.png и работает
// на любой instance MainScene/StarMapScene.
//
// IMPORTANT (memory feedback_frog_container_alpha): НЕ трогаем frog.container.alpha
// — confetti это отдельные Phaser GameObjects поверх сцены (depth=6000).
// Self-destructs through scene.time.delayedCall — никаких leaks при scene shutdown,
// так как timer привязан к scene's timeline.

import Phaser from 'phaser'

/** Cache-key для generated white-pixel texture. Один на whole game. */
const TEXTURE_KEY = 'onb-confetti-pixel'

export interface ConfettiBurstOptions {
  scene: Phaser.Scene
  x: number
  y: number
  /** Hex colours для tint (Phaser random'ит per-particle). E.g. [0xbef264, 0x65a30d]. */
  palette: number[]
  /** Particles per burst. Default 40 (target 30-50 per CONTEXT). */
  count?: number
  /** Particle lifespan (ms). Default 1200. */
  lifespanMs?: number
  /**
   * Render depth. Default 6000 — выше TutorialPulseRing (5000), но без
   * предположения о существовании конкретных rings; просто «всегда сверху».
   */
  depth?: number
}

/**
 * Ensure confetti texture exists в данной scene. No-op if already created.
 * 4x4 white square — tint накладывается per-particle через emitter config.
 */
function ensureConfettiTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEY)) return
  const gfx = scene.add.graphics({ x: 0, y: 0 })
  gfx.fillStyle(0xffffff, 1)
  gfx.fillRect(0, 0, 4, 4)
  gfx.generateTexture(TEXTURE_KEY, 4, 4)
  gfx.destroy()
}

/**
 * Single-shot confetti burst. Use as ConfettiBurst.fire({...}).
 * Auto-destroys after lifespanMs + 300ms buffer.
 */
export class ConfettiBurst {
  static fire(opts: ConfettiBurstOptions): void {
    const scene = opts.scene
    ensureConfettiTexture(scene)

    const count = opts.count ?? 40
    const lifespan = opts.lifespanMs ?? 1200
    const depth = opts.depth ?? 6000

    // Phaser 3.60+ particle emitter API: scene.add.particles(x, y, key, config).
    // emitting:false + explode(count) даёт single-shot burst без continuous spawn.
    const emitter = scene.add.particles(opts.x, opts.y, TEXTURE_KEY, {
      speed: { min: 200, max: 450 },
      // Spread в верхней полусфере (200..340 deg). Phaser использует angles
      // где 0=вправо, 90=вниз. 270 = вверх, 200..340 = ~140° веер вверх.
      angle: { min: 200, max: 340 },
      gravityY: 700,
      lifespan,
      scale: { start: 1.5, end: 0.3 },
      alpha: { start: 1, end: 0 },
      tint: opts.palette,
      rotate: { min: 0, max: 360 },
      emitting: false,
    })
    emitter.setDepth(depth)
    emitter.explode(count, opts.x, opts.y)

    // Self-destruct после lifespan + buffer.
    // Если scene shutdown'нется раньше — Phaser сам очистит timer + emitter.
    scene.time.delayedCall(lifespan + 300, () => {
      emitter.destroy()
    })
  }
}
