// Phase 9: extracted из StarMapScene.ts L1826-1844 (case 25).
// Echo wave — 5-8 быстрых волн друг за другом
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compEchoWave(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const count = 5 + Math.floor(rng() * 4)
  const stepDelay = 60 + rng() * 50
  const baseColor = pickColor(rng, sys)
  for (let i = 0; i < count; i++) {
    scene.time.delayedCall(i * stepDelay, () => {
      if (!sprite.active) return
      const ring = scene.add.graphics()
      ring.lineStyle((1 + rng()) * DPR, baseColor, 0.7 - i * 0.07)
      ring.strokeCircle(0, 0, sys.size * 1.05)
      sprite.add(ring)
      scene.tweens.add({
        targets: ring,
        scaleX: 2.5 + rng() * 0.5,
        scaleY: 2.5 + rng() * 0.5,
        alpha: 0,
        duration: 700,
        ease: 'Sine.easeOut',
        onComplete: () => ring.destroy(),
      })
    })
  }
}
