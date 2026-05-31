// EctoDroneController: дрон loc2 (drone_loc2.png).
//
// Пока что — ПРОСТО ЛЕТАЕТ по полю (патрулирует случайными точками). Сбор
// эктоплазмы добавим следующим шагом. Размер — как у дронов loc1.
//
// Public API: tick() (на loc2), reset(), destroy().

import Phaser from 'phaser'
import type { MainScene } from '../MainScene'
import {
  BOX_DISPLAY_SIZE,
  DPR,
  FIELD_PAD_X,
  FIELD_PAD_Y,
  FIELD_PAD_Y_BOTTOM,
} from './types'

const DRONE_PX = BOX_DISPLAY_SIZE * 0.95 // экранный размер (как дроны loc1)
const FLY_SPEED = 90 * DPR // px/сек
const DRONE_DEPTH = 96000 // поверх лягушек, как дроны loc1

export class EctoDroneController {
  private scene: MainScene
  private sprite: Phaser.GameObjects.Image | null = null
  private wandering = false
  private tweens: Phaser.Tweens.Tween[] = []

  constructor(scene: MainScene) {
    this.scene = scene
  }

  private randomFieldPoint(): Phaser.Math.Vector2 {
    const { width, height } = this.scene.scale
    return new Phaser.Math.Vector2(
      Phaser.Math.Between(FIELD_PAD_X + 10 * DPR, width - FIELD_PAD_X - 10 * DPR),
      Phaser.Math.Between(
        FIELD_PAD_Y + 10 * DPR,
        height - FIELD_PAD_Y_BOTTOM - 10 * DPR,
      ),
    )
  }

  private ensureSpawned(): void {
    if (this.sprite) return
    const p = this.randomFieldPoint()
    const sp = this.scene.add.image(p.x, p.y, 'drone_loc2')
    sp.setScale(DRONE_PX / sp.width)
    sp.setDepth(DRONE_DEPTH)
    this.sprite = sp
  }

  tick(): void {
    this.ensureSpawned()
    if (!this.wandering) {
      this.wandering = true
      this.wanderStep()
    }
  }

  private wanderStep(): void {
    const sp = this.sprite
    if (!sp || !sp.active) return
    const t = this.randomFieldPoint()
    sp.setFlipX(t.x < sp.x)
    const dist = Phaser.Math.Distance.Between(sp.x, sp.y, t.x, t.y)
    const tw = this.scene.tweens.add({
      targets: sp,
      x: t.x,
      y: t.y,
      duration: Math.max(500, (dist / FLY_SPEED) * 1000),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.scene.time.delayedCall(Phaser.Math.Between(200, 700), () =>
          this.wanderStep(),
        )
      },
    })
    this.tweens.push(tw)
  }

  reset(): void {
    for (const tw of this.tweens) tw.remove()
    this.tweens = []
    if (this.sprite) {
      this.scene.tweens.killTweensOf(this.sprite)
      this.sprite.destroy()
      this.sprite = null
    }
    this.wandering = false
  }

  destroy(): void {
    this.reset()
  }
}
