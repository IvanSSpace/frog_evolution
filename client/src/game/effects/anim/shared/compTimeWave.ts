// Phase 20-02: extracted из StarMapScene.ts (case 61).
// Time wave — расходящееся искажение (3-4 концентрических ring с offset) (mystic, ancient).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compTimeWave(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const rings = 3 + Math.floor(rng() * 2)
  const offsetMag = sys.size * 0.15
  const baseAng = rng() * Math.PI * 2
  const baseColor = pickColor(rng, sys)
  for (let i = 0; i < rings; i++) {
    const ox = Math.cos(baseAng + i * 0.6) * offsetMag * (i / rings)
    const oy = Math.sin(baseAng + i * 0.6) * offsetMag * (i / rings)
    const ring = scene.add.graphics()
    ring.lineStyle((1 + rng()) * DPR, baseColor, 0.8 - i * 0.15)
    ring.strokeCircle(0, 0, sys.size * 1.05)
    ring.x = ox
    ring.y = oy
    sprite.add(ring)
    scene.tweens.add({
      targets: ring,
      scaleX: 2.0 + i * 0.3,
      scaleY: 2.0 + i * 0.3,
      alpha: 0,
      duration: 700 + i * 100,
      ease: 'Cubic.easeOut',
      delay: i * 80,
      onComplete: () => ring.destroy(),
    })
  }
}
