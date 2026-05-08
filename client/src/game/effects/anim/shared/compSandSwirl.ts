// Phase 9: extracted из StarMapScene.ts L1548-1573 (case 17).
// Sand swirl — мелкие точки кружатся как песок (для desert)
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compSandSwirl(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const N = 12 + Math.floor(rng() * 8)
  const direction = rng() < 0.5 ? 1 : -1
  const dur = 600 + rng() * 300
  const baseR = sys.size * 1.2
  const rVar = sys.size * 0.5
  for (let i = 0; i < N; i++) {
    const startAng = rng() * Math.PI * 2
    const startR = baseR + (rng() - 0.5) * rVar
    const color = pickColor(rng, sys)
    const dot = scene.add.circle(0, 0, (0.8 + rng()) * DPR, color, 0.8)
    sprite.add(dot)
    const startTime = scene.time.now
    const localDur = dur + rng() * 200
    const update = () => {
      if (!dot.active) { scene.events.off('update', update); return }
      const t = (scene.time.now - startTime) / localDur
      if (t >= 1) { dot.destroy(); scene.events.off('update', update); return }
      const r = startR * (1 + t * 0.5)
      const a = startAng + direction * t * Math.PI * 1.5
      dot.x = Math.cos(a) * r; dot.y = Math.sin(a) * r
      dot.alpha = 0.8 * (1 - t)
    }
    scene.events.on('update', update)
  }
}
