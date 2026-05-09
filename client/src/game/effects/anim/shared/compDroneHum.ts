// Phase 20-02: extracted из StarMapScene.ts (case 79).
// Drone hum — sound-style: bass-drone (низкий тяжелый дрон).
// Большой круг медленно пульсирует с низкой частотой.
import type Phaser from 'phaser'
import { pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compDroneHum(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const drone = scene.add.circle(0, 0, sys.size * 1.4, pickColor(rng, sys), 0.4)
  sprite.add(drone)
  scene.tweens.add({
    targets: drone,
    scale: 1.3,
    alpha: 0,
    duration: 800 + rng() * 200,
    ease: 'Sine.easeInOut',
    onComplete: () => drone.destroy(),
  })
}
