// Ship visual: spaceShip.png sprite + orbital motion when docked + bezier transit arcs.
// Transit uses a cubic bezier: departs tangent to departure orbit, arrives tangent to
// destination orbit — giving a natural "break orbit / enter orbit" visual.

import Phaser from 'phaser'

export interface ShipSpriteOpts {
  scene: Phaser.Scene
  parent: Phaser.GameObjects.Container | null
  initialPosition: { x: number; y: number }
  depth?: number
  onPositionUpdate?: (x: number, y: number) => void
}

const SHIP_TEX = 'spaceShip'
const TRAIL_TEX = '__ship_trail_dot'
const SHIP_SIZE = 43 // CSS px — adjusted to DPR inside
const ORBIT_R_PX = 44 // orbit radius in CSS px
const ORBIT_MS = 9000 // 9 s per orbit
const POS_THROTTLE = 96 // ms between onPositionUpdate calls
// Min elapsed ms to consider a transit "fresh" (use bezier arc) vs "mid-flight restore" (snap + linear)
const FRESH_THRESHOLD_MS = 1200

// ─── cubic bezier helpers ────────────────────────────────────────────────────

function cbz(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): number {
  const m = 1 - t
  return (
    m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3
  )
}

/** Derivative (un-normalised tangent) of cubic bezier at t. */
function cbzD(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): number {
  const m = 1 - t
  return 3 * m * m * (p1 - p0) + 6 * m * t * (p2 - p1) + 3 * t * t * (p3 - p2)
}

export class ShipSprite {
  public state: 'docked' | 'transit' = 'docked'
  public worldX: number
  public worldY: number

  private scene: Phaser.Scene
  private dpr: number
  private container: Phaser.GameObjects.Container
  private body: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics
  private thruster1: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private thruster2: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private currentTween: Phaser.Tweens.Tween | null = null
  private orbitTween: Phaser.Tweens.Tween | null = null
  private orbitCounter = { angle: 0 }
  private opts: ShipSpriteOpts
  private destroyed = false
  private lastPosMs = 0
  private displayAngle = 0
  private targetAngle = 0

