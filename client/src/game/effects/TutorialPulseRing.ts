// Phase 23 Plan 23-03 (Beat 2 — Tap-hint): reusable Phaser pulsing ring.
//
// Used by:
//   - Plan 23-03 BoxController — pink ring вокруг первого упавшего бокса.
//   - Plan 23-04 (future) — ring вокруг каждой из двух merge-eligible лягушек.
//
// Design notes:
//   - Container НЕ ставится `setInteractive` — без hit-area pointer events
//     проходят сквозь ring к target'у (бокс/лягушка) под ним. Это критично
//     для cliclability (memory: feedback_clickability).
//   - Pulse реализован yoyo-tween'ом alpha+scale через Phaser Container.
//     ВАЖНО: target = container (отдельный объект), а НЕ frog.container —
//     иначе alpha-tween попадёт на frog.container и вызовет «мерцание лягушки
//     прозрачностью» (memory: feedback_frog_container_alpha).
//   - Follow реализован через scene.events.on('update', ...) — каждый frame
//     ring перекладывает свои x/y на target.x/target.y. Если target destroyed
//     (box opened) → target.active=false → ring замораживается и ждёт явный
//     .destroy() от вызывающей стороны.
//
// Lifecycle:
//   new TutorialPulseRing({...})   → ring появляется + начинает pulse + follow
//   ring.worldPosition             → текущие x/y (для DOM-overlay anchor'а)
//   ring.destroy(fadeMs?)          → fade-out tween + cleanup. Idempotent.

import Phaser from 'phaser'

export interface TutorialPulseRingTarget {
  x: number
  y: number
  active: boolean
}

export interface TutorialPulseRingOptions {
  scene: Phaser.Scene
  /** Любой GameObject (или подобный объект) с .x/.y/.active. Ring трекает его. */
  target: TutorialPulseRingTarget
  /** Радиус кольца (CSS px включая DPR). */
  radius: number
  /** Stroke color (default 0xec4899 — pink-500). */
  color?: number
  /** Stroke width в px (default 3). */
  strokeWidth?: number
  /** Полупериод pulse — alpha+scale up; yoyo обратно за столько же (default 800ms). */
  duration?: number
  /** Максимальный scale в пике pulse (default 1.15). */
  maxScale?: number
  /** Render depth (default 5000 — выше боксов/лягушек, ниже UI overlay'ев). */
  depth?: number
}

export class TutorialPulseRing {
  private readonly scene: Phaser.Scene
  private readonly target: TutorialPulseRingTarget
  private container: Phaser.GameObjects.Container
  private tween: Phaser.Tweens.Tween
  private updateHandler: () => void
  private destroyed = false

  constructor(opts: TutorialPulseRingOptions) {
    this.scene = opts.scene
    this.target = opts.target

    const color = opts.color ?? 0xec4899
    const stroke = opts.strokeWidth ?? 3
    const duration = opts.duration ?? 800
    const maxScale = opts.maxScale ?? 1.15
    const depth = opts.depth ?? 5000
    // Defensive: cap radius в [4, 120] CSS px — иначе при некорректном
    // displayWidth target'а ring может перекрыть весь viewport.
    // 120 px = достаточно для большого frog/box visual'но не overflow'ит.
    const safeRadius = Math.max(4, Math.min(opts.radius, 120))

    const ring = this.scene.add.graphics()
    ring.lineStyle(stroke, color, 1)
    ring.strokeCircle(0, 0, safeRadius)

    this.container = this.scene.add.container(this.target.x, this.target.y, [
      ring,
    ])
    this.container.setDepth(depth)
    this.container.setAlpha(0.4)
    // NB: container.setSize/setInteractive НЕ вызываем — без hit-area pointer
    // events проходят сквозь ring к target'у под ним (cliclability).

    this.tween = this.scene.tweens.add({
      targets: this.container,
      alpha: { from: 0.4, to: 0.9 },
      scale: { from: 1.0, to: maxScale },
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Follow target each frame — пока target жив.
    this.updateHandler = () => {
      if (this.destroyed) return
      if (!this.target.active) return
      this.container.x = this.target.x
      this.container.y = this.target.y
    }
    this.scene.events.on('update', this.updateHandler)
  }

  /** Текущие world-coords (для DOM-anchor'а под рингом). */
  get worldPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y }
  }

  /**
   * Fade-out + cleanup. Idempotent — повторный вызов no-op.
   * @param fadeMs — длительность fade-tween'а перед destroy (default 300ms).
   */
  destroy(fadeMs = 300): void {
    if (this.destroyed) return
    this.destroyed = true

    this.tween.stop()
    this.scene.events.off('update', this.updateHandler)

    // Если scene уничтожается прямо сейчас — destroy сразу без tween'а.
    if (!this.scene || !this.scene.tweens) {
      this.container.destroy()
      return
    }

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scale: 1.2,
      duration: fadeMs,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.container.destroy()
      },
    })
  }
}
