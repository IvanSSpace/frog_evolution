// Phase 9: extracted из StarMapScene.ts L1239-1277 (case 0).
// Кольцо (rng: цвет, толщина, scale, ease, duration, направление)
// Phase 7: расширены диапазоны thickness, endScale, log-scale duration; subVariant с пунктиром.
import type Phaser from 'phaser'
import { DPR, pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compRing(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const ring = scene.add.graphics()
  const color = pickColor(rng, sys)
  const thickness = (1 + rng() * 5) * DPR
  const alpha = 0.7 + rng() * 0.3
  const startScale = 0.95 + rng() * 0.1
  const endScale = 1.4 + rng() * 2.5
  // log-scale duration: 200-1100ms (вместо linear 400-800)
  const dur = Math.floor(200 * Math.exp(rng() * 1.7))
  ring.lineStyle(thickness, color, alpha)
  // 50% — обычный, 50% — пунктирный (приближение через arc-сегменты)
  if (rng() < 0.5) {
    ring.strokeCircle(0, 0, sys.size * 1.05)
  } else {
    const dashes = 8 + Math.floor(rng() * 12)
    const r = sys.size * 1.05
    const gap = 0.3 + rng() * 0.4
    for (let i = 0; i < dashes; i++) {
      const a0 = (i / dashes) * Math.PI * 2
      const a1 = a0 + ((Math.PI * 2) / dashes) * (1 - gap)
      const segs = 4
      let px = Math.cos(a0) * r,
        py = Math.sin(a0) * r
      for (let s = 1; s <= segs; s++) {
        const t = s / segs
        const a = a0 + (a1 - a0) * t
        const x = Math.cos(a) * r,
          y = Math.sin(a) * r
        ring.lineBetween(px, py, x, y)
        px = x
        py = y
      }
    }
  }
  ring.scale = startScale
  sprite.add(ring)
  scene.tweens.add({
    targets: ring,
    scaleX: endScale,
    scaleY: endScale,
    alpha: 0,
    duration: dur,
    ease: pickEase(rng),
    onComplete: () => ring.destroy(),
  })
}
