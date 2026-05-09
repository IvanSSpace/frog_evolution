// Phase 9: extracted из StarMapScene.ts L1463-1499 (case 11).
// Halo flash — большое свечение вокруг планеты (rng: цвет, размер, alpha)
// Phase 7: расширены layers (2-6); subVariant — пульсирующий halo (40%).
import type Phaser from 'phaser'
import { pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compHaloFlash(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const halo = scene.add.graphics()
  const color = pickColor(rng, sys)
  const startR = sys.size * 1.2
  const layers = 2 + Math.floor(rng() * 5) // 2-6 слоёв
  for (let i = 0; i < layers; i++) {
    const r = startR * (1 + i * 0.25)
    halo.fillStyle(color, (0.4 - i * 0.07) * (0.6 + rng() * 0.4))
    halo.fillCircle(0, 0, r)
  }
  sprite.add(halo)
  const pulsing = rng() < 0.4
  if (pulsing) {
    // 2-3 пульсации scale 1↔1.4, потом fade out
    const pulses = 2 + Math.floor(rng() * 2)
    const pulseDur = 180 + rng() * 100
    scene.tweens.add({
      targets: halo,
      scaleX: 1.4,
      scaleY: 1.4,
      yoyo: true,
      repeat: pulses - 1,
      duration: pulseDur,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        scene.tweens.add({
          targets: halo,
          alpha: 0,
          scaleX: 1.6,
          scaleY: 1.6,
          duration: 250,
          ease: 'Cubic.easeOut',
          onComplete: () => halo.destroy(),
        })
      },
    })
  } else {
    scene.tweens.add({
      targets: halo,
      scaleX: 1.6 + rng() * 0.6,
      scaleY: 1.6 + rng() * 0.6,
      alpha: 0,
      duration: 450 + rng() * 350,
      ease: pickEase(rng),
      onComplete: () => halo.destroy(),
    })
  }
}
