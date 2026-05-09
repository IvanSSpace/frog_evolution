// Phase 20-02: extracted из StarMapScene.ts (case 64).
// Charge burst — точки сходятся к центру, потом explode наружу.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compChargeBurst(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 8 + Math.floor(rng() * 6)
  const startR = sys.size * (1.8 + rng() * 0.5)
  const collapseDur = 250 + rng() * 100
  const burstDur = 350 + rng() * 200
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2
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
      scale: 0.4,
      duration: collapseDur,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        const newAng = ang + Math.PI + (rng() - 0.5) * 0.5
        scene.tweens.add({
          targets: dot,
          x: Math.cos(newAng) * sys.size * (2.5 + rng() * 0.5),
          y: Math.sin(newAng) * sys.size * (2.5 + rng() * 0.5),
          alpha: 0,
          scale: 1.5,
          duration: burstDur,
          ease: 'Cubic.easeOut',
          onComplete: () => dot.destroy(),
        })
      },
    })
  }
}
