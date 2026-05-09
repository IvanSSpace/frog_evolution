// Phase 20-02: extracted из StarMapScene.ts (case 33).
// Phoenix burst — искры взлетают и догорают (огненный фонтан).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compPhoenixBurst(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 14 + Math.floor(rng() * 8)
  const fanCenter = -Math.PI / 2 + (rng() - 0.5) * 0.4
  const fanWidth = 1.0 + rng() * 0.6
  const dur = 700 + rng() * 250
  for (let i = 0; i < N; i++) {
    const ang = fanCenter + (rng() - 0.5) * fanWidth
    const speed = sys.size * (1.5 + rng() * 0.8)
    const color = pickColor(rng, sys)
    const dot = scene.add.circle(0, 0, (1.5 + rng() * 1.5) * DPR, color, 1)
    sprite.add(dot)
    const vx = Math.cos(ang) * speed
    const vy = Math.sin(ang) * speed
    const g = sys.size * 2.5
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
      dot.x = vx * t
      dot.y = vy * t + 0.5 * g * t * t
      // догорает: смещение цвета через alpha + scale
      dot.alpha = 1 - t * 0.95
      dot.scale = 1 - t * 0.5
    }
    scene.events.on('update', update)
  }
}
