// Battle engine — пошаговый round-robin auto-chess симулятор.
//
// Frog Chess redesign (Phase 1 — пошаговое ядро):
//   - Бой идёт раундами. В каждом раунде каждый ЖИВОЙ юнит ходит ровно 1 раз.
//   - Порядок хода внутри раунда — случайный (shuffle живых на старте раунда).
//   - На своём ходу юнит:
//       1. найти ближайшего живого врага (manhattan distance)
//       2. если adjacent (dist=1) → attack (урон ЗА УДАР, без attackSpeed)
//       3. иначе → step 1 клетку в сторону врага
//   - Действия выполняются ПО ОЧЕРЕДИ (по одному), с паузой TURN_MS между
//     ними — чтобы бой читался как мультик (абилки/удары видны по одному).
//   - Урон применяется сразу (не одновременно) — пошаговая модель.
//   - Юнит умирает при HP<=0 → освобождает клетку.
//   - Бой кончается когда одна сторона полностью мертва.
//
// Phase 2+ (cover front/back, профили таргетинга, абилки, traits) — следом.

import Phaser from 'phaser'
import {
  GRID_COLS,
  GRID_ROWS,
  cellRC,
  cellIndex,
  cellDistance,
} from './battleGrid'
import type { BattleUnit, Side } from './battleUnits'
import type { WarriorClass } from '../../config/warriors'
import { DPR } from '../main/types'
import type { GridLayout } from './battleGrid'

/** Режим выбора цели по классу (Phase 2 — прикрытие front/back).
 *  - melee: бьёт только ФРОНТ-ранг врага (пока фронт жив, бэк недосягаем).
 *  - ranged: игнорит прикрытие, бьёт любого (ближайшего).
 *  - diver: целит БЭК-ранг врага (контра сквишам), игнорит прикрытие.
 *  Сам «прыжок» ассасина = абилка (Phase 3); пока diver просто идёт в бэк. */
type TargetMode = 'melee' | 'ranged' | 'diver'

function targetModeForClass(cls: WarriorClass): TargetMode {
  switch (cls) {
    case 'tank':
    case 'carry':
    case 'swarm':
      return 'melee'
    case 'mage':
    case 'support':
      return 'ranged'
    case 'assassin':
      return 'diver'
  }
}

