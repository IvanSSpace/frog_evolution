// Phase 20-02: extracted из StarMapScene.ts (case 93).
// Life bloom — sound-style: organic-grow (растущие лозы).
// 4-6 vine-линий тянутся из центра наружу через сегменты, в конце — точка-цветок.
import type Phaser from 'phaser'
import { DPR, pickColor } from './sharedHelpers'
import type { AnimSys } from './types'

export function compLifeBloom(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  sys: AnimSys,
  rng: () => number,
): void {
  const vines = 4 + Math.floor(rng() * 3) // 4..6
  const segs = 6
  const segStep = 60
  const flowers: Phaser.GameObjects.Arc[] = []
  for (let v = 0; v < vines; v++) {
    const baseAng = (v / vines) * Math.PI * 2 + (rng() - 0.5) * 0.4
    const color = pickColor(rng, sys)
    const vine = scene.add.graphics()
    vine.lineStyle(1.5 * DPR, color, 0.9)
    sprite.add(vine)
    // Узлы Bezier-like вдоль extending пути
    const ctrlAng = baseAng + (rng() - 0.5) * 0.6
    const endR = sys.size * 0.85
    const ctrlR = sys.size * 0.55
    const endX = Math.cos(baseAng) * endR
    const endY = Math.sin(baseAng) * endR
    const ctrlX = Math.cos(ctrlAng) * ctrlR
    const ctrlY = Math.sin(ctrlAng) * ctrlR
    let prevX = 0,
      prevY = 0
    for (let s = 1; s <= segs; s++) {
      const t = s / segs
      const u = 1 - t
      const nx = u * u * 0 + 2 * u * t * ctrlX + t * t * endX
      const ny = u * u * 0 + 2 * u * t * ctrlY + t * t * endY
      const px = prevX,
        py = prevY
      const nxC = nx,
        nyC = ny
      scene.time.delayedCall(s * segStep + v * 30, () => {
        if (!vine.active) return
        vine.lineBetween(px, py, nxC, nyC)
      })
      prevX = nx
      prevY = ny
    }
    // Цветок на конце
    scene.time.delayedCall(segs * segStep + v * 30 + 80, () => {
      if (!sprite.active) return
      const flower = scene.add.circle(endX, endY, DPR * 1.5, color, 1)
      sprite.add(flower)
      flowers.push(flower)
      scene.tweens.add({
        targets: flower,
        scale: 2,
        alpha: 0,
        duration: 300,
        ease: 'Sine.easeOut',
        onComplete: () => flower.destroy(),
      })
    })
    // Финальный fade + destroy ветки
    scene.tweens.add({
      targets: vine,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      delay: 800,
      onComplete: () => vine.destroy(),
    })
  }
}
