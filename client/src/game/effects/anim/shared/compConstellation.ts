// Phase 20-02: extracted из StarMapScene.ts (case 31).
// Constellation — N точек + линии между ближайшими.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compConstellation(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 5 + Math.floor(rng() * 4)
  const points: { x: number; y: number }[] = []
  const dots: Phaser.GameObjects.Arc[] = []
  const color = pickColor(rng, sys)
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + rng() * 0.6
    const r = sys.size * (1.3 + rng() * 0.6)
    const x = Math.cos(ang) * r,
      y = Math.sin(ang) * r
    points.push({ x, y })
    const dot = scene.add.circle(x, y, (1.5 + rng()) * DPR, 0xffffff, 1)
    sprite.add(dot)
    dots.push(dot)
  }
  // линии между ближайшими соседями (по index)
  const lines = scene.add.graphics()
  lines.lineStyle(0.8 * DPR, color, 0.5)
  for (let i = 0; i < N; i++) {
    const a = points[i]
    const b = points[(i + 1) % N]
    lines.lineBetween(a.x, a.y, b.x, b.y)
  }
  sprite.add(lines)
  scene.tweens.add({
    targets: [...dots, lines],
    alpha: 0,
    duration: 700 + rng() * 200,
    ease: 'Sine.easeOut',
    delay: 150,
    onComplete: () => {
      dots.forEach((d) => d.destroy())
      lines.destroy()
    },
  })
}
