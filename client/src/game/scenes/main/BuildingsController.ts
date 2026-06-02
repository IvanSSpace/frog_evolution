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

// Loc2 (Лес) — 3 здания по референсу toxic_map2_2size_bottom.png:
//   фабрика фрогов L7 (верх-лево, конвейер) / фабрика дронов-с-пушкой (верх-право,
//   купол) / капсула репликации (низ-центр, Y-кластер). Геймплей пока не реализован
//   (только визуал, как loc1). Позиции приблизительные — подстраиваются итеративно.
const BUILDINGS_LOC2: readonly BuildingDef[] = [
  {
    key: 'bld2_factory',
    src: '/builds_loc2/frog_factory2loc.png',
    xFrac: 0.28,
    yFrac: 0.54,
    widthFrac: 0.46,
  },
  {
    key: 'bld2_droner',
    src: '/builds_loc2/droner2loc.png',
    xFrac: 0.74,
    yFrac: 0.48,
    widthFrac: 0.34,
    opens: 'ectoDroner',
  },
  // Капсула репликации: центральная (крупнее) + 2 позади неё слева/справа.
  // Боковые с меньшим yFrac → ниже depth → рендерятся ЗА центральной.
  {
    key: 'bld2_capsule',
    src: '/builds_loc2/capsule1_semi.png',
    xFrac: 0.3,
    yFrac: 0.83,
    widthFrac: 0.28,
  },
  {
    key: 'bld2_capsule',
    src: '/builds_loc2/capsule1_semi.png',
    xFrac: 0.74,
    yFrac: 0.83,
    widthFrac: 0.28,
  },
  {
    key: 'bld2_capsule',
    src: '/builds_loc2/capsule1_semi.png',
    xFrac: 0.52,
    yFrac: 0.92,
    widthFrac: 0.28,
  },
] as const

// Loc3 (Континент) — древняя земля: монумент-тотем (центр, чуть выше) + блок
// эволюции (низ). Источник лягушек (болотные бассейны) + источник-тик — отдельно.
const BUILDINGS_LOC3: readonly BuildingDef[] = [
  {
    key: 'bld3_monument',
    src: '/builds_loc3/monument.png',
    xFrac: 0.56,
    yFrac: 0.52,
    widthFrac: 0.4,
    opens: 'fireLevels', // клик → модалка настройки огней (Чанк 2)
  },
  {
    key: 'bld3_evoblock',
    src: '/builds_loc3/evoblock1_tansparent.png',
    xFrac: 0.5,
    yFrac: 0.9,
    widthFrac: 0.62,
    opens: 'evolution',
  },
] as const

// Набор зданий по локации. Расширяется по мере добавления локаций.
const BUILDINGS_BY_LOC: Record<number, readonly BuildingDef[]> = {
  1: BUILDINGS,
  2: BUILDINGS_LOC2,
  3: BUILDINGS_LOC3,
}

