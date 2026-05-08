// Phase 16: Ship visual (REQ SHIP-02, SHIP-04, SHIP-05, SHIP-06).
// Phaser-native (Container + Graphics + ParticleEmitter). НЕ DOM.
// Singleton в StarMapScene; subscribed на cosmicSlice.ship через scene-side subscribe.

import Phaser from 'phaser'

export interface ShipSpriteOpts {
  scene: Phaser.Scene
  parent: Phaser.GameObjects.Container | null  // null = scene root
  initialPosition: { x: number; y: number }
  depth?: number  // default 1500
  onPositionUpdate?: (x: number, y: number) => void  // throttled (~6 frames)
}

const TRAIL_TINT = 0xfde047  // желтый (matches plasma idle)
const SHIP_SCALE = 1
const POS_UPDATE_THROTTLE_MS = 16 * 6  // ~96ms (~6 frames @ 60fps)
const TEX_KEY = '__ship_trail_dot'

export class ShipSprite {
  public state: 'docked' | 'transit' = 'docked'
  public worldX: number
  public worldY: number

  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private body: Phaser.GameObjects.Graphics
  private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private currentTween: Phaser.Tweens.Tween | null = null
  private opts: ShipSpriteOpts
  private destroyed = false
  private lastPosUpdateMs = 0

  constructor(opts: ShipSpriteOpts) {
    this.opts = opts
    this.scene = opts.scene
    this.worldX = opts.initialPosition.x
    this.worldY = opts.initialPosition.y

    this.container = this.scene.add.container(this.worldX, this.worldY)
    this.container.setDepth(opts.depth ?? 1500)
    if (opts.parent) {
      opts.parent.add(this.container)
    }

    // Body — простая ракетка-triangle.
    this.body = this.scene.add.graphics()
    this.drawBody(this.body)
    this.container.add(this.body)
  }

  /** Triangular ship silhouette pointing right (rotation=0). */
  private drawBody(g: Phaser.GameObjects.Graphics) {
    g.clear()
    // Корпус: triangle с базой 12 px, высотой 18 px, точка справа.
    g.fillStyle(0xe5e7eb, 1)  // светло-серый
    g.beginPath()
    g.moveTo(10 * SHIP_SCALE, 0)
    g.lineTo(-8 * SHIP_SCALE, -6 * SHIP_SCALE)
    g.lineTo(-8 * SHIP_SCALE, 6 * SHIP_SCALE)
    g.closePath()
    g.fillPath()
    // Окошко-cockpit
    g.fillStyle(0x60a5fa, 1)
    g.fillCircle(2 * SHIP_SCALE, 0, 2 * SHIP_SCALE)
    // Outline
    g.lineStyle(1, 0x111827, 1)
    g.strokePath()
  }

  /** Setup particle emitter for trail. Created lazily on first transit. */
  private ensureTrail() {
    if (this.particles || this.destroyed) return
    // Phaser 4: scene.add.particles(x, y, texture, config) returns ParticleEmitter.
    if (!this.scene.textures.exists(TEX_KEY)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false)
      g.fillStyle(0xffffff, 1)
      g.fillCircle(2, 2, 2)
      g.generateTexture(TEX_KEY, 4, 4)
      g.destroy()
    }
    this.particles = this.scene.add.particles(0, 0, TEX_KEY, {
      lifespan: 600,
      speed: 0,
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: TRAIL_TINT,
      blendMode: Phaser.BlendModes.ADD,
      frequency: 40,  // emit every 40ms
      follow: this.container,
      followOffset: { x: -10, y: 0 },
    })
    this.particles.setDepth((this.opts.depth ?? 1500) - 1)
    this.particles.stop()  // запустим в startTransit
  }

  /** Hide trail (transit complete or set to docked). */
  private stopTrail() {
    if (!this.particles) return
    this.particles.stop()
  }

  setDocked(planetPos: { x: number; y: number }, planetSize?: number): void {
    if (this.destroyed) return
    this.killCurrentTween()
    this.stopTrail()
    this.state = 'docked'
    // Orbit offset: справа от планеты, на размере planet+30 px (минимум 50).
    const orbitR = Math.max(50, (planetSize ?? 60) * 0.6)
    const x = planetPos.x + orbitR
    const y = planetPos.y
    this.container.setPosition(x, y)
    this.container.setRotation(0)
    this.worldX = x
    this.worldY = y
  }

  startTransit(
    from: { x: number; y: number },
    to: { x: number; y: number },
    durationMs: number,
    onArrive: () => void,
  ): void {
    if (this.destroyed) return
    this.killCurrentTween()
    this.ensureTrail()

    this.container.setPosition(from.x, from.y)
    this.worldX = from.x
    this.worldY = from.y

    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    this.container.setRotation(angle)

    this.state = 'transit'
    this.particles?.start()

    this.currentTween = this.scene.tweens.add({
      targets: this.container,
      x: to.x,
      y: to.y,
      duration: durationMs,
      ease: 'Linear',
      onUpdate: (tween) => {
        if (this.destroyed) return
        this.worldX = this.container.x
        this.worldY = this.container.y
        // Stop trail at t > 0.95 (REQ SHIP-05)
        if (tween.progress > 0.95) this.stopTrail()
        // Throttled position broadcast (REQ SHIP-06: redirect needs current pos)
        const now = performance.now()
        if (now - this.lastPosUpdateMs > POS_UPDATE_THROTTLE_MS) {
          this.lastPosUpdateMs = now
          this.opts.onPositionUpdate?.(this.worldX, this.worldY)
        }
      },
      onComplete: () => {
        if (this.destroyed) return
        this.currentTween = null
        this.stopTrail()
        this.state = 'docked'
        onArrive()
      },
    })
  }

  /** Mid-flight redirect: kill current, start fresh from current pos. */
  redirect(
    to: { x: number; y: number },
    durationMs: number,
    onArrive: () => void,
  ): void {
    if (this.destroyed) return
    const from = { x: this.worldX, y: this.worldY }
    this.startTransit(from, to, durationMs, onArrive)
  }

  /** Snap-position ship without tween (used for store-driven sync after store change). */
  syncFromState(
    transit: {
      from: { x: number; y: number }
      to: { x: number; y: number }
      startedAt: number
      arrivesAt: number
    },
    onArrive: () => void,
  ): void {
    if (this.destroyed) return
    const total = transit.arrivesAt - transit.startedAt
    const elapsed = Date.now() - transit.startedAt
    if (elapsed >= total) {
      onArrive()
      return
    }
    const remaining = total - elapsed
    // Compute current interpolated start point (linear)
    const t = Math.max(0, Math.min(1, elapsed / total))
    const curX = transit.from.x + (transit.to.x - transit.from.x) * t
    const curY = transit.from.y + (transit.to.y - transit.from.y) * t
    this.startTransit({ x: curX, y: curY }, transit.to, remaining, onArrive)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.killCurrentTween()
    if (this.particles) {
      this.particles.destroy()
      this.particles = null
    }
    this.container.destroy()
  }

  private killCurrentTween() {
    if (this.currentTween) {
      this.currentTween.stop()
      this.currentTween.remove()
      this.currentTween = null
    }
  }
}
