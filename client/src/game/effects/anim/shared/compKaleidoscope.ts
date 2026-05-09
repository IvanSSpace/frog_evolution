// Phase 20-02: extracted из StarMapScene.ts (case 78).
// Kaleidoscope — sound-style: symmetry-spin (симметричное вращение).
// 6/8-секторная симметричная картина с вращением.
import type Phaser from 'phaser'
import { pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compKaleidoscope(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const sectors = rng() < 0.5 ? 6 : 8
  const kaleido = scene.add.graphics()
  const c1 = pickColor(rng, sys)
  const c2 = pickColor(rng, sys)
  for (let i = 0; i < sectors; i++) {
    const ang = (i / sectors) * Math.PI * 2
    kaleido.fillStyle(i % 2 === 0 ? c1 : c2, 0.6)
    const r = sys.size * (1.3 + rng() * 0.3)
    kaleido.fillTriangle(
      0,
      0,
      Math.cos(ang) * r,
      Math.sin(ang) * r,
      Math.cos(ang + Math.PI / sectors) * r,
      Math.sin(ang + Math.PI / sectors) * r,
    )
  }
  kaleido.scale = 0.3
  sprite.add(kaleido)
  scene.tweens.add({
    targets: kaleido,
    scale: 1.3 + rng() * 0.3,
    alpha: 0,
    rotation: ((rng() < 0.5 ? 1 : -1) * Math.PI) / 2,
    duration: 600 + rng() * 200,
    ease: 'Cubic.easeOut',
    onComplete: () => kaleido.destroy(),
  })
}
