import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import type { Element, Rarity } from '../../store/cosmic/types'
import {
  playAwakenedOnce,
  scheduleAwakenedIdle,
} from '../../game/effects/elements/awakenedPresets'
import { textureKeyForLevel, configForLevel } from '../../game/config/frogs'

interface GalleryDetailPreviewProps {
  archetype: Element
  rarity: Rarity
}

const SIZE = 480

const RARITY_TO_LEVEL: Record<Rarity, number> = {
  common: 1,
  rare: 7,
  epic: 13,
  legendary: 1, // disabled — fallback на L1
}

function makePreviewScene(
  archetype: Element,
  rarity: Rarity,
): typeof Phaser.Scene {
  const level = RARITY_TO_LEVEL[rarity]
  const textureKey = textureKeyForLevel(level)
  const svgPath = configForLevel(level).path

  class PreviewScene extends Phaser.Scene {
    constructor() {
      super({ key: 'GalleryPreview' })
    }

    preload() {
      this.load.svg(textureKey, svgPath, { width: 80, height: 80 })
    }

    create() {
      const container = this.add.container(SIZE / 2, SIZE / 2)
      const frog = this.add.image(0, 0, textureKey)
      // cfg.size из FROG_LEVELS — тот же множитель, что и в игре
      const cfg = configForLevel(level)
      if (cfg && typeof cfg.size === 'number') {
        frog.setScale(cfg.size)
      }
      container.add(frog)
      playAwakenedOnce(this, container, archetype, rarity)
      scheduleAwakenedIdle(this, container, archetype, rarity)
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
      style={{
        width: SIZE,
        height: SIZE,
        pointerEvents: 'none', // canvas не должен ловить клики — UI поверх остаётся кликабельным
      }}
      className="rounded-lg overflow-hidden"
    />
  )
}
