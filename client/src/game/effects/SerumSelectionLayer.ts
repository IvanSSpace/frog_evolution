// Phase 14: визуальный layer для tap-to-select serum flow.
// Управляет:
//  - зелёные halo вокруг eligible frogs (pulse, repeat -1)
//  - one-shot red flash вокруг ineligible frogs (mis-tap, ~220ms)
//  - cleanup всего на hide() / dispose() (REQ INFRA-06)
//
// НЕ subscribed на store — MainScene вызывает методы явно (pure visual API).
// Не используем compHaloFlash из Phase 9 — он принимает AnimSys и designed для
// StarMap planet effects (one-shot, не pulse). Standalone Graphics эффективнее.

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

const HALO_COLOR_GREEN = 0x4ade80   // emerald-400 (matches forest tint)
const HALO_COLOR_RED = 0xef4444     // red-500
const HALO_RADIUS = 38               // px @ DPR=1; масштаб через container.scale

export class SerumSelectionLayer {
  private scene: Phaser.Scene
  private halos = new Map<string, HaloEntry>()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Показать halos над eligible frogs. Сначала hide() previous (idempotent). */
  show(eligibleFrogs: ReadonlyArray<FrogLike>): void {
    this.hide()
    for (const f of eligibleFrogs) {
      const g = this.scene.add.graphics()
      g.lineStyle(3, HALO_COLOR_GREEN, 0.9)
      g.strokeCircle(0, 0, HALO_RADIUS)
      // Background slight fill
      g.fillStyle(HALO_COLOR_GREEN, 0.15)
      g.fillCircle(0, 0, HALO_RADIUS)
      // depth -1 относительно body (body at depth 0 inside container).
      g.setDepth(-1)
      f.container.add(g)
      // Pulse: scale 1.0 ↔ 1.15, 800ms cycle (yoyo, repeat infinite).
      const tw = this.scene.tweens.add({
        targets: g,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 800,
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

  /** One-shot red flash на frog (mis-tap feedback, ~220ms self-cleaning). */
  flashRed(frog: FrogLike): void {
    const g = this.scene.add.graphics()
    g.lineStyle(4, HALO_COLOR_RED, 1)
    g.strokeCircle(0, 0, HALO_RADIUS)
    g.setDepth(-1)
    frog.container.add(g)
    // Quick scale pulse + fade, then destroy.
    this.scene.tweens.add({
      targets: g,
      scaleX: 1.3,
      scaleY: 1.3,
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
