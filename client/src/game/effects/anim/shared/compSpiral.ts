// Phase 20-02: extracted из StarMapScene.ts (case 6).
// Spiral burst — sparkles разлетаются по спирали (rng: rotation, count).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compSpiral(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 8 + Math.floor(rng() * 8) // 8-15
  const rotations = 0.5 + rng() * 1.5 // 0.5-2 оборота за время полёта
  const direction = rng() < 0.5 ? 1 : -1
  const maxDist = sys.size * (1.5 + rng() * 0.8)
  const dur = 500 + rng() * 350
  for (let i = 0; i < N; i++) {
    const baseAng = (i / N) * Math.PI * 2
    const color = pickColor(rng, sys)
    const dot = scene.add.circle(0, 0, (1.5 + rng() * 2) * DPR, color, 1)
    sprite.add(dot)
    const startTime = scene.time.now
    const localDur = dur + rng() * 150
    const update = () => {
      if (!dot.active) {
        scene.events.off('update', update)
        return
      }
      const t = (scene.time.now - startTime) / localDur
      if (t >= 1) {
        dot.destroy()
        scene.events.off('update', update)
        return
      }
      const r = maxDist * t
      const a = baseAng + direction * t * Math.PI * 2 * rotations
      dot.x = Math.cos(a) * r
      dot.y = Math.sin(a) * r
      dot.alpha = 1 - t
    }
    scene.events.on('update', update)
  }
}
