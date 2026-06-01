// JourneyScene — авто-раннер «миссия-путешествие».
//
// Отряд лягушек идёт слева направо прыжками кучкой, камера едет следом. На пути —
// препятствия (камень/пропасть/существо/барьер). Перед каждым останавливаемся и
// спрашиваем push-your-luck: «Отступить» (забрать накопленный лут) или
// «Продолжить» (преодолеть телом ценой лягушек — они ГИБНУТ, расход отряда).
//
// Лягушки отряда — это лягушки с поля (переданы из JourneyMissionSelect). Кто
// погиб в забеге — удаляется с локации (removeFrogFromLocation). Кто дошёл/отступил
// — остаётся. Если отряд кончился до отступления → провал, накопленный лут теряется.
//
// Лут пока = слизь (gold). Временные бафы (всплеск дропа / временные дроны и т.п.) —
// следующий этап (нужен баф-слайс, согласовать). i18n journey-строк — отдельный
// проход (скелет был RU-хардкод, держим консистентно).
//
// Открывается/закрывается через eventBus из game/index.ts (sleep/wake MainScene).

import Phaser from 'phaser'
import { DPR, BASE_SCALE } from '../main/types'
import { textureKeyForLevel } from '../../config/frogs'
import { eventBus } from '../../../store/eventBus'
import { useGameStore } from '../../../store/gameStore'
import {
  journeyMissionById,
  OBSTACLE_ICON,
  OBSTACLE_LABEL,
  type JourneyMission,
  type JourneyObstacle,
} from './missions'

interface JourneyParams {
  crew: number[] // уровни выбранных лягушек = отряд
  missionId: string
}

interface SquadFrog {
  sprite: Phaser.GameObjects.Image
  level: number // уровень лягушки (для removeFrogFromLocation при гибели)
  offsetX: number // смещение в кучке относительно лидера
  offsetY: number // лёгкая глубина по вертикали
  phase: number // фаза прыжка (рассинхрон волны)
  hopH: number // высота прыжка
}

interface WorldObstacle extends JourneyObstacle {
  x: number // позиция в мире (atFrac * distance)
  display: Phaser.GameObjects.GameObject[] // спрайты для fade при преодолении
}

const WALK_VIEW_RATIO = 0.3 // отряд держим на 30% ширины экрана от левого края

export class JourneyScene extends Phaser.Scene {
  private params: JourneyParams = { crew: [], missionId: 'planet_meadow' }
  private mission!: JourneyMission
  private ready = false
  private finished = false
  private paused = false // пауза волны прыжков во время промпта

