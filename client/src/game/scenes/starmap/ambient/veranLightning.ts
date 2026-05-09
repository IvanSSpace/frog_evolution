// Phase 20-03 (Wave 3): VERAN race lightning effect extracted from StarMapScene.ts.
// Случайные молнии вокруг планеты VERAN — каждые 4.5 секунды с шансом 0.55 на flash,
// плюс ещё с шансом 0.4 второй flash через 120ms.

import type Phaser from 'phaser'
import type { Race } from '../types'
import { DPR } from '../../../effects/anim/shared/sharedHelpers'

export function setupVeranLightning(scene: Phaser.Scene, races: Race[]): void {
  const veran = races.find((r) => r.id === 'veran')
  if (!veran) return
  const flash = () => {
    const lightning = scene.add.graphics()
    lightning.lineStyle(2 * DPR, 0xc4b5fd, 1)
    const numBolts = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < numBolts; i++) {
      const ang = Math.random() * Math.PI * 2
      let x = Math.cos(ang) * (veran.size + 6 * DPR)
      let y = Math.sin(ang) * (veran.size + 6 * DPR)
      lightning.beginPath()
      lightning.moveTo(x, y)
      for (let j = 0; j < 4; j++) {
        x += Math.cos(ang) * 8 * DPR + (Math.random() - 0.5) * 6 * DPR
        y += Math.sin(ang) * 8 * DPR + (Math.random() - 0.5) * 6 * DPR
        lightning.lineTo(x, y)
      }
      lightning.strokePath()
    }
    lightning.x = veran.x
    lightning.y = veran.y
    lightning.setDepth(12)
    scene.tweens.add({
      targets: lightning,
      alpha: 0,
      duration: 250,
      onComplete: () => lightning.destroy(),
    })
  }
  scene.time.addEvent({
    delay: 4500,
    loop: true,
    callback: () => {
      if (Math.random() < 0.55) {
        flash()
        if (Math.random() < 0.4) scene.time.delayedCall(120, flash)
      }
    },
  })
}
