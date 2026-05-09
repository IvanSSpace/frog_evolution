// Phase 20-02: extracted из StarMapScene.ts (case 20).
// Dust puff — медленный low-alpha облачный пуф (для dead, rocky, shadow).
import type Phaser from 'phaser'
import { pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compDustPuff(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const puff = scene.add.graphics()
  const color = pickColor(rng, sys)
  const blobs = 4 + Math.floor(rng() * 3)
  for (let i = 0; i < blobs; i++) {
    const ang = rng() * Math.PI * 2
    const dist = sys.size * (0.6 + rng() * 0.5)
    const r = sys.size * (0.3 + rng() * 0.25)
    puff.fillStyle(color, 0.25 + rng() * 0.2)
    puff.fillCircle(Math.cos(ang) * dist, Math.sin(ang) * dist, r)
  }
  sprite.add(puff)
  scene.tweens.add({
    targets: puff,
    scaleX: 1.4 + rng() * 0.3,
    scaleY: 1.4 + rng() * 0.3,
    alpha: 0,
    duration: 700 + rng() * 350,
    ease: 'Sine.easeOut',
    onComplete: () => puff.destroy(),
  })
}
