// JourneyScene — авто-раннер «миссия-путешествие» (скелет).
//
// Отряд лягушек идёт слева направо прыжками кучкой, камера едет следом. Параллакс-
// фон, земля внизу, финишная черта справа. Дошли до финиша → начисляем слизь
// (addGold) + показываем результат → ✕/«Домой» возвращает на ферму.
//
// СКЕЛЕТ: без препятствий/событий и без расхода отряда — все лягушки доходят.
// Следующий этап: события на пути + жертва лягушки за препятствие (см. Design Note
// 2026-05-31-journey-missions-autorunner.md). Модель отряда (squad[]) уже массив,
// чтобы расход добавлялся без переписывания.
//
// Открывается/закрывается через eventBus из game/index.ts (sleep/wake MainScene),
// как ShipDeckScene. Параметры (crew, missionId) передаются setParams().

import Phaser from 'phaser'
import { DPR, BASE_SCALE } from '../main/types'
import { textureKeyForLevel } from '../../config/frogs'
import { eventBus } from '../../../store/eventBus'
import { useGameStore } from '../../../store/gameStore'
import { journeyMissionById, type JourneyMission } from './missions'

interface JourneyParams {
  crew: number[] // уровни выбранных лягушек = отряд
  missionId: string
}

interface SquadFrog {
  sprite: Phaser.GameObjects.Image
  offsetX: number // смещение в кучке относительно лидера
  offsetY: number // лёгкая глубина по вертикали
  phase: number // фаза прыжка (рассинхрон волны)
  hopH: number // высота прыжка
}

const WALK_VIEW_RATIO = 0.3 // отряд держим на 30% ширины экрана от левого края

export class JourneyScene extends Phaser.Scene {
  private params: JourneyParams = { crew: [], missionId: 'planet_meadow' }
  private mission!: JourneyMission
  private ready = false
  private finished = false

  private layer!: Phaser.GameObjects.Container // мир (скроллится камерой)
  private hud!: Phaser.GameObjects.Container // фикс к камере (scrollFactor 0)
  private squad: SquadFrog[] = []
  private leaderX = 0 // позиция «головы» отряда в координатах мира
  private worldEndX = 0 // x финиша
  private groundY = 0
  private advanceTween?: Phaser.Tweens.Tween

  constructor() {
    super('JourneyScene')
  }

