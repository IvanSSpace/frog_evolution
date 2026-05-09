// Phase 20-02: extracted из StarMapScene.ts (case 40).
// Spiral arms — 2-4 спиральных рукава из точек как маленькая галактика.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compSpiralArms(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const arms = 2 + Math.floor(rng() * 3) // 2-4
  const dotsPerArm = 8 + Math.floor(rng() * 4)
  const turns = 0.7 + rng() * 0.7
  const maxR = sys.size * (1.8 + rng() * 0.5)
  const direction = rng() < 0.5 ? 1 : -1
  const dur = 700 + rng() * 250
  for (let a = 0; a < arms; a++) {
    const armOffset = (a / arms) * Math.PI * 2
    for (let i = 0; i < dotsPerArm; i++) {
      const t = i / dotsPerArm
      const r = maxR * t
      const ang = armOffset + direction * t * Math.PI * 2 * turns
      const color = pickColor(rng, sys)
      const dot = scene.add.circle(0, 0, (1 + rng() * 1.5) * DPR, color, 0.9)
      sprite.add(dot)
      scene.tweens.add({
        targets: dot,
        x: Math.cos(ang) * r,
        y: Math.sin(ang) * r,
        alpha: 0,
        duration: dur + i * 30,
        ease: 'Cubic.easeOut',
        delay: i * 25,
        onComplete: () => dot.destroy(),
      })
    }
  }
}
