// Phase 20-02: extracted из StarMapScene.ts (case 57).
// Flicker stars — 15-25 мини-точек загораются и тухнут (mystic, mist, ancient).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compFlickerStars(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 15 + Math.floor(rng() * 11)
  for (let i = 0; i < N; i++) {
    const ang = rng() * Math.PI * 2
    const r = sys.size * (1.0 + rng() * 0.8)
    const color = pickColor(rng, sys)
    const dot = scene.add.circle(
      Math.cos(ang) * r,
      Math.sin(ang) * r,
      (0.8 + rng()) * DPR,
      color,
      0,
    )
    sprite.add(dot)
    scene.tweens.add({
      targets: dot,
      alpha: 0.95,
      duration: 100 + rng() * 100,
      delay: rng() * 600,
      ease: 'Sine.easeOut',
      onComplete: () => {
        scene.tweens.add({
          targets: dot,
          alpha: 0,
          duration: 200 + rng() * 200,
          ease: 'Sine.easeIn',
          onComplete: () => dot.destroy(),
        })
      },
    })
  }
}
