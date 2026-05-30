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

interface BuildingDef {
  key: string
  src: string
  // Доли зоны строений: x от ширины, y (низ спрайта) от высоты зоны.
  xFrac: number
  yFrac: number
  // Ширина спрайта как доля ширины экрана.
  widthFrac: number
}

// Раскладка по референсу: main↑центр, collector←, storage→,
// droner↙, space↘, scaner↓центр. yFrac = позиция «ног» здания в зоне.
const BUILDINGS: readonly BuildingDef[] = [
  { key: 'bld_main', src: '/builds/main.png', xFrac: 0.5, yFrac: 0.34, widthFrac: 0.44 },
  { key: 'bld_collector', src: '/builds/collector.png', xFrac: 0.24, yFrac: 0.54, widthFrac: 0.27 },
  { key: 'bld_storage', src: '/builds/storage.png', xFrac: 0.77, yFrac: 0.54, widthFrac: 0.29 },
  { key: 'bld_droner', src: '/builds/droner.png', xFrac: 0.24, yFrac: 0.82, widthFrac: 0.29 },
  { key: 'bld_space', src: '/builds/space.png', xFrac: 0.77, yFrac: 0.8, widthFrac: 0.32 },
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
      sp.setScale((width * b.widthFrac) / sp.width)
      sp.setPosition(width * b.xFrac, zoneTop + zoneH * b.yFrac)
      // Iso-сортировка между зданиями: ниже по y = ближе к зрителю.
      sp.setDepth(b.yFrac * 100)
      this.sprites.push(sp)
    }
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
