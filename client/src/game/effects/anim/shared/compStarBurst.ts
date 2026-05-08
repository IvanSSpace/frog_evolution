// Phase 9: extracted из StarMapScene.ts L1564-1595 (case 10).
// Star burst — N линий от центра планеты разной длины (rng: count, colors, length)
// Phase 7: расширен диапазон rays (4-19); 30% — некоторые лучи длиннее в 2x.
import type Phaser from 'phaser'
import { DPR, pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compStarBurst(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const rays = 4 + Math.floor(rng() * 16) // 4-19
  const burst = scene.add.graphics()
  const color = pickColor(rng, sys)
  const accent = pickColor(rng, sys)
  const startR = sys.size * 0.6
  const endRBase = sys.size * (1.5 + rng() * 0.6)
  const tippingPct = rng() < 0.3 ? 0.3 : 0 // 30% recipes — некоторые лучи длиннее
  burst.lineStyle((1 + rng() * 1.5) * DPR, color, 0.85)
  for (let i = 0; i < rays; i++) {
    const ang = (i / rays) * Math.PI * 2 + rng() * 0.2
    const lenMult = (tippingPct > 0 && rng() < tippingPct) ? 2 : 1
    const endR = endRBase * (0.7 + rng() * 0.4) * lenMult
    burst.lineBetween(
      Math.cos(ang) * startR, Math.sin(ang) * startR,
      Math.cos(ang) * endR, Math.sin(ang) * endR,
    )
  }
  // Тонкие accent поверх
  burst.lineStyle(0.5 * DPR, accent, 0.7)
  for (let i = 0; i < rays / 2; i++) {
    const ang = (i / (rays / 2)) * Math.PI * 2 + rng() * 0.3 + Math.PI / rays
    const endR = endRBase * (0.5 + rng() * 0.3)
    burst.lineBetween(0, 0, Math.cos(ang) * endR, Math.sin(ang) * endR)
  }
  sprite.add(burst)
  scene.tweens.add({
    targets: burst, alpha: 0, scaleX: 1.3 + rng() * 0.4, scaleY: 1.3 + rng() * 0.4,
    duration: 400 + rng() * 300, ease: pickEase(rng),
    onComplete: () => burst.destroy(),
  })
}
