// Phase 20-02: extracted из StarMapScene.ts (case 51).
// Snake trail — точка обходит S-образную форму с trail.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compSnakeTrail(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const dur = 700 + rng() * 250
  const amplitude = sys.size * (0.6 + rng() * 0.3)
  const length = sys.size * (3 + rng())
  const ang = rng() * Math.PI * 2
  const cosA = Math.cos(ang),
    sinA = Math.sin(ang)
  const head = scene.add.circle(
    0,
    0,
    (2.5 + rng()) * DPR,
    pickColor(rng, sys),
    1,
  )
  const trail: Phaser.GameObjects.Arc[] = []
  sprite.add(head)
  for (let i = 0; i < 6; i++) {
    const t = scene.add.circle(
      0,
      0,
      (2 - i * 0.25) * DPR,
      pickColor(rng, sys),
      0.7 - i * 0.1,
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
    const along = -length / 2 + length * t
    const wave = Math.sin(t * Math.PI * 4) * amplitude
    head.x = along * cosA - wave * sinA
    head.y = along * sinA + wave * cosA
    trail.forEach((d, i) => {
      const tt = Math.max(0, t - (i + 1) * 0.04)
      const a2 = -length / 2 + length * tt
      const w2 = Math.sin(tt * Math.PI * 4) * amplitude
      d.x = a2 * cosA - w2 * sinA
      d.y = a2 * sinA + w2 * cosA
    })
  }
  scene.events.on('update', update)
}
