// Phase 13: burstEffect — одноразовый element-burst при тапе на carrier (ELEMENT-10).
// 200-400ms blast: ring expand + sparkle burst + flash, опционально + starburst для
// "magical" elements (arcane/war/void/plasma).
// Не возвращает lifecycle — primitives используют tween onComplete для self-cleanup.

import type Phaser from 'phaser'
import type { Element } from '../../../store/cosmic/types'
import {
  compRing, compSparkle, compFlash, compStarBurst,
} from '../anim/shared'
import type { SharedBgSystem } from '../anim/shared/types'
import { ELEMENT_TINTS } from './elementTints'
import { archetypeForElement } from './elementMapping'

// Elements которые получают дополнительный compStarBurst — "magical" feel.
const STAR_BURST_ELEMENTS: ReadonlySet<Element> = new Set<Element>([
  'arcane', 'war', 'void', 'plasma',
])

const BURST_SIZE = 14
const BURST_BRIGHTNESS = 1.0

/**
 * Одноразовый element-burst при тапе на carrier (ELEMENT-10).
 * 200-400ms: ring + sparkle + flash (+ starburst для magical elements).
 *
 * @param scene активная Phaser scene
 * @param container parent container (обычно frog.container)
 * @param element элемент carrier'а (определяет цвет/archetype)
 */
export function burstEffect(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  element: Element,
): void {
  if (!container.active) return

  const tint = ELEMENT_TINTS[element]
  const fakeSys: SharedBgSystem = {
    id: `burst-${element}`,
    name: element,
    x: 0, y: 0,
    type: 'resource',
    archetype: archetypeForElement(element),
    color: tint,
    accent: tint,
    size: BURST_SIZE,
    brightness: BURST_BRIGHTNESS,
    hasMoon: false,
    rngSeed: 0,
  }

  // One-shot — детерминизм не нужен.
  const rng = (): number => Math.random()

  try {
    compRing(scene, container, fakeSys, rng)
    compSparkle(scene, container, fakeSys, rng)
    compFlash(scene, container, rng)
    if (STAR_BURST_ELEMENTS.has(element)) {
      compStarBurst(scene, container, fakeSys, rng)
    }
  } catch (e) {
    // Не ломаем scene даже при сбое примитива.
    console.warn('[burstEffect] primitive failed for', element, e)
  }
}
