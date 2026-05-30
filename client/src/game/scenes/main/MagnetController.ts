// Phase 21-04 (Wave 4): Magnet controller, extracted from MainScene.ts.
//
// Owns: список активных магнитов + spawn-таймер. Магнит — эфемерный
// gameobject (text-emoji в контейнере) который тянет ближайшую пару
// одноуровневых лягушек к своей точке и мерджит их при сближении.
// На цикле выполняет N мерджей (зависит от уровня апгрейда), затем
// исчезает; либо expires по таймеру.
//
// Public API:
//   - magnets: read-only ссылка на массив (для onLocationChanged cleanup)
//   - resetSpawnTimer(): сбросить magnetSpawnMs (после transition / clearField)
//   - tick(level, delta): вызывается из MainScene.update() при условии
//     что serum-paused=false и магнит включён в локации/апгрейдах. Сам
//     решает пора ли спавнить новый магнит (если ещё нет ни одного и
//     есть валидная пара) и шевелит активные.
//   - clearAll(): destroy + очистка списка (используется при transition snap-end и
//     перед началом transition — магниты эфемерны).
//
// Coupling: ссылка на MainScene + MergeController. Использует
// scene.frogs (read для isAttracted reset), scene.tweens, scene.add,
// scene.time. Вызывает merge.findClosestSameLevelPair / merge.performMerge /
// merge.hasMergeablePair.

import Phaser from 'phaser'
import {
  getMagnetSpawnInterval,
  getMagnetDuration,
  getMagnetMergesPerCycle,
} from '../../../store/gameStore'
import { MERGE_RADIUS, BOX_DISPLAY_SIZE, DPR, type MagnetData } from './types'
import type { MainScene } from '../MainScene'
import type { MergeController } from './MergeController'

export class MagnetController {
  private scene: MainScene
  private merge: MergeController

  // Phase 21-04: магнит-state теперь живёт здесь, а не в scene-полях.
  private _magnets: MagnetData[] = []
  private spawnMs = 0

  constructor(scene: MainScene, merge: MergeController) {
    this.scene = scene
    this.merge = merge
  }

  /** Read-only ссылка для onLocationChanged (уничтожает магниты до transition). */
  get magnets(): readonly MagnetData[] {
    return this._magnets
  }

  /** Сбросить spawn-таймер — в clearField + после transition snap-end. */
  resetSpawnTimer(): void {
    this.spawnMs = 0
  }

  /**
   * Уничтожить все активные магниты немедленно (без fade-out).
   * Используется при clearField и в начале location-transition.
   */
  clearAll(): void {
    for (const m of [...this._magnets]) {
      this.scene.tweens.killTweensOf(m.emoji)
      this.scene.tweens.killTweensOf(m.container)
      m.container.destroy(true)
    }
    this._magnets = []
    // Позиция дрона невалидна между локациями — следующий спавн стартует свежо.
    this.lastDroneX = null
    this.lastDroneY = null
  }

  /**
   * Per-frame tick. Caller (MainScene.update) уже проверил что:
   *   - !isLocationTransitioning
   *   - !serumPaused
   *   - location.magnetEnabled && magnetLevel > 0 && store.magnetEnabled
   * (если эти условия не выполнены — caller вызывает resetSpawnTimer).
   */
  tick(level: number, delta: number): void {
    this.spawnMs += delta
    const spawnInt = getMagnetSpawnInterval(level)
    if (this.spawnMs >= spawnInt) {
      if (this.merge.hasMergeablePair() && this._magnets.length === 0) {
        this.spawnMagnet(level)
        this.spawnMs = 0
      } else {
        // Замираем на 100% и ждём появления пары
        this.spawnMs = spawnInt
      }
    }

    if (this._magnets.length > 0) this.updateMagnets()
  }

  private spawnMagnet(level: number) {
    const scene = this.scene
    const pair = this.merge.findClosestSameLevelPair()
    if (!pair) return

    const [a, b] = pair

    // Освобождаем пару от их текущих движений чтобы магнит чисто тянул
    for (const f of [a, b]) {
      scene.tweens.killTweensOf(f.container)
      f.isMoving = false
    }

    const x = (a.container.x + b.container.x) / 2
    const y = (a.container.y + b.container.y) / 2
    const duration = getMagnetDuration(level)

    // 2026-05-30: магнит-дрон (magnet_drone.png) — видимый, ПРИЛЕТАЕТ к паре
    // как goo_collector (наклон по ходу + flip), потом тянет/мерджит. Стартует
    // от позиции последнего дрона (непрерывный полёт) либо сверху при первом
    // спавне. Депт высокий (поверх лягушек).
    const startX = this.lastDroneX ?? x + (Math.random() < 0.5 ? -1 : 1) * 120 * DPR
    const startY = this.lastDroneY ?? y - 200 * DPR
    const container = scene.add.container(startX, startY)
    container.setDepth(99000)

    const emoji = scene.add.image(0, 0, 'magnet_drone')
    const baseScale = (BOX_DISPLAY_SIZE * 0.7) / emoji.width
    emoji.setScale(baseScale)
    container.add(emoji)
    // Лёгкое парение вверх-вниз.
    scene.tweens.add({
      targets: emoji,
      y: -4 * DPR,
      duration: 700,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })

    const magnet: MagnetData = {
      container,
      emoji,
      x,
      y,
      expiresAt: Date.now() + duration,
      pair,
      mergesDone: 0,
      mergesTarget: getMagnetMergesPerCycle(level),
      arriving: true,
    }
    this._magnets.push(magnet)
    // Полёт к паре с наклоном; по прилёте снимаем arriving → начинается тяга.
    this.flyTo(magnet, x, y, baseScale, () => {
      magnet.arriving = false
    })
  }

