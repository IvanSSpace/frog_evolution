// Phase 20-02: extracted из StarMapScene.ts (case 91).
// Swarm particles — sound-style: buzz-swarm (рой жучков).
// 12-20 точек огибают планету по орбите с разными угловыми скоростями.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compSwarmParticles(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 12 + Math.floor(rng() * 9) // 12..20
  const dur = 1000
  const particles: {
    obj: Phaser.GameObjects.Arc
    r: number
    ang: number
    speed: number
  }[] = []
  for (let i = 0; i < N; i++) {
    const r = sys.size * (1.0 + rng() * 0.4)
    const ang = (i / N) * Math.PI * 2 + rng() * 0.3
    const speed = (rng() - 0.5) * 0.006 // ±0.003 рад/мс
    const dot = scene.add.circle(
      Math.cos(ang) * r,
      Math.sin(ang) * r,
      (1.2 + rng()) * DPR,
      pickColor(rng, sys),
      0.85,
    )
    sprite.add(dot)
    particles.push({ obj: dot, r, ang, speed })
  }
  let elapsed = 0
  const update = (_t: number, dt: number) => {
    elapsed += dt
    for (const p of particles) {
      p.ang += p.speed * dt
      p.obj.x = Math.cos(p.ang) * p.r
      p.obj.y = Math.sin(p.ang) * p.r
      // Плавное fade в конце жизни
      const t = elapsed / dur
      if (t > 0.7) p.obj.alpha = Math.max(0, 0.85 * (1 - (t - 0.7) / 0.3))
    }
  }
  scene.events.on('update', update)
  scene.time.delayedCall(dur, () => {
    scene.events.off('update', update)
    for (const p of particles) {
      if (p.obj.active) p.obj.destroy()
    }
  })
}
