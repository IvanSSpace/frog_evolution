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

const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
// Если палец между pointerdown и pointerup сдвинулся больше этого порога —
// это был скролл/пан (смена зоны frogs↔buildings), а не тап: модалку НЕ
// открываем. Значение совпадает со SWIPE_SLOP в MainScene (порог начала пана),
// поэтому «любой жест, который запанил камеру, не открывает здание».
const BUILDING_TAP_SLOP = 90 * DPR

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
  {
    key: 'bld_main',
    src: '/builds/main.png',
    xFrac: 0.53,
    yFrac: 0.33,
    widthFrac: 0.37,
    opens: 'shop',
  },
  {
    key: 'bld_collector',
    src: '/builds/collector.png',
    xFrac: 0.3,
    yFrac: 0.54,
    widthFrac: 0.27,
  },
  {
    key: 'bld_storage',
    src: '/builds/storage.png',
    xFrac: 0.77,
    yFrac: 0.54,
    widthFrac: 0.29,
    opens: 'inventory',
  },
  {
    key: 'bld_droner',
    src: '/builds/droner.png',
    xFrac: 0.3,
    yFrac: 0.82,
    widthFrac: 0.37,
    opens: 'droner',
  },
  {
    key: 'bld_space',
    src: '/builds/space.png',
    xFrac: 0.77,
    yFrac: 0.78,
    widthFrac: 0.32,
  },
  {
    key: 'bld_scaner',
    src: '/builds/scaner.png',
    xFrac: 0.5,
    yFrac: 0.97,
    widthFrac: 0.27,
  },
] as const

export class BuildingsController {
  private scene: MainScene
  private sprites: Phaser.GameObjects.Image[] = []
  // TEMP preview (НЕ КОММИТИТЬ): надпись «Собрать» над коллектором.
  private collectLabel: Phaser.GameObjects.Container | null = null
  // TEMP preview (НЕ КОММИТИТЬ): идёт анимация сбора.
  private collecting = false
  // TEMP preview (НЕ КОММИТИТЬ): отдельная надёжная хит-зона кнопки «Собрать».
  private collectHit: Phaser.GameObjects.Rectangle | null = null

  constructor(scene: MainScene) {
    this.scene = scene
  }

