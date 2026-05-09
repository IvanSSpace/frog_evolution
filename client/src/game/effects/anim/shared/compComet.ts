// Phase 20-02: extracted из StarMapScene.ts (case 9).
// Comet — точка пролетает мимо планеты (rng: angle, speed, trail length).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compComet(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const angle = rng() * Math.PI * 2
  const distance = sys.size * (3 + rng() * 1.5)
  const sx = Math.cos(angle) * -distance
  const sy = Math.sin(angle) * -distance
  const ex = Math.cos(angle) * distance
  const ey = Math.sin(angle) * distance
  const color = pickColor(rng, sys)
  const dur = 400 + rng() * 300
  // Голова кометы
  const head = scene.add.circle(sx, sy, (3 + rng() * 2) * DPR, 0xffffff, 1)
  const halo = scene.add.circle(sx, sy, (7 + rng() * 4) * DPR, color, 0.5)
  sprite.add(halo)
  sprite.add(head)
  // Trail — N точек в очереди за головой
  const trailLen = 3 + Math.floor(rng() * 4) // 3-6
  const trail: Phaser.GameObjects.Arc[] = []
  for (let i = 0; i < trailLen; i++) {
    const t = scene.add.circle(
      sx,
      sy,
      (2 - i * 0.2) * DPR,
      color,
      0.5 - i * 0.07,
    )
    sprite.add(t)
    trail.push(t)
  }
  const startTime = scene.time.now
  const update = () => {
    if (!head.active) {
      scene.events.off('update', update)
      return
    }
    const t = (scene.time.now - startTime) / dur
    if (t >= 1) {
      head.destroy()
      halo.destroy()
      trail.forEach((d) => d.destroy())
      scene.events.off('update', update)
      return
    }
    head.x = sx + (ex - sx) * t
    head.y = sy + (ey - sy) * t
    halo.x = head.x
    halo.y = head.y
    trail.forEach((dot, i) => {
      const tt = Math.max(0, t - (i + 1) * 0.05)
      dot.x = sx + (ex - sx) * tt
      dot.y = sy + (ey - sy) * tt
    })
  }
  scene.events.on('update', update)
}
