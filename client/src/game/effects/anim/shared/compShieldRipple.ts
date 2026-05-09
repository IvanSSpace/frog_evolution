// Phase 20-02: extracted из StarMapScene.ts (case 66).
// Shield ripple — гексагональный shield с расходящимися волнами.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compShieldRipple(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const layers = 3
  const baseR = sys.size * 1.2
  const color = pickColor(rng, sys)
  for (let i = 0; i < layers; i++) {
    scene.time.delayedCall(i * 100, () => {
      if (!sprite.active) return
      const hex = scene.add.graphics()
      hex.lineStyle((1.2 + rng()) * DPR, color, 0.85 - i * 0.15)
      hex.beginPath()
      for (let j = 0; j <= 6; j++) {
        const a = (j / 6) * Math.PI * 2
        const x = Math.cos(a) * baseR,
          y = Math.sin(a) * baseR
        if (j === 0) hex.moveTo(x, y)
        else hex.lineTo(x, y)
      }
      hex.strokePath()
      hex.rotation = (i * Math.PI) / 12
      sprite.add(hex)
      scene.tweens.add({
        targets: hex,
        scale: 1.8 + i * 0.2,
        alpha: 0,
        rotation: hex.rotation + Math.PI / 6,
        duration: 600,
        ease: 'Cubic.easeOut',
        onComplete: () => hex.destroy(),
      })
    })
  }
}
