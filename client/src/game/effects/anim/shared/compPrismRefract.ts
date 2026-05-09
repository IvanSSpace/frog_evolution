// Phase 20-02: extracted из StarMapScene.ts (case 92).
// Prism refract — sound-style: spectral-shimmer (преломление радуги).
// 7 разноцветных лучей расходятся из точки на краю планеты.
import type Phaser from 'phaser'
import { DPR } from './sharedHelpers'
import type { AnimSys } from './types'

export function compPrismRefract(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const rainbow = [
    0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3,
  ]
  const baseAng = rng() * Math.PI * 2
  const ox = Math.cos(baseAng) * sys.size
  const oy = Math.sin(baseAng) * sys.size
  const rays: Phaser.GameObjects.Graphics[] = []
  for (let i = 0; i < 7; i++) {
    const offset = ((i - 3) / 3) * (Math.PI / 12) // ±15° spread
    const rayAng = baseAng + offset
    const len = sys.size * (1.5 + rng() * 0.5)
    const ray = scene.add.graphics()
    ray.lineStyle(1.5 * DPR, rainbow[i], 0)
    ray.lineBetween(
      ox,
      oy,
      ox + Math.cos(rayAng) * len,
      oy + Math.sin(rayAng) * len,
    )
    ray.alpha = 0
    sprite.add(ray)
    rays.push(ray)
    // Fade-in
    scene.tweens.add({
      targets: ray,
      alpha: 0.85,
      duration: 100,
      ease: 'Sine.easeOut',
      delay: i * 15,
    })
    // Fade-out + destroy
    scene.tweens.add({
      targets: ray,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      delay: 200 + i * 15,
      onComplete: () => ray.destroy(),
    })
  }
}
