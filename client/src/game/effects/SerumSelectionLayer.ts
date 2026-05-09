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
  graphics: Phaser.GameObjects.Graphics
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

  /** Показать halos под eligible frogs. color — hex number (0xRRGGBB) элемента сыворотки. */
  show(eligibleFrogs: ReadonlyArray<FrogLike>, color = 0x4ade80): void {
    this.hide()
    for (const f of eligibleFrogs) {
      const g = this.scene.add.graphics()

      // Внутренняя мягкая заливка
      g.fillStyle(color, 0.2)
      g.fillEllipse(0, OVAL_Y, OVAL_RX * 2, OVAL_RY * 2)

      // Контур овала
      g.lineStyle(4.5, color, 0.9)
      g.strokeEllipse(0, OVAL_Y, OVAL_RX * 2, OVAL_RY * 2)

      g.setDepth(-1)
      f.container.addAt(g, 0)

      // Тихий pulse — narrow alpha range, не мерцает
      const tw = this.scene.tweens.add({
        targets: g,
        alpha: { from: 0.8, to: 1.0 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
      this.halos.set(f.id, { frogId: f.id, graphics: g, tween: tw })
    }
  }

  /** Скрыть все halos: kill tweens + destroy graphics. */
  hide(): void {
    for (const [, entry] of this.halos) {
      if (entry.tween) {
        this.scene.tweens.remove(entry.tween)
      }
      entry.graphics.destroy()
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
