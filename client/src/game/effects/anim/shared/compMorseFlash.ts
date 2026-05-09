// Phase 20-02: extracted из StarMapScene.ts (case 82).
// Morse flash — sound-style: dit-dah-dit (азбука морзе).
// Серия коротких + длинных вспышек, как сигнал.
import type Phaser from 'phaser'
import { pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compMorseFlash(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  // Pattern: dot-dot-dash-dot (каждый = blink с alpha)
  const pattern = [80, 80, 200, 80] // ms
  let totalDelay = 0
  for (const dur of pattern) {
    scene.time.delayedCall(totalDelay, () => {
      if (!sprite.active) return
      const flash = scene.add.circle(
        0,
        0,
        sys.size * 1.05,
        pickColor(rng, sys),
        0.7,
      )
      sprite.add(flash)
      scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: dur,
        ease: 'Sine.easeOut',
        onComplete: () => flash.destroy(),
      })
    })
    totalDelay += dur + 60
  }
}
