// Phase 20-02: extracted из StarMapScene.ts (case 43).
// Galaxy spawn — мини-галактика рождается рядом с планетой (для gas_giant, ancient).
import type Phaser from 'phaser'
import { pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compGalaxySpawn(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const offsetAng = rng() * Math.PI * 2
  const offsetDist = sys.size * (1.6 + rng() * 0.5)
  const cx = Math.cos(offsetAng) * offsetDist
  const cy = Math.sin(offsetAng) * offsetDist
  const galaxy = scene.add.graphics()
  const color = pickColor(rng, sys)
  const accent = pickColor(rng, sys)
  const ovalRX = sys.size * 0.6
  const ovalRY = sys.size * 0.25
  galaxy.fillStyle(color, 0.5)
  galaxy.fillEllipse(0, 0, ovalRX * 2, ovalRY * 2)
  galaxy.fillStyle(0xffffff, 0.85)
  galaxy.fillCircle(0, 0, ovalRX * 0.25)
  galaxy.fillStyle(accent, 0.5)
  galaxy.fillEllipse(0, 0, ovalRX * 1.4, ovalRY * 1.4)
  galaxy.x = cx
  galaxy.y = cy
  galaxy.rotation = rng() * Math.PI * 2
  galaxy.scale = 0
  sprite.add(galaxy)
  scene.tweens.add({
    targets: galaxy,
    scale: 1,
    rotation: galaxy.rotation + Math.PI,
    duration: 500 + rng() * 200,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: galaxy,
        alpha: 0,
        scale: 1.5,
        duration: 350,
        ease: 'Cubic.easeOut',
        onComplete: () => galaxy.destroy(),
      })
    },
  })
}
