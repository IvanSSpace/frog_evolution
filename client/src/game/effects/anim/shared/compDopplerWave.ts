// Phase 20-02: extracted из StarMapScene.ts (case 81).
// Doppler wave — sound-style: doppler-shift (волна со сдвигом).
// Эллиптическая волна расширяется с asymmetric color tint.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compDopplerWave(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const wave = scene.add.graphics()
  const angle = rng() * Math.PI * 2
  const c1 = pickColor(rng, sys)
  const c2 = pickColor(rng, sys)
  wave.lineStyle(2 * DPR, c1, 0.7)
  wave.strokeEllipse(-sys.size * 0.2, 0, sys.size * 1.6, sys.size * 1.0)
  wave.lineStyle(1.5 * DPR, c2, 0.5)
  wave.strokeEllipse(sys.size * 0.2, 0, sys.size * 2.0, sys.size * 1.2)
  wave.rotation = angle
  sprite.add(wave)
  scene.tweens.add({
    targets: wave,
    scale: 1.7 + rng() * 0.3,
    alpha: 0,
    x: Math.cos(angle) * sys.size,
    y: Math.sin(angle) * sys.size,
    duration: 600 + rng() * 200,
    ease: 'Cubic.easeOut',
    onComplete: () => wave.destroy(),
  })
}
