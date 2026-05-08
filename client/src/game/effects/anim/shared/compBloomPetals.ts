// Phase 9: extracted из StarMapScene.ts L1607-1631 (case 19).
// Bloom petals — точки расходятся по форме цветка (для forest, organic, home)
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compBloomPetals(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const petals = 5 + Math.floor(rng() * 4) // 5-8
  const dur = 600 + rng() * 250
  const maxDist = sys.size * (1.5 + rng() * 0.5)
  for (let p = 0; p < petals; p++) {
    const baseAng = (p / petals) * Math.PI * 2
    // 2-3 точки на лепесток
    const dotsPerPetal = 2 + Math.floor(rng() * 2)
    for (let j = 0; j < dotsPerPetal; j++) {
      const offset = (j - dotsPerPetal / 2 + 0.5) * 0.15
      const ang = baseAng + offset
      const dist = maxDist * (0.7 + j * 0.15)
      const color = pickColor(rng, sys)
      const dot = scene.add.circle(0, 0, (1.5 + rng()) * DPR, color, 1)
      sprite.add(dot)
      scene.tweens.add({
        targets: dot,
        x: Math.cos(ang) * dist, y: Math.sin(ang) * dist,
        alpha: 0, scaleX: 1.5, scaleY: 1.5,
        duration: dur + j * 50, ease: 'Sine.easeOut',
        onComplete: () => dot.destroy(),
      })
    }
  }
}
