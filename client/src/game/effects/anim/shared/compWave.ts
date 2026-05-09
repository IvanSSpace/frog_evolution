// Phase 20-02: extracted из StarMapScene.ts (case 8).
// Wave — ассимметричное эллиптическое расширение (rng: aspect, color, scale).
import type Phaser from 'phaser'
import { DPR, pickColor, pickEase } from './sharedHelpers'
import type { AnimSys } from './types'

export function compWave(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const wave = scene.add.graphics()
  const color = pickColor(rng, sys)
  const aspectX = 0.7 + rng() * 0.7 // 0.7-1.4 — сжатый или растянутый
  const aspectY = 0.7 + rng() * 0.7
  const angle = rng() * 360
  const dur = 500 + rng() * 350
  const maxScale = 2.2 + rng() * 1.5
  wave.lineStyle((2 + rng() * 2) * DPR, color, 0.6 + rng() * 0.4)
  wave.strokeEllipse(0, 0, sys.size * 2.2 * aspectX, sys.size * 2.2 * aspectY)
  wave.angle = angle
  sprite.add(wave)
  scene.tweens.add({
    targets: wave,
    scaleX: maxScale,
    scaleY: maxScale,
    alpha: 0,
    duration: dur,
    ease: pickEase(rng),
    onComplete: () => wave.destroy(),
  })
}
