// Phase 20-02: extracted из StarMapScene.ts (case 58).
// Light dance — 3 луча кружатся вокруг (energy, plasma, mechano).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compLightDance(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 3
  const dur = 700 + rng() * 200
  const baseAng = rng() * Math.PI * 2
  const radius = sys.size * 0.4
  const turns = 0.8 + rng() * 0.7
  const direction = rng() < 0.5 ? 1 : -1
  for (let i = 0; i < N; i++) {
    const phaseOffset = (i / N) * Math.PI * 2
    const color = pickColor(rng, sys)
    const beam = scene.add.graphics()
    beam.fillStyle(color, 0.7)
    beam.fillRect(0, -1.5 * DPR, sys.size * 0.9, 3 * DPR)
    beam.fillStyle(0xffffff, 0.85)
    beam.fillRect(0, -0.5 * DPR, sys.size * 0.6, 1 * DPR)
    sprite.add(beam)
    const startTime = scene.time.now
    const update = () => {
      if (!beam.active) {
        scene.events.off('update', update)
        return
      }
      const t = (scene.time.now - startTime) / dur
      if (t >= 1) {
        beam.destroy()
        scene.events.off('update', update)
        return
      }
      const a = baseAng + phaseOffset + direction * t * Math.PI * 2 * turns
      beam.x = Math.cos(a) * radius
      beam.y = Math.sin(a) * radius
      beam.rotation = a
      beam.alpha = (1 - t) * 0.85
    }
    scene.events.on('update', update)
  }
}
