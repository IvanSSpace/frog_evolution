// Phase 20-02: extracted из StarMapScene.ts (case 24).
// Singularity collapse — sprite сжимается в точку, потом резкий burst.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compSingularity(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  // 8-12 точек сначала засасываются к центру, потом разлетаются
  const N = 10 + Math.floor(rng() * 4)
  const startR = sys.size * (1.6 + rng() * 0.4)
  const collapseDur = 250 + rng() * 100
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + rng() * 0.3
    const color = pickColor(rng, sys)
    const dot = scene.add.circle(
      Math.cos(ang) * startR,
      Math.sin(ang) * startR,
      (1.5 + rng()) * DPR,
      color,
      1,
    )
    sprite.add(dot)
    scene.tweens.add({
      targets: dot,
      x: 0,
      y: 0,
      duration: collapseDur,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        // burst наружу
        const newAng = rng() * Math.PI * 2
        const newDist = sys.size * (2 + rng())
        scene.tweens.add({
          targets: dot,
          x: Math.cos(newAng) * newDist,
          y: Math.sin(newAng) * newDist,
          alpha: 0,
          scaleX: 1.5,
          scaleY: 1.5,
          duration: 350 + rng() * 200,
          ease: 'Cubic.easeOut',
          onComplete: () => dot.destroy(),
        })
      },
    })
  }
}
