// Phase 9: extracted из StarMapScene.ts L2517-2544 (case 53).
// Chroma shift — RGB ghost split (3 копии в разных цветах смещаются и сливаются)
import Phaser from 'phaser'
import type { AnimSys } from './types'

export function compChromaShift(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const offset = sys.size * (0.18 + rng() * 0.12)
  const baseAng = rng() * Math.PI * 2
  const colors = [0xff0066, 0x00ff66, 0x0066ff]
  const ghosts: Phaser.GameObjects.Arc[] = []
  for (let i = 0; i < 3; i++) {
    const a = baseAng + (i / 3) * Math.PI * 2
    const dx = Math.cos(a) * offset
    const dy = Math.sin(a) * offset
    const ghost = scene.add.circle(0, 0, sys.size * 0.85, colors[i], 0.5)
    ghost.setBlendMode(Phaser.BlendModes.SCREEN)
    sprite.add(ghost)
    ghosts.push(ghost)
    scene.tweens.add({
      targets: ghost, x: dx, y: dy,
      yoyo: true, duration: 200 + rng() * 100,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        scene.tweens.add({
          targets: ghost, alpha: 0,
          duration: 200, ease: 'Cubic.easeOut',
          onComplete: () => ghost.destroy(),
        })
      },
    })
  }
  void ghosts
}
