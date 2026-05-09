// Phase 20-02: extracted из StarMapScene.ts (case 77).
// Earthquake shake — sound-style: rumble-shake (тряска земли).
// 6-10 точек в случайных местах резко дрожат.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compEarthquakeShake(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 6 + Math.floor(rng() * 5)
  for (let i = 0; i < N; i++) {
    const ang = rng() * Math.PI * 2
    const r = sys.size * (0.7 + rng() * 0.4)
    const x = Math.cos(ang) * r,
      y = Math.sin(ang) * r
    const dot = scene.add.circle(
      x,
      y,
      (1.5 + rng() * 1.5) * DPR,
      pickColor(rng, sys),
      1,
    )
    sprite.add(dot)
    scene.tweens.add({
      targets: dot,
      x: x + (rng() - 0.5) * sys.size * 0.5,
      y: y + (rng() - 0.5) * sys.size * 0.5,
      yoyo: true,
      repeat: 3,
      duration: 60 + rng() * 40,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        scene.tweens.add({
          targets: dot,
          alpha: 0,
          duration: 200,
          onComplete: () => dot.destroy(),
        })
      },
    })
  }
}
