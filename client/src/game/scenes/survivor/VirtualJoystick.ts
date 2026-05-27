// VirtualJoystick — floating on-demand джойстик для Survivor-арены.
//
// Тап в ЛЮБУЮ точку экрана → база появляется под пальцем, палец (thumb) тянется
// за указателем (clamped в radius). Отпустил → прячется, вектор = 0.
//
// Экранно-фиксированный (scrollFactor 0) — не уезжает с камерой, которая следит
// за героем. Возвращает нормализованный вектор движения через `direction`.

import Phaser from 'phaser'
import { DPR } from '../main/types'

const BASE_RADIUS = 52 * DPR
const THUMB_RADIUS = 26 * DPR
// Мёртвая зона: микро-дрожь пальца не двигает героя.
const DEAD_ZONE = 6 * DPR

export class VirtualJoystick {
  private base: Phaser.GameObjects.Arc
  private thumb: Phaser.GameObjects.Arc
  private active = false
  private originX = 0
  private originY = 0
  /** Нормализованный вектор движения (длина 0..1). */
  readonly dir = { x: 0, y: 0 }

  constructor(scene: Phaser.Scene) {
    this.base = scene.add
      .circle(0, 0, BASE_RADIUS, 0xffffff, 0.12)
      .setStrokeStyle(2 * DPR, 0xffffff, 0.4)
      .setScrollFactor(0)
      .setDepth(100000)
      .setVisible(false)

    this.thumb = scene.add
      .circle(0, 0, THUMB_RADIUS, 0xffffff, 0.32)
      .setStrokeStyle(2 * DPR, 0xffffff, 0.6)
      .setScrollFactor(0)
      .setDepth(100001)
      .setVisible(false)
  }

  /** pointerdown — поднять джойстик под пальцем. */
  start(x: number, y: number): void {
    this.active = true
    this.originX = x
    this.originY = y
    this.base.setPosition(x, y).setVisible(true)
    this.thumb.setPosition(x, y).setVisible(true)
    this.dir.x = 0
    this.dir.y = 0
  }

  /** pointermove — тянуть палец, пересчитать вектор. */
  move(x: number, y: number): void {
    if (!this.active) return
    let dx = x - this.originX
    let dy = y - this.originY
    const dist = Math.hypot(dx, dy)

    if (dist < DEAD_ZONE) {
      this.dir.x = 0
      this.dir.y = 0
      this.thumb.setPosition(this.originX, this.originY)
      return
    }

    // Палец clamped в радиус базы.
    const clamped = Math.min(dist, BASE_RADIUS)
    const nx = dx / dist
    const ny = dy / dist
    this.thumb.setPosition(
      this.originX + nx * clamped,
      this.originY + ny * clamped,
    )
    // Сила движения = доля от радиуса (плавный разгон у центра).
    const mag = clamped / BASE_RADIUS
    this.dir.x = nx * mag
    this.dir.y = ny * mag
  }

  /** pointerup — спрятать, остановить. */
  end(): void {
    this.active = false
    this.dir.x = 0
    this.dir.y = 0
    this.base.setVisible(false)
    this.thumb.setVisible(false)
  }

  destroy(): void {
    this.base.destroy()
    this.thumb.destroy()
  }
}
