// Phase 12: dormant idle presets — по одному на 16 элементов.
// Каждый preset вызывает один из Phase 9 primitives (effects/anim/shared)
// с минимальной интенсивностью: малый sys.size, низкий brightness, low alpha,
// throttle интервал 3000ms. Phase 13 добавит awakened tiers (common/rare/epic/legendary).

import type Phaser from 'phaser'
import type { Element } from '../../../store/cosmic/types'
import {
  compFlameTongues,
  compIceWisps,
  compRipple,
  compBloomPetals,
  compToxicCloud,
  compPlasmaArc,
  compHaloFlash,
  compCrystalShatter,
  compSandSwirl,
  compChromaShift,
  compChimeRing,
  compEchoWave,
  compStarBurst,
  compConfetti,
  compFlash,
  compBubbleStream,
} from '../anim/shared'
import type { SharedBgSystem } from '../anim/shared/types'
import { ELEMENT_TINTS } from './elementTints'
import { archetypeForElement } from './elementMapping'
import type { OverlayLifecycle } from './types'
import { devWarn } from '../../../utils/devLog'

// Все primitives кроме compFlash принимают (scene, container, sys, rng).
// compFlash — special case: (scene, container, rng).
type SysPrimitive = (
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  sys: SharedBgSystem,
  rng: () => number,
) => void

type FlashPrimitive = (
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  rng: () => number,
) => void

interface DormantPreset {
  // Если flash=true — special signature (без sys).
  flash?: FlashPrimitive
  fn?: SysPrimitive
}

// 16 dormant idle presets. Подобраны так, чтобы каждый element имел свой
// уникальный визуальный мотив через Phase 9 primitives.
const DORMANT_PRESETS: Record<Element, DormantPreset> = {
  fire: { fn: compFlameTongues }, // языки пламени
  ice: { fn: compIceWisps }, // ледяные завитки
  water: { fn: compRipple }, // расширяющиеся круги
  forest: { fn: compBloomPetals }, // лепестки цветка
  toxic: { fn: compToxicCloud }, // ядовитое облако
  plasma: { fn: compPlasmaArc }, // плазменная дуга
  shadow: { fn: compHaloFlash }, // тёмное свечение
  crystal: { fn: compCrystalShatter }, // кристальный осколок
  desert: { fn: compSandSwirl }, // песчаный вихрь
  gas: { fn: compChromaShift }, // хроматический сдвиг
  ring: { fn: compChimeRing }, // тонкое кольцо
  binary: { fn: compEchoWave }, // эхо-волна
  arcane: { fn: compStarBurst }, // взрыв звёзд
  mechanical: { fn: compConfetti }, // фрагмент-конфетти
  war: { flash: compFlash }, // короткая вспышка
  void: { fn: compBubbleStream }, // тёмные пузыри
}

// КРИТИЧНО: малый размер → primitives рендерят малые объекты, не перекрывают спрайт лягушки.
const DORMANT_SYS_SIZE = 6
const DORMANT_BRIGHTNESS = 0.4

// ELEMENT-08: throttle hook. Phase 20 INFRA-05 wires real adaptive throttle factor.
// Сейчас throttle=1 → 3000ms; throttle=0.5 → 6000ms (медленнее), throttle=2 → 1500ms (быстрее).
const BASE_INTERVAL_MS = 3000

interface ScheduleOpts {
  /** Phase 20 INFRA-05 wires real adaptive throttle factor here.
   *  >0; default 1 → 3000ms. <1 = реже, >1 = чаще (но cap'нутый снизу). */
  throttle?: number
}

/**
 * Запускает повторяющийся idle-эффект для element поверх container.
 * Возвращает OverlayLifecycle с dispose() — отменяет timer, останавливает анимации.
 *
 * @param scene активная Phaser scene
 * @param container parent container (обычно frog.container или overlay.container)
 * @param element один из 16 elements
 * @param opts опции (throttle для Phase 20)
 */
export function scheduleDormantIdle(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  element: Element,
  opts?: ScheduleOpts,
): OverlayLifecycle {
  const tint = ELEMENT_TINTS[element]
  const archetype = archetypeForElement(element)

  // Build minimal "fake" SharedBgSystem (primitives expect AnimSys-shape).
  // pickColor() читает archetype + color/accent → сэмплит из THEME_PALETTES.
  const fakeSys: SharedBgSystem = {
    id: `dormant-${element}`,
    name: element,
    x: 0,
    y: 0,
    type: 'resource',
    archetype,
    color: tint,
    accent: tint,
    size: DORMANT_SYS_SIZE,
    brightness: DORMANT_BRIGHTNESS,
    hasMoon: false,
    rngSeed: 0,
  }

  // Deterministic rng → стабильная картинка между tick'ами (вариация всё равно есть
  // через сами primitives — они часто читают rng() много раз).
  // Но нам нужно немного рандомности чтобы effect отличался от тика к тику.
  // Используем простой LCG seeded by Date.now()/element для разнообразия:
  let seed = (Date.now() ^ element.length) >>> 0
  const rng = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return (seed & 0xffffffff) / 0x100000000
  }

  const throttle = Math.max(0.1, opts?.throttle ?? 1)
  const intervalMs = Math.round(BASE_INTERVAL_MS / throttle)

  const preset = DORMANT_PRESETS[element]

  const timer = scene.time.addEvent({
    delay: intervalMs,
    loop: true,
    callback: () => {
      // Защита от race condition: container мог быть destroyed/detached.
      // Phaser ставит scene=null при destroy → readonly check.
      const ownerScene: Phaser.Scene | null = (
        container as { scene: Phaser.Scene | null }
      ).scene
      if (!ownerScene || !container.active) return
      try {
        if (preset.flash) {
          preset.flash(scene, container, rng)
        } else if (preset.fn) {
          preset.fn(scene, container, fakeSys, rng)
        }
      } catch (e) {
        // T-12-08: primitive crash не должен ломать сцену; warn один раз и тихо стопаем idle.
        devWarn('[dormant] primitive failed for', element, e)
        timer.remove(false)
      }
    },
  })

  return {
    dispose: () => {
      timer.remove(false)
    },
  }
}
