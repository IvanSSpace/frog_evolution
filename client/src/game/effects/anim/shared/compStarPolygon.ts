// Phase 20-02: extracted из StarMapScene.ts (case 46).
// Star polygon — пятиконечная (или 6-) звезда расширяется.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compStarPolygon(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const points = 5 + Math.floor(rng() * 3) // 5-7
  const star = scene.add.graphics()
  const color = pickColor(rng, sys)
  const accent = pickColor(rng, sys)
  const outR = sys.size * 1.2
  const inR = outR * 0.4
  const verts: number[] = []
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? outR : inR
    verts.push(Math.cos(a) * r, Math.sin(a) * r)
  }
  star.fillStyle(color, 0.7)
  star.beginPath()
  star.moveTo(verts[0], verts[1])
  for (let i = 2; i < verts.length; i += 2) star.lineTo(verts[i], verts[i + 1])
  star.closePath()
  star.fill()
  star.lineStyle(DPR, accent, 0.85)
  star.strokePath()
  star.scale = 0.3
  sprite.add(star)
  scene.tweens.add({
    targets: star,
    scale: 1.6 + rng() * 0.5,
    alpha: 0,
    rotation: ((rng() < 0.5 ? 1 : -1) * Math.PI) / 5,
    duration: 550 + rng() * 200,
    ease: 'Cubic.easeOut',
    onComplete: () => star.destroy(),
  })
}
