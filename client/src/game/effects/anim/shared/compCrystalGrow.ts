// Phase 20-02: extracted из StarMapScene.ts (case 41).
// Crystal grow — кристаллы растут наружу из центра как ледяные иглы.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compCrystalGrow(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 5 + Math.floor(rng() * 4)
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + rng() * 0.3
    const finalLen = sys.size * (1.6 + rng() * 0.6)
    const color = pickColor(rng, sys)
    const shard = scene.add.graphics()
    const w = (1.5 + rng() * 1.5) * DPR
    shard.fillStyle(color, 0.9)
    shard.fillTriangle(0, 0, w, finalLen * 0.5, -w, finalLen * 0.5)
    shard.fillStyle(0xffffff, 0.5)
    shard.fillTriangle(0, 0, w * 0.5, finalLen * 0.5, -w * 0.5, finalLen * 0.5)
    shard.rotation = ang - Math.PI / 2
    shard.scale = 0.05
    sprite.add(shard)
    scene.tweens.add({
      targets: shard,
      scale: 1,
      duration: 350 + rng() * 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        scene.tweens.add({
          targets: shard,
          alpha: 0,
          scale: 1.2,
          duration: 400 + rng() * 200,
          ease: 'Cubic.easeIn',
          onComplete: () => shard.destroy(),
        })
      },
    })
  }
}
