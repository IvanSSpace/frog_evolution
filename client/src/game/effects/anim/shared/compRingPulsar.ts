// Phase 20-02: extracted из StarMapScene.ts (case 90).
// Ring pulsar — sound-style: heartbeat (lub-DUB пульсация).
// Двойной удар: короткая пульсация → сильная пульсация.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compRingPulsar(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const ring = scene.add.graphics()
  const color = pickColor(rng, sys)
  ring.lineStyle(2 * DPR, color, 0.85)
  ring.strokeCircle(0, 0, sys.size * 1.3)
  ring.scale = 0.85
  sprite.add(ring)
  // Lub: короткая пульсация
  scene.tweens.add({
    targets: ring,
    scale: 1.15,
    duration: 120,
    ease: 'Sine.easeOut',
    yoyo: true,
  })
  // DUB: сильная пульсация (через delay)
  scene.tweens.add({
    targets: ring,
    scale: 1.4,
    alpha: 0,
    duration: 200,
    ease: 'Cubic.easeOut',
    delay: 280,
  })
  // Финальное затухание + destroy
  scene.tweens.add({
    targets: ring,
    alpha: 0,
    duration: 350,
    ease: 'Cubic.easeOut',
    delay: 480,
    onComplete: () => ring.destroy(),
  })
}
