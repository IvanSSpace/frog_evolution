// Phase 9: extracted из StarMapScene.ts L1655-1674 (case 21).
// Toxic cloud — зелёные пятна расширяются клубом (для toxic, mist)
import type Phaser from 'phaser'
import { pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compToxicCloud(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const cloud = scene.add.graphics()
  const blobs = 5 + Math.floor(rng() * 4)
  for (let i = 0; i < blobs; i++) {
    const ang = rng() * Math.PI * 2
    const dist = sys.size * (0.4 + rng() * 0.7)
    const r = sys.size * (0.25 + rng() * 0.3)
    const color = pickColor(rng, sys)
    cloud.fillStyle(color, 0.3 + rng() * 0.25)
    cloud.fillEllipse(Math.cos(ang) * dist, Math.sin(ang) * dist, r * 1.5, r)
  }
  sprite.add(cloud)
  scene.tweens.add({
    targets: cloud,
    scaleX: 1.7 + rng() * 0.5,
    scaleY: 1.7 + rng() * 0.5,
    angle: (rng() - 0.5) * 90,
    alpha: 0,
    duration: 700 + rng() * 350,
    ease: pickEase(rng),
    onComplete: () => cloud.destroy(),
  })
}
