// Pooled tap-effect controller — расширенная версия.
// Каждый архетип получает уникальную комбинацию из примитивов:
//   - rings: расширяющиеся кольца (multi-color, multi-ring, staggered, optional spin)
//   - particles: частицы по pattern'у (radial / spiral / random / arc)
//   - lines: короткие линии (lightning, beams)
//   - emoji floater: всплывающий emoji-символ
//
// Pool sizes increased для concurrent taps:
//   12 rings, 20 particles, 6 lines, 4 emoji texts
// Все preallocated, recycled circularly → zero allocations runtime.

import type Phaser from 'phaser'
import type { StarMapScene } from '../StarMapScene'

const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))

const RING_POOL = 12
const PARTICLE_POOL = 20
const LINE_POOL = 6
const EMOJI_POOL = 4

type ParticlePattern = 'radial' | 'spiral' | 'random' | 'arc'

interface RingSpec {
  color: number | 'inherit'
  delay: number
  duration: number
  scaleTo: number
  alphaStart: number
  thickness?: number
  spin?: number // angle to rotate during scale (radians)
}

interface ParticleSpec {
  count: number
  color: number | 'inherit'
  pattern: ParticlePattern
  distMul: number // multiplier of planet size
  size?: number // particle radius in DPR
  duration: number
  scatter?: number // angle scatter in radians for 'arc'/'random'
}

interface LineSpec {
  count: number
  color: number | 'inherit'
  lengthMul: number
  duration: number
  zigzag?: boolean
}

interface ArchetypePreset {
  rings: RingSpec[]
  particles?: ParticleSpec
  lines?: LineSpec
  emoji?: string
}

