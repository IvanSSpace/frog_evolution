// Phase 20-02: extracted из StarMapScene.ts (case 4).
// Lightning (rng: количество молний, угол fan, цвет, глубина зигзага).
import type Phaser from 'phaser'
import { DPR, pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compLightning(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const bolts = 3 + Math.floor(rng() * 5) // 3-7
  const fanCenter = rng() * Math.PI * 2
  const fanWidth = rng() < 0.4 ? Math.PI * 2 : Math.PI * (0.5 + rng() * 1) // часто полный круг, иногда сектор
  const segments = 2 + Math.floor(rng() * 3) // 2-4
  const baseColor = rng() < 0.6 ? 0xfde047 : pickColor(rng, sys)
  const lightning = scene.add.graphics()
  lightning.lineStyle((1.5 + rng() * 1.5) * DPR, baseColor, 0.85 + rng() * 0.15)
  for (let i = 0; i < bolts; i++) {
    const ang =
      fanCenter - fanWidth / 2 + (i / Math.max(1, bolts - 1)) * fanWidth
    const r1 = sys.size * (0.3 + rng() * 0.2)
    const r2 = sys.size * (1.4 + rng() * 0.7)
    let px = Math.cos(ang) * r1,
      py = Math.sin(ang) * r1
    for (let j = 1; j <= segments; j++) {
      const t = j / segments
      const r = r1 + (r2 - r1) * t
      const jitter = (rng() - 0.5) * 0.6
      const x = Math.cos(ang + jitter) * r
      const y = Math.sin(ang + jitter) * r
      lightning.lineBetween(px, py, x, y)
      px = x
      py = y
    }
  }
  sprite.add(lightning)
  scene.tweens.add({
    targets: lightning,
    alpha: 0,
    duration: 250 + rng() * 250,
    ease: pickEase(rng),
    onComplete: () => lightning.destroy(),
  })
}
