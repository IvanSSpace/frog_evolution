// Phase 20-02: extracted из StarMapScene.ts (case 14).
// Ring dance — кольцо вращается + пульсирует (для gas_ringed, home, mystic).
import type Phaser from 'phaser'
import { DPR, pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compRingDance(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const ring = scene.add.graphics()
  const color = pickColor(rng, sys)
  const accent = pickColor(rng, sys)
  const tilt = (rng() - 0.5) * 80
  ring.lineStyle((1.5 + rng()) * DPR, color, 0.85)
  ring.strokeEllipse(0, 0, sys.size * 2.4, sys.size * 1.0)
  ring.lineStyle(DPR, accent, 0.6)
  ring.strokeEllipse(0, 0, sys.size * 2.7, sys.size * 1.1)
  ring.angle = tilt
  sprite.add(ring)
  scene.tweens.add({
    targets: ring,
    angle: tilt + (rng() < 0.5 ? 360 : -360),
    scaleX: 1.2 + rng() * 0.3,
    scaleY: 1.2 + rng() * 0.3,
    alpha: 0,
    duration: 700 + rng() * 300,
    ease: pickEase(rng),
    onComplete: () => ring.destroy(),
  })
}
