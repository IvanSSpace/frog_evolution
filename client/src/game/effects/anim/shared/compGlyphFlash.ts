// Phase 20-02: extracted из StarMapScene.ts (case 62).
// Glyph flash — стилизованная руна на момент (ancient, mystic, crystal_bio).
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compGlyphFlash(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const glyph = scene.add.graphics()
  const color = pickColor(rng, sys)
  const accent = pickColor(rng, sys)
  const r = sys.size * 0.85
  const shape = Math.floor(rng() * 3) // 0=triangle, 1=square, 2=hexagon
  glyph.lineStyle(2 * DPR, color, 0.95)
  if (shape === 0) {
    // Triangle с внутренней деталью
    glyph.beginPath()
    for (let i = 0; i <= 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r
      if (i === 0) glyph.moveTo(x, y)
      else glyph.lineTo(x, y)
    }
    glyph.strokePath()
    // внутренний треугольник вверх ногами
    glyph.lineStyle(1 * DPR, accent, 0.8)
    glyph.beginPath()
    for (let i = 0; i <= 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2
      const x = Math.cos(a) * r * 0.5,
        y = Math.sin(a) * r * 0.5
      if (i === 0) glyph.moveTo(x, y)
      else glyph.lineTo(x, y)
    }
    glyph.strokePath()
  } else if (shape === 1) {
    glyph.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4)
    glyph.lineStyle(1 * DPR, accent, 0.8)
    glyph.lineBetween(-r * 0.7, 0, r * 0.7, 0)
    glyph.lineBetween(0, -r * 0.7, 0, r * 0.7)
  } else {
    glyph.beginPath()
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r
      if (i === 0) glyph.moveTo(x, y)
      else glyph.lineTo(x, y)
    }
    glyph.strokePath()
    // центральная точка
    glyph.fillStyle(accent, 0.9)
    glyph.fillCircle(0, 0, r * 0.18)
  }
  glyph.rotation = rng() * Math.PI * 2
  glyph.scale = 0.3
  glyph.alpha = 0
  sprite.add(glyph)
  scene.tweens.add({
    targets: glyph,
    scale: 1,
    alpha: 1,
    duration: 200,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: glyph,
        scale: 1.4,
        alpha: 0,
        duration: 350 + rng() * 200,
        ease: 'Cubic.easeIn',
        onComplete: () => glyph.destroy(),
      })
    },
  })
}
