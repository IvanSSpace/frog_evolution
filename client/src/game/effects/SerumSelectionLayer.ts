// Phase 14: визуальный layer для tap-to-select serum flow.
// Управляет:
//  - овальная тень-подсветка под eligible frogs (тихий pulse, repeat -1)
//  - one-shot red flash вокруг ineligible frogs (mis-tap, ~220ms)
//  - cleanup всего на hide() / dispose() (REQ INFRA-06)

import Phaser from 'phaser'

export interface FrogLike {
  id: string
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Image
}

interface HaloEntry {
  frogId: string
  body: Phaser.GameObjects.Image
  tween: Phaser.Tweens.Tween | null
  // Tint тела ДО мигания (carrier/element-лягушки имеют запечённый element-tint
  // через FrogElementOverlay). Восстанавливаем на hide, чтобы не стереть его.
  prevTint: number | null
}

const HALO_COLOR_RED = 0xef4444 // red-500
const WHITE = Phaser.Display.Color.IntegerToColor(0xffffff)

// Фрог-текстура грузится как 47 * (DPR * 1.5) px высотой; BASE_SCALE = 1/1.5.
// В локальных координатах контейнера: полувысота = 47 * DPR * 1.5 / 2 ≈ 35 * DPR.
// Овал ставим чуть ниже ног.
const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))
const OVAL_RX = 52 * DPR // горизонтальный радиус
const OVAL_RY = 18 * DPR // вертикальный радиус (плоский)
const OVAL_Y = 42 * DPR // смещение вниз от центра лягушки (за ноги)

export class SerumSelectionLayer {
  private scene: Phaser.Scene
  private halos = new Map<string, HaloEntry>()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** ТЕСТ (2026-05-28): вместо halo-овала под лягушкой — мигание тела цветом
   *  сыворотки. Tint на body (НЕ alpha контейнера — даёт «мигание прозрачностью»).
   *  Пульс white↔color через tint-multiply. Идемпотентен. */
  show(eligibleFrogs: ReadonlyArray<FrogLike>, color = 0x4ade80): void {
    this.hide()
    const target = Phaser.Display.Color.IntegerToColor(color)
    for (const frog of eligibleFrogs) {
      const prevTint = frog.body.isTinted ? frog.body.tintTopLeft : null
      const proxy = { t: 0 }
      const tween = this.scene.tweens.add({
        targets: proxy,
        t: 1,
        duration: 420,
        ease: 'Sine.easeInOut',
        repeat: -1,
        yoyo: true,
        onUpdate: () => {
          const c = Phaser.Display.Color.Interpolate.ColorWithColor(
            WHITE,
            target,
            100,
            proxy.t * 100,
          )
          frog.body.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b))
        },
      })
      this.halos.set(frog.id, {
        frogId: frog.id,
        body: frog.body,
        tween,
        prevTint,
      })
    }
  }

  /** Скрыть всё: kill tweens + восстановить прежний tint тела. */
  hide(): void {
    for (const [, entry] of this.halos) {
      if (entry.tween) {
        this.scene.tweens.remove(entry.tween)
      }
      if (entry.prevTint != null) entry.body.setTint(entry.prevTint)
      else entry.body.clearTint()
    }
    this.halos.clear()
  }

  /** One-shot red flash под frog (mis-tap feedback, ~220ms self-cleaning). */
  flashRed(frog: FrogLike): void {
    const g = this.scene.add.graphics()
    g.lineStyle(3.5, HALO_COLOR_RED, 1)
    g.strokeEllipse(0, OVAL_Y, OVAL_RX * 2, OVAL_RY * 2)
    g.fillStyle(HALO_COLOR_RED, 0.2)
    g.fillEllipse(0, OVAL_Y, OVAL_RX * 2, OVAL_RY * 2)
    g.setDepth(-1)
    frog.container.add(g)
    this.scene.tweens.add({
      targets: g,
      scaleX: 1.35,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    })
  }

  /** Сколько halos сейчас активно. Dev/test introspection. */
  get activeHaloCount(): number {
    return this.halos.size
  }

  /** Full cleanup на scene shutdown. */
  dispose(): void {
    this.hide()
  }
}
