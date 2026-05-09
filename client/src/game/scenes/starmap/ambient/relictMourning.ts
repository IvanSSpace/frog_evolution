// Phase 20-03 (Wave 3): RELICT race mourning particles extracted from StarMapScene.ts.
// Меланхоличный эффект — каждые 1.8 секунды частица всплывает вверх с fade.

import type Phaser from 'phaser'
import type { Race } from '../types'
import { DPR } from '../../../effects/anim/shared/sharedHelpers'

export function setupRelictMourning(scene: Phaser.Scene, races: Race[]): void {
  const relict = races.find((r) => r.id === 'relict')
  if (!relict) return
  scene.time.addEvent({
    delay: 1800,
    loop: true,
    callback: () => {
      const particle = scene.add.circle(
        relict.x + (Math.random() - 0.5) * relict.size,
        relict.y + relict.size * 0.3,
        1.5 * DPR,
        0xa5f3fc,
        0.7,
      )
      particle.setDepth(11)
      scene.tweens.add({
        targets: particle,
        y: relict.y - (60 + Math.random() * 30) * DPR,
        x: particle.x + (Math.random() - 0.5) * 20 * DPR,
        alpha: 0,
        duration: 3500,
        ease: 'Sine.easeOut',
        onComplete: () => particle.destroy(),
      })
    },
  })
}
