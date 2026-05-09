// Phase 9: extracted из StarMapScene.ts L3755-3788 (case 87).
// Plasma arc — sound-style: arc-buzz (электрическая дуга)
// Изогнутая дуга-молния от точки к точке
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compPlasmaArc(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const arcs = 2 + Math.floor(rng() * 2)
  for (let i = 0; i < arcs; i++) {
    const ang1 = rng() * Math.PI * 2
    const ang2 = ang1 + Math.PI + (rng() - 0.5) * 0.8
    const r = sys.size * (1.3 + rng() * 0.3)
    const arc = scene.add.graphics()
    const color = pickColor(rng, sys)
    arc.lineStyle(1.5 * DPR, color, 0.9)
    // Bezier-кривая через 2 узла
    const x1 = Math.cos(ang1) * r,
      y1 = Math.sin(ang1) * r
    const x2 = Math.cos(ang2) * r,
      y2 = Math.sin(ang2) * r
    const cx = (x1 + x2) / 2 + (rng() - 0.5) * sys.size * 0.6
    const cy = (y1 + y2) / 2 + (rng() - 0.5) * sys.size * 0.6
    const segs = 12
    let px = x1,
      py = y1
    for (let s = 1; s <= segs; s++) {
      const t = s / segs
      const u = 1 - t
      const x = u * u * x1 + 2 * u * t * cx + t * t * x2
      const y = u * u * y1 + 2 * u * t * cy + t * t * y2
      // jitter — молниевый эффект
      const jx = x + (rng() - 0.5) * 1.5 * DPR
      const jy = y + (rng() - 0.5) * 1.5 * DPR
      arc.lineBetween(px, py, jx, jy)
      px = jx
      py = jy
    }
    sprite.add(arc)
    scene.tweens.add({
      targets: arc,
      alpha: 0,
      duration: 350 + rng() * 150,
      ease: 'Cubic.easeOut',
      onComplete: () => arc.destroy(),
    })
  }
}
