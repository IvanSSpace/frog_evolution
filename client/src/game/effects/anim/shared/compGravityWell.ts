// Phase 20-02: extracted из StarMapScene.ts (case 26).
// Gravity well — тёмная воронка-деформация вокруг.
import type Phaser from 'phaser'
import { DPR } from './sharedHelpers'
import type { AnimSys } from './types'

export function compGravityWell(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const layers = 4
  for (let i = 0; i < layers; i++) {
    const ring = scene.add.graphics()
    const r = sys.size * (1.5 + i * 0.3)
    ring.lineStyle((2 - i * 0.4) * DPR, 0x000000, 0.6 - i * 0.1)
    ring.strokeCircle(0, 0, r)
    sprite.add(ring)
    scene.tweens.add({
      targets: ring,
      scaleX: 1.4,
      scaleY: 0.6, // squash в эллипс (deformation)
      rotation: (rng() - 0.5) * Math.PI,
      alpha: 0,
      duration: 600 + i * 80,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    })
  }
  // Внутренний glow тёмный
  const dark = scene.add.circle(0, 0, sys.size * 1.3, 0x000000, 0.4)
  sprite.add(dark)
  scene.tweens.add({
    targets: dark,
    alpha: 0,
    scaleX: 1.5,
    scaleY: 1.5,
    duration: 500,
    ease: 'Cubic.easeOut',
    onComplete: () => dark.destroy(),
  })
}
