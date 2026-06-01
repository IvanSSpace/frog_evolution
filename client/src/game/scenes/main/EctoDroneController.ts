// EctoDroneController: дрон loc2 (drone_loc2.png).
//
// Пока что — ПРОСТО ЛЕТАЕТ по полю (патрулирует случайными точками). Сбор
// эктоплазмы добавим следующим шагом. Размер — как у дронов loc1.
//
// Public API: tick() (на loc2), reset(), destroy().

import Phaser from 'phaser'
import type { MainScene } from '../MainScene'
import { useGameStore } from '../../../store/gameStore'
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
const ECTO_PER_POOP = 1 // эктоплазма за одну собранную слизь
const SUCK_MS = 2000 // длительность всасывания слизи
const HOVER_OFF = 46 * DPR // дрон зависает выше-правее слизи (пушка 45° вниз-влево)

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

  private nearestPoop(): Phaser.GameObjects.Image | null {
    const sp = this.sprite
    if (!sp) return null
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
    return best
  }

  private wanderStep(): void {
    const sp = this.sprite
    if (!sp || !sp.active) return
    // Есть фиолетовая слизь → летим зависать НАД ней (пушка 45° вниз-влево);
    // иначе — случайная точка патруля.
    const poop = this.nearestPoop()
    // Зависаем над слизью с БЛИЖНЕЙ стороны (меньше лёта).
    let target: Phaser.Math.Vector2
    if (poop) {
      const onLeft = sp.x < poop.x // дрон слева от слизи → заходим слева
      target = new Phaser.Math.Vector2(
        poop.x + (onLeft ? -HOVER_OFF : HOVER_OFF),
        poop.y - HOVER_OFF,
      )
    } else {
      target = this.randomFieldPoint()
    }
    // В полёте разворот по направлению движения (как при патруле).
    // Арт смотрит вправо по умолчанию → flipX при движении ВПРАВО.
    if (Math.abs(target.x - sp.x) > 2) sp.setFlipX(target.x > sp.x)
    const dist = Phaser.Math.Distance.Between(sp.x, sp.y, target.x, target.y)
    const tw = this.scene.tweens.add({
      targets: sp,
      x: target.x,
      y: target.y,
      duration: Math.max(poop ? 250 : 500, (dist / FLY_SPEED) * 1000),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (poop && poop.active) {
          this.suck(poop, () => this.wanderStep())
        } else {
          this.scene.time.delayedCall(Phaser.Math.Between(200, 700), () =>
            this.wanderStep(),
          )
        }
      },
    })
    this.tweens.push(tw)
  }

  // Всасывание ~2с: слизь тянется к пушке дрона (низ-влево), уменьшаясь и
  // подрагивая; дрон чуть отдаёт. По завершении — +эктоплазма.
  private suck(poop: Phaser.GameObjects.Image, onDone: () => void): void {
    const sp = this.sprite
    if (!sp) {
      onDone()
      return
    }
    // забираем из общего списка сразу (чтобы др. логика не трогала)
    this.scene.ectoPoops = this.scene.ectoPoops.filter((p) => p !== poop)
    this.scene.tweens.killTweensOf(poop)
    // Сторона слизи относительно дрона → смотрит на неё, пушка тянет в её сторону.
    const slimeLeft = poop.x < sp.x
    sp.setFlipX(!slimeLeft) // арт смотрит вправо по умолчанию → flip когда слизь слева
    const cannonX = sp.x + (slimeLeft ? -8 : 8) * DPR
    const cannonY = sp.y + sp.displayHeight * 0.46
    const suckTw = this.scene.tweens.add({
      targets: poop,
      x: cannonX,
      y: cannonY,
      scale: 0.12,
      duration: SUCK_MS,
      ease: 'Sine.easeIn',
      onComplete: () => {
        poop.destroy()
        useGameStore.getState().addEctoplasm(ECTO_PER_POOP)
        onDone()
      },
    })
    // дрожь слизи во время всасывания
    const shakeTw = this.scene.tweens.add({
      targets: poop,
      angle: 14,
      duration: 130,
      yoyo: true,
      repeat: Math.floor(SUCK_MS / 260),
      ease: 'Sine.easeInOut',
    })
    // лёгкая отдача дрона
    const recoilTw = this.scene.tweens.add({
      targets: sp,
      scaleX: sp.scaleX * 1.05,
      scaleY: sp.scaleY * 0.95,
      duration: 180,
      yoyo: true,
      repeat: Math.floor(SUCK_MS / 360),
      ease: 'Sine.easeInOut',
    })
    this.tweens.push(suckTw, shakeTw, recoilTw)
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
