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
    lodMinZoom?: number,
  ): void
}

// 15 статичных частиц пыли (раньше 50 с infinite-repeat tween'ами — убраны
// для perf). При zoom < 0.20 полностью убираются из display list через
// lodMinZoom (на дальнем zoom пыль и так не видна, размер субпиксельный).
const PARTICLE_COUNT = 15
const LOD_MIN_ZOOM = 0.2

export function setupCosmicDust(
  scene: Phaser.Scene,
  opts: { worldSize: number; seed: number; register: CullableRegister },
): void {
  const { worldSize, seed, register } = opts
  const dustRng = mulberry32(seed + 3)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const startX = (dustRng() - 0.5) * worldSize * 2
    const startY = (dustRng() - 0.5) * worldSize * 2
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
    // Без tween-анимации — статичная точка. Cull-радиус минимальный,
    // только сама точка. lodMinZoom скрывает на дальнем zoom.
    register(dust, startX, startY, 4 * DPR, LOD_MIN_ZOOM)
  }
}
