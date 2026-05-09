// Phase 20-02: extracted из StarMapScene.ts (case 94).
// Wind ribbons — sound-style: airy-whoosh (ленты ветра).
// 2-3 ленты-sin-wave проносятся через планету слева направо.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compWindRibbons(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const ribbonCount = 2 + Math.floor(rng() * 2) // 2..3
  const dur = 1100
  const ribbons: {
    gfx: Phaser.GameObjects.Graphics
    color: number
    phase: number
    amp: number
    yBase: number
    startTime: number
  }[] = []
  for (let i = 0; i < ribbonCount; i++) {
    const gfx = scene.add.graphics()
    sprite.add(gfx)
    ribbons.push({
      gfx,
      color: pickColor(rng, sys),
      phase: rng() * Math.PI * 2,
      amp: sys.size * (0.15 + rng() * 0.2),
      yBase: (rng() - 0.5) * sys.size * 0.6,
      startTime: i * 200,
    })
  }
  let elapsed = 0
  const totalLen = sys.size * 2.5
  const segs = 12
  const update = (_t: number, dt: number) => {
    elapsed += dt
    for (const r of ribbons) {
      const localT = (elapsed - r.startTime) / dur
      if (localT < 0) continue
      const xCenter = -sys.size + sys.size * 2 * localT
      // Alpha: 0 → 0.6 → 0
      const alpha =
        localT < 0.3
          ? (localT / 0.3) * 0.6
          : localT > 0.7
            ? Math.max(0, ((1 - localT) / 0.3) * 0.6)
            : 0.6
      r.gfx.clear()
      r.gfx.lineStyle(1.5 * DPR, r.color, alpha)
      for (let s = 0; s < segs; s++) {
        const t1 = s / segs
        const t2 = (s + 1) / segs
        const x1 = xCenter - totalLen / 2 + totalLen * t1
        const x2 = xCenter - totalLen / 2 + totalLen * t2
        const y1 =
          r.yBase +
          Math.sin(t1 * Math.PI * 4 + r.phase + elapsed * 0.005) * r.amp
        const y2 =
          r.yBase +
          Math.sin(t2 * Math.PI * 4 + r.phase + elapsed * 0.005) * r.amp
        r.gfx.lineBetween(x1, y1, x2, y2)
      }
    }
  }
  scene.events.on('update', update)
  scene.time.delayedCall(dur + 200, () => {
    scene.events.off('update', update)
    for (const r of ribbons) {
      if (r.gfx.active) r.gfx.destroy()
    }
  })
}
