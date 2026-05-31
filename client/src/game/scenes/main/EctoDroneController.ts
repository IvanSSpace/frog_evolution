// EctoDroneController: дрон loc2, собирающий фиолетовую слизь (эктоплазму).
//
// Дрон базируется у здания (drone_loc2.png), и когда на поле появляется ecto-
// слизь (scene.ectoPoops) — летит к ближайшей, собирает (+эктоплазма, слизь
// исчезает) и возвращается на базу. Прокачка (скорость/кол-во) — позже.
//
// Public API: tick() (на loc2), reset(), destroy().

import Phaser from 'phaser'
import type { MainScene } from '../MainScene'
import { useGameStore } from '../../../store/gameStore'
import { DPR } from './types'

// Точка базы дрона у здания (xFrac, yFracZone — зона строений).
const BASE_PT: readonly [number, number] = [0.622, 0.487]
const FLY_SPEED = 420 * DPR // px/сек
const COLLECT_PAUSE = 260 // мс над слизью при сборе
const ECTO_PER_POOP = 1 // сколько эктоплазмы даёт одна слизь
const DRONE_WIDTH_FRAC = 0.16 // размер дрона (доля ширины экрана)

type DroneState = 'idle' | 'toTarget' | 'collecting' | 'toBase'

export class EctoDroneController {
  private scene: MainScene
  private sprite: Phaser.GameObjects.Image | null = null
  private state: DroneState = 'idle'
  private target: Phaser.GameObjects.Image | null = null
  private tweens: Phaser.Tweens.Tween[] = []

  constructor(scene: MainScene) {
    this.scene = scene
  }

  private base(): Phaser.Math.Vector2 {
    const { width, height } = this.scene.scale
    return new Phaser.Math.Vector2(
      BASE_PT[0] * width,
      height * (1 + BASE_PT[1]),
    )
  }

  private ensureSpawned(): void {
    if (this.sprite) return
    const b = this.base()
    const sp = this.scene.add.image(b.x, b.y, 'drone_loc2')
    const scale = (this.scene.scale.width * DRONE_WIDTH_FRAC) / sp.width
    sp.setScale(scale)
    sp.setDepth(400000) // поверх лягушек/слизи (как капсулы на переднем плане)
    this.sprite = sp
    this.state = 'idle'
  }

  tick(): void {
    this.ensureSpawned()
    if (this.state !== 'idle') return
    // Найти ближайшую живую ecto-слизь.
    const sp = this.sprite!
    let best: Phaser.GameObjects.Image | null = null
    let bestD = Infinity
    for (const p of this.scene.ectoPoops) {
      if (!p.active) continue
      const d = Phaser.Math.Distance.Between(sp.x, sp.y, p.x, p.y)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    if (!best) return
    this.target = best
    this.flyTo(best.x, best.y, () => this.collect())
    this.state = 'toTarget'
  }

  private flyTo(x: number, y: number, onDone: () => void): void {
    const sp = this.sprite
    if (!sp) return
    const dist = Phaser.Math.Distance.Between(sp.x, sp.y, x, y)
    // лёгкий наклон по направлению
    if (x < sp.x) sp.setFlipX(true)
    else sp.setFlipX(false)
    const tw = this.scene.tweens.add({
      targets: sp,
      x,
      y,
      duration: Math.max(250, (dist / FLY_SPEED) * 1000),
      ease: 'Sine.easeInOut',
      onComplete: onDone,
    })
    this.tweens.push(tw)
  }

  private collect(): void {
    this.state = 'collecting'
    const poop = this.target
    this.scene.time.delayedCall(COLLECT_PAUSE, () => {
      if (poop && poop.active) {
        // слизь «всасывается» и исчезает
        this.scene.tweens.add({
          targets: poop,
          scale: 0,
          alpha: 0,
          duration: 200,
          ease: 'Back.easeIn',
          onComplete: () => poop.destroy(),
        })
        this.scene.ectoPoops = this.scene.ectoPoops.filter((p) => p !== poop)
        useGameStore.getState().addEctoplasm(ECTO_PER_POOP)
      }
      this.target = null
      const b = this.base()
      this.flyTo(b.x, b.y, () => {
        this.state = 'idle'
      })
      this.state = 'toBase'
    })
  }

  reset(): void {
    for (const tw of this.tweens) tw.remove()
    this.tweens = []
    if (this.sprite) {
      this.scene.tweens.killTweensOf(this.sprite)
      this.sprite.destroy()
      this.sprite = null
    }
    this.target = null
    this.state = 'idle'
  }

  destroy(): void {
    this.reset()
  }
}
