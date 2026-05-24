// Battle engine — простой tick-based auto-chess симулятор.
//
// Этап 3c MVP:
//   - global tick каждые TICK_MS (300ms по умолчанию)
//   - в каждом тике каждый живой юнит делает 1 действие:
//       1. найти ближайшего живого врага (manhattan distance)
//       2. если adjacent (dist=1) → attack
//       3. иначе → step 1 клетку в сторону врага (если занято — попробовать альтернативу)
//   - все действия применяются после расчёта (одновременность)
//   - юнит умирает при HP<=0 → освобождает клетку
//   - бой заканчивается когда одна сторона полностью мертва
//
// Range > 1 (mage / support) — добавим в следующей итерации. Пока все melee.

import Phaser from 'phaser'
import {
  GRID_COLS,
  GRID_ROWS,
  cellRC,
  cellIndex,
  cellDistance,
} from './battleGrid'
import type { BattleUnit, Side } from './battleUnits'
import { DPR } from '../main/types'
import type { GridLayout } from './battleGrid'

export const TICK_MS = 600
const MOVE_TWEEN_MS = 260
const ATTACK_LUNGE_FRACTION = 0.14
const ATTACK_LUNGE_MS = 110

export type BattleResult = 'win' | 'lose'

export interface BattleEngineCallbacks {
  /** Вызывается когда битва завершена (одна сторона полностью мертва). */
  onEnd: (result: BattleResult) => void
}

export class BattleEngine {
  private scene: Phaser.Scene
  private layout: GridLayout
  private playerUnits: BattleUnit[]
  private enemyUnits: BattleUnit[]
  private cb: BattleEngineCallbacks
  private tickEvent: Phaser.Time.TimerEvent | null = null
  private isRunning = false
  /** Занятость клеток: cellIdx → unit. Обновляется при каждом move/death. */
  private occupancy: Map<number, BattleUnit> = new Map()

  constructor(
    scene: Phaser.Scene,
    layout: GridLayout,
    playerUnits: BattleUnit[],
    enemyUnits: BattleUnit[],
    cb: BattleEngineCallbacks,
  ) {
    this.scene = scene
    this.layout = layout
    this.playerUnits = playerUnits
    this.enemyUnits = enemyUnits
    this.cb = cb
    // Инициализируем occupancy
    for (const u of [...playerUnits, ...enemyUnits]) {
      this.occupancy.set(u.cellIdx, u)
    }
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.tickEvent = this.scene.time.addEvent({
      delay: TICK_MS,
      loop: true,
      callback: () => this.tick(),
    })
  }

  stop(): void {
    this.isRunning = false
    if (this.tickEvent) {
      this.tickEvent.remove(false)
      this.tickEvent = null
    }
  }

  private allUnits(): BattleUnit[] {
    return [...this.playerUnits, ...this.enemyUnits]
  }

  private enemies(side: Side): BattleUnit[] {
    return side === 'player' ? this.enemyUnits : this.playerUnits
  }

  /** Ближайший живой враг по manhattan distance. */
  private findNearestEnemy(unit: BattleUnit): BattleUnit | null {
    const foes = this.enemies(unit.side).filter((u) => u.alive)
    if (foes.length === 0) return null
    let best = foes[0]
    let bestDist = cellDistance(unit.cellIdx, best.cellIdx)
    for (let i = 1; i < foes.length; i++) {
      const d = cellDistance(unit.cellIdx, foes[i].cellIdx)
      if (d < bestDist) {
        best = foes[i]
        bestDist = d
      }
    }
    return best
  }

