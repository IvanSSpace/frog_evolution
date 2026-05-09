// Phase 20-02: extracted из StarMapScene.ts (case 18).
// Lava erupt — точки извергаются вверх с trail и падают (для lava, forge).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compLavaErupt(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 8 + Math.floor(rng() * 6)
  const baseAng = -Math.PI / 2 + (rng() - 0.5) * 0.6 // вверх ± 17°
  const fanWidth = 0.8 + rng() * 0.7
  const dur = 700 + rng() * 300
  for (let i = 0; i < N; i++) {
    const ang = baseAng + (rng() - 0.5) * fanWidth
    const speed = sys.size * (1.6 + rng() * 0.8)
    const color = pickColor(rng, sys)
    const dot = scene.add.circle(0, 0, (2 + rng() * 2) * DPR, color, 1)
    sprite.add(dot)
    // парабола: x = vx*t, y = vy*t + 0.5*g*t²
    const vx = Math.cos(ang) * speed
    const vy = Math.sin(ang) * speed
    const g = sys.size * 4
    const startTime = scene.time.now
    const localDur = dur + rng() * 200
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
      dot.x = vx * t
      dot.y = vy * t + 0.5 * g * t * t
      dot.alpha = 1 - t * 0.7
      dot.scale = 1 - t * 0.3
    }
    scene.events.on('update', update)
  }
}
