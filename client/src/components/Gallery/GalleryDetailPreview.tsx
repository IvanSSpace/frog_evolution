import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import type { Element } from '../../store/cosmic/types'
import type { LegacyRarity } from '../../store/cosmic/bestiary'
import { textureKeyForLevel, configForLevel } from '../../game/config/frogs'
import { ELEMENT_TINTS } from '../../game/effects/elements/elementTints'
import type { AuraSpec } from '../../game/effects/ElementAuraOverlay'
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
} from '../../game/effects/elementAuraSpecs'

interface GalleryDetailPreviewProps {
  archetype: Element
  rarity: LegacyRarity
}

const SIZE = 480

const RARITY_TO_LEVEL: Record<LegacyRarity, number> = {
  common: 1,
  rare: 7,
  epic: 13,
  legendary: 1, // disabled — fallback на L1
}

// Native rasterization size — высокое разрешение для sharpness при downscale
const NATIVE_LOAD_SIZE = 256

// Целевой display size в canvas:
//   L1 (cfg.size 0.8) → ~70px
//   L7 (cfg.size 2.0) → ~170px
// Формула: displayPx = cfg.size × DISPLAY_BASE_PX
const DISPLAY_BASE_PX = 85

// Маппинг archetype → AuraSpec. Используется тот же spec что и в main scene
// (ElementAuraOverlay), визуал гарантированно одинаковый.
const AURA_SPECS: Partial<Record<Element, AuraSpec>> = {
  fire: fireSpec,
  water: waterSpec,
  forest: forestSpec,
  toxic: toxicSpec,
  plasma: plasmaSpec,
  crystal: crystalSpec,
  desert: desertSpec,
  gas: gasSpec,
  ring: ringSpec,
  binary: binarySpec,
}

function makePreviewScene(
  archetype: Element,
  rarity: LegacyRarity,
): typeof Phaser.Scene {
  const level = RARITY_TO_LEVEL[rarity]
  const textureKey = textureKeyForLevel(level)
  const svgPath = configForLevel(level).path
  const spec = AURA_SPECS[archetype]

  class PreviewScene extends Phaser.Scene {
    constructor() {
      super({ key: 'GalleryPreview' })
    }

    preload() {
      // Загружаем raw SVG-текст, на FILE_COMPLETE препроцессим: заменяем
      // `fill #ffffff` на archetype element tint hex → Blob URL → svg texture.
      // Цветные элементы (короны/узоры) сохраняют свои цвета.
      this.load.text(`gallery_raw_${textureKey}`, svgPath)
      this.load.on(
        Phaser.Loader.Events.FILE_COMPLETE,
        (key: string, _type: string, data: unknown) => {
          if (key !== `gallery_raw_${textureKey}`) return
          if (typeof data !== 'string') return
          const tintHex =
            '#' +
            ELEMENT_TINTS[archetype].toString(16).padStart(6, '0')
          const recolored = data
            .replace(/fill:\s*#ffffff/gi, `fill:${tintHex}`)
            .replace(/fill="#ffffff"/gi, `fill="${tintHex}"`)
            .replace(/fill="#fff"/gi, `fill="${tintHex}"`)
          const blob = new Blob([recolored], { type: 'image/svg+xml' })
          const url = URL.createObjectURL(blob)
          this.load.svg(textureKey, url, {
            width: NATIVE_LOAD_SIZE,
            height: NATIVE_LOAD_SIZE,
          })
        },
      )
    }

    create() {
      // Aura спавнится первой (ниже по depth) — лягушка автоматически поверх.
      if (spec) {
        spec.ensureTextures(this)
        const aura = spec.createAura(this)
        aura.container.setPosition(SIZE / 2, SIZE / 2 - 20)
        aura.container.setScale(2.4) // увеличить для preview canvas (главная сцена меньше)
        aura.container.setDepth(0)
      }

      // Лягушка — tint уже запечён в SVG при preload, setTint не зовём.
      const container = this.add.container(SIZE / 2, SIZE / 2)
      container.setDepth(10)
      const frog = this.add.image(0, 0, textureKey)
      const displayPx = 2.0 * DISPLAY_BASE_PX // 170px
      const scale = displayPx / NATIVE_LOAD_SIZE
      frog.setScale(scale)
      container.add(frog)
    }
  }
  return PreviewScene
}

export function GalleryDetailPreview({
  archetype,
  rarity,
}: GalleryDetailPreviewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!ref.current) return

    const SceneClass = makePreviewScene(archetype, rarity)

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: SIZE,
      height: SIZE,
      parent: ref.current,
      transparent: true,
      scene: SceneClass,
      scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
    })
    gameRef.current = game

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [archetype, rarity])

  return (
    <div
      ref={ref}
      style={{ width: SIZE, height: SIZE, pointerEvents: 'none' }}
      className="rounded-lg overflow-hidden"
    />
  )
}