const PRESETS: Record<string, ArchetypePreset> = {
  // 🔥 Lava — горячая взрывная вспышка
  lava: {
    rings: [
      { color: 0xff6b1a, delay: 0, duration: 380, scaleTo: 2.4, alphaStart: 0.95, thickness: 2.5 },
      { color: 0xfacc15, delay: 80, duration: 320, scaleTo: 1.8, alphaStart: 0.7, thickness: 1.5 },
    ],
    particles: { count: 6, color: 0xff8c1a, pattern: 'radial', distMul: 2.2, duration: 500, size: 2.5 },
    emoji: '✨',
  },
  // 💧 Ocean — рябь по воде (3 кольца ripple)
  ocean: {
    rings: [
      { color: 0x3b82f6, delay: 0, duration: 500, scaleTo: 2.6, alphaStart: 0.75 },
      { color: 0x60a5fa, delay: 100, duration: 500, scaleTo: 2.2, alphaStart: 0.6 },
      { color: 0x93c5fd, delay: 200, duration: 500, scaleTo: 1.8, alphaStart: 0.45 },
    ],
  },
  // ❄️ Ice — кристаллический разлёт
  ice: {
    rings: [
      { color: 0xa5f3fc, delay: 0, duration: 350, scaleTo: 2.2, alphaStart: 0.9, thickness: 2 },
    ],
    particles: { count: 6, color: 0xe0f2fe, pattern: 'radial', distMul: 2.4, duration: 600, size: 1.8 },
    lines: { count: 4, color: 0xa5f3fc, lengthMul: 1.5, duration: 350 },
  },
  // 🌲 Forest — мягкий растекающийся glow
  forest: {
    rings: [
      { color: 0x10b981, delay: 0, duration: 500, scaleTo: 2.4, alphaStart: 0.7 },
      { color: 0x86efac, delay: 80, duration: 450, scaleTo: 2.0, alphaStart: 0.5 },
    ],
    particles: { count: 4, color: 0x86efac, pattern: 'random', distMul: 1.8, scatter: Math.PI * 0.6, duration: 600 },
  },
  // 🏜️ Desert — песчаная пыль
  desert: {
    rings: [
      { color: 0xd97706, delay: 0, duration: 400, scaleTo: 2.0, alphaStart: 0.7 },
    ],
    particles: { count: 6, color: 0xfbbf24, pattern: 'random', distMul: 1.6, scatter: Math.PI * 2, duration: 700, size: 1.5 },
  },
  // ☠️ Toxic — болезненное зелёное облако
  toxic: {
    rings: [
      { color: 0xa3e635, delay: 0, duration: 420, scaleTo: 2.4, alphaStart: 0.85 },
      { color: 0x4ade80, delay: 120, duration: 380, scaleTo: 2.0, alphaStart: 0.6 },
    ],
    particles: { count: 3, color: 0xa3e635, pattern: 'spiral', distMul: 2.0, duration: 550 },
  },
  // 🌋 Plasma — молниеносная вспышка
  plasma: {
    rings: [
      { color: 0xfde047, delay: 0, duration: 280, scaleTo: 2.6, alphaStart: 1.0, thickness: 3 },
    ],
    particles: { count: 6, color: 0xfde047, pattern: 'radial', distMul: 2.4, duration: 380, size: 2 },
    lines: { count: 5, color: 0xfacc15, lengthMul: 1.8, duration: 240, zigzag: true },
  },
  // ⚡ Binary — двойная вспышка
  binary: {
    rings: [
      { color: 0xfacc15, delay: 0, duration: 320, scaleTo: 2.4, alphaStart: 0.9, thickness: 2 },
      { color: 0xfde047, delay: 130, duration: 320, scaleTo: 2.4, alphaStart: 0.9, thickness: 2 },
    ],
    particles: { count: 4, color: 0xfde047, pattern: 'arc', scatter: Math.PI, distMul: 2.0, duration: 400 },
  },
  // ⛏️ Mineral — кристаллический холодный sparkle
  mineral: {
    rings: [
      { color: 0xc4b5fd, delay: 0, duration: 360, scaleTo: 1.8, alphaStart: 0.85, thickness: 2 },
    ],
    lines: { count: 6, color: 0xc4b5fd, lengthMul: 1.4, duration: 380 },
  },
  // 💀 Dead — тусклый медленный фейд
  dead: {
    rings: [
      { color: 0x9ca3af, delay: 0, duration: 700, scaleTo: 1.8, alphaStart: 0.5 },
    ],
  },
  // 🌀 Gas giant — закручивающийся свирл
  gas_giant: {
    rings: [
      { color: 0xfb923c, delay: 0, duration: 500, scaleTo: 2.4, alphaStart: 0.75, spin: Math.PI * 0.6 },
    ],
    particles: { count: 5, color: 0xfdba74, pattern: 'spiral', distMul: 2.0, duration: 650 },
  },
  // 🪐 Gas ringed — Saturn-like, 2 кольца + spiral particles
  gas_ringed: {
    rings: [
      { color: 0xa855f7, delay: 0, duration: 480, scaleTo: 2.4, alphaStart: 0.75, spin: Math.PI * 0.4 },
      { color: 0xd8b4fe, delay: 80, duration: 420, scaleTo: 2.0, alphaStart: 0.55, spin: Math.PI * 0.4 },
    ],
    particles: { count: 6, color: 0xc4b5fd, pattern: 'spiral', distMul: 2.4, duration: 600 },
  },
  // 🌑 Shadow — тёмный мистический свирл
  shadow: {
    rings: [
      { color: 0x6b21a8, delay: 0, duration: 550, scaleTo: 2.0, alphaStart: 0.7, spin: Math.PI * 0.5 },
    ],
    particles: { count: 3, color: 0xa855f7, pattern: 'spiral', distMul: 1.8, duration: 700 },
  },
  // Default для main races — наследуем цвет
  default: {
    rings: [
      { color: 'inherit', delay: 0, duration: 400, scaleTo: 2.2, alphaStart: 0.8, thickness: 2 },
      { color: 'inherit', delay: 90, duration: 380, scaleTo: 1.7, alphaStart: 0.5 },
    ],
    particles: { count: 4, color: 'inherit', pattern: 'radial', distMul: 2.0, duration: 500 },
  },
}

