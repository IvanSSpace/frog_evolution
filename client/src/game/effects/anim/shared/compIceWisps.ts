// Phase 9: extracted из StarMapScene.ts L3436-3465 (case 74).
// Ice wisps — ледяные завитки кружатся вокруг
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compIceWisps(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 4 + Math.floor(rng() * 3)
  const direction = rng() < 0.5 ? 1 : -1
  const dur = 700 + rng() * 200
  for (let i = 0; i < N; i++) {
    const phase = (i / N) * Math.PI * 2
    const wisp = scene.add.graphics()
    const color = pickColor(rng, sys)
    // мелкая дуга как закрученный завиток
    wisp.lineStyle((1 + rng()) * DPR, color, 0.85)
    wisp.beginPath()
    const segs = 8
    for (let s = 0; s <= segs; s++) {
      const t = s / segs
      const r = sys.size * (1.2 + t * 0.4)
      const a = phase + (direction * t * Math.PI) / 2
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r
      if (s === 0) wisp.moveTo(x, y)
      else wisp.lineTo(x, y)
    }
    wisp.strokePath()
    wisp.scale = 0.5
    sprite.add(wisp)
    scene.tweens.add({
      targets: wisp,
      scale: 1.2,
      alpha: 0,
      rotation: (direction * Math.PI) / 4,
      duration: dur + rng() * 150,
      ease: 'Sine.easeOut',
      onComplete: () => wisp.destroy(),
    })
  }
}
