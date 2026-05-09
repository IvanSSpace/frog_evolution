// Phase 9: extracted из StarMapScene.ts L1600-1618 (case 16).
// Ripple — N расширяющихся колец последовательно (для ocean, aquatic)
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compRipple(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const count = 2 + Math.floor(rng() * 3) // 2-4
  const stepDelay = 130 + rng() * 100
  for (let i = 0; i < count; i++) {
    scene.time.delayedCall(i * stepDelay, () => {
      if (!sprite.active) return
      const ring = scene.add.graphics()
      const color = pickColor(rng, sys)
      ring.lineStyle((1 + rng()) * DPR, color, 0.7 + rng() * 0.3)
      ring.strokeCircle(0, 0, sys.size * 1.0)
      sprite.add(ring)
      scene.tweens.add({
        targets: ring,
        scaleX: 2.0 + rng() * 0.7,
        scaleY: 2.0 + rng() * 0.7,
        alpha: 0,
        duration: 600 + rng() * 200,
        ease: 'Sine.easeOut',
        onComplete: () => ring.destroy(),
      })
    })
  }
}
