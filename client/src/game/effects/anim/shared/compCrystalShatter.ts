// Phase 9: extracted из StarMapScene.ts L1518-1543 (case 15).
// Crystal shatter — N остроугольных осколков разлетаются (для ice, mineral, crystal)
import type Phaser from 'phaser'
import { DPR, pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compCrystalShatter(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 5 + Math.floor(rng() * 6)
  const dur = 500 + rng() * 300
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.3
    const dist = sys.size * (1.5 + rng() * 0.7)
    const color = pickColor(rng, sys)
    // ромб через 4 точки
    const shard = scene.add.graphics()
    const sw = (1.5 + rng() * 1.5) * DPR
    const sh = (3.5 + rng() * 3) * DPR
    shard.fillStyle(color, 0.95)
    shard.fillTriangle(0, -sh, sw, 0, 0, sh)
    shard.fillTriangle(0, -sh, -sw, 0, 0, sh)
    shard.rotation = ang + Math.PI / 2
    sprite.add(shard)
    scene.tweens.add({
      targets: shard,
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist,
      rotation: shard.rotation + (rng() - 0.5) * Math.PI * 2,
      alpha: 0,
      scaleX: 0.4,
      scaleY: 0.4,
      duration: dur + rng() * 200,
      ease: pickEase(rng),
      onComplete: () => shard.destroy(),
    })
  }
}
