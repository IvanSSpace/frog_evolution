// Phase 20-02: extracted из StarMapScene.ts (case 29).
// DNA helix — две точки переплетаются по синусоиде друг с другом.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compDNAHelix(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const ang = rng() * Math.PI * 2
  const len = sys.size * (3 + rng())
  const dur = 700 + rng() * 200
  const turns = 1.5 + rng() * 1
  const c1 = pickColor(rng, sys)
  const c2 = pickColor(rng, sys)
  const dot1 = scene.add.circle(0, 0, (2 + rng()) * DPR, c1, 1)
  const dot2 = scene.add.circle(0, 0, (2 + rng()) * DPR, c2, 1)
  sprite.add(dot1)
  sprite.add(dot2)
  const startTime = scene.time.now
  const update = () => {
    if (!dot1.active) {
      scene.events.off('update', update)
      return
    }
    const t = (scene.time.now - startTime) / dur
    if (t >= 1) {
      dot1.destroy()
      dot2.destroy()
      scene.events.off('update', update)
      return
    }
    const along = -len / 2 + len * t
    const wave = Math.sin(t * Math.PI * 2 * turns) * sys.size * 0.5
    const cosA = Math.cos(ang),
      sinA = Math.sin(ang)
    // dot1
    dot1.x = along * cosA - wave * sinA
    dot1.y = along * sinA + wave * cosA
    // dot2 — anti-phase
    dot2.x = along * cosA - -wave * sinA
    dot2.y = along * sinA + -wave * cosA
    const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
    dot1.alpha = fade
    dot2.alpha = fade
  }
  scene.events.on('update', update)
}
