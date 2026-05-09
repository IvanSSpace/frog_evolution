// Phase 20-02: extracted из StarMapScene.ts (case 38).
// Crackle discharge — короткие электрические разряды по поверхности.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compCrackleDischarge(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const sparks = 6 + Math.floor(rng() * 5)
  for (let i = 0; i < sparks; i++) {
    const delay = Math.floor(rng() * 250)
    scene.time.delayedCall(delay, () => {
      if (!sprite.active) return
      const ang = rng() * Math.PI * 2
      const r1 = sys.size * (0.7 + rng() * 0.2)
      const r2 = sys.size * (1.0 + rng() * 0.3)
      const startA = ang
      const endA = ang + (rng() - 0.5) * 0.5
      const arc = scene.add.graphics()
      const color = pickColor(rng, sys)
      arc.lineStyle((1 + rng()) * DPR, color, 1)
      // Зигзаг из 2 сегментов
      const midR = (r1 + r2) / 2
      const midA = (startA + endA) / 2 + (rng() - 0.5) * 0.3
      arc.lineBetween(
        Math.cos(startA) * r1,
        Math.sin(startA) * r1,
        Math.cos(midA) * midR,
        Math.sin(midA) * midR,
      )
      arc.lineBetween(
        Math.cos(midA) * midR,
        Math.sin(midA) * midR,
        Math.cos(endA) * r2,
        Math.sin(endA) * r2,
      )
      sprite.add(arc)
      scene.tweens.add({
        targets: arc,
        alpha: 0,
        duration: 200 + rng() * 150,
        onComplete: () => arc.destroy(),
      })
    })
  }
}
