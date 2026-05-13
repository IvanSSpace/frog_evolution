// Pooled tap-effect controller. Один разделяемый instance на сцену.
// При тапе планеты — берёт rings/particles из preallocated пула, проигрывает
// короткий эффект (300-600ms) и возвращает в пул через setVisible(false).
// Zero allocations на runtime → нет GC pressure → не лагает.
//
// Per-archetype presets: каждый тип планеты получает свой "акцент"
// (цвет, кол-во rings, particles), сверху общий squish (см. renderMain/renderBg).

import type Phaser from 'phaser'
import type { StarMapScene } from '../StarMapScene'

const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))

const RING_POOL = 6
const PARTICLE_POOL = 12

interface ArchetypePreset {
  ringCount: 1 | 2
  ringDelayMs: number
  ringDurationMs: number
  ringScaleTo: number
  ringAlphaStart: number
  ringColor: number | 'inherit' // 'inherit' = sys.color
  particleCount: 0 | 2 | 3 | 4
}

// Палитра + поведение на архетип. 'inherit' = используем sys.color.
const PRESETS: Record<string, ArchetypePreset> = {
  // BG archetypes
  lava: { ringCount: 1, ringDelayMs: 0, ringDurationMs: 380, ringScaleTo: 2.4, ringAlphaStart: 0.95, ringColor: 0xff6b1a, particleCount: 4 },
  ocean: { ringCount: 2, ringDelayMs: 90, ringDurationMs: 500, ringScaleTo: 2.6, ringAlphaStart: 0.75, ringColor: 0x3b82f6, particleCount: 0 },
  ice: { ringCount: 1, ringDelayMs: 0, ringDurationMs: 350, ringScaleTo: 2.2, ringAlphaStart: 0.9, ringColor: 0xa5f3fc, particleCount: 3 },
  forest: { ringCount: 1, ringDelayMs: 0, ringDurationMs: 450, ringScaleTo: 2.2, ringAlphaStart: 0.75, ringColor: 0x10b981, particleCount: 0 },
  desert: { ringCount: 1, ringDelayMs: 0, ringDurationMs: 400, ringScaleTo: 2.0, ringAlphaStart: 0.7, ringColor: 0xd97706, particleCount: 2 },
  toxic: { ringCount: 1, ringDelayMs: 0, ringDurationMs: 400, ringScaleTo: 2.4, ringAlphaStart: 0.85, ringColor: 0xa3e635, particleCount: 2 },
  plasma: { ringCount: 1, ringDelayMs: 0, ringDurationMs: 300, ringScaleTo: 2.6, ringAlphaStart: 1.0, ringColor: 0xfde047, particleCount: 4 },
  binary: { ringCount: 2, ringDelayMs: 100, ringDurationMs: 350, ringScaleTo: 2.4, ringAlphaStart: 0.9, ringColor: 0xfacc15, particleCount: 0 },
  mineral: { ringCount: 1, ringDelayMs: 0, ringDurationMs: 350, ringScaleTo: 1.8, ringAlphaStart: 0.85, ringColor: 0xc4b5fd, particleCount: 0 },
  dead: { ringCount: 1, ringDelayMs: 0, ringDurationMs: 600, ringScaleTo: 1.8, ringAlphaStart: 0.5, ringColor: 0x9ca3af, particleCount: 0 },
  gas_giant: { ringCount: 1, ringDelayMs: 0, ringDurationMs: 450, ringScaleTo: 2.4, ringAlphaStart: 0.75, ringColor: 0xfb923c, particleCount: 0 },
  gas_ringed: { ringCount: 2, ringDelayMs: 60, ringDurationMs: 450, ringScaleTo: 2.4, ringAlphaStart: 0.7, ringColor: 0xa855f7, particleCount: 0 },
  shadow: { ringCount: 1, ringDelayMs: 0, ringDurationMs: 500, ringScaleTo: 2.0, ringAlphaStart: 0.65, ringColor: 0x6b21a8, particleCount: 0 },
  // Main race types — наследуем цвет от расы
  default: { ringCount: 1, ringDelayMs: 0, ringDurationMs: 400, ringScaleTo: 2.2, ringAlphaStart: 0.8, ringColor: 'inherit', particleCount: 2 },
}

export class TapEffectController {
  private scene: StarMapScene
  private ringPool: Phaser.GameObjects.Graphics[] = []
  private ringIdx = 0
  private particlePool: Phaser.GameObjects.Graphics[] = []
  private particleIdx = 0
  private initialized = false

  constructor(scene: StarMapScene) {
    this.scene = scene
  }

  init() {
    if (this.initialized) return
    this.initialized = true
    for (let i = 0; i < RING_POOL; i++) {
      const g = this.scene.add.graphics()
      g.setDepth(30)
      g.setVisible(false)
      this.ringPool.push(g)
    }
    for (let i = 0; i < PARTICLE_POOL; i++) {
      const g = this.scene.add.graphics()
      g.setDepth(31)
      g.setVisible(false)
      this.particlePool.push(g)
    }
  }

  /** archetypeOrType: для BG — sys.archetype, для main — sys.type. */
  play(
    x: number,
    y: number,
    planetSize: number,
    archetypeOrType: string,
    fallbackColor: number,
  ): void {
    if (!this.initialized) this.init()
    const preset = PRESETS[archetypeOrType] ?? PRESETS.default
    const color =
      preset.ringColor === 'inherit' ? fallbackColor : preset.ringColor

    // ── Rings ──
    for (let r = 0; r < preset.ringCount; r++) {
      const ring = this.ringPool[this.ringIdx]
      this.ringIdx = (this.ringIdx + 1) % RING_POOL
      this.scene.tweens.killTweensOf(ring)
      ring.clear()
      ring.lineStyle(2 * DPR, color, 1)
      ring.strokeCircle(0, 0, planetSize + 4 * DPR)
      ring.setPosition(x, y)
      ring.setScale(0.85)
      ring.setAlpha(preset.ringAlphaStart)
      ring.setVisible(true)
      this.scene.tweens.add({
        targets: ring,
        scale: preset.ringScaleTo,
        alpha: 0,
        duration: preset.ringDurationMs,
        delay: preset.ringDelayMs * r,
        ease: 'Quad.easeOut',
        onComplete: () => ring.setVisible(false),
      })
    }

    // ── Particles (outward dots) ──
    if (preset.particleCount > 0) {
      const baseAngle = Math.random() * Math.PI * 2
      for (let p = 0; p < preset.particleCount; p++) {
        const part = this.particlePool[this.particleIdx]
        this.particleIdx = (this.particleIdx + 1) % PARTICLE_POOL
        this.scene.tweens.killTweensOf(part)
        part.clear()
        part.fillStyle(color, 1)
        part.fillCircle(0, 0, 2 * DPR)
        const angle = baseAngle + (p / preset.particleCount) * Math.PI * 2
        const dist = planetSize * 1.8
        part.setPosition(x, y)
        part.setAlpha(1)
        part.setVisible(true)
        this.scene.tweens.add({
          targets: part,
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist,
          alpha: 0,
          duration: 420,
          ease: 'Quad.easeOut',
          onComplete: () => part.setVisible(false),
        })
      }
    }
  }
}
