// EvolutionCenterController: центр эволюции (Loc3, evoblock-капсула).
//
// Эволюция (любого уровня, с любой локации) → лягушка списывается, в капсуле
// запускается визуал: слой evoblockActive (зад) → N мини-лягушек плавают в
// полигоне → evoblock_transparent2 (стекло-перёд). Кол-во по группе уровня:
// L1-6 → 6, L7-12 → 3, L13-18 → 1. По таймеру — эволюция готова (v1: визуал;
// реестр анлоков уникальных механик — следующим шагом).
//
// Триггер: eventBus 'evolution:start' {level} (из EvolutionModal). Public API:
// reset(), destroy().

import Phaser from 'phaser'
import type { MainScene } from '../MainScene'
import type { FrogSpawner } from './FrogSpawner'
import type { BuildingsController } from './BuildingsController'
import { useGameStore } from '../../../store/gameStore'
import { eventBus } from '../../../store/eventBus'
import { textureKeyForLevel } from '../../config/frogs'
import { BASE_SCALE } from './types'

const EVO_DURATION_MS = 15000 // тест-таймер эволюции (балансим позже)
const FADE_MS = 500
const SWIM_SPEED = 42 // px/сек DVD-дрейф мини-лягушек в капсуле

// Полигон, в котором плавают лягушки внутри капсулы (xFrac, yFracZone).
type Pt = readonly [number, number]
const POOL_POLY: readonly Pt[] = [
  [0.318, 0.789],
  [0.331, 0.74],
  [0.495, 0.694],
  [0.663, 0.735],
  [0.667, 0.79],
  [0.536, 0.837],
  [0.466, 0.843],
  [0.31, 0.793],
]

// Сколько мини-лягушек плавает по группе уровня эволюционирующей лягушки.
function swimmerCount(level: number): number {
  if (level <= 6) return 6
  if (level <= 12) return 3
  return 1
}
function swimmerScale(n: number): number {
  return n >= 6 ? 0.4 : n >= 3 ? 0.55 : 0.75
}

