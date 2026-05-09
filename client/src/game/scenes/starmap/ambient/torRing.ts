// Phase 20-03 (Wave 3): TOR race ring extracted from StarMapScene.ts.
// Двойное вращающееся кольцо вокруг планеты TOR.

import type Phaser from 'phaser'
import type { Race } from '../types'
import { DPR } from '../../../effects/anim/shared/sharedHelpers'

export function setupTorRing(
  scene: Phaser.Scene,
  races: Race[],
  systemSprites: Map<string, Phaser.GameObjects.Container>,
): void {
  const tor = races.find((r) => r.id === 'tor')
  if (!tor) return
  const container = systemSprites.get('tor')
  if (!container) return
  const ring = scene.add.graphics()
  ring.lineStyle(2 * DPR, 0xfca5a5, 0.6)
  ring.strokeCircle(0, 0, tor.size + 18 * DPR)
  ring.lineStyle(1 * DPR, 0xfca5a5, 0.3)
  ring.strokeCircle(0, 0, tor.size + 24 * DPR)
  ring.setDepth(5)
  container.add(ring)
  scene.tweens.add({
    targets: ring,
    angle: 360,
    duration: 18000,
    repeat: -1,
    ease: 'Linear',
  })
}
