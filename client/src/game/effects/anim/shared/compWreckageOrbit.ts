// Phase 20-02: extracted из StarMapScene.ts (case 95).
// Wreckage orbit — sound-style: debris-creak (обломки на орбите).
// 6-10 крошечных треугольников вращаются вокруг планеты с разными скоростями.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compWreckageOrbit(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 6 + Math.floor(rng() * 5) // 6..10
  const dur = 900
  const debris: {
    gfx: Phaser.GameObjects.Graphics
    r: number
    ang: number
    speed: number
    spin: number
  }[] = []
  for (let i = 0; i < N; i++) {
    const gfx = scene.add.graphics()
    const color = pickColor(rng, sys)
    const sz = (1.5 + rng() * 1.2) * DPR
    gfx.fillStyle(color, 0.85)
    gfx.fillTriangle(-sz, sz * 0.6, sz, sz * 0.3, 0, -sz)
    sprite.add(gfx)
    const r = sys.size * (1.1 + rng() * 0.3)
    const ang = (i / N) * Math.PI * 2 + rng() * 0.4
    const speed = (rng() < 0.5 ? 1 : -1) * (0.001 + rng() * 0.003)
    const spin = (rng() - 0.5) * 0.008
    gfx.x = Math.cos(ang) * r
    gfx.y = Math.sin(ang) * r
    debris.push({ gfx, r, ang, speed, spin })
  }
  let elapsed = 0
  const update = (_t: number, dt: number) => {
    elapsed += dt
    for (const d of debris) {
      d.ang += d.speed * dt
      d.gfx.x = Math.cos(d.ang) * d.r
      d.gfx.y = Math.sin(d.ang) * d.r
      d.gfx.rotation += d.spin * dt
      if (elapsed > dur * 0.6) {
        d.gfx.alpha = Math.max(0, 1 - (elapsed - dur * 0.6) / (dur * 0.4))
      }
    }
  }
  scene.events.on('update', update)
  scene.time.delayedCall(dur, () => {
    scene.events.off('update', update)
    for (const d of debris) {
      if (d.gfx.active) d.gfx.destroy()
    }
  })
}
