// Phase 9: extracted из StarMapScene.ts L2407-2433 (case 50).
// Flame tongues — несколько языков пламени (для lava, plasma, energy)
import type Phaser from 'phaser'
import { pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compFlameTongues(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 3 + Math.floor(rng() * 4)
  const dur = 500 + rng() * 200
  const baseAng = rng() * Math.PI * 2
  const fanWidth = Math.PI * (0.5 + rng() * 1.5)
  for (let i = 0; i < N; i++) {
    const ang = baseAng - fanWidth / 2 + (i / Math.max(1, N - 1)) * fanWidth
    const flame = scene.add.graphics()
    const color = pickColor(rng, sys)
    const len = sys.size * (1.2 + rng() * 0.6)
    const w = sys.size * 0.25
    flame.fillStyle(color, 0.7)
    // teardrop через ellipse
    flame.fillEllipse(0, len * 0.5, w, len)
    flame.fillStyle(0xffffff, 0.5)
    flame.fillEllipse(0, len * 0.5, w * 0.4, len * 0.7)
    flame.rotation = ang + Math.PI / 2
    flame.scale = 0.6
    sprite.add(flame)
    scene.tweens.add({
      targets: flame,
      scaleY: 1.5 + rng() * 0.4,
      scaleX: 0.8,
      alpha: 0,
      duration: dur + rng() * 150,
      ease: 'Cubic.easeOut',
      delay: i * 40,
      onComplete: () => flame.destroy(),
    })
  }
}
