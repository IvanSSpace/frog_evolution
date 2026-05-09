// Phase 20-02: extracted из StarMapScene.ts (case 48).
// Wave train — несколько асимметричных волн в одну сторону.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compWaveTrain(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const count = 3 + Math.floor(rng() * 3)
  const direction = rng() * Math.PI * 2
  const stepDelay = 100 + rng() * 80
  for (let i = 0; i < count; i++) {
    scene.time.delayedCall(i * stepDelay, () => {
      if (!sprite.active) return
      const wave = scene.add.graphics()
      const color = pickColor(rng, sys)
      wave.lineStyle((1 + rng()) * DPR, color, 0.7)
      wave.strokeEllipse(0, 0, sys.size * 1.5, sys.size * 0.6)
      wave.rotation = direction
      sprite.add(wave)
      scene.tweens.add({
        targets: wave,
        x: Math.cos(direction) * sys.size * 1.5,
        y: Math.sin(direction) * sys.size * 1.5,
        alpha: 0,
        scaleX: 1.5,
        duration: 600,
        ease: 'Sine.easeOut',
        onComplete: () => wave.destroy(),
      })
    })
  }
}
