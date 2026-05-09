// Phase 20-02: extracted из StarMapScene.ts (case 69).
// Liquid pool — жидкая капля растекается из центра.
import type Phaser from 'phaser'
import { pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compLiquidPool(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const pool = scene.add.graphics()
  const color = pickColor(rng, sys)
  const blobs = 4 + Math.floor(rng() * 3)
  for (let i = 0; i < blobs; i++) {
    const ang = (i / blobs) * Math.PI * 2 + rng() * 0.4
    const r = sys.size * (0.4 + rng() * 0.4)
    pool.fillStyle(color, 0.5 + rng() * 0.3)
    pool.fillEllipse(
      Math.cos(ang) * r * 0.4,
      Math.sin(ang) * r * 0.4,
      r * 1.5,
      r * 0.8,
    )
  }
  pool.scale = 0.2
  sprite.add(pool)
  scene.tweens.add({
    targets: pool,
    scale: 1.5 + rng() * 0.4,
    alpha: 0,
    rotation: (rng() - 0.5) * Math.PI,
    duration: 600 + rng() * 200,
    ease: 'Cubic.easeOut',
    onComplete: () => pool.destroy(),
  })
}
