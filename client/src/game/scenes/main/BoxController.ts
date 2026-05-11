// Phase 21-03 (Wave 3): Box drop controller, extracted from MainScene.ts.
//
// Owns: спавн коробок (обычные/rare), idle-bobbing анимация, тап-открытие
// (с радиусом BOX_OPEN_RADIUS), пост-открытие сценарий — частицы, shake,
// emit rareCrate:opened или спавн новой лягушки + apply crateQuality
// (на Болоте) / minLevel (на других локациях). Также updates rareBoxProgress
// в store.
//
// Public API:
//   - canSpawnBox(): проверка лимита (frogs + boxes < MAX_ENTITIES)
//   - spawnBox(isRare, preLanded): create + animate landing + idle
//   - startBoxIdleAnim(box): bobbing chain (вызывается после landing)
//   - onBoxTapped(box): открыть коробку → frog spawn / rareCrate event
//
// Coupling: класс хранит ссылку на MainScene + FrogSpawner + MergeController.
// Использует scene.boxes (package-public read+write),
// scene.pendingBoxCount, scene.frogs.length (через canSpawnBox), scene.cameras.
// Вызывает spawner.spawnFrog и merge.flashAt.

import Phaser from 'phaser'
import {
  useGameStore,
  getCrateLevel,
  getLocationById,
  getRareBoxThreshold,
} from '../../../store/gameStore'
import { eventBus } from '../../../store/eventBus'
import { MAX_LEVEL } from '../../config/frogs'
import { hapticImpact } from '../../../utils/telegram'
import {
  BASE_SCALE,
  BOX_DISPLAY_SIZE,
  BOX_FALL_DURATION,
  BOX_IDLE_INTERVAL,
  BOX_OPEN_RADIUS,
  DPR,
  FIELD_PAD_X,
  FIELD_PAD_Y,
  FIELD_PAD_Y_BOTTOM,
  MAX_ENTITIES,
  RARE_BOX_SCALE_MULT,
  RARE_BOX_TINT,
  type BoxData,
} from './types'
import type { MainScene } from '../MainScene'
import type { FrogSpawner } from './FrogSpawner'
import type { MergeController } from './MergeController'

export class BoxController {
  private scene: MainScene
  private spawner: FrogSpawner
  private merge: MergeController

  constructor(scene: MainScene, spawner: FrogSpawner, merge: MergeController) {
    this.scene = scene
    this.spawner = spawner
    this.merge = merge
  }

  canSpawnBox(): boolean {
    return this.scene.frogs.length + this.scene.boxes.length < MAX_ENTITIES
  }

