// Phase 20-02: extracted из StarMapScene.ts (case 70).
// Gravity knot — точки скручиваются в спиральный узел и распадаются.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compGravityKnot(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 10 + Math.floor(rng() * 6)
  const dur = 700 + rng() * 200
  const knotPhase = rng() * Math.PI * 2
  for (let i = 0; i < N; i++) {
    const phase = (i / N) * Math.PI * 2 + knotPhase
    const color = pickColor(rng, sys)
    const dot = scene.add.circle(0, 0, (1.5 + rng()) * DPR, color, 1)
    sprite.add(dot)
    const startTime = scene.time.now
    const update = () => {
      if (!dot.active) {
        scene.events.off('update', update)
        return
      }
      const t = (scene.time.now - startTime) / dur
      if (t >= 1) {
        dot.destroy()
        scene.events.off('update', update)
        return
      }
      // r oscillates; angle grows
      const r = sys.size * (1.0 + 0.5 * Math.sin(t * Math.PI * 3))
      const a = phase + t * Math.PI * 4
      dot.x = Math.cos(a) * r
      dot.y = Math.sin(a) * r
      dot.alpha = 1 - t * 0.7
    }
    scene.events.on('update', update)
  }
}