/** Пауза между ходами отдельных юнитов (мультик-темп). */
export const TURN_MS = 480
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
  private isRunning = false
  /** Очередь хода текущего раунда (живые юниты в случайном порядке). */
  private roundQueue: BattleUnit[] = []
  /** Номер раунда (для будущих абилок с кулдауном в раундах). */
  private roundNum = 0
  /** Таймер следующего хода — храним чтобы stop() его отменил. */
  private turnTimer: Phaser.Time.TimerEvent | null = null
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
    this.startRound()
  }

  stop(): void {
    this.isRunning = false
    if (this.turnTimer) {
      this.turnTimer.remove(false)
      this.turnTimer = null
    }
  }

  private allUnits(): BattleUnit[] {
    return [...this.playerUnits, ...this.enemyUnits]
  }

  private enemies(side: Side): BattleUnit[] {
    return side === 'player' ? this.enemyUnits : this.playerUnits
  }

  /** Начать новый раунд: собрать живых, перемешать, запустить очередь ходов. */
  private startRound(): void {
    if (!this.isRunning) return
    if (this.checkBattleEnd()) return
    this.roundNum += 1
    const living = this.allUnits().filter((u) => u.alive)
    // Случайный порядок инициативы (Fisher–Yates).
    for (let i = living.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[living[i], living[j]] = [living[j], living[i]]
    }
    this.roundQueue = living
    this.processNextTurn()
  }

  /** Обработать ход следующего юнита из очереди раунда. */
  private processNextTurn(): void {
    if (!this.isRunning) return

    // Очередь раунда пуста → следующий раунд.
    if (this.roundQueue.length === 0) {
      this.startRound()
      return
    }

    const unit = this.roundQueue.shift()!
    // Юнит мог умереть в этом раунде до своего хода — пропускаем без паузы.
    if (!unit.alive) {
      this.processNextTurn()
      return
    }

    const target = this.selectTarget(unit)
    if (!target) {
      // Врагов не осталось — бой окончен.
      this.checkBattleEnd()
      return
    }

    const dist = cellDistance(unit.cellIdx, target.cellIdx)
    if (dist === 1) {
      // Attack — урон за удар (без attackSpeed). Броня митигирует.
      this.attackAnim(unit, target)
      const dealt = unit.damage * (100 / (100 + Math.max(0, target.armor)))
      target.hp = Math.max(0, target.hp - dealt)
      this.updateHpBar(target)
      if (target.hp <= 0) {
        target.alive = false
        this.occupancy.delete(target.cellIdx)
        this.deathAnim(target)
      }
    } else {
      // Move toward target — один шаг.
      const stepIdx = this.pickStepTowards(unit, target.cellIdx)
      if (stepIdx !== null) {
        this.occupancy.delete(unit.cellIdx)
        unit.cellIdx = stepIdx
        this.occupancy.set(stepIdx, unit)
        this.moveAnim(unit, stepIdx)
      }
    }

    // Конец боя после действия?
    if (this.checkBattleEnd()) return

    // Следующий ход через паузу (читаемый темп).
    this.turnTimer = this.scene.time.delayedCall(TURN_MS, () =>
      this.processNextTurn(),
    )
  }

  /** Если одна сторона мертва — останавливает бой и зовёт onEnd. Возвращает true. */
  private checkBattleEnd(): boolean {
    const playerAlive = this.playerUnits.some((u) => u.alive)
    const enemyAlive = this.enemyUnits.some((u) => u.alive)
    if (!playerAlive || !enemyAlive) {
      this.stop()
      this.cb.onEnd(playerAlive ? 'win' : 'lose')
      return true
    }
    return false
  }

  /** Ближайший к unit'у юнит из списка (manhattan distance). */
  private nearestOf(unit: BattleUnit, pool: BattleUnit[]): BattleUnit | null {
    if (pool.length === 0) return null
    let best = pool[0]
    let bestDist = cellDistance(unit.cellIdx, best.cellIdx)
    for (let i = 1; i < pool.length; i++) {
      const d = cellDistance(unit.cellIdx, pool[i].cellIdx)
      if (d < bestDist) {
        best = pool[i]
        bestDist = d
      }
    }
    return best
  }

  /** Выбрать цель по профилю класса (Phase 2 — прикрытие front/back).
   *
   *  «Фронт-ранг» врага = ряд, ближайший к средней линии (к атакующему).
   *  «Бэк-ранг» = ряд, дальний от средней линии.
   *  - melee целит только фронт-ранг (пока он жив, бэк прикрыт).
   *  - ranged бьёт ближайшего без учёта прикрытия.
   *  - diver целит бэк-ранг (если он есть), иначе фронт. */
  private selectTarget(unit: BattleUnit): BattleUnit | null {
    const foes = this.enemies(unit.side).filter((u) => u.alive)
    if (foes.length === 0) return null

    const mode = targetModeForClass(unit.cls)
    if (mode === 'ranged') {
      return this.nearestOf(unit, foes)
    }

    // Ряды врагов. player-враги в рядах 0..2, enemy-враги (= игрок) в 4..6.
    // Средняя линия = ряд 3. Фронт = ряд ближе к 3, бэк = дальше от 3.
    const foeRows = foes.map((f) => cellRC(f.cellIdx).row)
    const foeIsAboveMidline = unit.side === 'player' // враги игрока сверху (0..2)
    // Фронт-ряд: для верхних врагов max(row); для нижних min(row).
    const frontRow = foeIsAboveMidline
      ? Math.max(...foeRows)
      : Math.min(...foeRows)
    // Бэк-ряд: противоположный.
    const backRow = foeIsAboveMidline
      ? Math.min(...foeRows)
      : Math.max(...foeRows)

    if (mode === 'diver') {
      const back = foes.filter((f) => cellRC(f.cellIdx).row === backRow)
      return this.nearestOf(unit, back.length > 0 ? back : foes)
    }

    // melee — только фронт-ранг.
    const front = foes.filter((f) => cellRC(f.cellIdx).row === frontRow)
    return this.nearestOf(unit, front.length > 0 ? front : foes)
  }

  /** Выбрать соседнюю клетку (dist=1) ближе всего к target'у.
   *  Возвращает null если ни одна свободная клетка не приближает —
   *  предотвращает «топтание на месте» когда путь заблокирован союзниками. */
  private pickStepTowards(unit: BattleUnit, targetIdx: number): number | null {
    const currentDist = cellDistance(unit.cellIdx, targetIdx)
    const { row, col } = cellRC(unit.cellIdx)
    const candidates: number[] = []
    if (row > 0) candidates.push(cellIndex(row - 1, col))
    if (row < GRID_ROWS - 1) candidates.push(cellIndex(row + 1, col))
    if (col > 0) candidates.push(cellIndex(row, col - 1))
    if (col < GRID_COLS - 1) candidates.push(cellIndex(row, col + 1))

    const free = candidates.filter((idx) => !this.occupancy.has(idx))
    if (free.length === 0) return null

    let best = free[0]
    let bestDist = cellDistance(best, targetIdx)
    for (let i = 1; i < free.length; i++) {
      const d = cellDistance(free[i], targetIdx)
      if (d < bestDist) {
        best = free[i]
        bestDist = d
      }
    }
    // Стоим если ни одна клетка не лучше текущей.
    if (bestDist >= currentDist) return null
    return best
  }

  private moveAnim(unit: BattleUnit, newCellIdx: number): void {
    const center = this.layout.cellCenters[newCellIdx]
    if (!center) return
    const body = unit.body
    // Использует base scale из createUnit — чтобы сохранить пропорции SVG.
    const baseY = (body.getData('baseScaleY') as number) ?? 1
    this.scene.tweens.killTweensOf(body)

    this.scene.tweens.add({
      targets: body,
      scaleY: baseY * 1.2,
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
          scaleY: baseY * 0.8,
          duration: 80,
          ease: 'Power2.easeIn',
          onComplete: () => {
            if (!unit.alive) return
            this.scene.tweens.add({
              targets: body,
              scaleY: baseY,
              duration: 120,
              ease: 'Power2.easeOut',
              onComplete: () => {
                if (!unit.alive) return
                this.scene.tweens.add({
                  targets: body,
                  scaleY: baseY * 0.92,
                  duration: 600 + Math.random() * 300,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut',
                  delay: Math.random() * 500,
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
    // Squish body — мягкое сжатие относительно базового scale.
    const baseY = (unit.body.getData('baseScaleY') as number) ?? 1
    this.scene.tweens.add({
      targets: unit.body,
      scaleY: baseY * 0.88,
      duration: ATTACK_LUNGE_MS,
      yoyo: true,
      ease: 'Quad.easeOut',
    })
    // Дуга удара — рисуется line-by-line.
    this.spawnAttackArc(myCenter, targetCenter)
  }

  /** Дуга-надрез (crescent) с заострёнными концами. Рисуется line-by-line
   *  как «росчерк» от одного острия к другому, затем плавно гаснет. */
  private spawnAttackArc(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    const midX = (from.x + to.x) / 2
    const midY = (from.y + to.y) / 2
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    const baseR = Math.min(this.layout.cellW, this.layout.cellH) * 0.32

    const startAngle = -Math.PI * 0.42
    const endAngle = Math.PI * 0.42
    const totalAngle = endAngle - startAngle

    const gfx = this.scene.add.graphics()
    gfx.setPosition(midX, midY)
    gfx.setRotation(angle)
    gfx.setDepth(8)

    const tracker = { p: 0 }
    this.scene.tweens.add({
      targets: tracker,
      p: 1,
      duration: 200,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        gfx.clear()
        // Crescent shape: внешняя arc forward + внутренняя arc обратно.
        // На концах радиусы совпадают — естественный острый конец.
        const curEnd = startAngle + totalAngle * tracker.p
        const outerR = baseR + 4 * DPR
        const innerR = baseR - 4 * DPR
        gfx.fillStyle(0xffffff, 0.9)
        gfx.beginPath()
        gfx.arc(0, 0, outerR, startAngle, curEnd, false)
        gfx.arc(0, 0, innerR, curEnd, startAngle, true)
        gfx.closePath()
        gfx.fillPath()
      },
      onComplete: () => {
        this.scene.tweens.add({
          targets: gfx,
          alpha: 0,
          duration: 220,
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
