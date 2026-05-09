// Phase 20-02: extracted из StarMapScene.ts (case 65).
// Infinity trail — точка обходит ∞-форму с trail.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compInfinityTrail(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const dur = 700 + rng() * 250
  const sz = sys.size * (1.4 + rng() * 0.4)
  const angle = rng() * Math.PI * 2
  const cosA = Math.cos(angle),
    sinA = Math.sin(angle)
  const head = scene.add.circle(
    0,
    0,
    (2.5 + rng()) * DPR,
    pickColor(rng, sys),
    1,
  )
  const trail: Phaser.GameObjects.Arc[] = []
  sprite.add(head)
  for (let i = 0; i < 5; i++) {
    const t = scene.add.circle(
      0,
      0,
      (2 - i * 0.3) * DPR,
      pickColor(rng, sys),
      0.6 - i * 0.1,
    )
    sprite.add(t)
    trail.push(t)
  }
  const startTime = scene.time.now
  const update = () => {
    if (!head.active) {
      scene.events.off('update', update)
      return
    }
    const t = (scene.time.now - startTime) / dur
    if (t >= 1) {
      head.destroy()
      trail.forEach((d) => d.destroy())
      scene.events.off('update', update)
      return
    }
    const path = (off: number) => {
      const tt = Math.max(0, t - off)
      const θ = tt * Math.PI * 2
      // ∞: x = sz * cos(θ), y = sz * sin(θ) * cos(θ)
      const lx = sz * Math.cos(θ)
      const ly = sz * Math.sin(θ) * Math.cos(θ)
      return { x: lx * cosA - ly * sinA, y: lx * sinA + ly * cosA }
    }
    const h = path(0)
    head.x = h.x
    head.y = h.y
    trail.forEach((d, i) => {
      const p = path((i + 1) * 0.04)
      d.x = p.x
      d.y = p.y
    })
  }
  scene.events.on('update', update)
}
