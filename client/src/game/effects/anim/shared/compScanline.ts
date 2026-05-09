// Phase 20-02: extracted из StarMapScene.ts (case 68).
// Scanline — горизонтальная полоса проходит сверху вниз через планету.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compScanline(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const line = scene.add.graphics()
  const color = pickColor(rng, sys)
  const w = sys.size * 2.4
  const h = (1.5 + rng()) * DPR
  line.fillStyle(color, 0.7)
  line.fillRect(-w / 2, -h / 2, w, h)
  line.fillStyle(0xffffff, 0.5)
  line.fillRect(-w / 2, -h / 4, w, h / 2)
  line.x = 0
  line.y = -sys.size * 1.5
  line.rotation = (rng() - 0.5) * 0.3 // лёгкий tilt
  sprite.add(line)
  scene.tweens.add({
    targets: line,
    y: sys.size * 1.5,
    alpha: { from: 1, to: 0 },
    duration: 500 + rng() * 200,
    ease: 'Sine.easeInOut',
    onComplete: () => line.destroy(),
  })
}
