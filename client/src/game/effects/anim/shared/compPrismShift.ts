// Phase 20-02: extracted из StarMapScene.ts (case 63).
// Prism shift — 7 разноцветных лучей радуги расходятся (crystal_bio, plasma, energy).
import type Phaser from 'phaser'
import { DPR } from './sharedHelpers'
import type { AnimSys } from './types'

export function compPrismShift(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const colors = [
    0xfca5a5, 0xfdba74, 0xfde047, 0x86efac, 0x67e8f9, 0xa5f3fc, 0xc4b5fd,
  ]
  const baseAng = rng() * Math.PI * 2
  const span = Math.PI * (0.5 + rng() * 0.8)
  const len = sys.size * (1.6 + rng() * 0.5)
  const dur = 500 + rng() * 250
  for (let i = 0; i < colors.length; i++) {
    const t = i / (colors.length - 1)
    const ang = baseAng - span / 2 + t * span
    const beam = scene.add.graphics()
    beam.fillStyle(colors[i], 0.7)
    beam.fillRect(sys.size * 0.5, -1.5 * DPR, len, 3 * DPR)
    beam.fillStyle(0xffffff, 0.5)
    beam.fillRect(sys.size * 0.5, -0.4 * DPR, len, 0.8 * DPR)
    beam.rotation = ang
    beam.alpha = 0
    sprite.add(beam)
    scene.tweens.add({
      targets: beam,
      alpha: 0.9,
      duration: 100,
      delay: i * 25,
      ease: 'Sine.easeOut',
      onComplete: () => {
        scene.tweens.add({
          targets: beam,
          alpha: 0,
          scaleX: 1.3,
          duration: dur,
          ease: 'Cubic.easeOut',
          onComplete: () => beam.destroy(),
        })
      },
    })
  }
}
