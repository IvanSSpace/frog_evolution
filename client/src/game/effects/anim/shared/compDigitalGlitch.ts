// Phase 20-02: extracted из StarMapScene.ts (case 89).
// Digital glitch — sound-style: glitch-tear (RGB-shift искажения).
// Пиксельные клоны разных RGB-цветов с stutter offset.
import Phaser from 'phaser'
import type { AnimSys } from './types'

export function compDigitalGlitch(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const channels = [0xff0066, 0x00ff66, 0x0066ff]
  const stutters = 4 + Math.floor(rng() * 3) // 4..6
  const stepDelay = 70 + rng() * 30
  const ghosts: Phaser.GameObjects.Rectangle[] = []
  for (let i = 0; i < stutters; i++) {
    scene.time.delayedCall(i * stepDelay, () => {
      if (!sprite.active) return
      for (let c = 0; c < 3; c++) {
        const offX = (rng() - 0.5) * sys.size * 0.6
        const offY = (rng() - 0.5) * sys.size * 0.3
        const rect = scene.add.rectangle(
          offX,
          offY,
          sys.size * 1.4,
          sys.size * 0.18,
          channels[c],
          0.55,
        )
        rect.setBlendMode(Phaser.BlendModes.SCREEN)
        sprite.add(rect)
        ghosts.push(rect)
        scene.tweens.add({
          targets: rect,
          alpha: 0,
          duration: 100 + rng() * 50,
          ease: 'Cubic.easeOut',
          onComplete: () => rect.destroy(),
        })
      }
    })
  }
  // Сафети-cleanup на случай если что-то осталось
  scene.time.delayedCall(stutters * stepDelay + 300, () => {
    for (const g of ghosts) {
      if (g.active) g.destroy()
    }
  })
}
