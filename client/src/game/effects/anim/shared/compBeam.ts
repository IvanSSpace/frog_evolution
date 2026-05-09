// Phase 20-02: extracted из StarMapScene.ts (case 22).
// Beam — прямой длинный луч в случайном направлении (для plasma, energy, mechano).
import type Phaser from 'phaser'
import { DPR, pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compBeam(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const beams = 1 + Math.floor(rng() * 3) // 1-3 луча
  for (let i = 0; i < beams; i++) {
    const ang = rng() * Math.PI * 2
    const len = sys.size * (2.5 + rng() * 1.5)
    const w = (3 + rng() * 4) * DPR
    const color = pickColor(rng, sys)
    const beam = scene.add.graphics()
    // gradient via 2 layers
    beam.fillStyle(color, 0.3)
    beam.fillRect(0, -w * 0.7, len, w * 1.4)
    beam.fillStyle(0xffffff, 0.85)
    beam.fillRect(0, -w * 0.3, len, w * 0.6)
    beam.rotation = ang
    sprite.add(beam)
    scene.tweens.add({
      targets: beam,
      alpha: 0,
      scaleX: 1 + rng() * 0.3,
      duration: 350 + rng() * 200,
      ease: pickEase(rng),
      onComplete: () => beam.destroy(),
    })
  }
}
