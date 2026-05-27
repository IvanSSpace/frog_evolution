// ShipDeckScene — снаряжение корабля перед космической экспедицией.
//
// По центру spaceShip.webp, снизу — пул доступных лягушек (уровень корабля),
// над ним слоты отряда (макс 6, мин 1). Тап по лягушке двигает её в отряд / назад.
// «Запустить» → лягушки по очереди запрыгивают в корабль → тряска → взлёт вверх →
// emit 'shipdeck:launch' (React стартует экспедицию). ✕ → 'shipdeck:cancel'.
//
// Открывается/закрывается через eventBus из game/index.ts (sleep/wake MainScene),
// как RaidScoutScene. Параметры (shipId, диапазон уровней) передаются setParams().

import Phaser from 'phaser'
import { DPR, BASE_SCALE } from '../main/types'
import { textureKeyForLevel } from '../../config/frogs'
import { eventBus } from '../../../store/eventBus'
import { useGameStore } from '../../../store/gameStore'

interface DeckParams {
  shipId: number
  location: number
  minL: number
  maxL: number
  demo: boolean
}

const MAX_CREW = 6

export class ShipDeckScene extends Phaser.Scene {
  private params: DeckParams = {
    shipId: 1,
    location: 1,
    minL: 1,
    maxL: 6,
    demo: false,
  }
  private ready = false
  private launching = false

  private frogs: number[] = [] // все доступные лягушки (стабильный список)
  private selected = new Set<number>() // индексы выбранных в this.frogs
  private frogTiers: number[] = [] // tier эволюции per-level (для модельки)

  private layer!: Phaser.GameObjects.Container
  private titleText!: Phaser.GameObjects.Text
  private hintText!: Phaser.GameObjects.Text
  private launchBtn!: Phaser.GameObjects.Text
  private ship!: Phaser.GameObjects.Image
  private crewSprites: Phaser.GameObjects.Image[] = []

  constructor() {
    super('ShipDeckScene')
  }

  preload() {
    if (!this.textures.exists('spaceShip')) {
      this.load.image('spaceShip', '/spaceShip.webp')
    }
  }