  private layer!: Phaser.GameObjects.Container // мир (скроллится камерой)
  private hud!: Phaser.GameObjects.Container // фикс к камере (scrollFactor 0)
  private promptGroup: Phaser.GameObjects.GameObject[] = []
  private squad: SquadFrog[] = []
  private obstacles: WorldObstacle[] = []
  private obIdx = 0
  private loot = 0 // накопленная слизь (теряется при провале)
  private capturedLocation = 1 // локация, с которой взят отряд (для гибели)
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
    this.paused = false
    this.leaderX = 0
    this.obIdx = 0
    this.loot = 0
    this.capturedLocation = useGameStore.getState().currentLocation
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
      obstacles: [],
    }
    this.layout()
    this.runSegment()
  }

  private layout = () => {
    if (!this.ready) return
    const w = this.scale.width
    const h = this.scale.height
    this.groundY = h * 0.78

    this.promptGroup = []
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
    this.buildObstacles()
    this.buildFinish(h)
    this.buildSquad()
    this.buildHud(w, h)

    this.cameras.main.scrollX = 0
  }

  // Параллакс-фон: небо + дальние холмы + облака (простые формы, скелет).
  private buildBackground(w: number, h: number, worldW: number) {
    const sky = this.add.rectangle(0, 0, worldW, h, 0xbfe9ff).setOrigin(0)
    sky.setScrollFactor(0)
    this.layer.add(sky)

    const farH = this.add.graphics()
    farH.fillStyle(0x8fce6b, 1)
    const farCount = Math.ceil(worldW / (w * 0.6)) + 2
    for (let i = 0; i < farCount; i++) {
      const cx = i * w * 0.6
      farH.fillCircle(cx, this.groundY, w * 0.45)
    }
    farH.setScrollFactor(0.4)
    this.layer.add(farH)

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
    const grass = this.add
      .rectangle(0, this.groundY, worldW, 6 * DPR, 0x3f8a2e)
      .setOrigin(0)
    this.layer.add(grass)
  }

  private buildObstacles() {
    this.obstacles = this.mission.obstacles.map((ob) => {
      const x = ob.atFrac * this.mission.distance
      const icon = this.add
        .text(x, this.groundY - 2 * DPR, OBSTACLE_ICON[ob.type], {
          fontSize: `${44 * DPR}px`,
        })
        .setOrigin(0.5, 1)
      this.layer.add(icon)
      return { ...ob, x, display: [icon] }
    })
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

      const col = idx % 3
      const row = Math.floor(idx / 3)
      this.squad.push({
        sprite,
        level,
        offsetX: -col * spacing - row * 6 * DPR,
        offsetY: -row * 5 * DPR,
        phase: idx * 0.7,
        hopH: (14 + (idx % 3) * 3) * DPR,
      })
    })
  }

  private buildHud(w: number, _h: number) {
    const exit = this.add
      .text(14 * DPR, 16 * DPR, '✕', {
        fontFamily: 'sans-serif',
        fontSize: `${22 * DPR}px`,
        color: '#ff8a8a',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    // ✕ во время забега = досрочный выход без награды (лут теряется).
    exit.on('pointerup', () => eventBus.emit('journey:exit', {}))
    this.hud.add(exit)

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

    // Счётчики отряда и лута (обновляются в refreshHud).
    const stats = this.add
      .text(w - 14 * DPR, 20 * DPR, '', {
        fontFamily: 'sans-serif',
        fontSize: `${13 * DPR}px`,
        color: '#1f3a17',
        align: 'right',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setName('stats')
    this.hud.add(stats)
    this.refreshHud()
  }

  private refreshHud() {
    const stats = this.hud.getByName('stats') as
      | Phaser.GameObjects.Text
      | undefined
    stats?.setText(`🐸 ${this.squad.length}   💧 ${this.loot}`)
  }

  // ─── ХОД ЗАБЕГА ───
  // Едем до следующего препятствия (или финиша), там пауза + промпт.
  private runSegment() {
    if (this.finished) return
    const ob = this.obstacles[this.obIdx]
    const targetX = ob ? ob.x : this.worldEndX
    this.advanceTo(targetX, () => {
      if (ob) this.showObstaclePrompt(ob)
      else this.onFinish()
    })
  }

  private advanceTo(targetX: number, onDone: () => void) {
    const w = this.scale.width
    const fromX = this.leaderX
    const dist = Math.max(0, targetX - fromX)
    const durationMs = Math.max(700, dist * 1.1)
    const obj = { x: fromX }
    this.advanceTween?.remove()
    this.advanceTween = this.tweens.add({
      targets: obj,
      x: targetX,
      duration: durationMs,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.leaderX = obj.x
        const camX = Phaser.Math.Clamp(
          this.leaderX - w * WALK_VIEW_RATIO,
          0,
          this.worldEndX,
        )
        this.cameras.main.scrollX = camX
      },
      onComplete: onDone,
    })
  }

  // Push-your-luck перед препятствием: отступить (забрать лут) / продолжить (риск).
  private showObstaclePrompt(ob: WorldObstacle) {
    this.paused = true
    const w = this.scale.width
    const h = this.scale.height
    const sacrifice = Math.min(ob.cost, this.squad.length)

    const dim = this.add
      .rectangle(0, 0, w, h, 0x0a1808, 0.55)
      .setOrigin(0)
      .setScrollFactor(0)
      .setInteractive() // блокирует тапы по миру под промптом
    this.hud.add(dim)
    this.promptGroup.push(dim)

    const panel = this.add
      .rectangle(w / 2, h / 2, w * 0.84, h * 0.4, 0x1f3a17, 0.96)
      .setScrollFactor(0)
    panel.setStrokeStyle(3 * DPR, 0x9ee06b)
    this.hud.add(panel)
    this.promptGroup.push(panel)

    const info = this.add
      .text(
        w / 2,
        h / 2 - h * 0.1,
        `${OBSTACLE_ICON[ob.type]} ${OBSTACLE_LABEL[ob.type]}\n` +
          `Преодолеть: −${sacrifice} 🐸\n` +
          `Награда: +${ob.loot} 💧\n` +
          `В кармане: ${this.loot} 💧`,
        {
          fontFamily: 'sans-serif',
          fontSize: `${15 * DPR}px`,
          color: '#eaffd8',
          align: 'center',
          fontStyle: 'bold',
          lineSpacing: 5 * DPR,
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
    this.hud.add(info)
    this.promptGroup.push(info)

    const retreat = this.makePromptButton(
      w * 0.3,
      h / 2 + h * 0.11,
      `🏳️ Отступить`,
      '#a16207',
      () => this.onRetreat(),
    )
    const cont = this.makePromptButton(
      w * 0.7,
      h / 2 + h * 0.11,
      `⚔️ Продолжить`,
      '#16a34a',
      () => this.resolveObstacle(ob),
    )
    this.promptGroup.push(retreat, cont)
  }

  private makePromptButton(
    x: number,
    y: number,
    label: string,
    bg: string,
    onTap: () => void,
  ): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, label, {
        fontFamily: 'sans-serif',
        fontSize: `${15 * DPR}px`,
        color: '#ffffff',
        backgroundColor: bg,
        padding: { x: 14 * DPR, y: 9 * DPR },
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    btn.on('pointerup', onTap)
    this.hud.add(btn)
    return btn
  }

  private clearPrompt() {
    for (const o of this.promptGroup) o.destroy()
    this.promptGroup = []
  }

  // «Продолжить»: разбиваем препятствие телом — тряска, частицы, гибель лягушек.
  private resolveObstacle(ob: WorldObstacle) {
    this.clearPrompt()
    const sacrifice = Math.min(ob.cost, this.squad.length)

    // FX столкновения у препятствия (на экране).
    this.collisionFx(ob)
    this.cameras.main.shake(220, 0.012)

    // Препятствие «ломается» — fade.
    for (const d of ob.display) {
      this.tweens.add({
        targets: d,
        alpha: 0,
        y: this.groundY - 30 * DPR,
        duration: 350,
        ease: 'Quad.easeOut',
      })
    }

    // Жертвуем лягушек (с хвоста кучки). Гибнут с поля.
    for (let i = 0; i < sacrifice; i++) {
      const f = this.squad.pop()
      if (!f) break
      useGameStore
        .getState()
        .removeFrogFromLocation(this.capturedLocation, f.level)
      this.killFrogFx(f)
    }

    this.loot += ob.loot
    this.refreshHud()

    if (this.squad.length === 0) {
      // Отряд кончился на препятствии → провал, лут теряется.
      this.time.delayedCall(450, () => this.onFail())
      return
    }

    this.obIdx++
    this.paused = false
    this.time.delayedCall(350, () => this.runSegment())
  }

  // Мультяшная гибель: подпрыг + закрутка + затухание, потом исчез.
  // Тут спрайт — отдельный Image (не frog.container), tween alpha безопасен.
  private killFrogFx(f: SquadFrog) {
    this.tweens.killTweensOf(f.sprite)
    this.tweens.add({
      targets: f.sprite,
      y: f.sprite.y - 40 * DPR,
      angle: 360,
      alpha: 0,
      scaleX: BASE_SCALE * 0.4,
      scaleY: BASE_SCALE * 0.4,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => f.sprite.destroy(),
    })
  }

  private collisionFx(ob: WorldObstacle) {
    const screenX = ob.x - this.cameras.main.scrollX
    const g = this.add.graphics().setScrollFactor(0)
    this.hud.add(g)
    const shards: { x: number; y: number; vx: number; vy: number }[] = []
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.4
      const sp = (60 + Math.random() * 90) * DPR
      shards.push({
        x: screenX,
        y: this.groundY - 24 * DPR,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40 * DPR,
      })
    }
    const obj = { t: 0 }
    this.tweens.add({
      targets: obj,
      t: 1,
      duration: 450,
      onUpdate: () => {
        g.clear()
        const dt = obj.t
        g.fillStyle(0x9c8a6a, 1 - dt)
        for (const s of shards) {
          const px = s.x + s.vx * dt
          const py = s.y + s.vy * dt + 140 * DPR * dt * dt
          g.fillRect(px, py, 6 * DPR, 6 * DPR)
        }
      },
      onComplete: () => g.destroy(),
    })
  }

  // ─── ИСХОДЫ ───
  private onFinish() {
    if (this.finished) return
    this.finished = true
    this.loot += this.mission.reward // финишный бонус
    useGameStore.getState().addGold(this.loot)
    eventBus.emit('journey:complete', {
      missionId: this.mission.id,
      reward: this.loot,
      survivors: this.squad.length,
    })
    this.refreshHud()
    this.showResult(
      `🏁 Дошли!\n+${this.loot} 💧 слизи\nВыжило: ${this.squad.length} 🐸`,
      0x1f3a17,
    )
  }

  private onRetreat() {
    if (this.finished) return
    this.finished = true
    this.clearPrompt()
    this.advanceTween?.remove()
    useGameStore.getState().addGold(this.loot)
    eventBus.emit('journey:complete', {
      missionId: this.mission.id,
      reward: this.loot,
      survivors: this.squad.length,
    })
    this.refreshHud()
    this.showResult(
      `🏳️ Отступили\n+${this.loot} 💧 слизи\nВернулось: ${this.squad.length} 🐸`,
      0x5a4a17,
    )
  }

  private onFail() {
    if (this.finished) return
    this.finished = true
    this.clearPrompt()
    this.advanceTween?.remove()
    eventBus.emit('journey:complete', {
      missionId: this.mission.id,
      reward: 0,
      survivors: 0,
    })
    this.refreshHud()
    this.showResult(`💀 Отряд погиб\nЛут потерян (${this.loot} 💧)`, 0x4a1717)
  }

  private showResult(message: string, panelColor: number) {
    const w = this.scale.width
    const h = this.scale.height

    const panel = this.add
      .rectangle(w / 2, h / 2, w * 0.8, h * 0.34, panelColor, 0.94)
      .setScrollFactor(0)
    panel.setStrokeStyle(3 * DPR, 0x9ee06b)
    this.hud.add(panel)

    const txt = this.add
      .text(w / 2, h / 2 - h * 0.05, message, {
        fontFamily: 'sans-serif',
        fontSize: `${17 * DPR}px`,
        color: '#eaffd8',
        align: 'center',
        fontStyle: 'bold',
        lineSpacing: 6 * DPR,
      })
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
    const hopActive = !this.finished && !this.paused
    for (const f of this.squad) {
      const baseX = this.leaderX + f.offsetX
      const hop = hopActive ? Math.abs(Math.sin(t * 6 + f.phase)) * f.hopH : 0
      f.sprite.x = baseX
      f.sprite.y = this.groundY + f.offsetY - hop
      const squash = 1 - (hop / f.hopH) * 0.12
      f.sprite.setScale(BASE_SCALE, BASE_SCALE * (hopActive ? squash : 1))
    }
  }
}
