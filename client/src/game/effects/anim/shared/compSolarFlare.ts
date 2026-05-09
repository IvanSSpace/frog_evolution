// Phase 20-02: extracted из StarMapScene.ts (case 27).
// Solar flare — гигантская асимметричная вспышка с одной стороны.
import type Phaser from 'phaser'
import { pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compSolarFlare(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const ang = rng() * Math.PI * 2
  const flare = scene.add.graphics()
  const color = pickColor(rng, sys)
  const accent = pickColor(rng, sys)
  const len = sys.size * (3 + rng() * 1.5)
  const w = sys.size * (0.9 + rng() * 0.5)
  // Эллипс длинный — направлен в сторону ang
  flare.fillStyle(color, 0.55)
  flare.fillEllipse(len * 0.4, 0, len, w)
  flare.fillStyle(0xffffff, 0.8)
  flare.fillEllipse(len * 0.3, 0, len * 0.7, w * 0.4)
  flare.fillStyle(accent, 0.4)
  flare.fillEllipse(len * 0.55, 0, len * 0.6, w * 0.7)
  flare.rotation = ang
  sprite.add(flare)
  scene.tweens.add({
    targets: flare,
    alpha: 0,
    scaleY: 1.4 + rng() * 0.4,
    duration: 500 + rng() * 250,
    ease: pickEase(rng),
    onComplete: () => flare.destroy(),
  })
}
