// Phase 20-02: extracted из StarMapScene.ts (case 34).
// Wormhole — концентрические уменьшающиеся кольца (туннель).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compWormhole(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const rings = 5
  const baseColor = pickColor(rng, sys)
  const accent = pickColor(rng, sys)
  for (let i = 0; i < rings; i++) {
    scene.time.delayedCall(i * 70, () => {
      if (!sprite.active) return
      const ring = scene.add.graphics()
      const c = i % 2 === 0 ? baseColor : accent
      ring.lineStyle((1.5 + rng() * 1.5) * DPR, c, 0.85 - i * 0.1)
      ring.strokeCircle(0, 0, sys.size * (2.2 - i * 0.2))
      sprite.add(ring)
      scene.tweens.add({
        targets: ring,
        scaleX: 0.1,
        scaleY: 0.1,
        alpha: 0,
        duration: 600,
        ease: 'Cubic.easeIn',
        onComplete: () => ring.destroy(),
      })
    })
  }
}
