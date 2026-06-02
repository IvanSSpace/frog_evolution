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
import { textureKeyForLevel } from '../../config/frogs'
import { BASE_SCALE } from './types'
import type { FrogData } from './types'

const EVO_DURATION_MS = 15000 // тест-таймер эволюции (балансим позже)
const FADE_MS = 500

export class EvolutionCenterController {
  private scene: MainScene
  private spawner: FrogSpawner
  private buildings: BuildingsController
  private active = false
  private overlay: Phaser.GameObjects.Image | null = null
  // Что плавает в капсуле: либо реальная лягушка с поля Loc3 (frog), либо
  // временный спрайт (если лягушка списана с другой локации из стора).
  private frog: FrogData | null = null
  private tempSprite: Phaser.GameObjects.Image | null = null
  private node: Phaser.GameObjects.Container | Phaser.GameObjects.Image | null =
    null
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

  // Старт по выбору из модалки. Эволюция доступна лягушке ЛЮБОГО уровня (с
  // любой локации). Если такая лягушка видима на поле Loc3 — берём её; иначе
  // списываем 1 из стора (любая локация где есть) и показываем временный спрайт.
  private onStart = ({ level }: { level: number }): void => {
    if (this.active) return
    if (useGameStore.getState().currentLocation !== 3) return
    const sp = this.buildings.getEvoblockSprite()
    if (!sp) return
    const cx = sp.x
    const cy = sp.y - sp.displayHeight * 0.5 // центр тела капсулы

    // (1) видимая свободная лягушка этого уровня на поле Loc3 → берём её.
    let field: FrogData | null = null
    let bestD = Infinity
    for (const f of this.scene.frogs) {
      if (f.level !== level) continue
      if (f.isDragging || f.isMerging || f.isAttracted) continue
      const d = Phaser.Math.Distance.Between(f.container.x, f.container.y, sp.x, sp.y)
      if (d < bestD) {
        bestD = d
        field = f
      }
    }
    if (field) {
      useGameStore.getState().removeFrogFromLocation(3, level)
      this.beginField(field, sp, cx, cy)
      return
    }

    // (2) иначе — списываем из стора любой локации, где есть, + временный спрайт.
    const loc = this.findOwnedLoc(level)
    if (loc == null) return // не владеешь лягушкой этого уровня
    useGameStore.getState().removeFrogFromLocation(loc, level)
    this.beginTemp(level, sp, cx, cy)
  }

  // Первая локация (по индексу) у которой в сторе есть лягушка этого уровня.
  private findOwnedLoc(level: number): number | null {
    const lf = useGameStore.getState().locationFrogs
    for (let i = 0; i < lf.length; i++) {
      if ((lf[i] ?? []).includes(level)) return i + 1
    }
    return null
  }

  private beginField(
    frog: FrogData,
    sp: Phaser.GameObjects.Image,
    cx: number,
    cy: number,
  ): void {
    this.active = true
    this.frog = frog
    this.node = frog.container
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
    this.beginAnim(sp, cx, cy)
  }

  private beginTemp(
    level: number,
    sp: Phaser.GameObjects.Image,
    cx: number,
    cy: number,
  ): void {
    this.active = true
    const img = this.scene.add
      .image(cx, cy + 40, textureKeyForLevel(level))
      .setScale(BASE_SCALE)
      .setDepth(sp.depth - 0.5) // ВНУТРИ капсулы (за стеклом)
    this.tempSprite = img
    this.node = img
    this.beginAnim(sp, cx, cy)
  }

  // Общая анимация: заезд в капсулу → плавание + crossfade активной текстуры.
  private beginAnim(
    sp: Phaser.GameObjects.Image,
    cx: number,
    cy: number,
  ): void {
    const node = this.node
    if (!node) return
    this.showActive(sp)
    this.tweens.push(
      this.scene.tweens.add({
        targets: node,
        x: cx,
        y: cy,
        duration: FADE_MS,
        ease: 'Sine.easeInOut',
        onComplete: () => this.startFloat(cy),
      }),
    )
    this.timer = this.scene.time.delayedCall(EVO_DURATION_MS, () =>
      this.complete(),
    )
  }

  // Плавание в капсуле: покачивание + медленное вращение.
  private startFloat(cy: number): void {
    const node = this.node
    if (!node || !node.active) return
    this.tweens.push(
      this.scene.tweens.add({
        targets: node,
        y: cy - 12,
        duration: 800,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      }),
      this.scene.tweens.add({
        targets: node,
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
    this.killTweens()
    // v1: лягушка эволюционировала → потребляется (стор уже списан на старте).
    // TODO: реестр анлоков + включение уникальной механики по виду/уровню.
    if (this.frog && this.frog.container.active) {
      this.spawner.removeFrog(this.frog)
    }
    if (this.tempSprite) {
      this.scene.tweens.killTweensOf(this.tempSprite)
      this.tempSprite.destroy()
    }
    this.frog = null
    this.tempSprite = null
    this.node = null
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

  // Сброс при смене локации: эволюция отменяется. Вернуть лягушку в норму
  // (+ вернуть в стор, т.к. на старте списали), убрать временный спрайт/FX.
  reset(): void {
    this.killTweens()
    const frog = this.frog
    if (frog && frog.container.active) {
      this.scene.tweens.killTweensOf(frog.container)
      frog.container.angle = 0
      frog.isAttracted = false
      if (frog.body.input) frog.body.input.enabled = true
      useGameStore.getState().addFrogToLocation(3, frog.level)
    }
    if (this.tempSprite) {
      this.scene.tweens.killTweensOf(this.tempSprite)
      this.tempSprite.destroy()
    }
    this.frog = null
    this.tempSprite = null
    this.node = null
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