  create() {
    this.ready = true
    this.scale.on('resize', this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.layout, this)
    })
    this.reset()
  }

  // Called from index.ts when (re)opening the scene.
  setParams(p: DeckParams) {
    this.params = p
    if (this.ready) this.reset()
  }

  reset() {
    this.launching = false
    const { location, minL, maxL } = this.params
    const store = useGameStore.getState()
    const all = store.locationFrogs[location - 1] ?? []
    this.frogs = all.filter((lvl) => lvl >= minL && lvl <= maxL)
    this.frogTiers = store.frogTiers
    this.selected = new Set()
    this.layout()
  }

  private layout = () => {
    if (!this.ready) return
    const w = this.scale.width
    const h = this.scale.height

    // Fresh layer each layout — simplest robust rebuild.
    this.layer?.destroy()
    this.layer = this.add.container(0, 0)

    // bg
    const bg = this.add
      .rectangle(0, 0, w, h, 0x0a0e1a)
      .setOrigin(0)
      .setInteractive()
    this.layer.add(bg)

    // title + hint
    this.titleText = this.add
      .text(
        w / 2,
        24 * DPR,
        `🛰️ Снаряди экипаж (L${this.params.minL}-${this.params.maxL})`,
        {
          fontFamily: 'sans-serif',
          fontSize: `${16 * DPR}px`,
          color: '#e8ecf6',
          fontStyle: 'bold',
        },
      )
      .setOrigin(0.5, 0)
    this.layer.add(this.titleText)

    // exit ✕
    const exit = this.add
      .text(14 * DPR, 16 * DPR, '✕', {
        fontFamily: 'sans-serif',
        fontSize: `${22 * DPR}px`,
        color: '#ff8a8a',
        fontStyle: 'bold',
      })
      .setInteractive({ useHandCursor: true })
    exit.on('pointerup', () => {
      if (!this.launching) eventBus.emit('shipdeck:cancel', {})
    })
    this.layer.add(exit)

    // ship — centered
    const shipCx = w / 2
    const shipCy = h * 0.4
    this.ship = this.add.image(shipCx, shipCy, 'spaceShip')
    const shipTarget = Math.min(w, h) * 0.36
    this.ship.setScale(shipTarget / Math.max(this.ship.width, this.ship.height))
    this.layer.add(this.ship)

    // Все лягушки внизу, разбросаны (grid + детерминированный jitter — стабильно
    // между перерисовками). Тап → выделение (кольцо под лягушкой) on/off.
    // На запуск летят только выделенные.
    this.crewSprites = []
    const n = this.frogs.length
    const cols = Math.max(3, Math.min(6, Math.ceil(Math.sqrt(n * 1.6))))
    const padX = w * 0.1 // отступ от краёв
    const usableW = w - padX * 2
    const cellW = usableW / cols
    const bandTop = h * 0.58
    const bandH = h * 0.3
    const rows = Math.max(1, Math.ceil(n / cols))
    const rowH = bandH / rows

    this.frogs.forEach((lvl, idx) => {
      const c = idx % cols
      const r = Math.floor(idx / cols)
      // Центрируем каждый ряд (последний неполный — по центру) → ровные интервалы.
      const itemsInRow = Math.min(cols, n - r * cols)
      const rowStartX = (w - itemsInRow * cellW) / 2
      // Малый jitter — лёгкий «живой» разброс, но интервалы почти равные.
      const jx = (this.hashFrac(idx * 1.7) - 0.5) * cellW * 0.22
      const jy = (this.hashFrac(idx * 3.3 + 1) - 0.5) * rowH * 0.22
      const x = rowStartX + cellW * (c + 0.5) + jx
      const y = bandTop + rowH * (r + 0.5) + jy
      const isSel = this.selected.has(idx)

      if (isSel) {
        const ringW = 50 * DPR * BASE_SCALE * 2 // ~frog width
        const ring = this.add
          .ellipse(x, y + 22 * DPR, ringW, ringW * 0.42, 0x4ad295, 0.3)
          .setStrokeStyle(2 * DPR, 0x4ad295, 0.95)
        this.layer.add(ring)
      }

      const f = this.makeFrog(lvl, x, y)
      if (isSel) f.setScale(BASE_SCALE * 1.12)
      f.setInteractive({ useHandCursor: true })
      f.on('pointerup', () => this.toggleSelect(idx))
      this.layer.add(f)
      if (isSel) this.crewSprites.push(f)
    })

    // hint
    this.hintText = this.add
      .text(w / 2, h * 0.52, `Экипаж: ${this.selected.size}/${MAX_CREW}`, {
        fontFamily: 'sans-serif',
        fontSize: `${12 * DPR}px`,
        color: '#7d88a8',
      })
      .setOrigin(0.5)
    this.layer.add(this.hintText)

    // Две кнопки запуска в один ряд (одна высота): «⚔️ На миссию» (VS-арена)
    // слева от «🚀 В космос» (серверная экспедиция). Обе активны только когда
    // выбран хотя бы 1 член экипажа.
    const canLaunch = this.selected.size >= 1
    const btnY = h - 40 * DPR

    // ⚔️ На миссию — слева от центра (origin справа → растёт влево).
    const missionBtn = this.add
      .text(w / 2 - 8 * DPR, btnY, '⚔️ На миссию', {
        fontFamily: 'sans-serif',
        fontSize: `${17 * DPR}px`,
        color: '#ffffff',
        backgroundColor: canLaunch ? '#b45309' : '#64748b',
        padding: { x: 18 * DPR, y: 10 * DPR },
        fontStyle: 'bold',
      })
      .setStroke(canLaunch ? '#7c2d12' : '#334155', 3 * DPR)
      .setOrigin(1, 0.5)
    if (canLaunch) {
      missionBtn.setInteractive({ useHandCursor: true })
      missionBtn.on('pointerup', () => this.onMission())
    }
    this.layer.add(missionBtn)

    // 🚀 В космос — справа от центра (origin слева → растёт вправо).
    this.launchBtn = this.add
      .text(
        w / 2 + 8 * DPR,
        btnY,
        canLaunch ? '🚀 В космос' : 'Выбери экипаж',
        {
          fontFamily: 'sans-serif',
          fontSize: `${17 * DPR}px`,
          color: '#ffffff',
          backgroundColor: canLaunch ? '#16a34a' : '#64748b',
          padding: { x: 18 * DPR, y: 10 * DPR },
          fontStyle: 'bold',
        },
      )
      .setStroke(canLaunch ? '#0f5132' : '#334155', 3 * DPR)
      .setOrigin(0, 0.5)
    if (canLaunch) {
      this.launchBtn.setInteractive({ useHandCursor: true })
      this.launchBtn.on('pointerup', () => this.onLaunch())
    }
    this.layer.add(this.launchBtn)
  }

  // ⚔️ Отправить выбранный экипаж в VS-арену (бой). crew = уровни выбранных жаб
  // («жизни»). game/index.ts ловит survivor:start → бутит SurvivorScene.
  private onMission() {
    if (this.launching || this.selected.size < 1) return
    this.launching = true
    const crew = [...this.selected].map((i) => this.frogs[i])
    eventBus.emit('survivor:start', { crew, shipId: this.params.shipId })
  }

  private makeFrog(
    level: number,
    x: number,
    y: number,
  ): Phaser.GameObjects.Image {
    const tier = this.frogTiers[level - 1] ?? 0 // эволюционировавшая моделька
    const key = textureKeyForLevel(level, tier)
    const img = this.add.image(x, y, key)
    img.setScale(BASE_SCALE) // тот же размер, что лягушки на поле
    return img
  }

  // Deterministic 0..1 from a number (stable scatter between re-layouts).
  private hashFrac(n: number): number {
    return (((Math.sin(n) * 43758.5453) % 1) + 1) % 1
  }

  // Toggle frog selection (ring on/off). Max MAX_CREW selected.
  private toggleSelect(idx: number) {
    if (this.launching) return
    if (this.selected.has(idx)) this.selected.delete(idx)
    else if (this.selected.size < MAX_CREW) this.selected.add(idx)
    else return
    this.layout()
  }

  private onLaunch() {
    if (this.launching || this.selected.size < 1) return
    this.launching = true
    const crew = [...this.selected].map((i) => this.frogs[i])
    const shipX = this.ship.x
    const shipY = this.ship.y

    // Crew frogs hop into the ship one-by-one.
    let delay = 0
    for (const f of this.crewSprites) {
      this.tweens.add({
        targets: f,
        x: shipX,
        y: shipY,
        scale: 0,
        alpha: 0,
        delay,
        duration: 300,
        ease: 'Cubic.easeIn',
      })
      delay += 160
    }

    // After everyone boarded: shake, then fly up.
    this.time.delayedCall(delay + 350, () => {
      this.tweens.add({
        targets: this.ship,
        x: { from: shipX - 5 * DPR, to: shipX + 5 * DPR },
        duration: 60,
        yoyo: true,
        repeat: 6,
        onComplete: () => {
          this.ship.x = shipX
          this.tweens.add({
            targets: this.ship,
            y: -this.ship.displayHeight,
            scaleX: this.ship.scaleX * 1.15,
            scaleY: this.ship.scaleY * 1.15,
            duration: 750,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              eventBus.emit('shipdeck:launch', {
                shipId: this.params.shipId,
                crew,
                demo: this.params.demo,
              })
            },
          })
        },
      })
    })
  }
}
