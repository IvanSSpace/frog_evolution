// Phase 20-02: extracted из StarMapScene.ts (case 42).
// Snow drift — снежинки парят и опускаются (для ice, aerial).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compSnowDrift(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 10 + Math.floor(rng() * 6)
  for (let i = 0; i < N; i++) {
    const startX = (rng() - 0.5) * sys.size * 3
    const startY = -sys.size * 1.5 - rng() * sys.size * 0.5
    const endY = sys.size * 1.5 + rng() * sys.size * 0.5
    const driftX = (rng() - 0.5) * sys.size * 0.8
    const color = pickColor(rng, sys)
    const flake = scene.add.circle(
      startX,
      startY,
      (1 + rng()) * DPR,
      color,
      0.9,
    )
    sprite.add(flake)
    scene.tweens.add({
      targets: flake,
      y: endY,
      x: startX + driftX,
      alpha: 0,
      duration: 700 + rng() * 400,
      ease: 'Sine.easeIn',
      delay: rng() * 150,
      onComplete: () => flake.destroy(),
    })
  }
}
