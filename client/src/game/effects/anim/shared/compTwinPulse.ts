// Phase 20-02: extracted из StarMapScene.ts (case 23).
// Twin pulse — 2 одновременных импульса в противоположных направлениях (для binary).
import type Phaser from 'phaser'
import { pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compTwinPulse(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const baseAng = rng() * Math.PI * 2
  const dist = sys.size * (1.0 + rng() * 0.4)
  for (const sign of [1, -1]) {
    const x = Math.cos(baseAng) * dist * sign
    const y = Math.sin(baseAng) * dist * sign
    const color = pickColor(rng, sys)
    const pulse = scene.add.circle(x, y, sys.size * 0.5, color, 0.85)
    sprite.add(pulse)
    scene.tweens.add({
      targets: pulse,
      scaleX: 1.8 + rng() * 0.4,
      scaleY: 1.8 + rng() * 0.4,
      alpha: 0,
      duration: 500 + rng() * 250,
      ease: pickEase(rng),
      onComplete: () => pulse.destroy(),
    })
  }
}
