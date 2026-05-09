// Phase 20-02: extracted из StarMapScene.ts (case 1).
// 2-4 кольца последовательно с задержкой (рандом число + цвета + scale).
import type Phaser from 'phaser'
import { DPR, pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compMultiRing(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const count = 2 + Math.floor(rng() * 3) // 2-4
  const baseDelay = 80 + rng() * 120
  const baseDur = 450 + rng() * 250
  for (let i = 0; i < count; i++) {
    const colorPick = i % 2 === 0 ? sys.color : sys.accent
    const c = rng() < 0.3 ? pickColor(rng, sys) : colorPick
    const thick = (1 + rng() * 2.5) * DPR
    const maxScale = 1.6 + rng() * 1.4
    scene.time.delayedCall(i * baseDelay, () => {
      if (!sprite.active) return
      const ring = scene.add.graphics()
      ring.lineStyle(thick, c, 0.7 + rng() * 0.3)
      ring.strokeCircle(0, 0, sys.size * 1.1)
      sprite.add(ring)
      scene.tweens.add({
        targets: ring,
        scaleX: maxScale,
        scaleY: maxScale,
        alpha: 0,
        duration: baseDur,
        ease: pickEase(rng),
        onComplete: () => ring.destroy(),
      })
    })
  }
}
