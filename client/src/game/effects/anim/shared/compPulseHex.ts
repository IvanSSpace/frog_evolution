// Phase 20-02: extracted из StarMapScene.ts (case 44).
// Pulse hex — гексагональное кольцо появляется и расширяется.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compPulseHex(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const sides = rng() < 0.5 ? 6 : 8
  const hex = scene.add.graphics()
  const color = pickColor(rng, sys)
  const r = sys.size * 1.3
  hex.lineStyle((1.5 + rng()) * DPR, color, 0.9)
  hex.beginPath()
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r
    if (i === 0) hex.moveTo(x, y)
    else hex.lineTo(x, y)
  }
  hex.strokePath()
  hex.rotation = rng() * Math.PI * 2
  sprite.add(hex)
  scene.tweens.add({
    targets: hex,
    scale: 1.8 + rng() * 0.5,
    alpha: 0,
    rotation: hex.rotation + (rng() < 0.5 ? Math.PI / 6 : -Math.PI / 6),
    duration: 500 + rng() * 250,
    ease: 'Cubic.easeOut',
    onComplete: () => hex.destroy(),
  })
}
