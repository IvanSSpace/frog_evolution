// Phase 20-02: extracted из StarMapScene.ts (case 55).
// Supernova — яркая вспышка → ударная волна → разлёт следов (dead, plasma, destroyed).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compSupernova(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const color = pickColor(rng, sys)
  // Этап 1: яркое ядро
  const core = scene.add.circle(0, 0, sys.size * 0.6, 0xffffff, 1)
  sprite.add(core)
  scene.tweens.add({
    targets: core,
    scale: 2.5,
    alpha: 0,
    duration: 250,
    ease: 'Cubic.easeOut',
    onComplete: () => core.destroy(),
  })
  // Этап 2: ударная волна (после короткой задержки)
  scene.time.delayedCall(120, () => {
    if (!sprite.active) return
    const shock = scene.add.graphics()
    shock.lineStyle(3 * DPR, color, 0.9)
    shock.strokeCircle(0, 0, sys.size * 1.0)
    sprite.add(shock)
    scene.tweens.add({
      targets: shock,
      scaleX: 3.5,
      scaleY: 3.5,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => shock.destroy(),
    })
  })
  // Этап 3: разлёт следов (искр)
  const N = 10 + Math.floor(rng() * 6)
  for (let i = 0; i < N; i++) {
    const ang = rng() * Math.PI * 2
    const dist = sys.size * (2.5 + rng())
    const tint = pickColor(rng, sys)
    const trail = scene.add.circle(0, 0, (1.5 + rng()) * DPR, tint, 1)
    sprite.add(trail)
    scene.tweens.add({
      targets: trail,
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist,
      alpha: 0,
      scale: 0.3,
      duration: 700 + rng() * 200,
      ease: 'Cubic.easeOut',
      delay: 80 + rng() * 100,
      onComplete: () => trail.destroy(),
    })
  }
}
