// Phase 20-02: extracted из StarMapScene.ts (case 30).
// Lens flare — длинная горизонтальная вспышка через всю планету.
import type Phaser from 'phaser'
import { pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compLensFlare(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const flare = scene.add.graphics()
  const color = pickColor(rng, sys)
  const ang = rng() * Math.PI * 2
  const len = sys.size * (4 + rng() * 1.5)
  const w = sys.size * 0.15
  flare.fillStyle(color, 0.4)
  flare.fillEllipse(0, 0, len, w * 1.6)
  flare.fillStyle(0xffffff, 0.9)
  flare.fillEllipse(0, 0, len * 0.7, w * 0.5)
  flare.fillStyle(color, 0.7)
  flare.fillCircle(0, 0, sys.size * 0.5)
  flare.rotation = ang
  sprite.add(flare)
  scene.tweens.add({
    targets: flare,
    alpha: 0,
    scaleX: 1.2 + rng() * 0.3,
    duration: 350 + rng() * 200,
    ease: 'Cubic.easeOut',
    onComplete: () => flare.destroy(),
  })
}
