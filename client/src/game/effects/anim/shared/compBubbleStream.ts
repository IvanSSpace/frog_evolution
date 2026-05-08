// Phase 9: extracted из StarMapScene.ts L3546-3575 (case 86).
// Bubble stream — sound-style: fizz-rise (поднимающаяся газировка)
// Поток мелких пузырей вверх
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compBubbleStream(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 12 + Math.floor(rng() * 6)
  const upAng = -Math.PI / 2 + (rng() - 0.5) * 0.3
  for (let i = 0; i < N; i++) {
    scene.time.delayedCall(i * 40, () => {
      if (!sprite.active) return
      const startX = (rng() - 0.5) * sys.size * 0.6
      const startY = sys.size * 0.7
      const r = (1 + rng() * 1.5) * DPR
      const bubble = scene.add.graphics()
      const color = pickColor(rng, sys)
      bubble.fillStyle(color, 0.5)
      bubble.fillCircle(0, 0, r)
      bubble.lineStyle(0.5 * DPR, 0xffffff, 0.7)
      bubble.strokeCircle(0, 0, r)
      bubble.x = startX; bubble.y = startY
      sprite.add(bubble)
      const dist = sys.size * (1.0 + rng() * 0.6)
      scene.tweens.add({
        targets: bubble,
        x: startX + Math.cos(upAng) * dist,
        y: startY + Math.sin(upAng) * dist,
        alpha: 0,
        scale: 1.4,
        duration: 600 + rng() * 200, ease: 'Sine.easeOut',
        onComplete: () => bubble.destroy(),
      })
    })
  }
}
