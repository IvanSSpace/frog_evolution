// Phase 20-02: extracted из StarMapScene.ts (case 83).
// Crystal bell — sound-style: clink-resonate (хрустальный звон).
// Гексагон + расходящиеся круги-резонансы.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compCrystalBell(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const hex = scene.add.graphics()
  const color = pickColor(rng, sys)
  hex.lineStyle(2 * DPR, color, 0.85)
  hex.beginPath()
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(a) * sys.size * 1.1
    const y = Math.sin(a) * sys.size * 1.1
    if (i === 0) hex.moveTo(x, y)
    else hex.lineTo(x, y)
  }
  hex.strokePath()
  sprite.add(hex)
  // Резонанс: 2 расходящихся круга
  for (let i = 0; i < 2; i++) {
    scene.time.delayedCall(120 + i * 100, () => {
      if (!sprite.active) return
      const ring = scene.add.graphics()
      ring.lineStyle(0.8 * DPR, color, 0.5)
      ring.strokeCircle(0, 0, sys.size * 1.1)
      sprite.add(ring)
      scene.tweens.add({
        targets: ring,
        scale: 2.2,
        alpha: 0,
        duration: 500,
        onComplete: () => ring.destroy(),
      })
    })
  }
  scene.tweens.add({
    targets: hex,
    scale: 1.2,
    alpha: 0,
    rotation: Math.PI / 6,
    duration: 600,
    ease: 'Cubic.easeOut',
    onComplete: () => hex.destroy(),
  })
}
