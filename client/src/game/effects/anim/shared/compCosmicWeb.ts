// Phase 20-02: extracted из StarMapScene.ts (case 71).
// Cosmic web — паутина из точек соединённых линиями.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compCosmicWeb(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 6 + Math.floor(rng() * 3)
  const points: { x: number; y: number }[] = []
  const dots: Phaser.GameObjects.Arc[] = []
  const color = pickColor(rng, sys)
  for (let i = 0; i < N; i++) {
    const ang = rng() * Math.PI * 2
    const r = sys.size * (1.2 + rng() * 0.6)
    const x = Math.cos(ang) * r,
      y = Math.sin(ang) * r
    points.push({ x, y })
    const dot = scene.add.circle(
      x,
      y,
      (1.5 + rng()) * DPR,
      pickColor(rng, sys),
      1,
    )
    sprite.add(dot)
    dots.push(dot)
  }
  // линии из каждой точки к 2 ближайшим
  const lines = scene.add.graphics()
  lines.lineStyle(0.7 * DPR, color, 0.5)
  for (let i = 0; i < N; i++) {
    const dists = points
      .map((p, j) => ({
        j,
        d: i === j ? 9999 : Math.hypot(p.x - points[i].x, p.y - points[i].y),
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
    for (const { j } of dists) {
      lines.lineBetween(points[i].x, points[i].y, points[j].x, points[j].y)
    }
  }
  sprite.add(lines)
  scene.tweens.add({
    targets: [...dots, lines],
    alpha: 0,
    scale: 1.2,
    duration: 700 + rng() * 200,
    ease: 'Sine.easeOut',
    delay: 200,
    onComplete: () => {
      dots.forEach((d) => d.destroy())
      lines.destroy()
    },
  })
}
