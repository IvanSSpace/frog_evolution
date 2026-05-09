// Phase 20-02: extracted из StarMapScene.ts (case 32).
// Magnetic field — кривые из «полюсов» планеты.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compMagneticField(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const lines = scene.add.graphics()
  const color = pickColor(rng, sys)
  const accent = pickColor(rng, sys)
  const polarAng = rng() * Math.PI * 2
  const arcs = 4 + Math.floor(rng() * 3)
  for (let i = 0; i < arcs; i++) {
    const offset = (i / (arcs - 1) - 0.5) * Math.PI * 0.6
    const span = sys.size * (1.3 + i * 0.18)
    // Bezier-like curve через 3 точки симметрично
    const cosP = Math.cos(polarAng),
      sinP = Math.sin(polarAng)
    const x0 = cosP * sys.size,
      y0 = sinP * sys.size
    const x1 = cosP * span + sinP * span * (i % 2 === 0 ? 1 : -1) * 0.5
    const y1 = sinP * span - cosP * span * (i % 2 === 0 ? 1 : -1) * 0.5
    const x2 = -x0,
      y2 = -y0
    lines.lineStyle(
      (0.8 + rng()) * DPR,
      i % 2 === 0 ? color : accent,
      0.6 + rng() * 0.3,
    )
    // approximation as 12 segments
    const segs = 12
    let px = x0,
      py = y0
    for (let s = 1; s <= segs; s++) {
      const t = s / segs
      // quadratic bezier
      const u = 1 - t
      const xx = u * u * x0 + 2 * u * t * x1 + t * t * x2
      const yy = u * u * y0 + 2 * u * t * y1 + t * t * y2
      lines.lineBetween(px, py, xx, yy)
      px = xx
      py = yy
    }
    void offset
  }
  sprite.add(lines)
  scene.tweens.add({
    targets: lines,
    alpha: 0,
    scaleX: 1.3,
    scaleY: 1.3,
    duration: 600 + rng() * 250,
    ease: 'Cubic.easeOut',
    onComplete: () => lines.destroy(),
  })
}
