// Phase 23 Plan 23-04 (Beat 3 — Merge demo): ghost-frog drag-trail animation.
//
// Used by:
//   - OnboardingController (Beat 3) — анимирует «как мерджить»: prozrachnaya
//     копия frog'а движется по дугообразной траектории от source к target,
//     иссекает в burst'е по прибытии, пауза, loop. Повтор N раз пока player
//     либо реально не мерджит, либо 8с auto-fade.
//
// Design notes:
//   - Ghost — ОТДЕЛЬНЫЙ Phaser.GameObjects.Image (clone via textureKey + tint).
//     НИКОГДА не tween'им alpha/scale на frog.container оригинальной лягушки
//     (memory: feedback_frog_container_alpha — иначе «мерцание лягушки»).
//   - Curve — Phaser.Curves.QuadraticBezier с control point подвинутым ВВЕРХ
//     (mid.y минус 50px), чтобы создать ощутимую дугу даже для близких frogs.
//   - Каждый loop пересоздаёт ghost image: цикл = spawn → tween 1200ms по curve
//     → burst (scale+alpha) 300ms → destroy → pause 800ms → следующий loop.
//   - НЕ ставится .setInteractive — pointer events проходят сквозь к настоящим
//     frogs под ghost'ом (memory: feedback_clickability).
//
// Lifecycle:
//   new GhostFrogTrail({...})  → spawn + start loop sequence
//   trail.destroy()            → graceful stop: kill tween, fade-out ghost, no
//                                more loops. Idempotent — повторный no-op.

import Phaser from 'phaser'

export interface GhostFrogTrailOptions {
  scene: Phaser.Scene
  /** Phaser texture key для frog body sprite (e.g. 'frog_lvl_1'). */
  textureKey: string
  /** Optional tint (e.g. element color). Default — no tint. */
  tint?: number
  /** Phaser world-coord для начала трека (source frog). */
  source: { x: number; y: number }
  /** Phaser world-coord для финиша (target frog). */
  target: { x: number; y: number }
  /** Длительность одного traversal source→target (default 1200ms). */
  durationMs?: number
  /** Прозрачность ghost'а в момент tween'а (default 0.5). */
  alpha?: number
  /** Pause между loops (default 800ms). */
  pauseMs?: number
  /** Количество повторов (default 3). */
  loops?: number
  /** Render depth (default 5000 — выше frogs/boxes, ниже UI overlays). */
  depth?: number
  /** Scale ghost sprite'а (default — берём 1.0, caller обычно передаёт BASE_SCALE). */
  scale?: number
  /** Callback после завершения всех loops (НЕ вызывается при destroy()). */
  onComplete?: () => void
}

export class GhostFrogTrail {
  private readonly scene: Phaser.Scene
  private readonly opts: GhostFrogTrailOptions
  private ghost: Phaser.GameObjects.Image | null = null
  private currentTween: Phaser.Tweens.Tween | null = null
  private burstTween: Phaser.Tweens.Tween | null = null
  private pauseTimer: Phaser.Time.TimerEvent | null = null
  private destroyed = false
  private loopsRemaining: number

  constructor(opts: GhostFrogTrailOptions) {
    this.opts = opts
    this.scene = opts.scene
    this.loopsRemaining = opts.loops ?? 3
    this.runOneLoop()
  }

  private runOneLoop(): void {
    if (this.destroyed) return
    if (this.loopsRemaining <= 0) {
      this.opts.onComplete?.()
      return
    }

    const { textureKey, tint, source, target } = this.opts
    const durationMs = this.opts.durationMs ?? 1200
    const alpha = this.opts.alpha ?? 0.5
    const depth = this.opts.depth ?? 5000
    const scale = this.opts.scale ?? 1

    // Arc-up curve: control point поднят на 50px ВВЕРХ от higher из двух точек
    // (в Phaser Y возрастает вниз — поэтому Math.min(source.y, target.y) даёт
    // верхнюю точку, минус 50 даёт точку ещё выше = арка вверх).
    const midX = (source.x + target.x) / 2
    const midY = Math.min(source.y, target.y) - 50
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(source.x, source.y),
      new Phaser.Math.Vector2(midX, midY),
      new Phaser.Math.Vector2(target.x, target.y),
    )

    const ghost = this.scene.add.image(source.x, source.y, textureKey)
    if (tint != null) ghost.setTint(tint)
    ghost.setAlpha(alpha)
    ghost.setDepth(depth)
    ghost.setScale(scale)
    this.ghost = ghost

    const pos = { t: 0 }
    this.currentTween = this.scene.tweens.add({
      targets: pos,
      t: 1,
      duration: durationMs,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (this.destroyed || !this.ghost) return
        const p = curve.getPoint(pos.t)
        this.ghost.x = p.x
        this.ghost.y = p.y
      },
      onComplete: () => {
        this.currentTween = null
        if (this.destroyed || !this.ghost) return
        // Burst на прибытии: масштабируем + fade-out.
        const burstTargetScale = scale * 1.3
        this.burstTween = this.scene.tweens.add({
          targets: this.ghost,
          alpha: 0,
          scale: burstTargetScale,
          duration: 300,
          ease: 'Sine.easeOut',
          onComplete: () => {
            this.burstTween = null
            this.ghost?.destroy()
            this.ghost = null
            this.loopsRemaining -= 1
            if (this.destroyed) return
            // Pause then next loop.
            this.pauseTimer = this.scene.time.delayedCall(
              this.opts.pauseMs ?? 800,
              () => {
                this.pauseTimer = null
                this.runOneLoop()
              },
            )
          },
        })
      },
    })
  }

  /**
   * Stop animation immediately, fade-out and destroy ghost. Idempotent.
   * Никакого onComplete callback'а — destroy ≠ natural completion.
   */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true

    this.currentTween?.stop()
    this.currentTween = null

    this.burstTween?.stop()
    this.burstTween = null

    this.pauseTimer?.remove(false)
    this.pauseTimer = null

    const g = this.ghost
    if (!g) return

    // Если scene уже уничтожается — destroy сразу без tween'а (нет tweens manager).
    if (!this.scene || !this.scene.tweens || !this.scene.tweens.add) {
      g.destroy()
      this.ghost = null
      return
    }

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        g.destroy()
      },
    })
    this.ghost = null
  }
}
