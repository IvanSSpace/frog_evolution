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
import { saveFieldBoxCount } from '../../../store/persistence'
import { MAX_LEVEL } from '../../config/frogs'
import { hapticImpact } from '../../../utils/telegram'
import {
  BASE_SCALE,
  BOX_DISPLAY_SIZE,
  BOX_FALL_DURATION,
  BOX_IDLE_INTERVAL,
  BOX_OPEN_RADIUS,
  BOX_SPAWN_MERGE_PROTECT_MS,
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
// Phase 22 Plan 22-05: effective slot cap учитывает permaSlotBonus из cosmic shop.
import { effectiveSlotCap } from '../../utils/shopBonuses'
// Phase 23 Plan 23-03 — Beat 2 (Tap-hint): onboarding state + pulse ring effect.
import { useOnboardingStore } from '../../../store/onboarding/onboardingSlice'
import { TutorialPulseRing } from '../../effects/TutorialPulseRing'

// Phase 23 Plan 23-03: registry key для cross-controller access к активному
// tutorial ring'у. BoxController создаёт, dismiss-handlers destroy'ят.
const TUTORIAL_RING_REGISTRY_KEY = '__tutorialPulseRing'
// Sentinel auto-dismiss timeout — должен совпадать с TapHintOverlay (TapHintOverlay.tsx).
const TUTORIAL_RING_AUTO_DISMISS_MS = 5000
// Delay перед спавном ring'а после box landing (CONTEXT.md Beat 2).
const TUTORIAL_RING_DELAY_MS = 300

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
    const cap = effectiveSlotCap(
      MAX_ENTITIES,
      useGameStore.getState().permaSlotBonus ?? 0,
    )
    return this.scene.frogs.length + this.scene.boxes.length < cap
  }

  /** Сохранить счётчик field-боксов в localStorage (только на Болоте — на других
   *  локациях боксов нет, не затираем сохранённое). Вызывается на spawn/open. */
  private persistFieldBoxes(): void {
    if (useGameStore.getState().currentLocation !== 1) return
    saveFieldBoxCount(this.scene.boxes.filter((b) => b.img.active).length)
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
      // Phase 23 Plan 23-03 — per-box id для tutorial event coupling.
      id: `box_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    }
    scene.boxes.push(box)
    scene.syncEntityCount()
    this.persistFieldBoxes()

    // Инпут вешаем сразу, во время падения handler игнорирует через isLanding
    img.setInteractive({ useHandCursor: true })
    img.on('pointerdown', () => {
      if (box.isLanding) return
      hapticImpact('medium')
      // Лёгкий звук на тап (раз на жест, не per-box — AoE открывает несколько).
      eventBus.emit('box:tapOpened', {})
      // Phase 23 Plan 23-03 — Beat 2 dismiss: первый tap ЛЮБОГО бокса гасит
      // tap-hint. Помечаем seen в store + эмитим event для DOM overlay
      // и destroy'ит ring (вне зависимости от какого бокса тап — даже не того,
      // вокруг которого был ring).
      this.dismissTutorialTapHint(box.id ?? '')
      // AoE-открытие: тап раскрывает все коробки в BOX_OPEN_RADIUS (splash).
      // Раньше это убирали из-за «случайного» авто-merge'а — теперь свежие
      // лягушки получают магнит-иммунитет (BOX_SPAWN_MERGE_PROTECT_MS),
      // поэтому клик по боксам больше не делает мгновенный merge.
      this.openBoxesInRadius(box)
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
            // Phase 23 Plan 23-03 — Beat 2 trigger: первый бокс приземлился.
            this.maybeSpawnTutorialTapHint(box)
          },
        })
      },
    })
  }

  /**
   * Phase 23 Plan 23-03 (Beat 2) — пробуем поднять tap-hint вокруг этого бокса.
   * Не делает ничего если:
   *   - welcomeSeen=false (Beat 1 ещё не пройден)
   *   - firstBoxTapSeen=true (Beat 2 уже завершён)
   *   - в scene.registry уже лежит активный ring (другой бокс был первым)
   *
   * Через 300ms (CONTEXT.md) re-check'ает state — если за это время другой
   * бокс уже создал ring или игрок успел тапнуть, выходим silently.
   */
  private maybeSpawnTutorialTapHint(box: BoxData): void {
    const scene = this.scene
    // Quick reject — избегаем setTimeout если уже не нужно.
    const s0 = useOnboardingStore.getState()
    if (!s0.welcomeSeen || s0.firstBoxTapSeen) return
    if (scene.registry.get(TUTORIAL_RING_REGISTRY_KEY)) return

    scene.time.delayedCall(TUTORIAL_RING_DELAY_MS, () => {
      // Re-check after delay — состояние могло измениться.
      const s = useOnboardingStore.getState()
      if (!s.welcomeSeen || s.firstBoxTapSeen) return
      if (scene.registry.get(TUTORIAL_RING_REGISTRY_KEY)) return
      // Бокс мог быть открыт / destroy'ен / уже не активен.
      if (!box.img.active || !scene.boxes.includes(box)) return

      const radius = (box.img.displayWidth * 0.7) / 2 + 6 * DPR
      const ring = new TutorialPulseRing({
        scene,
        target: box.img,
        radius,
      })
      scene.registry.set(TUTORIAL_RING_REGISTRY_KEY, ring)

      eventBus.emit('tutorial:firstBoxSpawned', {
        x: box.img.x,
        y: box.img.y,
        boxId: box.id ?? '',
        width: box.img.displayWidth,
      })

      // Sentinel auto-dismiss — на случай если игрок никогда не тапнет бокс
      // (бокс может open'нуться от другого пути, или пользователь afk).
      // TapHintOverlay тоже своим таймером пометит seen=true; здесь дублируем
      // только destroy ring'а как страховку.
      scene.time.delayedCall(TUTORIAL_RING_AUTO_DISMISS_MS, () => {
        const cur = scene.registry.get(TUTORIAL_RING_REGISTRY_KEY) as
          | TutorialPulseRing
          | undefined
        if (cur === ring) {
          ring.destroy()
          scene.registry.set(TUTORIAL_RING_REGISTRY_KEY, undefined)
        }
      })
    })
  }

  /**
   * Phase 23 Plan 23-03 (Beat 2 dismiss) — общий dismiss hook для box-tap.
   * Срабатывает на КАЖДЫЙ box pointerdown; реальную работу делает только
   * если state ещё не seen. Idempotent.
   */
  private dismissTutorialTapHint(boxId: string): void {
    const s = useOnboardingStore.getState()
    if (!s.welcomeSeen || s.firstBoxTapSeen) return

    s.markFirstBoxTapSeen()
    eventBus.emit('tutorial:firstBoxTapped', { boxId })

    const ring = this.scene.registry.get(TUTORIAL_RING_REGISTRY_KEY) as
      | TutorialPulseRing
      | undefined
    if (ring) {
      ring.destroy()
      this.scene.registry.set(TUTORIAL_RING_REGISTRY_KEY, undefined)
    }
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

    // Первая пауза перед первым прыжком — рандомизирована по полному периоду.
    // Иначе боксы, восстановленные/заспавненные в один тик (preLanded при входе
    // на локацию), стартуют синхронно и прыгают в унисон. Случайный стартовый
    // оффсет разводит фазы и держит их рассинхронными навсегда (период фиксирован).
    scene.time.delayedCall(Phaser.Math.Between(0, BOX_IDLE_INTERVAL), cycle)
  }

  /**
   * AoE-открытие (splash): раскрывает тапнутый бокс + все активные боксы в
   * радиусе BOX_OPEN_RADIUS. Снимок целей берём ДО цикла — onBoxTapped мутирует
   * scene.boxes (и может заспавнить rare-бокс, который в снимок не попадёт →
   * без бесконечного цикла). Защита от случайного merge'а — в onBoxTapped.
   */
  private openBoxesInRadius(tapped: BoxData) {
    const cx = tapped.img.x
    const cy = tapped.img.y
    const targets = this.scene.boxes.filter((b) => {
      if (b === tapped) return true
      if (b.isLanding || !b.img.active) return false
      return (
        Phaser.Math.Distance.Between(cx, cy, b.img.x, b.img.y) <=
        BOX_OPEN_RADIUS
      )
    })
    for (const b of targets) this.onBoxTapped(b)
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
    this.persistFieldBoxes()
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

    // Flash only (shake disabled per user request)
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
      // Магнит-иммунитет: клик по боксам (особенно AoE) не должен делать
      // мгновенный авто-merge свежих лягушек. См. types.BOX_SPAWN_MERGE_PROTECT_MS.
      newFrog.mergeProtectedUntil = Date.now() + BOX_SPAWN_MERGE_PROTECT_MS
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
