// Phase 20-02: extracted из StarMapScene.ts (case 49).
// Petal storm — много лепестков-эллипсов кружатся вокруг.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compPetalStorm(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 12 + Math.floor(rng() * 6)
  const direction = rng() < 0.5 ? 1 : -1
  const dur = 700 + rng() * 250
  const baseR = sys.size * 1.2
  for (let i = 0; i < N; i++) {
    const phase = (i / N) * Math.PI * 2
    const color = pickColor(rng, sys)
    const petal = scene.add.ellipse(
      0,
      0,
      (3 + rng() * 2) * DPR,
      (1.5 + rng()) * DPR,
      color,
      0.85,
    )
    petal.rotation = phase
    sprite.add(petal)
    const startTime = scene.time.now
    const update = () => {
      if (!petal.active) {
        scene.events.off('update', update)
        return
      }
      const t = (scene.time.now - startTime) / dur
      if (t >= 1) {
        petal.destroy()
        scene.events.off('update', update)
        return
      }
      const r = baseR * (1 + t * 0.6)
      const a = phase + direction * t * Math.PI * 2
      petal.x = Math.cos(a) * r
      petal.y = Math.sin(a) * r
      petal.rotation = a + Math.PI / 2
      petal.alpha = 0.85 * (1 - t)
    }
    scene.events.on('update', update)
  }
}
