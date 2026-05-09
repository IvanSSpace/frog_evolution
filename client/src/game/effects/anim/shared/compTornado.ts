// Phase 20-02: extracted из StarMapScene.ts (case 45).
// Tornado — спираль конусом вверх (вертикальный вихрь).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compTornado(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 16 + Math.floor(rng() * 6)
  const dur = 700 + rng() * 200
  const direction = rng() < 0.5 ? 1 : -1
  const ang = -Math.PI / 2 // вверх
  for (let i = 0; i < N; i++) {
    const t0 = i / N
    const dot = scene.add.circle(
      0,
      0,
      (1 + rng()) * DPR,
      pickColor(rng, sys),
      0.85,
    )
    sprite.add(dot)
    const startTime = scene.time.now + i * 25
    const localDur = dur
    const update = () => {
      if (!dot.active) {
        scene.events.off('update', update)
        return
      }
      const t = (scene.time.now - startTime) / localDur
      if (t < 0) return
      if (t >= 1) {
        dot.destroy()
        scene.events.off('update', update)
        return
      }
      const along = sys.size * (1.5 - t * 2.5) // снизу-вверх
      const radius = sys.size * (0.2 + t * 0.6) // расширяется
      const phase = direction * t * Math.PI * 4 + t0 * Math.PI * 2
      const cosA = Math.cos(ang),
        sinA = Math.sin(ang)
      // local coords: forward = ang, side = perpendicular
      const sideX = -sinA,
        sideY = cosA
      dot.x = cosA * along + sideX * Math.cos(phase) * radius
      dot.y = sinA * along + sideY * Math.cos(phase) * radius
      dot.alpha = 0.85 * (1 - t)
    }
    scene.events.on('update', update)
  }
}