  create() {
    this.ready = true
    this.scale.on('resize', this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.layout, this)
      this.advanceTween?.remove()
    })
    this.reset()
  }

  setParams(p: JourneyParams) {
    this.params = p
    if (this.ready) this.reset()
  }

  reset() {
    this.finished = false
    this.leaderX = 0
    this.advanceTween?.remove()
    this.mission = journeyMissionById(this.params.missionId) ?? {
      id: this.params.missionId,
      name: 'Путешествие',
      icon: '🐸',
      domain: 'planet',
      desc: '',
      distance: 3000,
      reward: 100,
      minSquad: 1,
    }
    this.layout()
    this.startRun()
  }

  private layout = () => {
    if (!this.ready) return
    const w = this.scale.width
    const h = this.scale.height
    this.groundY = h * 0.78

    this.layer?.destroy()
    this.hud?.destroy()
    this.layer = this.add.container(0, 0)
    this.hud = this.add.container(0, 0)

    // Длина мира: дистанция миссии + запас экрана справа после финиша.
    this.worldEndX = this.mission.distance
    const worldW = this.worldEndX + w
    this.cameras.main.setBounds(0, 0, worldW, h)

    this.buildBackground(w, h, worldW)
    this.buildGround(w, h, worldW)
    this.buildFinish(h)
    this.buildSquad()
    this.buildHud(w, h)

    // Камера в начало.
    this.cameras.main.scrollX = 0
  }

  // Параллакс-фон: небо-градиент (рект) + дальние холмы (медленный scrollFactor) +
  // ближние холмы (быстрее). Скелет — простые цветные формы.
  private buildBackground(w: number, h: number, worldW: number) {
    const sky = this.add.rectangle(0, 0, worldW, h, 0xbfe9ff).setOrigin(0)
    sky.setScrollFactor(0) // небо неподвижно
    this.layer.add(sky)

    // Дальние холмы (тёмно-зелёные), медленный параллакс.
    const farH = this.add.graphics()
    farH.fillStyle(0x8fce6b, 1)
    const farCount = Math.ceil(worldW / (w * 0.6)) + 2
    for (let i = 0; i < farCount; i++) {
      const cx = i * w * 0.6
      farH.fillCircle(cx, this.groundY, w * 0.45)
    }
    farH.setScrollFactor(0.4)
    this.layer.add(farH)

    // Облака (несколько), очень медленный параллакс.
    const cloud = this.add.graphics()
    cloud.fillStyle(0xffffff, 0.85)
    const cloudCount = Math.ceil(worldW / (w * 0.5)) + 2
    for (let i = 0; i < cloudCount; i++) {
      const cx = i * w * 0.5 + (i % 2) * w * 0.2
      const cy = h * (0.12 + (i % 3) * 0.07)
      cloud.fillCircle(cx, cy, 26 * DPR)
      cloud.fillCircle(cx + 30 * DPR, cy + 6 * DPR, 20 * DPR)
      cloud.fillCircle(cx - 28 * DPR, cy + 8 * DPR, 18 * DPR)
    }
    cloud.setScrollFactor(0.2)
    this.layer.add(cloud)
  }

  private buildGround(_w: number, h: number, worldW: number) {
    const ground = this.add
      .rectangle(0, this.groundY, worldW, h - this.groundY, 0x5aa844)
      .setOrigin(0)
    this.layer.add(ground)
    // Линия травы поверх земли.
    const grass = this.add
      .rectangle(0, this.groundY, worldW, 6 * DPR, 0x3f8a2e)
      .setOrigin(0)
    this.layer.add(grass)
  }

  private buildFinish(h: number) {
    const fx = this.worldEndX
    const pole = this.add
      .rectangle(fx, this.groundY, 5 * DPR, -(h * 0.22), 0x444444)
      .setOrigin(0, 1)
    this.layer.add(pole)
    const flag = this.add
      .text(fx + 8 * DPR, this.groundY - h * 0.22, '🏁', {
        fontSize: `${28 * DPR}px`,
      })
      .setOrigin(0, 0.5)
    this.layer.add(flag)
  }

  private buildSquad() {
    this.squad = []
    const crew = this.params.crew.length ? this.params.crew : [1]
    const tiers = useGameStore.getState().frogTiers
    const spacing = 26 * DPR

    crew.forEach((level, idx) => {
      const tier = tiers[level - 1] ?? 0
      const key = textureKeyForLevel(level, tier)
      const sprite = this.add.image(0, this.groundY, key)
      sprite.setScale(BASE_SCALE)
      sprite.setOrigin(0.5, 1)
      this.layer.add(sprite)

      // Кучка: 3 в ряд, хвост уходит влево от лидера. Лёгкая глубина по Y.
      const col = idx % 3
      const row = Math.floor(idx / 3)
      this.squad.push({
        sprite,
        offsetX: -col * spacing - row * 6 * DPR,
        offsetY: -row * 5 * DPR,
        phase: idx * 0.7,
        hopH: (14 + (idx % 3) * 3) * DPR,
      })
    })
  }

  private buildHud(w: number, _h: number) {
    // ✕ выход (прерывание без награды).
    const exit = this.add
      .text(14 * DPR, 16 * DPR, '✕', {
        fontFamily: 'sans-serif',
        fontSize: `${22 * DPR}px`,
        color: '#ff8a8a',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    exit.on('pointerup', () => eventBus.emit('journey:exit', {}))
    this.hud.add(exit)

    // Заголовок миссии.
    const title = this.add
      .text(w / 2, 20 * DPR, `${this.mission.icon} ${this.mission.name}`, {
        fontFamily: 'sans-serif',
        fontSize: `${15 * DPR}px`,
        color: '#1f3a17',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
    this.hud.add(title)
  }

  // Запуск забега: лидер плавно едет от 0 до финиша, камера держит отряд слева.
  private startRun() {
    const w = this.scale.width
    // Длительность ~ дистанция (≈ 0.9px/мс), мин 4с.
    const durationMs = Math.max(4000, this.mission.distance * 1.1)
    const tweenObj = { x: 0 }
    this.advanceTween = this.tweens.add({
      targets: tweenObj,
      x: this.worldEndX,
      duration: durationMs,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.leaderX = tweenObj.x
        const camX = Phaser.Math.Clamp(
          this.leaderX - w * WALK_VIEW_RATIO,
          0,
          Math.max(0, this.worldEndX + w - w),
        )
        this.cameras.main.scrollX = camX
      },
      onComplete: () => this.onArrive(),
    })
  }

  private onArrive() {
    if (this.finished) return
    this.finished = true
    const survivors = this.squad.length
    const reward = this.mission.reward

    // Начисляем слизь (gold). addGold сам применяет бонусы эволюции/баффы.
    useGameStore.getState().addGold(reward)
    eventBus.emit('journey:complete', {
      missionId: this.mission.id,
      reward,
      survivors,
    })

    this.showResult(reward, survivors)
  }

  private showResult(reward: number, survivors: number) {
    const w = this.scale.width
    const h = this.scale.height

    const panel = this.add
      .rectangle(w / 2, h / 2, w * 0.8, h * 0.34, 0x1f3a17, 0.92)
      .setScrollFactor(0)
    panel.setStrokeStyle(3 * DPR, 0x9ee06b)
    this.hud.add(panel)

    const txt = this.add
      .text(
        w / 2,
        h / 2 - h * 0.06,
        `🏁 Дошли!\n+${reward} 💧 слизи\nОтряд: ${survivors} 🐸`,
        {
          fontFamily: 'sans-serif',
          fontSize: `${17 * DPR}px`,
          color: '#eaffd8',
          align: 'center',
          fontStyle: 'bold',
          lineSpacing: 6 * DPR,
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
    this.hud.add(txt)

    const btn = this.add
      .text(w / 2, h / 2 + h * 0.1, '🏠 На ферму', {
        fontFamily: 'sans-serif',
        fontSize: `${16 * DPR}px`,
        color: '#ffffff',
        backgroundColor: '#16a34a',
        padding: { x: 18 * DPR, y: 10 * DPR },
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    btn.on('pointerup', () => eventBus.emit('journey:exit', {}))
    this.hud.add(btn)
  }

  override update(time: number) {
    if (!this.ready || this.squad.length === 0) return
    const t = time / 1000
    for (const f of this.squad) {
      const baseX = this.leaderX + f.offsetX
      // Прыжок: модуль синуса → пружинистый отскок от земли.
      const hop = this.finished
        ? 0
        : Math.abs(Math.sin(t * 6 + f.phase)) * f.hopH
      f.sprite.x = baseX
      f.sprite.y = this.groundY + f.offsetY - hop
      // Лёгкое сжатие при приземлении (squash) для «сочности».
      const squash = 1 - (hop / f.hopH) * 0.12
      f.sprite.setScale(BASE_SCALE, BASE_SCALE * (this.finished ? 1 : squash))
    }
  }
}
