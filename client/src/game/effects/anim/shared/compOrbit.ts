// Phase 20-02: extracted из StarMapScene.ts (case 5).
// Orbit dart (rng: количество точек на орбите, скорость, направление, радиус).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compOrbit(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const dots = 1 + Math.floor(rng() * 3) // 1-3 точки
  const radius = sys.size * (1.2 + rng() * 0.5)
  const direction = rng() < 0.5 ? 1 : -1
  const cycles = 1 + rng() * 0.8 // 1-1.8 оборота
  const dur = 500 + rng() * 400
  const startAng = rng() * Math.PI * 2
  for (let i = 0; i < dots; i++) {
    const phase = (i / dots) * Math.PI * 2
    const color = pickColor(rng, sys)
    const dot = scene.add.circle(0, 0, (2 + rng() * 2) * DPR, 0xffffff, 1)
    const glow = scene.add.circle(
      0,
      0,
      (5 + rng() * 4) * DPR,
      color,
      0.4 + rng() * 0.3,
    )
    sprite.add(glow)
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
        glow.destroy()
        scene.events.off('update', update)
        return
      }
      const a = startAng + phase + direction * t * Math.PI * 2 * cycles
      const x = Math.cos(a) * radius
      const y = Math.sin(a) * radius
      dot.x = x
      dot.y = y
      glow.x = x
      glow.y = y
      // fade в конце
      if (t > 0.7) {
        dot.alpha = 1 - (t - 0.7) / 0.3
        glow.alpha = (0.4 + rng() * 0.3) * (1 - (t - 0.7) / 0.3)
      }
    }
    scene.events.on('update', update)
  }
}
