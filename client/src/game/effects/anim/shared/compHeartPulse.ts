// Phase 20-02: extracted из StarMapScene.ts (case 37).
// Heart pulse — пульс из 2 кругов в виде сердца (горячая планета любви).
import type Phaser from 'phaser'
import { pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compHeartPulse(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const heart = scene.add.graphics()
  const color = pickColor(rng, sys)
  const r = sys.size * 0.7
  heart.fillStyle(color, 0.85)
  // 2 круга + треугольник снизу = сердце
  heart.fillCircle(-r * 0.5, -r * 0.2, r * 0.6)
  heart.fillCircle(r * 0.5, -r * 0.2, r * 0.6)
  heart.fillTriangle(-r, 0, r, 0, 0, r * 1.0)
  sprite.add(heart)
  scene.tweens.add({
    targets: heart,
    scaleX: 1.6 + rng() * 0.3,
    scaleY: 1.6 + rng() * 0.3,
    alpha: 0,
    duration: 600 + rng() * 200,
    ease: 'Sine.easeOut',
    onComplete: () => heart.destroy(),
  })
}
