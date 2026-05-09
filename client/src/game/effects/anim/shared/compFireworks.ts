// Phase 20-02: extracted из StarMapScene.ts (case 67).
// Fireworks — взрыв с точками которые дополнительно взрываются.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compFireworks(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const primary = 6 + Math.floor(rng() * 4)
  const dur = 400 + rng() * 200
  for (let i = 0; i < primary; i++) {
    const ang = (i / primary) * Math.PI * 2 + rng() * 0.3
    const dist = sys.size * (1.5 + rng() * 0.4)
    const color = pickColor(rng, sys)
    const dot = scene.add.circle(0, 0, (2 + rng()) * DPR, color, 1)
    sprite.add(dot)
    const tx = Math.cos(ang) * dist,
      ty = Math.sin(ang) * dist
    scene.tweens.add({
      targets: dot,
      x: tx,
      y: ty,
      duration: dur,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        // Sub-explosion: 3 мини-точки
        for (let k = 0; k < 3; k++) {
          const subAng = ang + ((rng() - 0.5) * Math.PI) / 2
          const sub = scene.add.circle(
            tx,
            ty,
            (1 + rng()) * DPR,
            pickColor(rng, sys),
            0.9,
          )
          sprite.add(sub)
          scene.tweens.add({
            targets: sub,
            x: tx + Math.cos(subAng) * sys.size * 0.6,
            y: ty + Math.sin(subAng) * sys.size * 0.6,
            alpha: 0,
            duration: 280 + rng() * 100,
            ease: 'Cubic.easeOut',
            onComplete: () => sub.destroy(),
          })
        }
        dot.destroy()
      },
    })
  }
}