  /** Выбрать соседнюю клетку (dist=1) ближе всего к target'у. */
  private pickStepTowards(unit: BattleUnit, targetIdx: number): number | null {
    const { row, col } = cellRC(unit.cellIdx)
    const candidates: number[] = []
    // 4-directional movement
    if (row > 0) candidates.push(cellIndex(row - 1, col))
    if (row < GRID_ROWS - 1) candidates.push(cellIndex(row + 1, col))
    if (col > 0) candidates.push(cellIndex(row, col - 1))
    if (col < GRID_COLS - 1) candidates.push(cellIndex(row, col + 1))

    // Фильтруем по occupancy (нельзя на клетку с союзником/врагом)
    const free = candidates.filter((idx) => !this.occupancy.has(idx))
    if (free.length === 0) return null

    // Берём клетку с минимальным расстоянием до target
    let best = free[0]
    let bestDist = cellDistance(best, targetIdx)
    for (let i = 1; i < free.length; i++) {
      const d = cellDistance(free[i], targetIdx)
      if (d < bestDist) {
        best = free[i]
        bestDist = d
      }
    }
    return best
  }

  private tick(): void {
    if (!this.isRunning) return

    // Снимем pending damages, чтобы применить одновременно после расчёта.
    const pendingDamage: Map<BattleUnit, number> = new Map()
    // Лучше processим в случайном порядке чтобы не было всегда player first.
    const units = this.allUnits().filter((u) => u.alive)
    units.sort(() => Math.random() - 0.5)

    for (const unit of units) {
      if (!unit.alive) continue
      const target = this.findNearestEnemy(unit)
      if (!target) continue
      const dist = cellDistance(unit.cellIdx, target.cellIdx)
      if (dist === 1) {
        // Attack — за tick наносим (damage * attackSpeed * TICK_MS / 1000)
        const dmg = unit.damage * unit.attackSpeed * (TICK_MS / 1000)
        pendingDamage.set(target, (pendingDamage.get(target) ?? 0) + dmg)
        this.attackAnim(unit, target)
      } else {
        // Move toward target
        const stepIdx = this.pickStepTowards(unit, target.cellIdx)
        if (stepIdx !== null) {
          // Освобождаем старую, занимаем новую
          this.occupancy.delete(unit.cellIdx)
          unit.cellIdx = stepIdx
          this.occupancy.set(stepIdx, unit)
          this.moveAnim(unit, stepIdx)
        }
      }
    }

    // Применяем damage одновременно
    for (const [target, dmg] of pendingDamage.entries()) {
      if (!target.alive) continue
      target.hp = Math.max(0, target.hp - dmg)
      this.updateHpBar(target)
      if (target.hp <= 0) {
        target.alive = false
        this.occupancy.delete(target.cellIdx)
        this.deathAnim(target)
      }
    }

    // Проверка конца боя
    const playerAlive = this.playerUnits.some((u) => u.alive)
    const enemyAlive = this.enemyUnits.some((u) => u.alive)
    if (!playerAlive || !enemyAlive) {
      this.stop()
      this.cb.onEnd(playerAlive ? 'win' : 'lose')
    }
  }

  private moveAnim(unit: BattleUnit, newCellIdx: number): void {
    const center = this.layout.cellCenters[newCellIdx]
    if (!center) return
    // Тот же паттерн что у живых лягушек на MainScene:
    // 1) stretch (вытянулись для прыжка) 2) переезд container 3) squish (приземлились)
    // 4) возврат к 1.0. Idle bob продолжается параллельно через delay.
    const body = unit.body
    this.scene.tweens.killTweensOf(body)

    this.scene.tweens.add({
      targets: body,
      scaleY: 1.2,
      duration: 120,
      ease: 'Power2.easeOut',
    })
    this.scene.tweens.add({
      targets: unit.container,
      x: center.x,
      y: center.y,
      duration: MOVE_TWEEN_MS,
      ease: 'Power2.easeOut',
      onComplete: () => {
        if (!unit.alive) return
        this.scene.tweens.add({
          targets: body,
          scaleY: 0.8,
          duration: 80,
          ease: 'Power2.easeIn',
          onComplete: () => {
            if (!unit.alive) return
            this.scene.tweens.add({
              targets: body,
              scaleY: 1.0,
              duration: 120,
              ease: 'Power2.easeOut',
              onComplete: () => {
                if (!unit.alive) return
                // Возобновляем idle bob
                this.scene.tweens.add({
                  targets: body,
                  scaleY: 0.92,
                  duration: 700,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut',
                })
              },
            })
          },
        })
      },
    })
  }

