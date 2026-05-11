import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import type { Element, Rarity } from '../../store/cosmic/types'
import { scheduleAwakenedIdle } from '../../game/effects/elements/awakenedPresets'

interface GalleryDetailPreviewProps {
  archetype: Element
  rarity: Rarity
}

const SIZE = 300

function makePreviewScene(
  archetype: Element,
  rarity: Rarity,
): typeof Phaser.Scene {
  class PreviewScene extends Phaser.Scene {
    constructor() {
      super({ key: 'GalleryPreview' })
    }

    create() {
      const container = this.add.container(SIZE / 2, SIZE / 2)
      const placeholder = this.add.circle(0, 0, 40, 0x4ade80, 1)
      container.add(placeholder)
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
      style={{ width: SIZE, height: SIZE }}
      className="rounded-lg overflow-hidden"
    />
  )
}