  constructor(opts: ShipSpriteOpts) {
    this.opts = opts
    this.scene = opts.scene
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))
    this.worldX = opts.initialPosition.x
    this.worldY = opts.initialPosition.y

    this.container = this.scene.add.container(this.worldX, this.worldY)
    this.container.setDepth(opts.depth ?? 1500)
    if (opts.parent) opts.parent.add(this.container)

    this.ensureTrailTex()

    if (this.scene.textures.exists(SHIP_TEX)) {
      this.body = this.makeSpriteBody()
    } else {
      this.body = this.makeGraphicsBody()
    }
    this.container.add(this.body)
  }

  // ─── body helpers ────────────────────────────────────────────────────────────

  private makeSpriteBody(): Phaser.GameObjects.Image {
    const sz = SHIP_SIZE * this.dpr
    const img = this.scene.add.image(0, 0, SHIP_TEX)
    img.setDisplaySize(sz, sz)
    img.setAngle(90)
    img.setBlendMode(Phaser.BlendModes.ADD)
    return img
  }

  private makeGraphicsBody(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics()
    const s = this.dpr
    g.fillStyle(0xe5e7eb, 1)
    g.beginPath()
    g.moveTo(10 * s, 0)
    g.lineTo(-8 * s, -6 * s)
    g.lineTo(-8 * s, 6 * s)
    g.closePath()
    g.fillPath()
    g.fillStyle(0x60a5fa, 1)
    g.fillCircle(2 * s, 0, 2 * s)
    return g
  }

  // ─── particle helpers ─────────────────────────────────────────────────────────

  private ensureTrailTex() {
    if (this.scene.textures.exists(TRAIL_TEX)) return
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(3, 3, 3)
    g.generateTexture(TRAIL_TEX, 6, 6)
    g.destroy()
  }

  // localOffsetY: offset along the ship's local Y axis (perpendicular to heading)
  private makeEmitter(
    localOffsetY: number,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const e = this.scene.add.particles(0, 0, TRAIL_TEX, {
      lifespan: 500,
      speedX: 0,
      speedY: 0,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: [0xfde047, 0xff8c00, 0xff4400],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 20,
    })
    // depth lower than ship container so particles render behind the ship
    e.setDepth((this.opts.depth ?? 1500) - 2)
    e.stop()
    ;(e as unknown as Record<string, number>).__localOffsetY = localOffsetY
    return e
  }

  /**
   * Called every frame: rotate thruster offsets by current ship heading and
   * update emitter world-position + backwards exhaust velocity.
   */
  private updateThrusterPositions() {
    const cos = Math.cos(this.displayAngle)
    const sin = Math.sin(this.displayAngle)
    // nozzle position: slightly behind ship center in local space
    const nozzleLocal = -(SHIP_SIZE * this.dpr * 0.5)
    // exhaust speed: particles shoot straight back from the nozzle
    const SPEED = 120 * this.dpr

    for (const e of [this.thruster1, this.thruster2]) {
      if (!e) continue
      const localY =
        (e as unknown as Record<string, number>).__localOffsetY * this.dpr
      // rotate local (nozzleLocal, localY) → world space
      e.x = this.container.x + cos * nozzleLocal - sin * localY
      e.y = this.container.y + sin * nozzleLocal + cos * localY
      // exhaust velocity: opposite to heading, with slight perpendicular spread
      ;(e as unknown as { speedX: number; speedY: number }).speedX =
        -cos * SPEED
      ;(e as unknown as { speedX: number; speedY: number }).speedY =
        -sin * SPEED
    }
  }

  private ensureThrusters() {
    if (this.thruster1 || this.destroyed) return
    this.thruster1 = this.makeEmitter(-4)
    this.thruster2 = this.makeEmitter(4)
  }

  private startThrusters(frequency = 20) {
    this.ensureThrusters()
    if (this.thruster1) this.thruster1.frequency = frequency
    if (this.thruster2) this.thruster2.frequency = frequency
    this.thruster1?.start()
    this.thruster2?.start()
  }
  private stopThrusters() {
    this.thruster1?.stop()
    this.thruster2?.stop()
  }

  // ─── rotation lerp ────────────────────────────────────────────────────────────

  private angleDiff(a: number, b: number): number {
    let d = b - a
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    return d
  }

  private updateRotation(dt: number) {
    const diff = this.angleDiff(this.displayAngle, this.targetAngle)
    this.displayAngle += diff * Math.min(1, dt * 0.006)
    this.container.setRotation(this.displayAngle)
  }

  // ─── bezier flight builder ────────────────────────────────────────────────────

  /**
   * Compute cubic bezier control points so the ship departs tangent to the
   * departure orbit and arrives tangent to the destination orbit (CCW).
   *
   * Returns { p0, p1, p2, p3, entryAngle }
   *   entryAngle = angle (from dest planet center) where P3 sits,
   *                used to seed orbitCounter so orbit starts at that exact point.
   */
  private buildBezierArc(
    destCenter: { x: number; y: number },
    destOrbitR: number,
  ): {
    p0x: number
    p0y: number
    p1x: number
    p1y: number
    p2x: number
    p2y: number
    p3x: number
    p3y: number
    entryAngle: number
  } {
    const p0x = this.worldX
    const p0y = this.worldY

    // Overall direction from departure position to destination planet center
    const dx = destCenter.x - p0x
    const dy = destCenter.y - p0y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const ndx = dx / dist // normalized
    const ndy = dy / dist

    // P3 = point on destination orbit closest to the ship's approach
    // (on the near side of the destination planet)
    const a3 = Math.atan2(-ndy, -ndx) // angle from dest center toward P0
    const p3x = destCenter.x + Math.cos(a3) * destOrbitR
    const p3y = destCenter.y + Math.sin(a3) * destOrbitR

    // Departure tangent = ship's current heading
    const depTx = Math.cos(this.displayAngle)
    const depTy = Math.sin(this.displayAngle)

    // Arrival tangent = CCW orbital tangent at a3: (-sin(a3), cos(a3))
    // Choose sign so it doesn't create a hairpin (dot with approach direction > 0)
    let arrTx = -Math.sin(a3)
    let arrTy = Math.cos(a3)
    // If arrival tangent points "backwards" relative to approach, flip it
    if (arrTx * ndx + arrTy * ndy < 0) {
      arrTx = -arrTx
      arrTy = -arrTy
    }

    // Control-point pull = 35% of total path chord
    const chord = Math.sqrt((p3x - p0x) ** 2 + (p3y - p0y) ** 2) || 1
    const pull = chord * 0.35

    const p1x = p0x + depTx * pull
    const p1y = p0y + depTy * pull
    const p2x = p3x - arrTx * pull
    const p2y = p3y - arrTy * pull

    return { p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, entryAngle: a3 }
  }

  /** Start a bezier-arc transit. */
  private _beginBezierFlight(
    destCenter: { x: number; y: number },
    destPlanetSize: number,
    durationMs: number,
    onArrive: () => void,
  ): void {
    if (this.destroyed) return

    const destOrbitR =
      (Math.max(20, (destPlanetSize ?? 30) * 0.7) + ORBIT_R_PX) * this.dpr

    const { p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, entryAngle } =
      this.buildBezierArc(destCenter, destOrbitR)

    this.state = 'transit'
    this.startThrusters()

    this.scene.events.off('update', this.onUpdate, this)
    this.scene.events.on('update', this.onUpdate, this)

    const tObj = { t: 0 }

    this.currentTween = this.scene.tweens.add({
      targets: tObj,
      t: 1,
      duration: Math.max(200, durationMs),
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (this.destroyed) return
        const t = tObj.t

        const x = cbz(t, p0x, p1x, p2x, p3x)
        const y = cbz(t, p0y, p1y, p2y, p3y)
        this.container.setPosition(x, y)
        this.worldX = x
        this.worldY = y

        // Ship faces the bezier tangent direction
        const tx = cbzD(t, p0x, p1x, p2x, p3x)
        const ty = cbzD(t, p0y, p1y, p2y, p3y)
        if (Math.abs(tx) > 0.5 || Math.abs(ty) > 0.5) {
          this.targetAngle = Math.atan2(ty, tx)
        }

        if (t > 0.88) this.stopThrusters()

        const now = performance.now()
        if (now - this.lastPosMs > POS_THROTTLE) {
          this.lastPosMs = now
          this.opts.onPositionUpdate?.(x, y)
        }
      },
      onComplete: () => {
        if (this.destroyed) return
        this.currentTween = null
        this.stopThrusters()
        this.state = 'docked'
        // Seed orbit at the exact arrival angle so setDocked starts there seamlessly
        this.orbitCounter.angle = entryAngle
        onArrive()
      },
    })
  }

  /** Linear flight (mid-flight restore — no arc, just snap heading and fly). */
  private _beginLinearFlight(
    from: { x: number; y: number },
    to: { x: number; y: number },
    durationMs: number,
    onArrive: () => void,
  ): void {
    if (this.destroyed) return

    this.container.setPosition(from.x, from.y)
    this.worldX = from.x
    this.worldY = from.y

    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    this.targetAngle = angle
    this.displayAngle = angle
    this.container.setRotation(angle)

    this.state = 'transit'
    this.startThrusters()

    this.scene.events.off('update', this.onUpdate, this)
    this.scene.events.on('update', this.onUpdate, this)

    this.currentTween = this.scene.tweens.add({
      targets: this.container,
      x: to.x,
      y: to.y,
      duration: Math.max(100, durationMs),
      ease: 'Linear',
      onUpdate: (tween) => {
        if (this.destroyed) return
        this.worldX = this.container.x
        this.worldY = this.container.y
        if (tween.progress > 0.92) this.stopThrusters()
        const now = performance.now()
        if (now - this.lastPosMs > POS_THROTTLE) {
          this.lastPosMs = now
          this.opts.onPositionUpdate?.(this.worldX, this.worldY)
        }
      },
      onComplete: () => {
        if (this.destroyed) return
        this.currentTween = null
        this.stopThrusters()
        this.state = 'docked'
        onArrive()
      },
    })
  }

  // ─── public API ──────────────────────────────────────────────────────────────

  setDocked(planetPos: { x: number; y: number }, planetSize?: number): void {
    if (this.destroyed) return
    this.killTweens()
    this.state = 'docked'

    const r = (Math.max(20, (planetSize ?? 30) * 0.7) + ORBIT_R_PX) * this.dpr

    // Keep angle from previous orbit/arrival so there's no jump
    const startAngle = this.orbitCounter.angle || 0
    this.orbitCounter.angle = startAngle

    this.orbitTween = this.scene.tweens.add({
      targets: this.orbitCounter,
      angle: startAngle + Math.PI * 2,
      duration: ORBIT_MS,
      repeat: -1,
      ease: 'Linear',
      onUpdate: () => {
        if (this.destroyed) return
        const a = this.orbitCounter.angle
        const x = planetPos.x + Math.cos(a) * r
        const y = planetPos.y + Math.sin(a) * r
        this.container.setPosition(x, y)
        this.worldX = x
        this.worldY = y
        this.targetAngle = a + Math.PI / 2
        const now = performance.now()
        if (now - this.lastPosMs > POS_THROTTLE) {
          this.lastPosMs = now
          this.opts.onPositionUpdate?.(x, y)
        }
      },
    })

    this.scene.events.on('update', this.onUpdate, this)
    // Gentle station-keeping thrust — lower frequency than full-burn transit
    this.startThrusters(80)
  }

  /**
   * Apply transit state from store.
   *
   * - fresh transit (elapsed < FRESH_THRESHOLD_MS): bezier arc departure + arrival
   * - mid-flight restore (elapsed >= threshold): snap to mid-path + linear flight
   *
   * destPlanetSize should be passed in the same units as setDocked's planetSize
   * (i.e. p.size * DPR from the scene).
   */
  syncFromState(
    transit: {
      from: { x: number; y: number }
      to: { x: number; y: number }
      startedAt: number
      arrivesAt: number
    },
    destPlanetSize: number,
    onArrive: () => void,
  ): void {
    if (this.destroyed) return
    this.killTweens()

    const total = transit.arrivesAt - transit.startedAt
    const elapsed = Date.now() - transit.startedAt

    if (elapsed >= total) {
      onArrive()
      return
    }

    if (elapsed < FRESH_THRESHOLD_MS) {
      // Fresh transit — start bezier from current orbital position
      this._beginBezierFlight(
        transit.to,
        destPlanetSize,
        total - elapsed,
        onArrive,
      )
    } else {
      // Mid-flight restore — snap to interpolated position and fly linearly
      const t = Math.max(0, Math.min(1, elapsed / total))
      const cx = transit.from.x + (transit.to.x - transit.from.x) * t
      const cy = transit.from.y + (transit.to.y - transit.from.y) * t
      this._beginLinearFlight(
        { x: cx, y: cy },
        transit.to,
        total - elapsed,
        onArrive,
      )
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.scene.events.off('update', this.onUpdate, this)
    this.killTweens()
    this.thruster1?.destroy()
    this.thruster2?.destroy()
    this.container.destroy()
  }

  // ─── private ─────────────────────────────────────────────────────────────────

  private onUpdate(_t: number, dt: number) {
    if (this.destroyed) return
    this.updateRotation(dt)
    this.updateThrusterPositions()
  }

  private killTweens() {
    if (this.currentTween) {
      this.currentTween.stop()
      this.currentTween = null
    }
    if (this.orbitTween) {
      this.orbitTween.stop()
      this.orbitTween = null
    }
    this.scene.events.off('update', this.onUpdate, this)
  }
}
