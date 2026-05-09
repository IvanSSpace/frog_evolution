// Phase 20-02: extracted из StarMapScene.ts (case 85).
// Clock gears — sound-style: clockwork-tick (часовой ход).
// 2 концентрические шестерни с зубцами вращаются.
import type Phaser from 'phaser'
import { DPR } from './sharedHelpers'
import type { AnimSys } from './types'

export function compClockGears(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  for (let g = 0; g < 2; g++) {
    const gear = scene.add.graphics()
    const color = g === 0 ? sys.color : sys.accent
    const teeth = 8 + g * 4
    const r = sys.size * (1.0 + g * 0.3)
    gear.lineStyle(1.5 * DPR, color, 0.85)
    gear.beginPath()
    for (let i = 0; i <= teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2
      const rr = i % 2 === 0 ? r : r * 0.92
      const x = Math.cos(a) * rr
      const y = Math.sin(a) * rr
      if (i === 0) gear.moveTo(x, y)
      else gear.lineTo(x, y)
    }
    gear.strokePath()
    sprite.add(gear)
    const direction = g === 0 ? 1 : -1
    scene.tweens.add({
      targets: gear,
      rotation: (direction * Math.PI) / 4,
      alpha: 0,
      scale: 1.15,
      duration: 700 + rng() * 200,
      ease: 'Cubic.easeOut',
      onComplete: () => gear.destroy(),
    })
  }
}
