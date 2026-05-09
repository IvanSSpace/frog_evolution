// Phase 20-02: extracted из StarMapScene.ts (case 73).
// Echo spawn — фантомные копии планеты появляются и исчезают вокруг.
import type Phaser from 'phaser'
import type { AnimSys } from './types'

export function compEchoSpawn(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 4 + Math.floor(rng() * 3)
  for (let i = 0; i < N; i++) {
    scene.time.delayedCall(i * 80, () => {
      if (!sprite.active) return
      const ang = (i / N) * Math.PI * 2 + rng() * 0.4
      const dist = sys.size * (1.0 + rng() * 0.5)
      const ghost = scene.add.circle(
        Math.cos(ang) * dist,
        Math.sin(ang) * dist,
        sys.size * 0.55,
        sys.color,
        0.5,
      )
      sprite.add(ghost)
      scene.tweens.add({
        targets: ghost,
        alpha: 0,
        scale: 1.4,
        duration: 400 + rng() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => ghost.destroy(),
      })
    })
  }
}
