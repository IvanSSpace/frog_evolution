// Phase 20-02: extracted из StarMapScene.ts (case 47).
// Cross flash — крестообразная вспышка X или + (для military, mineral).
import type Phaser from 'phaser'
import { pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compCrossFlash(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const cross = scene.add.graphics()
  const color = pickColor(rng, sys)
  const len = sys.size * (2.5 + rng() * 0.7)
  const w = sys.size * 0.18
  cross.fillStyle(color, 0.5)
  cross.fillRect(-len, -w, len * 2, w * 2)
  cross.fillRect(-w, -len, w * 2, len * 2)
  cross.fillStyle(0xffffff, 0.95)
  cross.fillRect(-len, -w * 0.4, len * 2, w * 0.8)
  cross.fillRect(-w * 0.4, -len, w * 0.8, len * 2)
  cross.rotation = rng() < 0.5 ? Math.PI / 4 : 0 // X или +
  cross.scale = 0.4
  sprite.add(cross)
  scene.tweens.add({
    targets: cross,
    scale: 1.3 + rng() * 0.3,
    alpha: 0,
    duration: 350 + rng() * 200,
    ease: 'Cubic.easeOut',
    onComplete: () => cross.destroy(),
  })
}
