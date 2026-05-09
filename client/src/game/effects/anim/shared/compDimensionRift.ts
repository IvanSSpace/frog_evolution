// Phase 20-02: extracted из StarMapScene.ts (case 59).
// Dimension rift — длинный зигзаг-разлом (shadow, destroyed, mystic).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compDimensionRift(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const ang = rng() * Math.PI * 2
  const len = sys.size * (3 + rng())
  const segments = 6 + Math.floor(rng() * 4)
  const color = pickColor(rng, sys)
  const rift = scene.add.graphics()
  rift.lineStyle((2 + rng() * 1.5) * DPR, color, 0.95)
  const cosA = Math.cos(ang),
    sinA = Math.sin(ang)
  let px = (-len / 2) * cosA,
    py = (-len / 2) * sinA
  for (let s = 1; s <= segments; s++) {
    const t = s / segments
    const along = -len / 2 + len * t
    const offset = (rng() - 0.5) * sys.size * 0.5
    const x = along * cosA - offset * sinA
    const y = along * sinA + offset * cosA
    rift.lineBetween(px, py, x, y)
    px = x
    py = y
  }
  // Тонкое свечение второй линией
  rift.lineStyle(0.8 * DPR, 0xffffff, 0.7)
  px = (-len / 2) * cosA
  py = (-len / 2) * sinA
  for (let s = 1; s <= segments; s++) {
    const t = s / segments
    const along = -len / 2 + len * t
    const offset = (rng() - 0.5) * sys.size * 0.3
    const x = along * cosA - offset * sinA
    const y = along * sinA + offset * cosA
    rift.lineBetween(px, py, x, y)
    px = x
    py = y
  }
  rift.scale = 0.5
  sprite.add(rift)
  scene.tweens.add({
    targets: rift,
    scale: 1.2,
    alpha: 0,
    duration: 500 + rng() * 250,
    ease: 'Cubic.easeOut',
    onComplete: () => rift.destroy(),
  })
}
