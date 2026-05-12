// Phase 20-03 (Wave 3): random signal pulses на главных расах extracted from
// StarMapScene.ts. Каждые 6 секунд случайная раса (кроме home/relict) шлёт
// тройной кольцевой сигнал + 📡 emoji-метку.
// Object pool — 12 rings (3 per signal × 4 concurrent) + 4 tag texts.

import type Phaser from 'phaser'
import type { Race } from '../types'
import { DPR } from '../../../effects/anim/shared/sharedHelpers'

const RING_POOL_SIZE = 12 // 3 кольца × до 4 одновременных сигналов
const TAG_POOL_SIZE = 4

export function setupRandomSignals(scene: Phaser.Scene, races: Race[]): void {
  const interactive = races.filter((r) => r.id !== 'home' && r.id !== 'relict')

  // Preallocate rings — Graphics empty, перерисовываем при reuse через clear().
  const ringPool: Phaser.GameObjects.Graphics[] = []
  for (let i = 0; i < RING_POOL_SIZE; i++) {
    const g = scene.add.graphics()
    g.setDepth(15)
    g.setVisible(false)
    ringPool.push(g)
  }
  let ringIdx = 0

  // Preallocate tag texts. Style фиксированный, обновляем только x/y/alpha.
  const tagPool: Phaser.GameObjects.Text[] = []
  for (let i = 0; i < TAG_POOL_SIZE; i++) {
    const t = scene.add.text(0, 0, '📡', { fontSize: 16 * DPR })
    t.setOrigin(0.5)
    t.setDepth(70)
    t.setVisible(false)
    tagPool.push(t)
  }
  let tagIdx = 0

  const signal = () => {
    const race = interactive[Math.floor(Math.random() * interactive.length)]
    for (let i = 0; i < 3; i++) {
      scene.time.delayedCall(i * 200, () => {
        const ring = ringPool[ringIdx]
        ringIdx = (ringIdx + 1) % RING_POOL_SIZE
        scene.tweens.killTweensOf(ring)
        ring.clear()
        ring.lineStyle(2 * DPR, race.color, 0.7)
        ring.strokeCircle(0, 0, race.size + 10 * DPR)
        ring.x = race.x
        ring.y = race.y
        ring.setScale(1)
        ring.setAlpha(0.7)
        ring.setVisible(true)
        scene.tweens.add({
          targets: ring,
          scale: 2.4,
          alpha: 0,
          duration: 1400,
          ease: 'Quad.easeOut',
          onComplete: () => ring.setVisible(false),
        })
      })
    }
    const tag = tagPool[tagIdx]
    tagIdx = (tagIdx + 1) % TAG_POOL_SIZE
    scene.tweens.killTweensOf(tag)
    tag.setPosition(race.x, race.y - race.size - 18 * DPR)
    tag.setAlpha(1)
    tag.setVisible(true)
    scene.tweens.add({
      targets: tag,
      y: race.y - race.size - 36 * DPR,
      alpha: 0,
      duration: 1500,
      onComplete: () => tag.setVisible(false),
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
