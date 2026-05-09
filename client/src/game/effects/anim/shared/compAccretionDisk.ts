// Phase 20-02: extracted из StarMapScene.ts (case 56).
// Accretion disk — плоский эллиптический диск с вращением (gas_giant, gas_ringed).
import type Phaser from 'phaser'
import { pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compAccretionDisk(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const tilt = (rng() - 0.5) * 80
  const dur = 700 + rng() * 250
  const color = pickColor(rng, sys)
  const accent = pickColor(rng, sys)
  const disk = scene.add.graphics()
  // 3 эллипса плотности диска
  for (let i = 0; i < 3; i++) {
    const rx = sys.size * (2.0 - i * 0.3)
    const ry = sys.size * (0.5 - i * 0.1)
    const c = i % 2 === 0 ? color : accent
    disk.fillStyle(c, 0.25 + i * 0.1)
    disk.fillEllipse(0, 0, rx * 2, ry * 2)
  }
  disk.angle = tilt
  disk.scale = 0.3
  sprite.add(disk)
  scene.tweens.add({
    targets: disk,
    scale: 1,
    angle: tilt + (rng() < 0.5 ? 60 : -60),
    duration: dur * 0.5,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: disk,
        alpha: 0,
        scale: 1.2,
        angle: tilt + 120,
        duration: dur * 0.5,
        ease: 'Cubic.easeIn',
        onComplete: () => disk.destroy(),
      })
    },
  })
}
