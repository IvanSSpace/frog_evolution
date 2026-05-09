// Phase 9: extracted из StarMapScene.ts L1306-1341 (case 2).
// Sparkle burst (rng: количество, дистанция, цвета, размер, mix tints)
// Phase 7: расширен диапазон N (4-19), dotSize (1-5); subVariant — мини-кресты вместо точек (40%).
import type Phaser from 'phaser'
import { DPR, pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compSparkle(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 4 + Math.floor(rng() * 16) // 4-19
  const baseDist = sys.size * (1.4 + rng() * 0.8)
  const distVar = rng() * 0.4
  const dotSize = (1 + rng() * 4) * DPR
  const dur = 400 + rng() * 350
  const useCross = rng() < 0.4
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.5
    const dist = baseDist * (1 - distVar + rng() * distVar * 2)
    const tint = pickColor(rng, sys)
    let dot: Phaser.GameObjects.Graphics | Phaser.GameObjects.Arc
    if (useCross) {
      const gfx = scene.add.graphics()
      gfx.fillStyle(tint, 1)
      // мини-крест: 2 узких прямоугольника
      gfx.fillRect(-dotSize, -dotSize * 0.3, dotSize * 2, dotSize * 0.6)
      gfx.fillRect(-dotSize * 0.3, -dotSize, dotSize * 0.6, dotSize * 2)
      gfx.rotation = rng() * Math.PI
      sprite.add(gfx)
      dot = gfx
    } else {
      const c = scene.add.circle(0, 0, dotSize, tint, 1)
      sprite.add(c)
      dot = c
    }
    scene.tweens.add({
      targets: dot,
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist,
      alpha: 0,
      scaleX: 0.2 + rng() * 0.3,
      scaleY: 0.2 + rng() * 0.3,
      duration: dur + rng() * 200,
      ease: pickEase(rng),
      onComplete: () => dot.destroy(),
    })
  }
}
