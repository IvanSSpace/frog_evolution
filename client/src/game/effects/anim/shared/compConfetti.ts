// Phase 9: extracted из StarMapScene.ts L1371-1394 (case 7).
// Confetti — N квадратов вылетают, поворачиваются и падают (rng: count, colors, gravity)
import type Phaser from 'phaser'
import { DPR, pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compConfetti(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 6 + Math.floor(rng() * 9) // 6-14
  const speedRange = sys.size * (1.5 + rng() * 0.6)
  const gravity = (rng() - 0.5) * 0.4 // -0.2..+0.2 (вниз/вверх предпочтение)
  const dur = 600 + rng() * 300
  const sizeBase = (2 + rng() * 2) * DPR
  for (let i = 0; i < N; i++) {
    const ang = rng() * Math.PI * 2
    const color = pickColor(rng, sys)
    const sz = sizeBase * (0.7 + rng() * 0.6)
    const rect = scene.add.rectangle(0, 0, sz, sz, color, 1)
    rect.setRotation(rng() * Math.PI * 2)
    sprite.add(rect)
    const dx = Math.cos(ang) * speedRange * (0.6 + rng() * 0.4)
    const dy =
      Math.sin(ang) * speedRange * (0.6 + rng() * 0.4) + gravity * speedRange
    scene.tweens.add({
      targets: rect,
      x: dx,
      y: dy,
      alpha: 0,
      rotation: rect.rotation + (rng() - 0.5) * Math.PI * 4,
      duration: dur + rng() * 200,
      ease: pickEase(rng),
      onComplete: () => rect.destroy(),
    })
  }
}
