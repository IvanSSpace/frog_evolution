// Phase 20-02: extracted из StarMapScene.ts (case 28).
// Aurora ribbon — изогнутая лента из точек по дуге.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compAuroraRibbon(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 14 + Math.floor(rng() * 8)
  const baseAng = rng() * Math.PI * 2
  const arcSpan = Math.PI * (0.6 + rng() * 0.5)
  const baseR = sys.size * (1.5 + rng() * 0.4)
  const dur = 700 + rng() * 300
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const ang = baseAng - arcSpan / 2 + t * arcSpan
    const r = baseR + Math.sin(t * Math.PI) * sys.size * 0.4 // изгиб
    const color = pickColor(rng, sys)
    const dot = scene.add.circle(
      Math.cos(ang) * r,
      Math.sin(ang) * r,
      (1 + rng()) * DPR,
      color,
      0.85,
    )
    sprite.add(dot)
    scene.tweens.add({
      targets: dot,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: dur + i * 30,
      ease: 'Sine.easeOut',
      delay: i * 25,
      onComplete: () => dot.destroy(),
    })
  }
}
