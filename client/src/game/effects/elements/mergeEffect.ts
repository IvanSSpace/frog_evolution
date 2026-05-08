// Phase 13: mergeEffect — same-element merge composite anim (ELEMENT-11).
// 600-800ms blast: ring expand (t=0) → sparkle burst (t=100) → ground ripple (t=300)
// → flash finale (t=500) → cleanup tmp container (t=800).
//
// Вызывается в MainScene.performMerge при совпадении element обоих carriers.

import type Phaser from 'phaser'
import type { Element } from '../../../store/cosmic/types'
import {
  compRing, compSparkle, compFlash, compRipple,
} from '../anim/shared'
import type { SharedBgSystem } from '../anim/shared/types'
import { ELEMENT_TINTS } from './elementTints'
import { archetypeForElement } from './elementMapping'

const MERGE_SIZE = 16
const MERGE_BRIGHTNESS = 1.0
// Depth выше merge vortex (99997 в MainScene) — мердж anim играет поверх vortex.
const MERGE_DEPTH = 99998
// Total lifetime — все primitives успевают завершиться к этому моменту.
const TMP_TTL_MS = 900

/**
 * One-shot 600-800ms composite anim для same-element merge.
 *
 * @param scene  активная Phaser scene
 * @param cx     центр мерджа (world coords)
 * @param cy     центр мерджа (world coords)
 * @param element элемент обоих carriers (одинаковый)
 */
export function mergeEffect(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  element: Element,
): void {
  // Создаём временный container на (cx, cy) в scene root.
  const tmp = scene.add.container(cx, cy)
  tmp.setDepth(MERGE_DEPTH)

  const tint = ELEMENT_TINTS[element]
  const fakeSys: SharedBgSystem = {
    id: `merge-${element}`,
    name: element,
    x: cx, y: cy,
    type: 'resource',
    archetype: archetypeForElement(element),
    color: tint,
    accent: tint,
    size: MERGE_SIZE,
    brightness: MERGE_BRIGHTNESS,
    hasMoon: false,
    rngSeed: 0,
  }
  const rng = (): number => Math.random()

  // t=0: ring expand (longest — стартует немедленно).
  try {
    compRing(scene, tmp, fakeSys, rng)
  } catch (e) {
    console.warn('[mergeEffect] compRing failed', element, e)
  }

  // t=100ms: sparkle burst.
  scene.time.delayedCall(100, () => {
    if (!tmp.active) return
    try {
      compSparkle(scene, tmp, fakeSys, rng)
    } catch (e) {
      console.warn('[mergeEffect] compSparkle failed', element, e)
    }
  })

  // t=300ms: ground ripple.
  scene.time.delayedCall(300, () => {
    if (!tmp.active) return
    try {
      compRipple(scene, tmp, fakeSys, rng)
    } catch (e) {
      console.warn('[mergeEffect] compRipple failed', element, e)
    }
  })

  // t=500ms: flash finale (без sys).
  scene.time.delayedCall(500, () => {
    if (!tmp.active) return
    try {
      compFlash(scene, tmp, rng)
    } catch (e) {
      console.warn('[mergeEffect] compFlash failed', element, e)
    }
  })

  // t=900ms: cleanup tmp container (все child tweens к этому моменту завершены).
  // Phaser отменит delayedCall сам, если scene shutdown'ится раньше — tmp
  // тогда уничтожится через scene cleanup автоматически.
  scene.time.delayedCall(TMP_TTL_MS, () => {
    if (tmp.active) tmp.destroy(true)
  })
}
