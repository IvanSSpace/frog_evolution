// Phase 9: extracted из StarMapScene.ts L3316-3334 (case 76).
// Chime ring — sound-style: bell-tinkle (нежный звон колокольчика)
// Серия мелких звонящих колец расходится плавно
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compChimeRing(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const count = 4 + Math.floor(rng() * 3)
  const stepDelay = 90 + rng() * 50
  for (let i = 0; i < count; i++) {
    scene.time.delayedCall(i * stepDelay, () => {
      if (!sprite.active) return
      const ring = scene.add.graphics()
      const color = pickColor(rng, sys)
      ring.lineStyle((0.8 + rng() * 0.6) * DPR, color, 0.6 - i * 0.08)
      ring.strokeCircle(0, 0, sys.size * (1.0 + i * 0.18))
      sprite.add(ring)
      scene.tweens.add({
        targets: ring, scale: 1.5, alpha: 0,
        duration: 600, ease: 'Sine.easeOut',
        onComplete: () => ring.destroy(),
      })
    })
  }
}
