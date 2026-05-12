// Phase 20-03 (Wave 3): VERAN race lightning effect extracted from StarMapScene.ts.
// Случайные молнии вокруг планеты VERAN — каждые 4.5 секунды с шансом 0.55 на flash,
// плюс ещё с шансом 0.4 второй flash через 120ms.
// Object pool — 3 Graphics переиспользуем (fade 250ms, fаерится <1/сек).

import type Phaser from 'phaser'
import type { Race } from '../types'
import { DPR } from '../../../effects/anim/shared/sharedHelpers'

const POOL_SIZE = 3

export function setupVeranLightning(scene: Phaser.Scene, races: Race[]): void {
  const veran = races.find((r) => r.id === 'veran')
  if (!veran) return

  // Preallocate pool — Graphics уже пустой; рисуем молнии при каждом flash'е через clear()+strokePath.
  const pool: Phaser.GameObjects.Graphics[] = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const g = scene.add.graphics()
    g.setDepth(12)
    g.x = veran.x
    g.y = veran.y
    g.setVisible(false)
    pool.push(g)
  }
  let poolIdx = 0

  const flash = () => {
    const lightning = pool[poolIdx]
    poolIdx = (poolIdx + 1) % POOL_SIZE
    scene.tweens.killTweensOf(lightning)
    lightning.clear()
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
    lightning.setAlpha(1)
    lightning.setVisible(true)
    scene.tweens.add({
      targets: lightning,
      alpha: 0,
      duration: 250,
      onComplete: () => lightning.setVisible(false),
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
