// Phase 20-03 (Wave 3): RELICT race mourning particles extracted from StarMapScene.ts.
// Меланхоличный эффект — каждые 1.8 секунды частица всплывает вверх с fade.
// Object pool — переиспользуем 4 Circle вместо create/destroy каждые 1.8 сек.

import type Phaser from 'phaser'
import type { Race } from '../types'
import { DPR } from '../../../effects/anim/shared/sharedHelpers'

const POOL_SIZE = 4

export function setupRelictMourning(scene: Phaser.Scene, races: Race[]): void {
  const relict = races.find((r) => r.id === 'relict')
  if (!relict) return

  // Preallocate pool — 4 хватает (each particle живёт 3.5s, фaерится каждые 1.8s).
  const pool: Phaser.GameObjects.Arc[] = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const p = scene.add.circle(0, 0, 1.5 * DPR, 0xa5f3fc, 0.7)
    p.setDepth(11)
    p.setVisible(false)
    pool.push(p)
  }
  let poolIdx = 0

  scene.time.addEvent({
    delay: 1800,
    loop: true,
    callback: () => {
      const p = pool[poolIdx]
      poolIdx = (poolIdx + 1) % POOL_SIZE
      // Reset state — в pool возвращается после fade=0
      const startX = relict.x + (Math.random() - 0.5) * relict.size
      const startY = relict.y + relict.size * 0.3
      p.setPosition(startX, startY)
      p.setAlpha(0.7)
      p.setVisible(true)
      // Kill any in-flight tween на этом объекте (если pool wrap слишком быстрый)
      scene.tweens.killTweensOf(p)
      scene.tweens.add({
        targets: p,
        y: relict.y - (60 + Math.random() * 30) * DPR,
        x: startX + (Math.random() - 0.5) * 20 * DPR,
        alpha: 0,
        duration: 3500,
        ease: 'Sine.easeOut',
        onComplete: () => p.setVisible(false),
      })
    },
  })
}