  private attackAnim(unit: BattleUnit, target: BattleUnit): void {
    const targetCenter = this.layout.cellCenters[target.cellIdx]
    const myCenter = this.layout.cellCenters[unit.cellIdx]
    if (!targetCenter || !myCenter) return
    // Микро-рывок в сторону врага — юнит не выходит из клетки.
    const dx = (targetCenter.x - myCenter.x) * ATTACK_LUNGE_FRACTION
    const dy = (targetCenter.y - myCenter.y) * ATTACK_LUNGE_FRACTION
    this.scene.tweens.add({
      targets: unit.container,
      x: myCenter.x + dx,
      y: myCenter.y + dy,
      duration: ATTACK_LUNGE_MS,
      yoyo: true,
      ease: 'Quad.easeOut',
    })
    // Squish body — мягкое сжатие как на MainScene (idle bob magnitude).
    this.scene.tweens.add({
      targets: unit.body,
      scaleY: 0.88,
      duration: ATTACK_LUNGE_MS,
      yoyo: true,
      ease: 'Quad.easeOut',
    })
    // Дуга удара — рисуется line-by-line.
    this.spawnAttackArc(myCenter, targetCenter)
  }

  /** Анимированная дуга удара между атакующим и целью — рисуется как
   *  «росчерк» от одного конца к другому, затем плавно гаснет. */
  private spawnAttackArc(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    const midX = (from.x + to.x) / 2
    const midY = (from.y + to.y) / 2
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    const radius = Math.min(this.layout.cellW, this.layout.cellH) * 0.35

    const startAngle = -Math.PI * 0.4
    const endAngle = Math.PI * 0.4

    const gfx = this.scene.add.graphics()
    gfx.setPosition(midX, midY)
    gfx.setRotation(angle)
    gfx.setDepth(8)

    const tracker = { p: 0 }
    this.scene.tweens.add({
      targets: tracker,
      p: 1,
      duration: 180,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        gfx.clear()
        gfx.lineStyle(3 * DPR, 0xffffff, 1)
        gfx.beginPath()
        gfx.arc(
          0,
          0,
          radius,
          startAngle,
          startAngle + (endAngle - startAngle) * tracker.p,
          false,
        )
        gfx.strokePath()
      },
      onComplete: () => {
        // Fade-out полностью прорисованной дуги.
        this.scene.tweens.add({
          targets: gfx,
          alpha: 0,
          duration: 200,
          ease: 'Quad.easeIn',
          onComplete: () => gfx.destroy(),
        })
      },
    })
  }

  private deathAnim(unit: BattleUnit): void {
    this.scene.tweens.add({
      targets: unit.container,
      alpha: 0,
      scale: 0.3,
      duration: 350,
      ease: 'Quad.easeIn',
      onComplete: () => {
        unit.container.destroy()
      },
    })
    // Х-метка/skull
    const center = this.layout.cellCenters[unit.cellIdx]
    if (center) {
      const skull = this.scene.add.text(center.x, center.y, '💀', {
        fontFamily: 'sans-serif',
        fontSize: `${20 * DPR}px`,
      })
      skull.setOrigin(0.5, 0.5)
      skull.setDepth(2)
      this.scene.tweens.add({
        targets: skull,
        alpha: 0,
        duration: 1200,
        delay: 400,
        onComplete: () => skull.destroy(),
      })
    }
  }

  private updateHpBar(unit: BattleUnit): void {
    const pct = Math.max(0, unit.hp / unit.maxHp)
    const fullW = (this.layout.cellW || 50) * 0.7
    unit.hpBar.scaleX = pct
    unit.hpBar.width = fullW
  }
}
