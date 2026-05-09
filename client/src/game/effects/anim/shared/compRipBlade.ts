// Phase 20-02: extracted из StarMapScene.ts (case 75).
// Rip blade — острый «разрез» прорезает планету диагонально.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compRipBlade(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const blade = scene.add.graphics()
  const color = pickColor(rng, sys)
  const len = sys.size * (3 + rng() * 0.6)
  const w = (1.5 + rng()) * DPR
  blade.fillStyle(color, 0.8)
  blade.fillRect(-len / 2, -w * 1.5, len, w * 3)
  blade.fillStyle(0xffffff, 0.95)
  blade.fillRect(-len / 2, -w * 0.5, len, w)
  blade.rotation = rng() * Math.PI * 2
  blade.scale = 0.1
  sprite.add(blade)
  scene.tweens.add({
    targets: blade,
    scaleX: 1.2,
    scaleY: 1,
    alpha: 0,
    duration: 350 + rng() * 200,
    ease: 'Cubic.easeOut',
    onComplete: () => blade.destroy(),
  })
}