export class TapEffectController {
  private scene: StarMapScene
  private ringPool: Phaser.GameObjects.Graphics[] = []
  private ringIdx = 0
  private particlePool: Phaser.GameObjects.Graphics[] = []
  private particleIdx = 0
  private linePool: Phaser.GameObjects.Graphics[] = []
  private lineIdx = 0
  private emojiPool: Phaser.GameObjects.Text[] = []
  private emojiIdx = 0
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
    for (let i = 0; i < LINE_POOL; i++) {
      const g = this.scene.add.graphics()
      g.setDepth(32)
      g.setVisible(false)
      this.linePool.push(g)
    }
    for (let i = 0; i < EMOJI_POOL; i++) {
      const t = this.scene.add.text(0, 0, '', { fontSize: `${14 * DPR}px` })
      t.setOrigin(0.5)
      t.setDepth(33)
      t.setVisible(false)
      this.emojiPool.push(t)
    }
  }

  private resolveColor(c: number | 'inherit', fallback: number): number {
    return c === 'inherit' ? fallback : c
  }

  private playRing(
    x: number,
    y: number,
    baseR: number,
    spec: RingSpec,
    fallbackColor: number,
  ): void {
    const ring = this.ringPool[this.ringIdx]
    this.ringIdx = (this.ringIdx + 1) % RING_POOL
    this.scene.tweens.killTweensOf(ring)
    const color = this.resolveColor(spec.color, fallbackColor)
    ring.clear()
    ring.lineStyle((spec.thickness ?? 2) * DPR, color, 1)
    ring.strokeCircle(0, 0, baseR)
    ring.setPosition(x, y)
    ring.setScale(0.85)
    ring.setAlpha(spec.alphaStart)
    ring.setRotation(0)
    ring.setVisible(true)
    const target: Record<string, number> = {
      scale: spec.scaleTo,
      alpha: 0,
    }
    if (spec.spin !== undefined) target.rotation = spec.spin
    this.scene.tweens.add({
      targets: ring,
      ...target,
      duration: spec.duration,
      delay: spec.delay,
      ease: 'Quad.easeOut',
      onComplete: () => ring.setVisible(false),
    })
  }

  private playParticles(
    x: number,
    y: number,
    baseR: number,
    spec: ParticleSpec,
    fallbackColor: number,
  ): void {
    const color = this.resolveColor(spec.color, fallbackColor)
    const baseAngle = Math.random() * Math.PI * 2
    const size = spec.size ?? 2
    for (let i = 0; i < spec.count; i++) {
      const part = this.particlePool[this.particleIdx]
      this.particleIdx = (this.particleIdx + 1) % PARTICLE_POOL
      this.scene.tweens.killTweensOf(part)
      part.clear()
      part.fillStyle(color, 1)
      part.fillCircle(0, 0, size * DPR)
      let angle: number
      if (spec.pattern === 'radial') {
        angle = baseAngle + (i / spec.count) * Math.PI * 2
      } else if (spec.pattern === 'spiral') {
        angle = baseAngle + (i / spec.count) * Math.PI * 2
      } else if (spec.pattern === 'arc') {
        const arc = spec.scatter ?? Math.PI
        angle = baseAngle - arc / 2 + (i / Math.max(1, spec.count - 1)) * arc
      } else {
        // random
        const scatter = spec.scatter ?? Math.PI * 2
        angle = baseAngle + (Math.random() - 0.5) * scatter
      }
      const dist = baseR * spec.distMul * (spec.pattern === 'random' ? 0.7 + Math.random() * 0.6 : 1)
      part.setPosition(x, y)
      part.setAlpha(1)
      part.setVisible(true)
      const targetX = x + Math.cos(angle) * dist
      const targetY = y + Math.sin(angle) * dist
      // Spiral: добавить кривизну через промежуточный onUpdate (без него — то же что radial)
      if (spec.pattern === 'spiral') {
        // Параметризованная спираль: t от 0 до 1, угол = baseAngle + t * twist
        const twist = Math.PI * 0.8
        const tweenObj = { t: 0 }
        this.scene.tweens.add({
          targets: tweenObj,
          t: 1,
          duration: spec.duration,
          ease: 'Quad.easeOut',
          onUpdate: () => {
            const a = angle + tweenObj.t * twist
            const r = dist * tweenObj.t
            part.x = x + Math.cos(a) * r
            part.y = y + Math.sin(a) * r
            part.alpha = 1 - tweenObj.t
          },
          onComplete: () => part.setVisible(false),
        })
      } else {
        this.scene.tweens.add({
          targets: part,
          x: targetX,
          y: targetY,
          alpha: 0,
          duration: spec.duration,
          ease: 'Quad.easeOut',
          onComplete: () => part.setVisible(false),
        })
      }
    }
  }

  private playLines(
    x: number,
    y: number,
    baseR: number,
    spec: LineSpec,
    fallbackColor: number,
  ): void {
    const color = this.resolveColor(spec.color, fallbackColor)
    const baseAngle = Math.random() * Math.PI * 2
    for (let i = 0; i < spec.count; i++) {
      const line = this.linePool[this.lineIdx]
      this.lineIdx = (this.lineIdx + 1) % LINE_POOL
      this.scene.tweens.killTweensOf(line)
      line.clear()
      line.lineStyle(2 * DPR, color, 1)
      const angle = baseAngle + (i / spec.count) * Math.PI * 2
      const sx = Math.cos(angle) * baseR
      const sy = Math.sin(angle) * baseR
      const ex = Math.cos(angle) * baseR * spec.lengthMul
      const ey = Math.sin(angle) * baseR * spec.lengthMul
      if (spec.zigzag) {
        const midA = (sx + ex) / 2 + Math.cos(angle + Math.PI / 2) * 3 * DPR
        const midB = (sy + ey) / 2 + Math.sin(angle + Math.PI / 2) * 3 * DPR
        line.beginPath()
        line.moveTo(sx, sy)
        line.lineTo(midA, midB)
        line.lineTo(ex, ey)
        line.strokePath()
      } else {
        line.lineBetween(sx, sy, ex, ey)
      }
      line.setPosition(x, y)
      line.setAlpha(1)
      line.setVisible(true)
      this.scene.tweens.add({
        targets: line,
        alpha: 0,
        duration: spec.duration,
        ease: 'Quad.easeOut',
        onComplete: () => line.setVisible(false),
      })
    }
  }

  private playEmoji(x: number, y: number, baseR: number, emoji: string): void {
    const t = this.emojiPool[this.emojiIdx]
    this.emojiIdx = (this.emojiIdx + 1) % EMOJI_POOL
    this.scene.tweens.killTweensOf(t)
    t.setText(emoji)
    t.setPosition(x, y - baseR * 0.6)
    t.setAlpha(1)
    t.setScale(0.6)
    t.setVisible(true)
    this.scene.tweens.add({
      targets: t,
      y: y - baseR * 2,
      alpha: 0,
      scale: 1.2,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => t.setVisible(false),
    })
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
    const baseR = planetSize + 4 * DPR
    for (const ring of preset.rings) {
      this.playRing(x, y, baseR, ring, fallbackColor)
    }
    if (preset.particles) {
      this.playParticles(x, y, planetSize, preset.particles, fallbackColor)
    }
    if (preset.lines) {
      this.playLines(x, y, baseR, preset.lines, fallbackColor)
    }
    if (preset.emoji) {
      this.playEmoji(x, y, planetSize, preset.emoji)
    }
  }
}
