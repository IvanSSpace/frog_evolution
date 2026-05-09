// Phase 20-02: extracted из StarMapScene.ts (case 52).
// Bubble pop — пузыри всплывают и лопаются (для ocean, toxic).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compBubblePop(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 5 + Math.floor(rng() * 4)
  for (let i = 0; i < N; i++) {
    const startAng = rng() * Math.PI * 2
    const startR = sys.size * (0.8 + rng() * 0.3)
    const sx = Math.cos(startAng) * startR
    const sy = Math.sin(startAng) * startR
    const color = pickColor(rng, sys)
    const bubble = scene.add.graphics()
    const r = (3 + rng() * 3) * DPR
    bubble.fillStyle(color, 0.4)
    bubble.fillCircle(0, 0, r)
    bubble.lineStyle(0.8 * DPR, 0xffffff, 0.7)
    bubble.strokeCircle(0, 0, r)
    bubble.fillStyle(0xffffff, 0.6)
    bubble.fillCircle(-r * 0.3, -r * 0.3, r * 0.3)
    bubble.x = sx
    bubble.y = sy
    bubble.scale = 0
    sprite.add(bubble)
    const upX = sx + (rng() - 0.5) * sys.size * 0.4
    const upY = sy - sys.size * (0.7 + rng() * 0.5)
    scene.tweens.add({
      targets: bubble,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
      delay: i * 50,
      onComplete: () => {
        scene.tweens.add({
          targets: bubble,
          x: upX,
          y: upY,
          duration: 400 + rng() * 200,
          ease: 'Sine.easeOut',
          onComplete: () => {
            scene.tweens.add({
              targets: bubble,
              scale: 1.6,
              alpha: 0,
              duration: 150,
              ease: 'Cubic.easeOut',
              onComplete: () => bubble.destroy(),
            })
          },
        })
      },
    })
  }
}
