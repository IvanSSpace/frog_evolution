// EvolutionCenterController: центр эволюции (Loc3, evoblock-капсула).
//
// Тап по капсуле → берём лягушку с поля → она «помещается» внутрь, плавает и
// крутится, блок переключается на активную текстуру, идёт таймер эволюции.
// По завершении — лягушка эволюционирует (v1: просто потребляется + revert;
// анлок уникальной механики добавим следующим шагом через реестр флагов).
//
// v1: 1 слот. Камер 1-2 — расширим. Public API: ensureHitZone(), reset(), destroy().

import Phaser from 'phaser'
import type { MainScene } from '../MainScene'
import type { FrogSpawner } from './FrogSpawner'
import type { BuildingsController } from './BuildingsController'
import { useGameStore } from '../../../store/gameStore'
import { eventBus } from '../../../store/eventBus'
import type { FrogData } from './types'

const EVO_DURATION_MS = 15000 // тест-таймер эволюции (балансим позже)
const FADE_MS = 500

export class EvolutionCenterController {
  private scene: MainScene
  private spawner: FrogSpawner
  private buildings: BuildingsController
  private active = false
  private overlay: Phaser.GameObjects.Image | null = null
  private frog: FrogData | null = null
  private tweens: Phaser.Tweens.Tween[] = []
  private timer: Phaser.Time.TimerEvent | null = null

  constructor(
    scene: MainScene,
    spawner: FrogSpawner,
    buildings: BuildingsController,
  ) {
    this.scene = scene
    this.spawner = spawner
    this.buildings = buildings
    // Модалка (EvolutionModal) выбрала лягушку уровня level → начать эволюцию.
    eventBus.on('evolution:start', this.onStart)
  }

  // Старт по выбору из модалки: берём с поля свободную лягушку нужного уровня
  // (ближайшую к капсуле), помещаем в капсулу.
  private onStart = ({ level }: { level: number }): void => {
    if (this.active) return
    if (useGameStore.getState().currentLocation !== 3) return
    const sp = this.buildings.getEvoblockSprite()
    if (!sp) return
    let best: FrogData | null = null
    let bestD = Infinity
    for (const f of this.scene.frogs) {
      if (f.level !== level) continue
      if (f.isDragging || f.isMerging || f.isAttracted) continue
      const d = Phaser.Math.Distance.Between(
        f.container.x,
        f.container.y,
        sp.x,
        sp.y,
      )
      if (d < bestD) {
        bestD = d
        best = f
      }
    }
    if (!best) return // нет свободной лягушки этого уровня на поле
    this.start(best, sp)
  }

  private start(frog: FrogData, sp: Phaser.GameObjects.Image): void {
    this.active = true
    this.frog = frog
    frog.isAttracted = true
    frog.isMoving = false
    if (frog.dashTimer) {
      frog.dashTimer.remove()
      frog.dashTimer = null
    }
    this.scene.tweens.killTweensOf(frog.container)
    this.scene.tweens.killTweensOf(frog.body)
    frog.body.y = 0
    frog.body.scaleY = 1
    if (frog.body.input) frog.body.input.enabled = false

    const cx = sp.x
    const cy = sp.y - sp.displayHeight * 0.5 // центр тела капсулы
    this.showActive(sp)
    this.tweens.push(
      this.scene.tweens.add({
        targets: frog.container,
        x: cx,
        y: cy,
        duration: FADE_MS,
        ease: 'Sine.easeInOut',
        onComplete: () => this.startFloat(frog, cy),
      }),
    )
    this.timer = this.scene.time.delayedCall(EVO_DURATION_MS, () =>
      this.complete(),
    )
  }

  // Плавание в капсуле: покачивание + медленное вращение.
  private startFloat(frog: FrogData, cy: number): void {
    if (!frog.container.active) return
    this.tweens.push(
      this.scene.tweens.add({
        targets: frog.container,
        y: cy - 12,
        duration: 800,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      }),
      this.scene.tweens.add({
        targets: frog.container,
        angle: 360,
        duration: 3200,
        repeat: -1,
      }),
    )
  }

  // Переключение капсулы на активную текстуру (плавный crossfade поверх).
  private showActive(sp: Phaser.GameObjects.Image): void {
    const ov = this.scene.add
      .image(sp.x, sp.y, 'bld3_evoblock_active')
      .setOrigin(sp.originX, sp.originY)
      .setScale(sp.scaleX, sp.scaleY)
      .setDepth(sp.depth + 0.2)
      .setAlpha(0)
    this.overlay = ov
    this.scene.tweens.add({ targets: ov, alpha: 1, duration: FADE_MS })
  }

  private hideActive(): void {
    const ov = this.overlay
    if (!ov) return
    this.overlay = null
    this.scene.tweens.killTweensOf(ov)
    this.scene.tweens.add({
      targets: ov,
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => ov.destroy(),
    })
  }

  private complete(): void {
    const frog = this.frog
    this.killTweens()
    if (frog && frog.container.active) {
      // v1: лягушка эволюционировала → потребляется. TODO: реестр анлоков +
      // спавн эволюционировавшей особи / включение уникальной механики.
      useGameStore.getState().removeFrogFromLocation(3, frog.level)
      this.spawner.removeFrog(frog)
    }
    this.frog = null
    this.hideActive()
    this.active = false
  }

  private killTweens(): void {
    for (const tw of this.tweens) tw.remove()
    this.tweens = []
    if (this.timer) {
      this.timer.remove()
      this.timer = null
    }
  }

  // Сброс при смене локации: вернуть лягушку в норму, убрать FX/хит-зону.
  reset(): void {
    this.killTweens()
    const frog = this.frog
    if (frog && frog.container.active) {
      this.scene.tweens.killTweensOf(frog.container)
      frog.container.angle = 0
      frog.isAttracted = false
      if (frog.body.input) frog.body.input.enabled = true
    }
    this.frog = null
    this.active = false
    if (this.overlay) {
      this.scene.tweens.killTweensOf(this.overlay)
      this.overlay.destroy()
      this.overlay = null
    }
  }

  destroy(): void {
    eventBus.off('evolution:start', this.onStart)
    this.reset()
  }
}