export class BuildingsController {
  private scene: MainScene
  private sprites: Phaser.GameObjects.Image[] = []
  // Локация, для которой сейчас построен набор зданий. При смене локации
  // старый набор уничтожается и строится новый (loc1 ↔ loc2).
  private builtLoc: number | null = null
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
    for (const b of BUILDINGS_LOC2) scene.load.image(b.key, b.src)
    for (const b of BUILDINGS_LOC3) scene.load.image(b.key, b.src)
    // Слои активного блока эволюции: зад (active) под лягушками + перёд (стекло)
    // поверх. Лягушки плавают между ними.
    scene.load.image('bld3_evoblock_back', '/builds_loc3/evoblockActive.png')
    scene.load.image(
      'bld3_evoblock_front',
      '/builds_loc3/evoblock_transparent2.png',
    )
    // Состояния коллектора по заполнению (превью + будущая механика).
    scene.load.image('bld_collector_empty', '/builds/collector_empty.png')
    scene.load.image('bld_collector_full', '/builds/collector_full.png')
    // Капсула репликации loc2: «заряженная» текстура (показывается во время
    // мерджа поверх обычной, плавно). capsule2_semi — того же размера.
    scene.load.image('bld2_capsule_full', '/builds_loc2/capsule2_semi.png')
  }

  show(locId: number): void {
    // Смена локации → уничтожить старый набор, построить новый.
    if (this.builtLoc !== null && this.builtLoc !== locId) {
      this.destroySprites()
    }
    if (this.sprites.length > 0) {
      for (const s of this.sprites) s.setVisible(true)
      return
    }
    const defs = BUILDINGS_BY_LOC[locId]
    if (!defs) return
    this.builtLoc = locId
    const { width, height } = this.scene.scale
    // Зона строений в world-координатах: y от height до 2*height (см.
    // MainScene loc1Bg/loc2Bg — tall bg height*2, нижняя половина = строения).
    const zoneTop = height
    const zoneH = height
    for (const b of defs) {
      const sp = this.scene.add.image(0, 0, b.key)
      sp.setOrigin(0.5, 1) // низ-центр = «ноги» на земле
      const baseScale = (width * b.widthFrac) / sp.width
      sp.setScale(baseScale)
      sp.setPosition(width * b.xFrac, zoneTop + zoneH * b.yFrac)
      // Iso-сортировка между зданиями: ниже по y = ближе к зрителю. main —
      // поверх дронов (depth > drone 96000), чтобы дрон проходил ЗА зданием
      // при обходе на RTB-маршруте.
      // Loc2-капсулы: depth ВЫШЕ лягушек (frog depth = container.y ~1.7*H) —
      // лягушка-мердж видна ВНУТРИ колбы (за полупрозрачным стеклом), а не поверх.
      // Loc3 evoblock — тоже поверх лягушек: эволюционирующая видна ВНУТРИ.
      const isFrontGlass =
        b.key === 'bld2_capsule' ||
        b.key === 'bld2_capsule_green' ||
        b.key === 'bld3_evoblock'
      sp.setDepth(
        isFrontGlass
          ? 300000 + b.yFrac
          : b.key === 'bld_main' ||
              b.key === 'bld_scaner' ||
              b.key === 'bld_collector'
            ? 200000
            : b.yFrac * 100,
      )
      // Squash-jiggle + открытие модалки — на ОТПУСКАНИЕ (pointerup), не на
      // нажатие: иначе анимация дёргается при старте скролла. И только если это
      // тап, а не скролл (палец проехал меньше порога): свайп смены зоны мог
      // начаться прямо со здания и палец просто оказался над ним на отпускании.
      sp.setInteractive({ useHandCursor: true })
      const modal = b.opens
      sp.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        const moved = Phaser.Math.Distance.Between(
          pointer.downX,
          pointer.downY,
          pointer.upX,
          pointer.upY,
        )
        if (moved > BUILDING_TAP_SLOP) return
        this.jiggle(sp, baseScale)
        if (modal) eventBus.emit('building:open', { modal })
      })
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
    // Спрайты ушли в зум-контейнер (он их уничтожит) — следующий show()
    // должен пересобрать набор с нуля.
    this.builtLoc = null
  }

  /** Спрайты для reparent в transition-контейнер (зум при смене локации). */
  getSprites(): Phaser.GameObjects.Image[] {
    return this.sprites
  }

  /** Спрайт фабрики лягушек loc2 (для конвейер-анимации при выпуске). */
  getFactorySprite(): Phaser.GameObjects.Image | null {
    return this.sprites.find((s) => s.texture.key === 'bld2_factory') ?? null
  }

  /** Спрайт блока эволюции loc3 (для EvolutionCenterController — FX/камеры). */
  getEvoblockSprite(): Phaser.GameObjects.Image | null {
    return this.sprites.find((s) => s.texture.key === 'bld3_evoblock') ?? null
  }

  /** Спрайты капсул репликации loc2 (для CapsuleMergeController — FX мерджа). */
  getCapsuleSprites(): Phaser.GameObjects.Image[] {
    return this.sprites.filter((s) => {
      const k = s.texture.key
      return k === 'bld2_capsule' || k === 'bld2_capsule_green'
    })
  }

  // Уничтожить текущий набор зданий (при смене локации loc1↔loc2 / teardown).
  private destroySprites(): void {
    for (const s of this.sprites) {
      this.scene.tweens.killTweensOf(s)
      s.destroy()
    }
    this.sprites = []
    this.builtLoc = null
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
    this.destroySprites()
  }
}
