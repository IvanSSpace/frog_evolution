// Phase 21-02 (Wave 2): Merge / carrier-merge controller, extracted from MainScene.ts.
//
// Phase 22 Plan 22-02: carrier merge rules wired. MergeController handles:
//   - normal+normal → standard merge
//   - carrier+normal → carrier L+1, element inherited from carrier
//   - carrier+carrier → carrier L+1, TARGET (drop-on, = `b`) element survives
//     per D-Carrier+carrier rule
//   - L18+L18 normal → cosmos unlock sentinel via markDiscovered(19) (unchanged)
//
// Drag direction is the game-design source of truth: caller (FrogSpawner.dragend)
// passes `a` = dropped frog, `b` = drop-on target. Do NOT swap these — element
// selection for carrier+carrier depends on the orientation.
//
// Public API:
//   - performMerge(a, b, cx, cy): top-level entry — routes to carrier/standard
//   - playCrossLocationFlyAway(x, y, level): ghost-fly anim when frog goes to other location
//   - findMergeTarget(x, y, level, exclude): radius search for merge pair
//   - findClosestSameLevelPair(): magnet pair search across all frogs
//   - hasMergeablePair(): boolean wrapper for the above
//   - spawnVortexParticles(cx, cy, duration): merge vortex particles
//   - flashAt(x, y): merge/box flash circle
//   - spawnFloatingText(x, y, text, _type): floating "+N" or label
//   - locationName(id): RU название локации (используется в fly-away label)
//
// Coupling: класс хранит ссылку на MainScene + FrogSpawner. Использует
// scene.frogs (read), scene.overlayManager, scene.input. Вызывает spawner
// для spiralFrogTo / removeFrog / spawnFrog / startIdleAnim.

import Phaser from 'phaser'
import {
  useGameStore,
  l18MergeIncrementFraction,
} from '../../../store/gameStore'

const SIX_HOURS_MS = 6 * 60 * 60 * 1000
import { useOnboardingStore } from '../../../store/onboarding/onboardingSlice'
import { eventBus } from '../../../store/eventBus'
import {
  FROG_LEVELS,
  MAX_LEVEL,
  textureKeyForLevel,
  getTargetIncomePerSec,
  type PoopType,
} from '../../config/frogs'
import { getLocationUnlockedByLevel } from '../../config/locationUnlocks'
import { hapticImpact, hapticNotification } from '../../../utils/telegram'
import { mergeEffect } from '../../effects/elements/mergeEffect'
import i18next from 'i18next'
import type { Element } from '../../../store/cosmic/types'
import { devLog } from '../../../utils/devLog'
import { mergeApi } from '../../../api/merge'
import { BASE_SCALE, DPR, MERGE_RADIUS, type FrogData } from './types'
import type { MainScene } from '../MainScene'
import type { FrogSpawner } from './FrogSpawner'

/** Classify drop-target relationship without importing deleted carrierFeed module. */
type MergeKind =
  | 'normal' // normal + normal → standard merge
  | 'carrier-normal' // carrier + normal (same level) → Plan 22-02 rule
  | 'blocked-mismatch' // different levels
  | 'blocked-carrier-pair' // two carriers — disallowed

function classifyMerge(
  a: FrogData,
  b: FrogData,
  carriers: ReturnType<typeof useGameStore.getState>['carriers'],
): MergeKind {
  if (a.level !== b.level) return 'blocked-mismatch'
  const aIsCarrier = carriers.some((c) => c.frogId === a.id)
  const bIsCarrier = carriers.some((c) => c.frogId === b.id)
  if (aIsCarrier && bIsCarrier) return 'blocked-carrier-pair'
  if (aIsCarrier || bIsCarrier) return 'carrier-normal'
  return 'normal'
}

export class MergeController {
  private scene: MainScene
  private spawner: FrogSpawner

  constructor(scene: MainScene, spawner: FrogSpawner) {
    this.scene = scene
    this.spawner = spawner
  }

