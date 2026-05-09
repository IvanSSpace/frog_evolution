// Phase 20-02: extracted из StarMapScene.ts (case 60).
// Frost explode — взрыв ледяных осколков с blue tint (ice, crystal, aerial).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compFrostExplode(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 8 + Math.floor(rng() * 6)
  const dur = 600 + rng() * 250
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.3
    const dist = sys.size * (1.6 + rng() * 0.8)
    const baseColor = pickColor(rng, sys)
    // mix с холодным blue tint
    const tint = rng() < 0.5 ? baseColor : 0xa5f3fc
    const shard = scene.add.graphics()
    const sw = (1 + rng()) * DPR
    const sh = (3 + rng() * 3) * DPR
    shard.fillStyle(tint, 0.95)
    shard.fillTriangle(0, -sh, sw * 1.2, 0, 0, sh * 0.4)
    shard.fillTriangle(0, -sh, -sw * 1.2, 0, 0, sh * 0.4)
    shard.fillStyle(0xffffff, 0.6)
    shard.fillTriangle(0, -sh * 0.6, sw * 0.5, 0, 0, sh * 0.2)
    shard.rotation = ang + Math.PI / 2
    sprite.add(shard)
    scene.tweens.add({
      targets: shard,
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist,
      rotation: shard.rotation + (rng() - 0.5) * Math.PI * 3,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: dur + rng() * 200,
      ease: 'Cubic.easeOut',
      onComplete: () => shard.destroy(),
    })
  }
  // Центральный flash
  const flash = scene.add.circle(0, 0, sys.size * 0.7, 0xa5f3fc, 0.7)
  sprite.add(flash)
  scene.tweens.add({
    targets: flash,
    scale: 2.5,
    alpha: 0,
    duration: 350,
    ease: 'Cubic.easeOut',
    onComplete: () => flash.destroy(),
  })
}