  /** Грузит текстуры зданий. Вызывать из MainScene.preload(). */
  static preload(scene: Phaser.Scene): void {
    for (const b of BUILDINGS) scene.load.image(b.key, b.src)
    // Состояния коллектора по заполнению (превью + будущая механика).
    scene.load.image('bld_collector_empty', '/builds/collector_empty.png')
    scene.load.image('bld_collector_full', '/builds/collector_full.png')
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
      sp.setDepth(
        b.key === 'bld_main' ||
          b.key === 'bld_scaner' ||
          b.key === 'bld_collector'
          ? 200000
          : b.yFrac * 100,
      )
      // Тап → squash-jiggle (origin низ → сжатие к земле, как «толкнули»).
      sp.setInteractive({ useHandCursor: true })
      sp.on('pointerdown', () => this.jiggle(sp, baseScale))
      if (b.opens) {
        const modal = b.opens
        sp.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          // Отличаем тап от скролла: если палец проехал больше порога — это был
          // свайп смены зоны и палец просто оказался над зданием на отпускании.
          const moved = Phaser.Math.Distance.Between(
            pointer.downX,
            pointer.downY,
            pointer.upX,
            pointer.upY,
          )
          if (moved > BUILDING_TAP_SLOP) return
          eventBus.emit('building:open', { modal })
        })
      }
      this.sprites.push(sp)
      // if (b.key === 'bld_collector') this.buildCollectLabel(sp) // временно скрыто
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

  // TEMP preview (НЕ КОММИТИТЬ): пилюля-кнопка «Собрать» над коллектором.
  // @ts-expect-error временно скрыто — метод не вызывается
  private buildCollectLabel(sp: Phaser.GameObjects.Image): void {
    if (this.collectLabel) return
    const scene = this.scene
    const dpr = window.devicePixelRatio || 1
    const fontPx = Math.round(15 * dpr)
    const padX = 16 * dpr
    const padY = 9 * dpr
    const borderW = 3 * dpr
    const bottomEdge = 4 * dpr // утолщённая нижняя кромка (3D, как ff-btn)

    const txt = scene.add
      .text(0, 0, 'Собрать', {
        fontFamily: "'Russo One', system-ui, sans-serif",
        fontSize: `${fontPx}px`,
        color: '#ffffff',
      })
      .setOrigin(0.5)
    txt.setShadow(0, 2 * dpr, 'rgba(0,0,0,0.35)', 0, false, true)

    const w = txt.width + padX * 2
    const h = txt.height + padY * 2
    const r = Math.min(14 * dpr, h / 2)

    const g = scene.add.graphics()
    // тёмная база/рамка — снизу выступает на bottomEdge (3D-кромка)
    g.fillStyle(0x14532d, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h + bottomEdge, r)
    // лицо: вертикальный градиент как .ff-btn-green (#4ade80 → #16a34a)
    g.fillGradientStyle(0x4ade80, 0x4ade80, 0x16a34a, 0x16a34a, 1)
    g.fillRoundedRect(
      -w / 2 + borderW,
      -h / 2 + borderW,
      w - borderW * 2,
      h - borderW * 2,
      Math.max(2, r - borderW),
    )
    // верхний глянцевый блик (inset highlight)
    g.fillStyle(0xffffff, 0.3)
    g.fillRoundedRect(
      -w / 2 + borderW + 2 * dpr,
      -h / 2 + borderW + 1 * dpr,
      w - (borderW + 2 * dpr) * 2,
      (h - borderW * 2) * 0.34,
      Math.max(2, (r - borderW) * 0.8),
    )

    // Позиция: по центру X спрайта, чуть выше его верхней кромки.
    const topY = sp.y - sp.displayHeight + 12 * dpr - (h + bottomEdge) / 2
    const cont = scene.add.container(sp.x, topY, [g, txt])
    cont.setDepth(1000000) // гарантированно поверх коллектора и всех зданий
    this.collectLabel = cont

    // Отдельная НАДЁЖНАЯ хит-зона: невидимый Rectangle (хит-тест как у картинок-
    // зданий, которые тапаются корректно — в отличие от кастомного hitArea
    // контейнера). Шире визуала + самый верхний depth → ловит тап раньше main.
    const hitW = w + 44 * dpr
    const hitH = h + bottomEdge + 40 * dpr
    const hit = scene.add.rectangle(sp.x, topY, hitW, hitH, 0xffffff, 0)
    hit.setDepth(1000001)
    hit.setInteractive({ useHandCursor: true })
    this.collectHit = hit
    hit.on('pointerdown', () => {
      if (this.collecting) return
      this.collecting = true
      hit.destroy()
      this.collectHit = null
      // Кнопка плавно исчезает.
      scene.tweens.add({
        targets: cont,
        alpha: 0,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 220,
        ease: 'Quad.easeIn',
        onComplete: () => {
          cont.destroy()
          if (this.collectLabel === cont) this.collectLabel = null
        },
      })
      // Здание: новое (collector_empty) появляется ПОД старым, старое плавно исчезает.
      sp.disableInteractive()
      this.swapBuilding(sp, 'bld_collector_empty')
    })
  }

  // TEMP preview (НЕ КОММИТИТЬ): меняет здание — новый спрайт появляется ПОД
  // старым (та же позиция/ширина, свой корректный baseScale и jiggle), старый
  // плавно исчезает и уничтожается. Так смена выглядит как «подменили снизу».
  private swapBuilding(
    oldSp: Phaser.GameObjects.Image,
    key: string,
  ): Phaser.GameObjects.Image {
    const scene = this.scene
    const targetW = oldSp.displayWidth // сохраняем текущую экранную ширину
    const nw = scene.add.image(oldSp.x, oldSp.y, key)
    nw.setOrigin(0.5, 1)
    nw.setDisplaySize(targetW, targetW * (nw.height / nw.width))
    nw.setDepth(oldSp.depth - 0.5) // чуть ниже старого → старый поверх, потом тает
    const baseScale = nw.scaleX
    nw.setInteractive({ useHandCursor: true })
    nw.on('pointerdown', () => this.jiggle(nw, baseScale))
    // заменяем ссылку в sprites
    const idx = this.sprites.indexOf(oldSp)
    if (idx >= 0) this.sprites[idx] = nw
    // старый плавно исчезает
    scene.tweens.killTweensOf(oldSp)
    scene.tweens.add({
      targets: oldSp,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => {
        scene.tweens.killTweensOf(oldSp)
        oldSp.destroy()
      },
    })
    return nw
  }

  hide(): void {
    for (const s of this.sprites) s.setVisible(false)
  }

  /**
   * Уход с локации в transition: спрайты УЖЕ reparent'нуты в зум-контейнер,
   * который уничтожит их через destroy(true). Роняем ссылки (не destroy'им —
   * иначе double-destroy) + чистим вспомогательные оверлеи. show() при возврате
   * на Болото пересоздаст здания с нуля.
   */
  releaseForTransition(): void {
    if (this.collectLabel) {
      this.collectLabel.destroy()
      this.collectLabel = null
    }
    if (this.collectHit) {
      this.collectHit.destroy()
      this.collectHit = null
    }
    this.sprites = []
  }

  /** Спрайты для reparent в transition-контейнер (зум при смене локации). */
  getSprites(): Phaser.GameObjects.Image[] {
    return this.sprites
  }

  destroy(): void {
    if (this.collectLabel) {
      this.collectLabel.destroy()
      this.collectLabel = null
    }
    if (this.collectHit) {
      this.collectHit.destroy()
      this.collectHit = null
    }
    for (const s of this.sprites) {
      this.scene.tweens.killTweensOf(s)
      s.destroy()
    }
    this.sprites = []
  }
}
