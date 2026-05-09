// Phase 20-02: extracted из StarMapScene.ts (case 12).
// Vortex — точки притягиваются К центру по спирали (для gas_giant, mystic, shadow).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compVortex(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 8 + Math.floor(rng() * 8)
  const startR = sys.size * (1.6 + rng() * 0.6)
  const rotations = 1 + rng() * 1.5
  const direction = rng() < 0.5 ? 1 : -1
  const dur = 550 + rng() * 350
  for (let i = 0; i < N; i++) {
    const baseAng = (i / N) * Math.PI * 2 + rng() * 0.4
    const color = pickColor(rng, sys)
    const dot = scene.add.circle(0, 0, (1.5 + rng() * 1.5) * DPR, color, 1)
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
      const r = startR * (1 - t)
      const a = baseAng + direction * t * Math.PI * 2 * rotations
      dot.x = Math.cos(a) * r
      dot.y = Math.sin(a) * r
      dot.alpha = 0.3 + 0.7 * t
      dot.scale = 0.4 + t * 0.7
    }
    scene.events.on('update', update)
  }
}
