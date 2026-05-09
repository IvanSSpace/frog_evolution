// Phase 20-02: extracted из StarMapScene.ts (case 54).
// Atom shells — 3 концентрические орбиты с точками.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compAtomShells(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const shells = 3
  const dur = 700 + rng() * 250
  for (let s = 0; s < shells; s++) {
    const r = sys.size * (1.0 + s * 0.4)
    const dotsOnShell = 3 + s
    const direction = s % 2 === 0 ? 1 : -1
    const baseAng = rng() * Math.PI * 2
    const color = pickColor(rng, sys)
    // Орбита-кольцо
    const ring = scene.add.graphics()
    ring.lineStyle(0.5 * DPR, color, 0.4)
    ring.strokeCircle(0, 0, r)
    sprite.add(ring)
    scene.tweens.add({
      targets: ring,
      alpha: 0,
      duration: dur,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    })
    // Точки на орбите
    for (let i = 0; i < dotsOnShell; i++) {
      const phase = (i / dotsOnShell) * Math.PI * 2
      const dot = scene.add.circle(0, 0, (1.5 + rng()) * DPR, color, 1)
      sprite.add(dot)
      const startTime = scene.time.now
      const update = () => {
        if (!dot.active) {
          scene.events.off('update', update)
          return
        }
        const t = (scene.time.now - startTime) / dur
        if (t >= 1) {
          dot.destroy()
          scene.events.off('update', update)
          return
        }
        const a = baseAng + phase + direction * t * Math.PI * 2
        dot.x = Math.cos(a) * r
        dot.y = Math.sin(a) * r
        dot.alpha = 1 - t * 0.6
      }
      scene.events.on('update', update)
    }
  }
}
