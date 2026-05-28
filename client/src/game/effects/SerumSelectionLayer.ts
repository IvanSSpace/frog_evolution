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
  // Отдельный child-sprite поверх лягушки (силуэт цвета архетипа). Пульсируем
  // его alpha — НЕ трогаем body tint и НЕ alpha контейнера (см. feedback_frog_container_alpha).
  flash: Phaser.GameObjects.Image
  tween: Phaser.Tweens.Tween | null
}

const HALO_COLOR_RED = 0xef4444 // red-500

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

  /** Мигание eligible-лягушек цветом архетипа сыворотки. Поверх каждой лягушки
   *  кладём child-sprite (копия текстуры тела) с setTintFill(color) — сплошной
   *  цветной силуэт — и пульсируем его alpha 0↔0.7. Ярко видно, не трогает
   *  body tint / container alpha. Идемпотентен. */
  show(eligibleFrogs: ReadonlyArray<FrogLike>, color = 0x4ade80): void {
    this.hide()
    for (const frog of eligibleFrogs) {
      const flash = this.scene.add.image(
        frog.body.x,
        frog.body.y,
        frog.body.texture.key,
      )
      flash.setOrigin(frog.body.originX, frog.body.originY)
      flash.setScale(frog.body.scaleX, frog.body.scaleY)
      flash.setTint(color).setTintMode(Phaser.TintModes.FILL) // весь силуэт = цвет архетипа
      flash.setAlpha(0)
      // Поверх тела (container.add аппендит наверх). Инпут не перехватывает.
      frog.container.add(flash)
      const tween = this.scene.tweens.add({
        targets: flash,
        alpha: 0.7,
        duration: 420,
        ease: 'Sine.easeInOut',
        repeat: -1,
        yoyo: true,
      })
      this.halos.set(frog.id, { frogId: frog.id, flash, tween })
    }
  }

  /** Скрыть всё: kill tweens + destroy flash-спрайты. */
  hide(): void {
    for (const [, entry] of this.halos) {
      if (entry.tween) {
        this.scene.tweens.remove(entry.tween)
      }
      entry.flash.destroy()
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
