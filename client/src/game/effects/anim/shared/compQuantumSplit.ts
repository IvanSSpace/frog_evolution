// Phase 20-02: extracted из StarMapScene.ts (case 36).
// Quantum split — на момент 2 фантомных копии расходятся, потом сжимаются.
import type Phaser from 'phaser'
import type { AnimSys } from './types'

export function compQuantumSplit(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const ang = rng() * Math.PI * 2
  const dist = sys.size * (1.0 + rng() * 0.4)
  for (const sign of [1, -1]) {
    const ghost = scene.add.circle(0, 0, sys.size * 0.95, sys.color, 0.6)
    sprite.add(ghost)
    const tx = Math.cos(ang) * dist * sign
    const ty = Math.sin(ang) * dist * sign
    scene.tweens.add({
      targets: ghost,
      x: tx,
      y: ty,
      alpha: 0,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 400 + rng() * 200,
      ease: 'Cubic.easeOut',
      onComplete: () => ghost.destroy(),
    })
  }
}
