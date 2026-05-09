// Phase 20-02: extracted из StarMapScene.ts (case 39).
// Pixel grid — N квадратиков образуют сетку и распадаются.
import type Phaser from 'phaser'
import { pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compPixelGrid(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const grid = 4 + Math.floor(rng() * 2) // 4x4 или 5x5
  const span = sys.size * 1.4
  const cell = (span * 2) / grid
  const cellSize = cell * 0.6
  const dur = 500 + rng() * 250
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      if (rng() < 0.3) continue // часть пропускаем
      const x = -span + (i + 0.5) * cell
      const y = -span + (j + 0.5) * cell
      const color = pickColor(rng, sys)
      const px = scene.add.rectangle(x, y, cellSize, cellSize, color, 0.85)
      sprite.add(px)
      scene.tweens.add({
        targets: px,
        alpha: 0,
        x: x * (1 + rng() * 0.4),
        y: y * (1 + rng() * 0.4),
        rotation: (rng() - 0.5) * Math.PI,
        duration: dur + rng() * 150,
        delay: rng() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => px.destroy(),
      })
    }
  }
}
