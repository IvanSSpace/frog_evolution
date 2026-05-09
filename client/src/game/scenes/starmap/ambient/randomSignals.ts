// Phase 20-03 (Wave 3): random signal pulses на главных расах extracted from
// StarMapScene.ts. Каждые 6 секунд случайная раса (кроме home/relict) шлёт
// тройной кольцевой сигнал + 📡 emoji-метку.

import type Phaser from 'phaser'
import type { Race } from '../types'
import { DPR } from '../../../effects/anim/shared/sharedHelpers'

export function setupRandomSignals(scene: Phaser.Scene, races: Race[]): void {
  const interactive = races.filter((r) => r.id !== 'home' && r.id !== 'relict')
  const signal = () => {
    const race = interactive[Math.floor(Math.random() * interactive.length)]
    for (let i = 0; i < 3; i++) {
      scene.time.delayedCall(i * 200, () => {
        const ring = scene.add.graphics()
        ring.lineStyle(2 * DPR, race.color, 0.7)
        ring.strokeCircle(0, 0, race.size + 10 * DPR)
        ring.x = race.x
        ring.y = race.y
        ring.setDepth(15)
        scene.tweens.add({
          targets: ring,
          scale: 2.4,
          alpha: 0,
          duration: 1400,
          ease: 'Quad.easeOut',
          onComplete: () => ring.destroy(),
        })
      })
    }
    const tag = scene.add.text(race.x, race.y - race.size - 18 * DPR, '📡', {
      fontSize: 16 * DPR,
    })
    tag.setOrigin(0.5)
    tag.setDepth(70)
    scene.tweens.add({
      targets: tag,
      y: race.y - race.size - 36 * DPR,
      alpha: { from: 1, to: 0 },
      duration: 1500,
      onComplete: () => tag.destroy(),
    })
  }
  scene.time.addEvent({
    delay: 6000,
    loop: true,
    callback: () => {
      signal()
      if (Math.random() < 0.25) scene.time.delayedCall(800, signal)
    },
  })
}
