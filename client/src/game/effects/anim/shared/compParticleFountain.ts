// Phase 20-02: extracted из StarMapScene.ts (case 72).
// Particle fountain — частицы вылетают вверх и падают обратно с гравитацией.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compParticleFountain(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 12 + Math.floor(rng() * 8)
  const dur = 800 + rng() * 250
  const upDir = rng() * Math.PI * 2
  const cosD = Math.cos(upDir),
    sinD = Math.sin(upDir)
  for (let i = 0; i < N; i++) {
    const speed = sys.size * (1.5 + rng() * 0.8)
    const spread = (rng() - 0.5) * 1.0
    const color = pickColor(rng, sys)
    const dot = scene.add.circle(0, 0, (1.5 + rng()) * DPR, color, 1)
    sprite.add(dot)
    // velocity по upDir + spread perp
    const perpX = -sinD,
      perpY = cosD
    const vx = cosD * speed + perpX * spread * speed * 0.5
    const vy = sinD * speed + perpY * spread * speed * 0.5
    const g = -sys.size * 4 // gravity отталкивает обратно (по противоположному направлению)
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
      // motion: vx*t, vy*t + 0.5 * g * t² (g flipped sign vs upDir)
      const fall = -0.5 * g * t * t
      dot.x = vx * t + cosD * fall
      dot.y = vy * t + sinD * fall
      dot.alpha = 1 - t * 0.85
    }
    scene.events.on('update', update)
  }
}