  spawnBox(isRare = false, preLanded = false) {
    const scene = this.scene
    const { width, height } = scene.scale
    const x = Phaser.Math.Between(
      FIELD_PAD_X + 40 * DPR,
      width - FIELD_PAD_X - 40 * DPR,
    )
    const targetY = Phaser.Math.Between(
      FIELD_PAD_Y + 40 * DPR,
      height - FIELD_PAD_Y_BOTTOM - 40 * DPR,
    )

    // Стартуем выше канваса — коробка просто влетает в кадр без fade.
    // Если preLanded — стартуем сразу на целевой Y, без анимации падения.
    const startY = preLanded ? targetY : -BOX_DISPLAY_SIZE
    const img = scene.add.image(x, startY, 'box')
    img.setDisplaySize(BOX_DISPLAY_SIZE, BOX_DISPLAY_SIZE)
    img.setDepth(targetY) // сразу высокий depth чтобы не перекрывалось лягушками
    if (isRare) {
      img.setTint(RARE_BOX_TINT)
      img.setDisplaySize(
        BOX_DISPLAY_SIZE * RARE_BOX_SCALE_MULT,
        BOX_DISPLAY_SIZE * RARE_BOX_SCALE_MULT,
      )
    }
    const baseScale = img.scaleX

    const box: BoxData = {
      img,
      isLanding: !preLanded,
      baseScale,
      baseY: targetY,
      idleTween: null,
      isRare,
    }
    scene.boxes.push(box)
    scene.syncEntityCount()

    // Инпут вешаем сразу, во время падения handler игнорирует через isLanding
    img.setInteractive({ useHandCursor: true })
    img.on('pointerdown', () => {
      if (box.isLanding) return
      hapticImpact('medium')
      // Открываем тапнутую коробку + все приземлившиеся в радиусе
      const cx = box.img.x
      const cy = box.img.y
      const targets: BoxData[] = []
      for (const b of scene.boxes) {
        if (b.isLanding) continue
        const d = Phaser.Math.Distance.Between(cx, cy, b.img.x, b.img.y)
        if (d <= BOX_OPEN_RADIUS) targets.push(b)
      }
      for (const t of targets) this.onBoxTapped(t)
    })

    if (preLanded) {
      this.startBoxIdleAnim(box)
      return
    }

    scene.tweens.add({
      targets: img,
      y: targetY,
      duration: BOX_FALL_DURATION,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Squash при приземлении
        scene.tweens.add({
          targets: img,
          scaleY: baseScale * 0.7,
          scaleX: baseScale * 1.15,
          duration: 80,
          yoyo: true,
          ease: 'Power2',
          onComplete: () => {
            img.scaleX = baseScale
            img.scaleY = baseScale
            box.isLanding = false
            this.startBoxIdleAnim(box)
          },
        })
      },
    })
  }

  startBoxIdleAnim(box: BoxData) {
    const scene = this.scene
    const { baseScale, baseY } = box
    const jumpHeight = 7 * DPR

    const cycle = () => {
      if (!box.img.active || !scene.boxes.includes(box)) return

      box.idleTween = scene.tweens.chain({
        targets: box.img,
        tweens: [
          // Squash перед прыжком: шире, ниже
          {
            scaleX: baseScale * 1.12,
            scaleY: baseScale * 0.88,
            duration: 100,
            ease: 'Power2.easeIn',
          },
          // Подпрыг + растяжка вверх
          {
            scaleX: baseScale * 0.96,
            scaleY: baseScale * 1.06,
            y: baseY - jumpHeight,
            duration: 150,
            ease: 'Power2.easeOut',
          },
          // Приземление: снова squash
          {
            scaleX: baseScale * 1.1,
            scaleY: baseScale * 0.9,
            y: baseY,
            duration: 80,
            ease: 'Power2.easeIn',
          },
          // Settle к норме
          {
            scaleX: baseScale,
            scaleY: baseScale,
            duration: 100,
            ease: 'Back.easeOut',
          },
        ],
        onComplete: () => {
          box.idleTween = null
          scene.time.delayedCall(BOX_IDLE_INTERVAL, cycle)
        },
      })
    }

    // Первая пауза перед первым прыжком
    scene.time.delayedCall(BOX_IDLE_INTERVAL, cycle)
  }

  onBoxTapped(box: BoxData) {
    const scene = this.scene
    if (box.isLanding) return
    if (!box.img.active) return

    const x = box.img.x
    const y = box.img.y
    const baseScale = box.baseScale

    scene.boxes = scene.boxes.filter((b) => b !== box)
    scene.syncEntityCount()
    scene.tweens.killTweensOf(box.img)
    box.idleTween = null
    box.img.disableInteractive()

    // Коробка увеличивается и исчезает
    scene.tweens.add({
      targets: box.img,
      scaleX: baseScale * 1.4,
      scaleY: baseScale * 1.4,
      alpha: 0,
      rotation: 0.4,
      duration: 220,
      ease: 'Power2.easeOut',
      onComplete: () => box.img.destroy(),
    })

    // Частицы взрыва
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4
      const dist = (40 + Math.random() * 30) * DPR
      const p = scene.add.circle(x, y, 3 * DPR, 0xc8a572, 0.9)
      p.setDepth(99998)
      scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist + 25 * DPR,
        alpha: 0,
        duration: 350,
        ease: 'Power2.easeOut',
        onComplete: () => p.destroy(),
      })
    }

    // Camera shake + flash
    scene.cameras.main.shake(120, 0.005)
    this.merge.flashAt(x, y)

    if (box.isRare) {
      eventBus.emit('rareCrate:opened', {
        x,
        y,
        minLevel: 1,
        maxLevel: MAX_LEVEL,
      })
      return
    }

    // Считаем открытые обычные боксы → мега-бокс каждые N открытий (только на Болоте)
    const storeForCount = useGameStore.getState()
    if (storeForCount.currentLocation === 1) {
      const newCount = storeForCount.boxOpenCount + 1
      const threshold = getRareBoxThreshold(storeForCount.upgrades.rareBoxSpeed)
      if (newCount >= threshold && this.canSpawnBox()) {
        this.spawnBox(true)
        storeForCount.setBoxOpenCount(0)
        storeForCount.setRareBoxProgress(0)
      } else {
        storeForCount.setBoxOpenCount(newCount)
        storeForCount.setRareBoxProgress(Math.min(newCount / threshold, 1))
      }
    }

    // Спавн лягушки. На Болоте (loc 1) применяется crateQuality, на других локациях — minLevel.
    scene.time.delayedCall(0, () => {
      const state = useGameStore.getState()
      const loc = getLocationById(state.currentLocation)
      const frogLevel =
        loc.id === 1 ? getCrateLevel(state.upgrades.crateQuality) : loc.minLevel
      const newFrog = this.spawner.spawnFrog(x, y, frogLevel)
      state.addFrogToLocation(loc.id, frogLevel)
      newFrog.container.setScale(0)
      scene.tweens.add({
        targets: newFrog.container,
        scale: BASE_SCALE * 1.2,
        duration: 160,
        ease: 'Back.easeOut',
        onComplete: () => {
          scene.tweens.add({
            targets: newFrog.container,
            scale: BASE_SCALE,
            duration: 100,
            ease: 'Power2.easeOut',
          })
        },
      })
    })

    // Освободившийся слот подхватит сам update() — не нужно дёргать вручную
  }
}