  // Позиция последнего дрона — новый стартует оттуда (непрерывный полёт).
  private lastDroneX: number | null = null
  private lastDroneY: number | null = null

  /** Летит контейнером к (tx,ty) с наклоном по ходу и flip спрайта. */
  private flyTo(
    m: MagnetData,
    tx: number,
    ty: number,
    baseScale: number,
    onDone?: () => void,
  ): void {
    const scene = this.scene
    const fromX = m.container.x
    const dir = tx >= fromX ? 1 : -1
    m.emoji.scaleX = dir * baseScale
    scene.tweens.killTweensOf(m.container)
    const dist = Phaser.Math.Distance.Between(fromX, m.container.y, tx, ty)
    const dur = Phaser.Math.Clamp(dist * 1.6, 220, 700)
    m.container.rotation = dir * 0.12
    scene.tweens.add({
      targets: m.container,
      x: tx,
      y: ty,
      duration: dur,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.lastDroneX = m.container.x
        this.lastDroneY = m.container.y
      },
      onComplete: () => {
        if (!m.container.active) return
        scene.tweens.add({
          targets: m.container,
          rotation: 0,
          duration: 160,
          ease: 'Back.easeOut',
        })
        onDone?.()
      },
    })
  }

  private removeMagnet(magnet: MagnetData) {
    const scene = this.scene
    this._magnets = this._magnets.filter((m) => m !== magnet)
    scene.tweens.killTweensOf(magnet.emoji)
    scene.tweens.killTweensOf(magnet.container)
    scene.tweens.add({
      targets: magnet.container,
      scale: 0,
      alpha: 0,
      duration: 180,
      ease: 'Power2.easeIn',
      onComplete: () => magnet.container.destroy(),
    })
  }

  private updateMagnets() {
    const scene = this.scene
    const now = Date.now()

    // Сбрасываем флаг притяжения — переустановим у целевой пары
    for (const f of scene.frogs) f.isAttracted = false

    for (const m of [...this._magnets]) {
      if (now >= m.expiresAt) {
        this.removeMagnet(m)
        continue
      }

      const [a, b] = m.pair

      // Если кто-то из пары уничтожен / в drag / merge — отменяем магнит
      if (
        !scene.frogs.includes(a) ||
        !scene.frogs.includes(b) ||
        a.isDragging ||
        a.isMerging ||
        b.isDragging ||
        b.isMerging
      ) {
        this.removeMagnet(m)
        continue
      }

      // Пока дрон ещё летит к паре (approach) — не тянем лягушек, ждём прилёта.
      if (m.arriving) continue

      // Притягиваем именно эту пару к точке магнита
      const pull = 0.06
      a.container.x = Phaser.Math.Linear(a.container.x, m.x, pull)
      a.container.y = Phaser.Math.Linear(a.container.y, m.y, pull)
      b.container.x = Phaser.Math.Linear(b.container.x, m.x, pull)
      b.container.y = Phaser.Math.Linear(b.container.y, m.y, pull)
      a.isAttracted = true
      b.isAttracted = true

      // Когда сошлись — мерджим в точке магнита
      const d = Phaser.Math.Distance.Between(
        a.container.x,
        a.container.y,
        b.container.x,
        b.container.y,
      )
      if (d < MERGE_RADIUS * 0.7) {
        this.merge.performMerge(a, b, m.x, m.y)
        m.mergesDone += 1

        if (m.mergesDone >= m.mergesTarget) {
          this.removeMagnet(m)
          continue
        }

        // Ищем следующую пару — если есть, переезжаем магнит к ней
        const next = this.merge.findClosestSameLevelPair()
        if (!next) {
          this.removeMagnet(m)
          continue
        }
        const [na, nb] = next
        for (const f of [na, nb]) {
          scene.tweens.killTweensOf(f.container)
          f.isMoving = false
        }
        const newX = (na.container.x + nb.container.x) / 2
        const newY = (na.container.y + nb.container.y) / 2
        m.pair = next
        m.x = newX
        m.y = newY
        // Дрон летит к новой паре с наклоном; пока летит — не тянет (arriving).
        m.arriving = true
        this.flyTo(m, newX, newY, Math.abs(m.emoji.scaleX), () => {
          m.arriving = false
        })
      }
    }
  }
}
