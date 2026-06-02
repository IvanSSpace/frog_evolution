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

const EVO_DURATION_MS = 24 * 60 * 60 * 1000 // эволюция ~сутки
const FADE_MS = 500
const SWIM_SPEED = 42 // px/сек DVD-дрейф мини-лягушек в капсуле
const SAVE_KEY = 'frog_evolution_active_evo' // {level, endsAt} — переживает сессии

function fmtRemain(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}:${p(sec)}`
}

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
  private maskGfx: Phaser.GameObjects.Graphics | null = null
  private tweens: Phaser.Tweens.Tween[] = []
  private endsAt = 0 // Date.now() ms когда эволюция готова
  private countdown: Phaser.GameObjects.Text | null = null
  private checkedSave = false // проверили localStorage на восстановление

  constructor(
    scene: MainScene,
    spawner: FrogSpawner,
    buildings: BuildingsController,
  ) {
    this.scene = scene
    this.spawner = spawner
    this.buildings = buildings
    eventBus.on('evolution:start', this.onStart)
    eventBus.on('evolution:finish', this.onFinish)
    if (import.meta.env.DEV) {
      ;(
        window as unknown as { __startEvo?: (l?: number, ms?: number) => void }
      ).__startEvo = (l = 5, ms = EVO_DURATION_MS) =>
        eventBus.emit('evolution:start', { level: l, durationMs: ms })
    }
  }

  private onStart = (payload: { level: number; durationMs?: number }): void => {
    if (this.active) return
    if (useGameStore.getState().currentLocation !== 3) return
    if (!this.buildings.getEvoblockSprite()) return
    const { level } = payload
    const durationMs = payload.durationMs ?? EVO_DURATION_MS

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
    const endsAt = Date.now() + durationMs
    this.save(level, endsAt)
    this.startVisual(level, endsAt)
  }

  // ─── persist (переживает сессии: эволюция идёт ~сутки) ───
  private save(level: number, endsAt: number): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ level, endsAt }))
    } catch {
      /* ignore */
    }
  }
  private clearSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* ignore */
    }
  }
  private loadSave(): { level: number; endsAt: number } | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return null
      const o = JSON.parse(raw) as { level: number; endsAt: number }
      if (typeof o.level === 'number' && typeof o.endsAt === 'number') return o
    } catch {
      /* ignore */
    }
    return null
  }

  // Мгновенно завершить активную эволюцию (временная кнопка из модалки).
  private onFinish = (): void => {
    if (this.active) this.complete()
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

  private startVisual(level: number, endsAt: number): void {
    const sp = this.buildings.getEvoblockSprite()
    if (!sp) return
    this.active = true
    this.endsAt = endsAt
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
    // Маска-полигон: лягушки клипаются по границе капсулы — ничего не торчит
    // за evoblock_transparent2 (часть вне полигона просто не рендерится).
    const g = this.scene.add.graphics()
    g.fillStyle(0xffffff, 1)
    g.beginPath()
    g.moveTo(this.poolPoly[0].x, this.poolPoly[0].y)
    for (let i = 1; i < this.poolPoly.length; i++) {
      g.lineTo(this.poolPoly[i].x, this.poolPoly[i].y)
    }
    g.closePath()
    g.fillPath()
    g.setVisible(false)
    this.maskGfx = g
    const poolMask = g.createGeometryMask()
    for (let i = 0; i < n; i++) {
      const start = this.randomInPoly(this.poolPoly)
      const img = this.scene.add
        .image(start.x, start.y, textureKeyForLevel(level))
        .setScale(scale)
        .setDepth(baseDepth + 2 + i * 0.01)
        .setAlpha(0)
      img.setMask(poolMask)
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

    // Обратный отсчёт над капсулой.
    this.countdown = this.scene.add
      .text(sp.x, sp.y - sp.displayHeight - 6, '', {
        fontFamily: "'Russo One', system-ui, sans-serif",
        fontSize: '26px',
        color: '#a7f3d0',
      })
      .setOrigin(0.5, 1)
      .setDepth(baseDepth + 4)
      .setStroke('#0a2e1a', 6)
    // Завершение — по истечении endsAt (проверяется в update; переживает сессии).
  }

  // Per-frame: DVD-движение лягушек + обновление отсчёта + завершение по таймеру.
  // Вызывается из MainScene на loc3. Также восстанавливает эволюцию из save.
  update(delta: number): void {
    if (!this.active) {
      this.tryRestore()
      return
    }
    // Истёк срок → эволюция готова.
    const remain = this.endsAt - Date.now()
    if (remain <= 0) {
      this.complete()
      return
    }
    if (this.countdown) this.countdown.setText(fmtRemain(remain))
    if (this.swimmers.length === 0) return
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

  // Эволюция готова: чистим сейв + визуал. TODO: реестр анлоков (открыть
  // уникальную механику по виду/уровню эволюционировавшей лягушки).
  private complete(): void {
    this.clearSave()
    this.teardown()
  }

  // Восстановление активной эволюции при заходе на Loc3 (переживает сессии).
  private tryRestore(): void {
    if (this.checkedSave) return
    if (useGameStore.getState().currentLocation !== 3) return
    const sp = this.buildings.getEvoblockSprite()
    if (!sp) return // здания ещё не показаны — попробуем в след. кадре
    this.checkedSave = true
    const s = this.loadSave()
    if (!s) return
    if (Date.now() >= s.endsAt) {
      // успела завершиться пока был away → готово.
      this.clearSave()
      return
    }
    this.startVisual(s.level, s.endsAt)
  }

  private teardown(): void {
    for (const tw of this.tweens) tw.remove()
    this.tweens = []
    for (const s of this.swimmers) {
      this.scene.tweens.killTweensOf(s)
      s.clearMask(true)
      s.destroy()
    }
    this.swimmers = []
    if (this.maskGfx) {
      this.maskGfx.destroy()
      this.maskGfx = null
    }
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
    if (this.countdown) {
      this.countdown.destroy()
      this.countdown = null
    }
    this.active = false
  }

  // Смена локации: визуал чистим, но СЕЙВ оставляем — эволюция идёт оффлайн.
  // На возврате tryRestore() поднимет её заново (checkedSave сброшен).
  reset(): void {
    this.teardown()
    this.checkedSave = false
  }

  destroy(): void {
    eventBus.off('evolution:start', this.onStart)
    eventBus.off('evolution:finish', this.onFinish)
    this.teardown()
  }
}