  findMergeTarget(
    x: number,
    y: number,
    level: number,
    exclude: FrogData,
  ): FrogData | null {
    const carriers = useGameStore.getState().carriers
    const excludeIsCarrier = carriers.some((c) => c.frogId === exclude.id)

    let best: FrogData | null = null
    let bestDist = MERGE_RADIUS
    for (const other of this.scene.frogs) {
      if (other === exclude) continue
      if (other.isMerging || other.isDragging) continue
      if (other.level !== level) continue
      if (excludeIsCarrier && carriers.some((c) => c.frogId === other.id)) continue
      const d = Phaser.Math.Distance.Between(
        x,
        y,
        other.container.x,
        other.container.y,
      )
      if (d <= bestDist) {
        bestDist = d
        best = other
      }
    }
    return best
  }

  // Ищет ближайшую пару лягушек одного уровня — кандидата для магнита
  findClosestSameLevelPair(): [FrogData, FrogData] | null {
    // Магнит мерджит только обычные пары normal+normal. Carrier'ы исключаем
    // полностью: carrier+normal через mergeApi даёт 400 (carrier не учтён в
    // locationFrogs) → спам запросов по кд. Carrier'ы юзер мерджит вручную.
    const carriers = useGameStore.getState().carriers
    const isCarrier = (f: FrogData) => carriers.some((c) => c.frogId === f.id)

    const byLevel = new Map<number, FrogData[]>()
    const now = Date.now()
    for (const f of this.scene.frogs) {
      if (f.isMerging || f.isDragging || f.isAttracted) continue
      if (f.level >= MAX_LEVEL) continue
      if (isCarrier(f)) continue
      // Свежие из бокса лягушки иммунны к магниту короткое время — иначе
      // AoE-открытие коробок = мгновенный «случайный» merge от клика.
      if (f.mergeProtectedUntil && now < f.mergeProtectedUntil) continue
      const arr = byLevel.get(f.level) ?? []
      arr.push(f)
      byLevel.set(f.level, arr)
    }

    let bestPair: [FrogData, FrogData] | null = null
    let bestDist = Infinity
    for (const frogs of byLevel.values()) {
      if (frogs.length < 2) continue
      for (let i = 0; i < frogs.length; i++) {
        for (let j = i + 1; j < frogs.length; j++) {
          const a = frogs[i]
          const b = frogs[j]
          const d = Phaser.Math.Distance.Between(
            a.container.x,
            a.container.y,
            b.container.x,
            b.container.y,
          )
          if (d < bestDist) {
            bestDist = d
            bestPair = [a, b]
          }
        }
      }
    }
    return bestPair
  }

  hasMergeablePair(): boolean {
    return this.findClosestSameLevelPair() !== null
  }

