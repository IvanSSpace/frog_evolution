// Phase 20-02: extracted из StarMapScene.ts (case 88).
// Bouncing ball — sound-style: rubber-thump (резиновый отскок).
// Мяч прыгает над планетой, отскоки с затуханием по высоте.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compBouncingBall(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const ball = scene.add.circle(
    0,
    0,
    (3 + rng() * 2) * DPR,
    pickColor(rng, sys),
    1,
  )
  sprite.add(ball)
  const bounces = 3 + Math.floor(rng() * 3) // 3..5
  const baseY = sys.size * 0.6
  const startX = -sys.size * 0.9
  const stepX = (sys.size * 1.8) / bounces
  ball.x = startX
  ball.y = baseY
  let elapsed = 0
  const bounceDur = 200
  for (let i = 0; i < bounces; i++) {
    const apexHeight = sys.size * (1.0 - i * 0.18)
    const apexY = baseY - apexHeight
    const xMid = startX + stepX * (i + 0.5)
    const xEnd = startX + stepX * (i + 1)
    // Подъём
    scene.tweens.add({
      targets: ball,
      x: xMid,
      y: apexY,
      duration: bounceDur,
      ease: 'Quad.easeOut',
      delay: elapsed,
    })
    // Падение
    scene.tweens.add({
      targets: ball,
      x: xEnd,
      y: baseY,
      duration: bounceDur,
      ease: 'Quad.easeIn',
      delay: elapsed + bounceDur,
    })
    elapsed += bounceDur * 2
  }
  // Финальный fade и destroy
  scene.tweens.add({
    targets: ball,
    alpha: 0,
    duration: 200,
    ease: 'Cubic.easeOut',
    delay: elapsed,
    onComplete: () => ball.destroy(),
  })
}
