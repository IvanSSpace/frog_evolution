// Phase 20-02: extracted из StarMapScene.ts (case 35).
// Cosmic ray — длинная прямая линия с свечением, проходит мимо.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compCosmicRay(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const ang = rng() * Math.PI * 2
  const reach = sys.size * (3.5 + rng())
  const sx = Math.cos(ang) * -reach
  const sy = Math.sin(ang) * -reach
  const ex = Math.cos(ang) * reach
  const ey = Math.sin(ang) * reach
  const color = pickColor(rng, sys)
  const w = (2 + rng() * 2) * DPR
  const ray = scene.add.graphics()
  ray.lineStyle(w, color, 0.7)
  ray.lineBetween(sx, sy, ex, ey)
  ray.lineStyle(w * 0.5, 0xffffff, 1)
  ray.lineBetween(sx, sy, ex, ey)
  sprite.add(ray)
  // двигаем альфу
  scene.tweens.add({
    targets: ray,
    alpha: 0,
    duration: 350 + rng() * 200,
    ease: 'Cubic.easeOut',
    onComplete: () => ray.destroy(),
  })
}
