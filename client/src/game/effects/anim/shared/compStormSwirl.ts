// Phase 20-02: extracted из StarMapScene.ts (case 13).
// Storm swirl — большой эллиптический вихрь (для gas_giant).
import type Phaser from 'phaser'
import { DPR, pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compStormSwirl(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const swirl = scene.add.graphics()
  const color = pickColor(rng, sys)
  const accent = pickColor(rng, sys)
  const angle = rng() * 360
  swirl.lineStyle((1.5 + rng()) * DPR, color, 0.7)
  swirl.strokeEllipse(0, 0, sys.size * 2.0, sys.size * 1.2)
  swirl.lineStyle(DPR, accent, 0.5)
  swirl.strokeEllipse(0, 0, sys.size * 1.6, sys.size * 0.9)
  swirl.angle = angle
  sprite.add(swirl)
  scene.tweens.add({
    targets: swirl,
    angle: angle + (rng() < 0.5 ? 180 : -180),
    scaleX: 1.4 + rng() * 0.4,
    scaleY: 1.4 + rng() * 0.4,
    alpha: 0,
    duration: 600 + rng() * 350,
    ease: pickEase(rng),
    onComplete: () => swirl.destroy(),
  })
}
