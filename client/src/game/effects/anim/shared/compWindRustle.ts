// Phase 20-02: extracted из StarMapScene.ts (case 84).
// Wind rustle — sound-style: wind-whisper (шёпот ветра).
// Мелкие точки сдуваются в одну сторону.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compWindRustle(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 14 + Math.floor(rng() * 8)
  const windAng = rng() * Math.PI * 2
  const cosW = Math.cos(windAng),
    sinW = Math.sin(windAng)
  for (let i = 0; i < N; i++) {
    const startAng = rng() * Math.PI * 2
    const startR = sys.size * (0.7 + rng() * 0.5)
    const sx = Math.cos(startAng) * startR
    const sy = Math.sin(startAng) * startR
    const dist = sys.size * (1.5 + rng() * 0.6)
    const dot = scene.add.circle(
      sx,
      sy,
      (0.8 + rng()) * DPR,
      pickColor(rng, sys),
      0.85,
    )
    sprite.add(dot)
    scene.tweens.add({
      targets: dot,
      x: sx + cosW * dist + (rng() - 0.5) * sys.size * 0.3,
      y: sy + sinW * dist + (rng() - 0.5) * sys.size * 0.3,
      alpha: 0,
      duration: 600 + rng() * 250,
      ease: 'Sine.easeOut',
      delay: rng() * 200,
      onComplete: () => dot.destroy(),
    })
  }
}