  performMerge(a: FrogData, b: FrogData, cx: number, cy: number) {
    const scene = this.scene
    const carriers = useGameStore.getState().carriers
    const kind = classifyMerge(a, b, carriers)

    devLog('[performMerge]', kind, {
      aId: a.id,
      bId: b.id,
      carrierIds: carriers.map((c) => c.frogId),
    })

    if (kind === 'blocked-mismatch') {
      eventBus.emit('cosmic:toast', {
        type: 'generic',
        msg: i18next.t('cosmic_hub.carrier.merge_blocked_mismatch'),
      })
      hapticNotification('error')
      return
    }

    if (kind === 'blocked-carrier-pair') {
      eventBus.emit('cosmic:toast', {
        type: 'generic',
        msg: i18next.t('cosmic_hub.carrier.merge_blocked_pair'),
      })
      hapticNotification('error')
      return
    }

    // Plan 22-02: carrier merge metadata — resolved here BEFORE delayedCall
    // because carrier records can be torn down/rebound mid-animation.
    // For carrier-normal kind we capture which side is the carrier so that
    // we dispatch mergeCarrierWithNormal(carrierId, normalId, ...) with the
    // right orientation regardless of drag direction.
    let carrierMergePlan:
      | { kind: 'carrier-normal'; carrierFrogId: string; normalFrogId: string }
      | null = null

    if (kind === 'carrier-normal') {
      const aIsCarrier = carriers.some((c) => c.frogId === a.id)
      const carrierFrogId = aIsCarrier ? a.id : b.id
      const normalFrogId = aIsCarrier ? b.id : a.id
      carrierMergePlan = { kind: 'carrier-normal', carrierFrogId, normalFrogId }
      if (import.meta.env.DEV) {
        const carrier = carriers.find((c) => c.frogId === carrierFrogId)
        devLog('[carrier-merge]', {
          kind: 'carrier-normal',
          carrierFrogId,
          normalFrogId,
          element: carrier?.element,
        })
      }
    }

    // === Standard-merge logic (normal+normal; carrier branches dispatch a
    // store action after the new frog spawns — see below in delayedCall). ===
    a.isMerging = true
    b.isMerging = true
    a.isMoving = true
    b.isMoving = true
    scene.tweens.killTweensOf(a.container)
    scene.tweens.killTweensOf(a.body)
    scene.tweens.killTweensOf(b.container)
    scene.tweens.killTweensOf(b.body)
    a.body.disableInteractive()
    b.body.disableInteractive()
    a.poopTimer?.remove()
    a.poopTimer = null
    b.poopTimer?.remove()
    b.poopTimer = null

    eventBus.emit('merge:happened', { level: a.level })
    hapticImpact('medium')

    // Phase 23 Plan 23-04 (Beat 3): первый успешный merge ЛЮБЫХ frogs (normal+normal /
    // carrier+normal / carrier+carrier — все варианты идут через performMerge) гасит
    // Merge demo overlay. markFirstMergeSeen — идемпотентна (повторные merges = no-op).
    // emit'им event ДО store mutation чтобы subscribers (OnboardingController) могли
    // прочитать !firstMergeSeen ещё до его установки если нужно — но фактически порядок
    // не критичен, оба signal'а несут одну семантику.
    {
      const onb = useOnboardingStore.getState()
      if (onb.firstBoxTapSeen && !onb.firstMergeSeen) {
        onb.markFirstMergeSeen()
        eventBus.emit('tutorial:firstMerge')
      }
    }

    const VORTEX_DURATION = 350
    a.container.setDepth(99997)
    b.container.setDepth(99997)

    this.spawner.spiralFrogTo(a, cx, cy, VORTEX_DURATION)
    this.spawner.spiralFrogTo(b, cx, cy, VORTEX_DURATION)
    this.spawnVortexParticles(cx, cy, VORTEX_DURATION)

    // ELEMENT-11: pre-capture carrier info ДО delayedCall — к моменту срабатывания
    // callback'а removeFrog(a)/(b) могут уже отработать и убрать carrier из store.
    const carriersSnap = useGameStore.getState().carriers
    const cA = carriersSnap.find((c) => c.frogId === a.id)
    const cB = carriersSnap.find((c) => c.frogId === b.id)
    const sameElementMerge: Element | null =
      cA && cB && cA.element === cB.element ? (cA.element as Element) : null

    scene.time.delayedCall(VORTEX_DURATION, () => {
      const oldLevel = a.level
      this.spawner.removeFrog(a)
      this.spawner.removeFrog(b)
      this.flashAt(cx, cy)

      // ELEMENT-11: same-element merge anim — поверх обычной flashAt.
      if (sameElementMerge) {
        mergeEffect(scene, cx, cy, sameElementMerge)
      }

      // L18+L18 — special path: лягушки сгорают (уже удалены removeFrog выше),
      // L19 НЕ материализуется. Тригерится unlock Звёздной карты через sentinel
      // markDiscovered(19).
      // Phase 22 Plan 22-06: cosmos gate — этот же sentinel включает hasCosmosUnlocked
      // (markCosmosUnlocked idempotent — повторные L18+L18 безопасны).
      if (oldLevel === MAX_LEVEL && b.level === MAX_LEVEL) {
        const storeL25 = useGameStore.getState()
        const currentLocId = storeL25.currentLocation
        storeL25.removeFrogFromLocation(currentLocId, MAX_LEVEL)
        storeL25.removeFrogFromLocation(currentLocId, MAX_LEVEL)
        const wasNew = storeL25.markDiscovered(19)
        if (wasNew) {
          eventBus.emit('location:unlocked', { locationId: 6 })
        }
        // Phase 22 Plan 22-06: cosmos unlock — реактивно открывает SerumBar,
        // Cosmic Hub button, Star Map ship controls во всех gated компонентах.
        storeL25.markCosmosUnlocked()
        // Phase 24 Plan 24-04: cinematic trigger.
        // Первый L18+L18 normal merge → cinematic (Plan 24-02 Phaser effect →
        // Plan 24-03 modal → Plan 24-04 controller spawn'ит L1 + opens Star Map).
        // markCaptainBirthSeen idempotent → повторные L18+L18 НЕ играют cinematic.
        if (!storeL25.captainBirthSeen) {
          storeL25.markCaptainBirthSeen()
          eventBus.emit('captain:birth-start', { x: cx, y: cy })
        }
        // 2026-05-23: rework reward — permanent % multiplier удалён.
        // Каждый L18+L18 merge даёт:
        //   - +1 essence
        //   - +5% / +2.5% temp buff к доходу на 6h (см. l18MergeIncrementFraction)
        //   - First merge также: +2× L18 income/sec ABSOLUTE permanent
        //     ("ghost L18 income", compensates loss of 2 destroyed L18 frogs).
        useGameStore.setState((s) => ({ essence: s.essence + 1 }))
        if (storeL25.l18MergesCount === 0) {
          const l18IncomePerSec = getTargetIncomePerSec(MAX_LEVEL)
          storeL25.addL18AbsoluteBonus(l18IncomePerSec * 2)
        }
        // 6h temp buff: % зависит от count'а ДО инкремента (count=0 → +5%,
        // count=1 → +5%, count≥2 → +2.5%).
        const buffFraction = l18MergeIncrementFraction(storeL25.l18MergesCount)
        if (buffFraction > 0) {
          storeL25.activateTemporaryIncomeBuff(buffFraction * 100, SIX_HOURS_MS)
        }
        storeL25.incrementL18Merges()
        mergeApi(MAX_LEVEL, currentLocId)
          .then((res) => {
            useGameStore.setState({
              locationFrogs: res.locationFrogs,
              discoveredLevels: res.discoveredLevels,
            })
          })
          .catch((e) => {
            console.warn('[merge] server sync failed:', e)
          })
        return
      }

      const newLevel = Math.min(a.level + 1, MAX_LEVEL)
      const newCfg = FROG_LEVELS[newLevel - 1]
      const store = useGameStore.getState()
      const currentLocId = store.currentLocation

      store.removeFrogFromLocation(currentLocId, oldLevel)
      store.removeFrogFromLocation(currentLocId, oldLevel)
      store.addFrogToLocation(newCfg.location, newLevel)

      mergeApi(oldLevel, currentLocId)
        .then((res) => {
          useGameStore.setState({
            locationFrogs: res.locationFrogs,
            discoveredLevels: res.discoveredLevels,
          })
        })
        .catch((e) => {
          console.warn('[merge] server sync failed:', e)
        })

      const isCrossLocation = newCfg.location !== currentLocId

      scene.time.delayedCall(60, () => {
        // Plan 22-02: resolve newFrogId for carrier-merge dispatch.
        // - Same-location: real spawned frog id.
        // - Cross-location: synthetic id; FrogSpawner.rebindCarriers will
        //   re-attach to a real frog when the target location is visited.
        let newFrogId: string

        if (isCrossLocation) {
          this.playCrossLocationFlyAway(cx, cy, newLevel)
          eventBus.emit('cosmic:toast', {
            type: 'generic',
            msg: i18next.t('cosmic_hub.carrier.merge_cross_location_warn'),
            duration: 3000,
          })
          newFrogId = `carrier-cross-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
        } else {
          const newFrog = this.spawner.spawnFrog(cx, cy, newLevel)
          newFrogId = newFrog.id
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
        }

        // Plan 22-02: dispatch carrier merge action AFTER spawn so we know
        // newFrogId. Standard-merge frog (normal+normal) — no action needed.
        if (carrierMergePlan?.kind === 'carrier-normal') {
          useGameStore
            .getState()
            .mergeCarrierWithNormal(
              carrierMergePlan.carrierFrogId,
              carrierMergePlan.normalFrogId,
              newFrogId,
              newLevel,
            )
        }

        // 2026-05-23: L18 ascension trigger удалён — carrier продолжает мерджиться
        // дальше до L18+L18 (cosmos sentinel выше). Специальный buff серума на
        // L18+L18 — TBD.

        const wasNew = store.markDiscovered(newLevel)
        if (wasNew) {
          eventBus.emit('frog:discovered', { level: newLevel })
          const unlockedLocId = getLocationUnlockedByLevel(newLevel)
          if (unlockedLocId !== null) {
            eventBus.emit('location:unlocked', { locationId: unlockedLocId })
          }
        }

        // Sync overlay after merge (carrier frogId moved to new frog above).
        scene.overlayManager?.markDirty()
      })
    })
  }

  // Анимация: большая полупрозрачная лягушка увеличивается и исчезает за 0.5с
  playCrossLocationFlyAway(x: number, y: number, level: number) {
    const scene = this.scene
    const cfg = FROG_LEVELS[level - 1]
    const ghost = scene.add.image(x, y, textureKeyForLevel(level))
    // tint уже запечён в SVG при preload, setTint больше не нужен.
    ghost.setScale(BASE_SCALE)
    ghost.setAlpha(0.2)
    ghost.setDepth(99999)

    scene.tweens.add({
      targets: ghost,
      scale: BASE_SCALE * 6,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => ghost.destroy(),
    })

    this.spawnFloatingText(
      x,
      y - 40 * DPR,
      `→ ${this.locationName(cfg.location)}`,
      'huge' as PoopType,
    )
  }

  locationName(id: number): string {
    switch (id) {
      case 1:
        return 'Болото'
      case 2:
        return 'Лес'
      case 3:
        return 'Континент'
      default:
        return ''
    }
  }

  spawnVortexParticles(cx: number, cy: number, duration: number) {
    const scene = this.scene
    const COUNT = 12
    for (let i = 0; i < COUNT; i++) {
      const baseAngle = (i / COUNT) * Math.PI * 2
      const startRadius = (50 + Math.random() * 30) * DPR
      const px = cx + Math.cos(baseAngle) * startRadius
      const py = cy + Math.sin(baseAngle) * startRadius

      const particle = scene.add.circle(px, py, 3 * DPR, 0xffffaa, 0.85)
      particle.setDepth(99998)

      const obj = { p: 0 }
      scene.tweens.add({
        targets: obj,
        p: 1,
        duration,
        ease: 'Power2.easeIn',
        onUpdate: () => {
          const a = baseAngle + obj.p * Math.PI * 3
          const r = startRadius * (1 - obj.p)
          particle.x = cx + Math.cos(a) * r
          particle.y = cy + Math.sin(a) * r
          particle.setAlpha(0.85 * (1 - obj.p))
        },
        onComplete: () => particle.destroy(),
      })
    }
  }

  flashAt(x: number, y: number) {
    const scene = this.scene
    const flash = scene.add.circle(x, y, 12 * DPR, 0xffffff, 1)
    flash.setDepth(99999)
    scene.tweens.add({
      targets: flash,
      scale: 4,
      alpha: 0,
      duration: 220,
      ease: 'Power2.easeOut',
      onComplete: () => flash.destroy(),
    })
  }

  spawnFloatingText(x: number, y: number, text: string, _type: PoopType) {
    const scene = this.scene
    const t = scene.add.text(x, y, text, {
      fontFamily: 'Russo One, sans-serif',
      fontSize: `${11 * DPR}px`,
      color: '#fde047',
      stroke: '#3a2207',
      strokeThickness: 2.5 * DPR,
    })
    t.setOrigin(0.5)
    t.setDepth(99998)

    scene.tweens.add({
      targets: t,
      y: y - 32 * DPR,
      duration: 1800,
      ease: 'Sine.easeOut',
    })
    scene.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1000,
      duration: 700,
      ease: 'Sine.easeIn',
      onComplete: () => t.destroy(),
    })
  }
}
