// Phase 21-03 (Wave 3): Auto-poop drop controller, extracted from MainScene.ts.
//
// Owns: спавн «какашки» по таймеру лягушки, золото-tick + emit goo:collected
// + floating "+N" text, fade-out cleanup, трекинг живых poop'ов в scene.poops
// (нужно для location-transition reparent в onLocationChanged).
//
// Public API:
//   - spawnAutoPoop(frog, type): запускается из FrogSpawner.poopTimer callback
//
// Coupling: ссылка на MainScene + MergeController. Использует scene.poops
// (package-public mut), scene.add. Вызывает merge.spawnFloatingText.

import { useGameStore } from '../../../store/gameStore'
import { eventBus } from '../../../store/eventBus'
import {
  getPoopValueExact,
  stochasticRound,
  type PoopType,
} from '../../config/frogs'
import { BASE_SCALE, DPR, type FrogData } from './types'
import type { MainScene } from '../MainScene'
import type { MergeController } from './MergeController'

export class PoopController {
  private scene: MainScene
  private merge: MergeController

  constructor(scene: MainScene, merge: MergeController) {
    this.scene = scene
    this.merge = merge
  }

  spawnAutoPoop(frog: FrogData, type: PoopType) {
    const scene = this.scene
    const x = frog.container.x
    const y = frog.container.y
    const facingRight = frog.facingRight
    // Сумма вычисляется по точной цели уровня (target/sec × interval),
    // округляется стохастически — среднее за время точно матчит target.
    const value = stochasticRound(getPoopValueExact(frog.level))

    // Размер у всех типов одинаковый, но крупнее базы
    const finalScale = BASE_SCALE * 1.3

    // Положение приземления какашки — отдельно по X и Y, индекс = уровень-1
    // horizDistByLevel — насколько далеко по ГОРИЗОНТАЛИ от лягушки (положительное — назад от неё)
    // vertOffsetByLevel — насколько НИЖЕ центра лягушки приземлится (положительное — вниз, отрицательное — вверх)
    const horizDistByLevel = [20, 26, 34, 40, 42, 42] // L1..L6
    const vertOffsetByLevel = [14, 16, 16, 20, 10, 26] // L1..L6

    const horizDist =
      (horizDistByLevel[Math.min(frog.level - 1, 5)] ?? 28) * DPR
    const vertOffset =
      (vertOffsetByLevel[Math.min(frog.level - 1, 5)] ?? 16) * DPR

    const behindX = x + (facingRight ? -10 * DPR : 10 * DPR)
    const startY = y + 6 * DPR
    const img = scene.add.image(behindX, startY, 'goo')
    img.setAlpha(0)
    img.setScale(0.4 * finalScale)
    scene.poops.push(img)

    // Phase 1: какашка появляется сзади и приземляется на (landX, landY)
    const landX = behindX + (facingRight ? -horizDist : horizDist)
    const landY = y + vertOffset

    scene.tweens.add({
      targets: img,
      x: landX,
      y: landY,
      alpha: 1,
      scale: finalScale,
      duration: 220,
      ease: 'Power2.easeOut',
      onComplete: () => {
        // Какашка статична, медленно тает на месте.
        // Если стохастический round дал 0 (для совсем малых таргетов) — без денег и цифры,
        // визуал какашки всё равно показываем.
        if (value > 0) {
          useGameStore.getState().addGold(value)
          eventBus.emit('goo:collected', { value })
          this.merge.spawnFloatingText(
            landX,
            landY - 22 * DPR,
            `+${value}`,
            type,
          )
        }

        scene.tweens.add({
          targets: img,
          alpha: 0,
          duration: 1100,
          ease: 'Sine.easeIn',
          onComplete: () => {
            scene.poops = scene.poops.filter((p) => p !== img)
            img.destroy()
          },
        })
      },
    })
  }

  // Loc2: фиолетовая «слизь» (эктоплазма). В ОТЛИЧИЕ от обычной какашки —
  // НЕ авто-собирается и НЕ тает: лежит на поле пока её не подберёт ecto-дрон.
  spawnEctoPoop(frog: FrogData) {
    const scene = this.scene
    const x = frog.container.x
    const y = frog.container.y
    const finalScale = BASE_SCALE * 1.4
    const behindX = x + (frog.facingRight ? -10 * DPR : 10 * DPR)
    const img = scene.add.image(behindX, y + 6 * DPR, 'goo')
    img.setTint(0x9d4edd) // фиолетовая
    img.setAlpha(0)
    img.setScale(0.4 * finalScale)
    img.setDepth(y) // как лягушки — iso-сортировка по y
    scene.ectoPoops.push(img)
    scene.tweens.add({
      targets: img,
      x: behindX + (frog.facingRight ? -28 * DPR : 28 * DPR),
      y: y + 16 * DPR,
      alpha: 1,
      scale: finalScale,
      duration: 220,
      ease: 'Power2.easeOut',
    })
    // лёгкая пульсация — заметно что лежит и ждёт сбора
    scene.tweens.add({
      targets: img,
      scaleX: finalScale * 1.08,
      scaleY: finalScale * 0.92,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 240,
    })
  }
}