export class EvolutionCenterController {
  private scene: MainScene
  private spawner: FrogSpawner
  private buildings: BuildingsController
  private active = false
  private back: Phaser.GameObjects.Image | null = null
  private front: Phaser.GameObjects.Image | null = null
  private swimmers: Phaser.GameObjects.Image[] = []
  private poolPoly: Phaser.Math.Vector2[] = []
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
    eventBus.on('evolution:start', this.onStart)
    if (import.meta.env.DEV) {
      ;(window as unknown as { __startEvo?: (l?: number) => void }).__startEvo =
        (l = 5) => eventBus.emit('evolution:start', { level: l })
    }
  }

  private onStart = ({ level }: { level: number }): void => {
    if (this.active) return
    if (useGameStore.getState().currentLocation !== 3) return
    if (!this.buildings.getEvoblockSprite()) return

    // Списываем 1 лягушку: видимую на поле Loc3 (если есть) либо из стора.
    let consumed = false
    for (const f of this.scene.frogs) {
      if (f.level === level && !f.isDragging && !f.isMerging && !f.isAttracted) {
        useGameStore.getState().removeFrogFromLocation(3, level)
        this.spawner.removeFrog(f)
        consumed = true
        break
      }
    }
    if (!consumed) {
      const loc = this.findOwnedLoc(level)
      if (loc == null) return
      useGameStore.getState().removeFrogFromLocation(loc, level)
    }
    this.startVisual(level)
  }

  private findOwnedLoc(level: number): number | null {
    const lf = useGameStore.getState().locationFrogs
    for (let i = 0; i < lf.length; i++) {
      if ((lf[i] ?? []).includes(level)) return i + 1
    }
    return null
  }

  private worldPt(p: Pt): Phaser.Math.Vector2 {
    const { width, height } = this.scene.scale
    return new Phaser.Math.Vector2(p[0] * width, height * (1 + p[1]))
  }

  private startVisual(level: number): void {
    const sp = this.buildings.getEvoblockSprite()
    if (!sp) return
    this.active = true
    const baseDepth = sp.depth // evoblock building depth (300000+)

    // Зад (активная текстура) поверх idle-блока.
    this.back = this.scene.add
      .image(sp.x, sp.y, 'bld3_evoblock_back')
      .setOrigin(sp.originX, sp.originY)
      .setScale(sp.scaleX, sp.scaleY)
      .setDepth(baseDepth + 1)
      .setAlpha(0)
    this.tweens.push(
      this.scene.tweens.add({
        targets: this.back,
        alpha: 1,
        duration: FADE_MS,
      }),
    )

    // N мини-лягушек в полигоне (между задом и стеклом). Двигаются DVD-стилем:
    // постоянная скорость + отскок от границ + медленное вращение (см. update).
    const n = swimmerCount(level)
    const scale = BASE_SCALE * swimmerScale(n)
    this.poolPoly = POOL_POLY.map((p) => this.worldPt(p))
    for (let i = 0; i < n; i++) {
      const start = this.randomInPoly(this.poolPoly)
      const img = this.scene.add
        .image(start.x, start.y, textureKeyForLevel(level))
        .setScale(scale)
        .setDepth(baseDepth + 2 + i * 0.01)
        .setAlpha(0)
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const speed = SWIM_SPEED * Phaser.Math.FloatBetween(0.8, 1.2)
      img.setData('vx', Math.cos(ang) * speed)
      img.setData('vy', Math.sin(ang) * speed)
      this.swimmers.push(img)
      this.tweens.push(
        this.scene.tweens.add({ targets: img, alpha: 1, duration: FADE_MS }),
        // медленное вращение (tumble), направление случайно.
        this.scene.tweens.add({
          targets: img,
          angle: Math.random() < 0.5 ? 360 : -360,
          duration: Phaser.Math.Between(4000, 7000),
          repeat: -1,
        }),
      )
    }

    // Стекло-перёд поверх лягушек.
    this.front = this.scene.add
      .image(sp.x, sp.y, 'bld3_evoblock_front')
      .setOrigin(sp.originX, sp.originY)
      .setScale(sp.scaleX, sp.scaleY)
      .setDepth(baseDepth + 3)
      .setAlpha(0)
    this.tweens.push(
      this.scene.tweens.add({
        targets: this.front,
        alpha: 1,
        duration: FADE_MS,
      }),
    )

    this.timer = this.scene.time.delayedCall(EVO_DURATION_MS, () =>
      this.complete(),
    )
  }

  // Per-frame: DVD-движение лягушек — постоянная скорость, отскок от границ
  // полигона. Вызывается из MainScene на loc3.
  update(delta: number): void {
    if (!this.active || this.swimmers.length === 0) return
    const dt = Math.min(delta, 50) / 1000
    const poly = this.poolPoly
    for (const img of this.swimmers) {
      if (!img.active) continue
      let vx = (img.getData('vx') as number) || 0
      let vy = (img.getData('vy') as number) || 0
      const nx = img.x + vx * dt
      const ny = img.y + vy * dt
      if (this.pointInPoly(nx, ny, poly)) {
        img.x = nx
        img.y = ny
      } else if (this.pointInPoly(img.x + vx * dt, img.y, poly)) {
        // вертикальная граница → отражаем vy
        img.x += vx * dt
        vy = -vy
        img.setData('vy', vy)
      } else if (this.pointInPoly(img.x, img.y + vy * dt, poly)) {
        // горизонтальная граница → отражаем vx
        img.y += vy * dt
        vx = -vx
        img.setData('vx', vx)
      } else {
        // угол → разворот
        img.setData('vx', -vx)
        img.setData('vy', -vy)
      }
    }
  }

  private randomInPoly(poly: Phaser.Math.Vector2[]): Phaser.Math.Vector2 {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity
    for (const p of poly) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    for (let i = 0; i < 24; i++) {
      const x = Phaser.Math.Between(minX, maxX)
      const y = Phaser.Math.Between(minY, maxY)
      if (this.pointInPoly(x, y, poly)) return new Phaser.Math.Vector2(x, y)
    }
    return new Phaser.Math.Vector2((minX + maxX) / 2, (minY + maxY) / 2)
  }

  private pointInPoly(
    x: number,
    y: number,
    poly: Phaser.Math.Vector2[],
  ): boolean {
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x,
        yi = poly[i].y,
        xj = poly[j].x,
        yj = poly[j].y
      const intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  private complete(): void {
    // TODO: реестр анлоков — открыть уникальную механику по виду/уровню.
    this.teardown()
  }

  private teardown(): void {
    for (const tw of this.tweens) tw.remove()
    this.tweens = []
    if (this.timer) {
      this.timer.remove()
      this.timer = null
    }
    for (const s of this.swimmers) {
      this.scene.tweens.killTweensOf(s)
      s.destroy()
    }
    this.swimmers = []
    if (this.back) {
      this.scene.tweens.killTweensOf(this.back)
      this.back.destroy()
      this.back = null
    }
    if (this.front) {
      this.scene.tweens.killTweensOf(this.front)
      this.front.destroy()
      this.front = null
    }
    this.active = false
  }

  // Смена локации: эволюция отменяется (лягушка уже списана — v1 теряется;
  // re-add можно добавить позже). Чистим визуал.
  reset(): void {
    this.teardown()
  }

  destroy(): void {
    eventBus.off('evolution:start', this.onStart)
    this.teardown()
  }
}
