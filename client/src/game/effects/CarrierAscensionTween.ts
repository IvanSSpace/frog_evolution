// Phase 22 Plan 22-03: ascension visual tween.
//
// Когда carrier ascends (см. ascendCarrier action в ascensionSlice):
//   1. Ad-hoc aura instance создаётся через подходящий AuraSpec
//      (reuse existing element spec, no new art per D-Specific Ideas).
//   2. Frog container получает tween: scale up ×1.4, alpha → 0, y -= 40
//      длительностью ~1500ms (Sine.easeOut).
//   3. По завершению — frog.container.destroy() + aura.container.destroy()
//      + onComplete callback (MainScene вызывает spawner.removeFrog которое
//      также убирает frog из scene.frogs и releases overlay).
//
// IMPORTANT (memory feedback_frog_container_alpha):
//   Tween alpha идёт на frog.container — это OK потому что лягушка через 1.5s
//   уничтожается. Эффект «мерцания прозрачностью» применяется ТОЛЬКО когда
//   container остаётся жив после tween. Здесь это финальный disappear:
//   container не возвращается в рабочее состояние, поэтому проблема не воспроизводится.
//
// Aura для ad-hoc instance: используем существующие AuraSpec из elementAuraSpecs.
// Маппинг element → spec ниже. `ice` элемент не имеет своей spec — fallback
// на waterSpec (та же категория Прочее в archetypeBonuses, визуально близко).

import Phaser from 'phaser'
import {
  type AuraSpec,
  type AuraInstance,
} from './ElementAuraOverlay'
import {
  fireSpec,
  waterSpec,
  forestSpec,
  toxicSpec,
  plasmaSpec,
  crystalSpec,
  desertSpec,
  gasSpec,
  ringSpec,
  binarySpec,
} from './elementAuraSpecs'
import type { Element } from '../../store/cosmic/types'

const SPEC_BY_ELEMENT: Record<Element, AuraSpec> = {
  fire: fireSpec,
  water: waterSpec,
  // ice не имеет dedicated spec — fallback на waterSpec (визуально близко).
  ice: waterSpec,
  forest: forestSpec,
  toxic: toxicSpec,
  plasma: plasmaSpec,
  crystal: crystalSpec,
  desert: desertSpec,
  gas: gasSpec,
  ring: ringSpec,
  binary: binarySpec,
}

const ASCENSION_DURATION_MS = 1500
const ASCENSION_RISE_PX = 40
const ASCENSION_SCALE_FACTOR = 1.4

/**
 * Воспроизводит ascension-анимацию для указанной лягушки:
 *  - создаёт ad-hoc aura (reuse element spec),
 *  - запускает основной tween scale/alpha/y,
 *  - по завершению уничтожает aura и вызывает onComplete.
 *
 * onComplete — ответственность вызывающего кода (обычно removeFrog
 * через FrogSpawner, чтобы scene.frogs и overlay manager синхронизировались).
 *
 * Если frog уже уничтожен (frog.container scene == null) — no-op.
 */
export function playAscensionTween(
  scene: Phaser.Scene,
  frogContainer: Phaser.GameObjects.Container,
  element: Element,
  onComplete: () => void,
): void {
  // Защита от уже уничтоженного container'а (race с removeFrog).
  if (!frogContainer || !frogContainer.scene) {
    onComplete()
    return
  }

  const spec = SPEC_BY_ELEMENT[element]
  spec.ensureTextures(scene)

  // Ad-hoc aura: создаём в позиции лягушки, движется вместе с container'ом
  // через лёгкий per-frame sync ниже (frog поднимается y -= 40).
  const aura: AuraInstance = spec.createAura(scene)
  aura.container.setPosition(frogContainer.x, frogContainer.y)
  aura.container.setDepth((frogContainer.depth ?? frogContainer.y) - 1)
  aura.container.setScale(1.0)

  // Sync aura position to frog during tween. Простой updateLoop через scene.events.
  const syncListener = () => {
    if (!frogContainer.scene) return
    aura.container.setPosition(frogContainer.x, frogContainer.y)
  }
  scene.events.on(Phaser.Scenes.Events.UPDATE, syncListener)

  // Aura pulse — параллельный tween (scale up + fade out).
  scene.tweens.add({
    targets: aura.container,
    scale: 1.8,
    alpha: 0,
    duration: ASCENSION_DURATION_MS,
    ease: 'Sine.easeOut',
  })

  // Основной tween на frog container'е.
  // ВАЖНО: frog.container уничтожается onComplete — alpha-tween безопасен
  // (см. header note про feedback_frog_container_alpha).
  const baseScale = frogContainer.scale
  const targetY = frogContainer.y - ASCENSION_RISE_PX

  scene.tweens.add({
    targets: frogContainer,
    scale: baseScale * ASCENSION_SCALE_FACTOR,
    alpha: 0,
    y: targetY,
    duration: ASCENSION_DURATION_MS,
    ease: 'Sine.easeOut',
    onComplete: () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, syncListener)
      // Destroy aura tweens + container.
      for (const t of aura.tweens) t.stop()
      aura.container.destroy(true)
      onComplete()
    },
  })
}
