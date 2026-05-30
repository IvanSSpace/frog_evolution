// BuildingsController: статичные здания зоны строений (нижняя зона Болота).
//
// Заменяет отдельные Factory/Storage контроллеры — управляет всеми зданиями
// одним классом. Только визуал (геймплей не реализован). Раскладка из
// референса юзера (изометрия, 6 зданий по полю).
//
// Public API:
//   - preload(scene): загрузить текстуры (вызывается из MainScene.preload).
//   - show() / hide(): показать/скрыть все здания.
//   - getSprites(): спрайты для reparent в transition-контейнер (зум).
//   - destroy().

import Phaser from 'phaser'
import type { MainScene } from '../MainScene'
import { eventBus } from '../../../store/eventBus'

interface BuildingDef {
  key: string
  src: string
  // Доли зоны строений: x от ширины, y (низ спрайта) от высоты зоны.
  xFrac: number
  yFrac: number
  // Ширина спрайта как доля ширины экрана.
  widthFrac: number
  // Какую модалку открывает клик по зданию (если есть). Слушает App.tsx.
  opens?: string
}

// Раскладка по референсу: main↑центр, collector←, storage→,
// droner↙, space↘, scaner↓центр. yFrac = позиция «ног» здания в зоне.
const BUILDINGS: readonly BuildingDef[] = [
  { key: 'bld_main', src: '/builds/main.png', xFrac: 0.5, yFrac: 0.34, widthFrac: 0.40, opens: 'shop' },
  { key: 'bld_collector', src: '/builds/collector.png', xFrac: 0.24, yFrac: 0.54, widthFrac: 0.27 },
  { key: 'bld_storage', src: '/builds/storage.png', xFrac: 0.77, yFrac: 0.54, widthFrac: 0.29, opens: 'inventory' },
  { key: 'bld_droner', src: '/builds/droner.png', xFrac: 0.24, yFrac: 0.82, widthFrac: 0.29 },
  { key: 'bld_space', src: '/builds/space.png', xFrac: 0.77, yFrac: 0.78, widthFrac: 0.32 },
  { key: 'bld_scaner', src: '/builds/scaner.png', xFrac: 0.5, yFrac: 0.97, widthFrac: 0.27 },
] as const

export class BuildingsController {
  private scene: MainScene
  private sprites: Phaser.GameObjects.Image[] = []

  constructor(scene: MainScene) {
    this.scene = scene
  }

  /** Грузит текстуры зданий. Вызывать из MainScene.preload(). */
  static preload(scene: Phaser.Scene): void {
    for (const b of BUILDINGS) scene.load.image(b.key, b.src)
  }

  show(): void {
    if (this.sprites.length > 0) {
      for (const s of this.sprites) s.setVisible(true)
      return
    }
    const { width, height } = this.scene.scale
    // Зона строений в world-координатах: y от height до 2*height (см.
    // MainScene loc1Bg — tall bg height*2, нижняя половина = строения).
    const zoneTop = height
    const zoneH = height
    for (const b of BUILDINGS) {
      const sp = this.scene.add.image(0, 0, b.key)
      sp.setOrigin(0.5, 1) // низ-центр = «ноги» на земле
      const baseScale = (width * b.widthFrac) / sp.width
      sp.setScale(baseScale)
      sp.setPosition(width * b.xFrac, zoneTop + zoneH * b.yFrac)
      // Iso-сортировка между зданиями: ниже по y = ближе к зрителю. main —
      // поверх дронов (depth > drone 96000), чтобы дрон проходил ЗА зданием
      // при обходе на RTB-маршруте.
      sp.setDepth(b.key === 'bld_main' ? 200000 : b.yFrac * 100)
      // Тап → squash-jiggle (origin низ → сжатие к земле, как «толкнули»).
      sp.setInteractive({ useHandCursor: true })
      sp.on('pointerdown', () => {
        this.jiggle(sp, baseScale)
        if (b.opens) eventBus.emit('building:open', { modal: b.opens })
      })
      this.sprites.push(sp)
    }
  }

  /** Squash-jiggle при тапе: быстрое сжатие по вертикали + раздача вширь,
   *  затем пружинный возврат. Origin низ-центр → «приседает» к земле. */
  private jiggle(sp: Phaser.GameObjects.Image, baseScale: number): void {
    this.scene.tweens.killTweensOf(sp)
    sp.setScale(baseScale)
    this.scene.tweens.add({
      targets: sp,
      scaleY: baseScale * 0.9,
      scaleX: baseScale * 1.06,
      duration: 80,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        if (!sp.active) return
        this.scene.tweens.add({
          targets: sp,
          scaleX: baseScale,
          scaleY: baseScale,
          duration: 160,
          ease: 'Back.easeOut',
        })
      },
    })
  }

  hide(): void {
    for (const s of this.sprites) s.setVisible(false)
  }

  /** Спрайты для reparent в transition-контейнер (зум при смене локации). */
  getSprites(): Phaser.GameObjects.Image[] {
    return this.sprites
  }

  destroy(): void {
    for (const s of this.sprites) {
      this.scene.tweens.killTweensOf(s)
      s.destroy()
    }
    this.sprites = []
  }
}
