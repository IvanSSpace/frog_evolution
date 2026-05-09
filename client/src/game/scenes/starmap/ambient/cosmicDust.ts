// Phase 20-03 (Wave 3): cosmic dust ambient effect extracted from StarMapScene.ts.
// Pure function, no `this`. Принимает scene + worldSize/seed + register callback
// для регистрации объектов в cullableData (приватное поле сцены).

import type Phaser from 'phaser'
import { mulberry32 } from '../helpers'
import { DPR } from '../../../effects/anim/shared/sharedHelpers'

export interface CullableRegister {
  (
    obj: Phaser.GameObjects.GameObject & {
      visible: boolean
      setVisible: (v: boolean) => unknown
    },
    x: number,
    y: number,
    r: number,
  ): void
}

// Создаёт 50 частиц космической пыли с tween-движением, регистрирует их
// в cullable-списке через register-callback. Снижено со 140 для производительности.
export function setupCosmicDust(
  scene: Phaser.Scene,
  opts: { worldSize: number; seed: number; register: CullableRegister },
): void {
  const { worldSize, seed, register } = opts
  const dustRng = mulberry32(seed + 3)
  // Космическая пыль — каждая частица tween. Снижено с 140.
  for (let i = 0; i < 50; i++) {
    const startX = (dustRng() - 0.5) * worldSize * 2
    const startY = (dustRng() - 0.5) * worldSize * 2
    const dx = (dustRng() - 0.5) * 200 * DPR
    const dy = (dustRng() - 0.5) * 200 * DPR
    const alpha = 0.2 + dustRng() * 0.4
    const color = [0xa5f3fc, 0xfde047, 0xc4b5fd, 0xfecaca][
      Math.floor(dustRng() * 4)
    ]
    const dust = scene.add.circle(
      startX,
      startY,
      (0.8 + dustRng() * 1.2) * DPR,
      color,
      alpha,
    )
    dust.setDepth(-50)
    scene.tweens.add({
      targets: dust,
      x: startX + dx,
      y: startY + dy,
      duration: 18000 + dustRng() * 18000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    // Радиус culling-сферы должен охватывать tween-движение
    register(dust, startX, startY, 300 * DPR)
  }
}
