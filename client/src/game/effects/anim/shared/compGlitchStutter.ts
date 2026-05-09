// Phase 20-02: extracted из StarMapScene.ts (case 80).
// Glitch stutter — sound-style: glitch-stutter (цифровое заикание).
// Повторяющиеся быстрые offset+colorshift.
import Phaser from 'phaser'
import type { AnimSys } from './types'

export function compGlitchStutter(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const stutters = 4 + Math.floor(rng() * 3)
  const colors = [0xff0066, 0x00ff66, 0x0066ff, 0xfde047]
  for (let i = 0; i < stutters; i++) {
    scene.time.delayedCall(i * 60, () => {
      if (!sprite.active) return
      const shift = sys.size * (0.1 + rng() * 0.15)
      const ang = rng() * Math.PI * 2
      const ghost = scene.add.circle(
        Math.cos(ang) * shift,
        Math.sin(ang) * shift,
        sys.size * 0.85,
        colors[i % colors.length],
        0.55,
      )
      ghost.setBlendMode(Phaser.BlendModes.SCREEN)
      sprite.add(ghost)
      scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 100,
        ease: 'Cubic.easeOut',
        onComplete: () => ghost.destroy(),
      })
    })
  }
}
