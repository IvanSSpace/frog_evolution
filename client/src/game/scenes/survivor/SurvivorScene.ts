// SurvivorScene — VS-арена (Vampire Survivors в формате нашей игры). Phase 1 прототип.
//
// Петля: 1 жаба-герой в центре, камера за ней. Мобы прут со сторон и бьют в
// МИЛИ при касании. Герой авто-атакует ДАЛЬНОБОЙНО (снаряд в ближайшего).
// Экипаж = «жизни»: герой умер → выходит следующая жаба (послабее), урон отряда
// КОНСТАНТНЫЙ. Кончился экипаж → fail. На BOSS_TIME спавнится босс → убил → win.
// Прокачка (Phase 2): мобы роняют кристаллы → магнит-сбор → XP-шкала сверху
// (стиль мега-бокса) → заполнилась → модалка выбора 1 из 3 апгрейдов (игра
// замирает). Прокачка RUN-LOCAL — сбрасывается каждый забег (init).
//
// Управление: floating joystick (VirtualJoystick) — тап в любую точку.
//
// Прототип на плейсхолдерах: готовые SVG-жабы (textureKeyForLevel) tinted/scaled,
// снаряды/кристаллы — круги. Ноль новых ассетов. Лут — фикс gold на win.
//
// Boot: eventBus 'survivor:start' (game/index.ts) → start('SurvivorScene', data).
// Exit: endRun → emit 'survivor:complete' + 'survivor:exit' → wake MainScene.

import Phaser from 'phaser'
import { DPR } from '../main/types'
import { textureKeyForLevel } from '../../config/frogs'
import { eventBus } from '../../../store/eventBus'
import { useGameStore } from '../../../store/gameStore'
import { hapticImpact, hapticNotification } from '../../../utils/telegram'
import { VirtualJoystick } from './VirtualJoystick'
import { getMission, type SurvivorMission } from './missions'

interface SurvivorInit {
  crew: number[]
  shipId: number
  planetId?: string
  missionId?: string
}

// === Tuning (DPR-scaled где это пиксели) ===
const WORLD = 2600 * DPR
const HERO_SPEED = 210 * DPR // px/sec
const HERO_SIZE = 96 * DPR // целевая ВЫСОТА спрайта (ширина — по пропорции)
const HERO_HITR = 34 * DPR
const HERO_HOP_AMP = 13 * DPR // высота подскока при движении
const HERO_HOP_FREQ = 7 // рад/с — частота хопа (~2.2 прыжка/сек)
// Squash-stretch как на ферме: в воздухе тянется вверх, у земли сжимается.
const HERO_HOP_STRETCH_Y = 1.18
const HERO_HOP_SQUASH_Y = 0.82
const HERO_HOP_STRETCH_X = 0.92
const HERO_HOP_SQUASH_X = 1.12
// Лёгкий idle-бобинг (стоя на месте) — чтобы герой не был статичным.
const HERO_IDLE_AMP = 4 * DPR
const HERO_IDLE_FREQ = 3 // рад/с
const HERO_IDLE_INTENSITY = 0.35 // доля squash-stretch на idle

const ATTACK_INTERVAL = 560 // ms между выстрелами
const ATTACK_DMG = 22 // КОНСТАНТНЫЙ урон отряда (не зависит от текущей «жизни»)
const PROJ_SPEED = 540 * DPR
const PROJ_TTL = 1300 // ms
const PROJ_R = 7 * DPR

const MOB_SIZE = 52 * DPR
const MOB_HITR = 22 * DPR
const MOB_HP = 30
const MOB_SPEED = 72 * DPR
const MOB_DMG = 9
const MOB_HIT_CD = 650 // ms между ударами одного моба
const SPAWN_INTERVAL_START = 1050 // ms
const SPAWN_INTERVAL_MIN = 340 // ms
const SPAWN_RAMP_MS = 75_000 // за это время рейт доходит до min

const BOSS_SIZE = 190 * DPR
const BOSS_HITR = 78 * DPR
const BOSS_HP = 1300
const BOSS_SPEED = 52 * DPR
const BOSS_DMG = 24

const RESPAWN_INVULN = 1500 // ms неуязвимости после смены «жизни»

// === Кристаллы + прокачка (run-local, сбрасывается каждый забег в init) ===
const CRYSTAL_R = 6 * DPR
const CRYSTAL_PICKUP_R = 95 * DPR // базовый радиус притяжения (апгрейд «магнит» множит)
const CRYSTAL_COLLECT_R = 26 * DPR // дистанция подбора
const CRYSTAL_PULL = 0.22 // lerp-сила притяжения к герою
// XP-кривая как в Vampire Survivors: 1→2 = 5, дальше +10 за уровень
// (2→3=15, 3→4=25 …). Раньше было 4 +2/ур — втрое площе, отсюда слишком
// быстрый скейл и непобедимость.
const XP_BASE = 5 // кристаллов на 1→2 уровень
const XP_PER_LEVEL = 10 // +N к порогу за каждый следующий уровень
const ATK_INTERVAL_MIN = 150 // пол скорострельности (апгрейд не опустит ниже)

// Масштабирование врагов (анти-снежоком, как в VS). HP растёт и от уровня
// ИГРОКА (тянется за прокачкой), и от времени забега. Урон/толпа — от времени.
const ENEMY_HP_PER_FROGLEVEL = 0.25 // +25% HP за каждый уровень самой жабы-врага
const ENEMY_HP_PER_LEVEL = 0.22 // +22% HP врага за каждый уровень игрока
const ENEMY_HP_PER_MIN = 1.0 // +100% HP врага за минуту забега
const ENEMY_DMG_PER_MIN = 0.6 // +60% урона врага за минуту
const ENEMY_SPEED_PER_MIN = 0.18 // +18% скорости за минуту (кап в коде)
const BOSS_HP_PER_LEVEL = 0.5 // HP босса тоже тянется за уровнем игрока
const SPAWN_BURST_EVERY_MS = 25_000 // +1 моб за тик спавна каждые 25с (кап 4)

// Орбитальные сферы (защитный апгрейд): крутятся вокруг героя, бьют врага при
// касании, после удара «гаснут» и через ORB_CD восстанавливаются.
const ORB_RADIUS = 96 * DPR
const ORB_SPEED = 2.6 // рад/с вращение
const ORB_R = 11 * DPR
const ORB_HITR = 16 * DPR
const ORB_DMG = 16
const ORB_CD = 1400 // ms восстановления после удара

// Капы апгрейдов (run-local).
const MAX_TARGETS = 4
const MAX_MULTISHOT = 4
const MAX_PIERCE = 5
const MAX_ORBS = 6
const MAX_ARMOR = 0.6
const MULTISHOT_SPREAD = 0.22 // рад между снарядами залпа

type UpgradeKind = 'attack' | 'defense'
interface UpgradeDef {
  id: string
  icon: string
  title: string
  desc: string
  kind: UpgradeKind
}

// Пул апгрейдов. На левелапе показываем 2 атакующих + 1 защитный.
const ATTACK_UPGRADES: UpgradeDef[] = [
  {
    id: 'dmg',
    icon: '🗡',
    title: 'Острый язык',
    desc: '+8 урона',
    kind: 'attack',
  },
  {
    id: 'atkspd',
    icon: '⚡',
    title: 'Хлёсткий язык',
    desc: 'Атака на 15% чаще',
    kind: 'attack',
  },
  {
    id: 'targets',
    icon: '🎯',
    title: 'Раздвоение',
    desc: '+1 цель за залп',
    kind: 'attack',
  },
  {
    id: 'multishot',
    icon: '🔱',
    title: 'Залп',
    desc: '+1 снаряд по цели',
    kind: 'attack',
  },
  {
    id: 'pierce',
    icon: '🪡',
    title: 'Пробитие',
    desc: 'Снаряд пробивает +1 врага',
    kind: 'attack',
  },
]
const DEFENSE_UPGRADES: UpgradeDef[] = [
  {
    id: 'hp',
    icon: '❤️',
    title: 'Толстая кожа',
    desc: '+30 макс. HP',
    kind: 'defense',
  },
  {
    id: 'orb',
    icon: '🟢',
    title: 'Сфера-спутник',
    desc: '+1 сфера: бьёт врагов, восстанавливается',
    kind: 'defense',
  },
  {
    id: 'regen',
    icon: '💧',
    title: 'Регенерация',
    desc: '+2 HP/сек',
    kind: 'defense',
  },
  {
    id: 'armor',
    icon: '🪨',
    title: 'Панцирь',
    desc: '−12% входящего урона',
    kind: 'defense',
  },
]

interface Crystal {
  sprite: Phaser.GameObjects.Arc
}

interface Orb {
  sprite: Phaser.GameObjects.Arc
  alive: boolean
  cdUntil: number
}

interface Hero {
  sprite: Phaser.GameObjects.Image
  // Логическая позиция (для движения/коллизий). Спрайт рендерится в (x, y-hop),
  // чтобы вертикальный подскок не «уносил» героя и не плыли расчёты дистанций.
  x: number
  y: number
  hp: number
  maxHp: number
  level: number
}
interface Mob {
  sprite: Phaser.GameObjects.Image
  hp: number
  speed: number
  dmg: number
  hitr: number
  lastHit: number
  isBoss: boolean
}
interface Projectile {
  sprite: Phaser.GameObjects.Arc
  vx: number
  vy: number
  born: number
  dmg: number
  pierce: number // сколько ещё врагов может пробить (0 = гибнет на первом)
  hit: Set<Mob> // уже задетые мобы (чтобы не бить одного дважды)
}

function heroMaxHpForLevel(level: number): number {
  // Слабее последующие «жизни» (crew отсортирован по убыванию уровня).
  return 60 + level * 14
}

export class SurvivorScene extends Phaser.Scene {
  private mission: SurvivorMission = getMission()
  private crew: number[] = []
  private crewIdx = 0

  private hero!: Hero
  private mobs: Mob[] = []
  private projectiles: Projectile[] = []
  private joystick!: VirtualJoystick

  private elapsed = 0
  private spawnAcc = 0
  private attackAcc = 0
  private kills = 0
  private bossSpawned = false
  private invulnUntil = 0
  private over = false
  private heroHopT = 0 // накопитель фазы хопа (растёт пока герой движется)
  private heroBaseScale = 1 // равномерный масштаб героя (squash-stretch множит его)

  // Run-local статы (апгрейды их меняют; сброс в init каждый забег).
  private dmg = ATTACK_DMG
  private atkInterval = ATTACK_INTERVAL
  private moveMult = 1 // апгрейда скорости нет — остаётся 1
  private pickupR = CRYSTAL_PICKUP_R
  private maxTargets = 1 // целей за залп (апгрейд «раздвоение»)
  private multishot = 1 // снарядов по каждой цели (апгрейд «залп»)
  private pierce = 0 // пробитие снаряда
  private regen = 0 // HP/сек
  private armor = 0 // доля снижения входящего урона (0..MAX_ARMOR)
  private orbs: Orb[] = []
  private orbAngle = 0

  // Прокачка через кристаллы.
  private crystals: Crystal[] = []
  private xp = 0
  private heroXpLevel = 1
  private xpNeeded = XP_BASE
  private paused = false // true пока открыто окно апгрейда (логика заморожена)
  private pausedAt = 0 // Date.now() момента паузы — watchdog от вечного зависания
  private fatalText?: Phaser.GameObjects.Text // вывод исключения на экран (диагностика)

  // HUD
  private hpBarFill!: Phaser.GameObjects.Rectangle
  private xpBarFill!: Phaser.GameObjects.Rectangle
  private infoText!: Phaser.GameObjects.Text

  constructor() {
    super('SurvivorScene')
  }

  init(data: SurvivorInit) {
    // Сортируем по убыванию: первая «жизнь» — сильнейшая жаба.
    this.crew = [...(data.crew ?? [])].sort((a, b) => b - a)
    if (this.crew.length === 0) this.crew = [1]
    this.mission = getMission(data.missionId)
    void data.shipId // shipId зарезервирован для Phase 3 (привязка лута к кораблю)
    this.crewIdx = 0
    this.mobs = []
    this.projectiles = []
    this.elapsed = 0
    this.spawnAcc = 0
    this.attackAcc = 0
    this.kills = 0
    this.bossSpawned = false
    this.invulnUntil = 0
    this.over = false
    // Прокачка run-local — каждый забег с нуля (как в Vampire Survivors).
    this.dmg = ATTACK_DMG
    this.atkInterval = ATTACK_INTERVAL
    this.moveMult = 1
    this.pickupR = CRYSTAL_PICKUP_R
    this.maxTargets = 1
    this.multishot = 1
    this.pierce = 0
    this.regen = 0
    this.armor = 0
    this.orbs = []
    this.orbAngle = 0
    this.crystals = []
    this.xp = 0
    this.heroXpLevel = 1
    this.xpNeeded = XP_BASE
    this.paused = false
  }

  create() {
    const cx = WORLD / 2
    const cy = WORLD / 2

    this.cameras.main.setBounds(0, 0, WORLD, WORLD)
    this.cameras.main.setBackgroundColor('#16241a')

    // Ground: тайл существующей карты болота, если текстура есть.
    if (this.textures.exists('map')) {
      this.add
        .tileSprite(0, 0, WORLD, WORLD, 'map')
        .setOrigin(0, 0)
        .setAlpha(0.5)
        .setDepth(-10)
    }

    // Hero (первая «жизнь»).
    const lvl = this.crew[0]
    const sprite = this.makeFrogSprite(cx, cy, lvl, HERO_SIZE)
    sprite.setDepth(10)
    this.heroBaseScale = sprite.scaleX
    this.hero = {
      sprite,
      x: cx,
      y: cy,
      hp: heroMaxHpForLevel(lvl),
      maxHp: heroMaxHpForLevel(lvl),
      level: lvl,
    }
    // Камера центрируется на ЛОГИЧЕСКОЙ позиции (см. moveHero) — не на спрайте.
    // startFollow(sprite) следил бы за прыгающим спрайтом и гасил бы хоп на экране.
    this.cameras.main.centerOn(cx, cy)

    // Joystick + input.
    this.joystick = new VirtualJoystick(this)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.paused || this.over) return
      this.joystick.start(p.x, p.y)
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.paused || this.over) return
      this.joystick.move(p.x, p.y)
    })
    this.input.on('pointerup', () => this.joystick.end())
    this.input.on('pointerupoutside', () => this.joystick.end())

    // Выбор апгрейда приходит из React-оверлея (SurvivorUpgradeModal).
    eventBus.on('survivor:pick-upgrade', this.onPickUpgrade)

    this.buildHud()

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup())
  }

  private onPickUpgrade = (p: { id: string }) => {
    if (!this.paused || this.over) return
    this.applyUpgrade(p.id)
    this.joystick.end()
    this.paused = false
  }

  // === Sprite helpers ===
  private makeFrogSprite(
    x: number,
    y: number,
    level: number,
    size: number,
    tint?: number,
  ): Phaser.GameObjects.Image {
    const key = textureKeyForLevel(level)
    if (this.textures.exists(key)) {
      const img = this.add.image(x, y, key)
      // size = целевая ВЫСОТА; масштаб равномерный → пропорции жабы сохранены
      // (setDisplaySize(size,size) форсил квадрат и сплющивал спрайт).
      img.setScale(size / img.height)
      if (tint !== undefined) img.setTint(tint)
      return img
    }
    // Fallback — круг (текстура не загружена).
    const c = this.add.circle(x, y, size / 2, tint ?? 0x6ec06e)
    return c as unknown as Phaser.GameObjects.Image
  }

  private buildHud() {
    const w = this.scale.width
    const barW = 220 * DPR
    const barH = 14 * DPR

    // XP-шкала — сверху во всю ширину, в стиле прогресса мега-бокса
    // (квадратная, синяя заливка). Заполнилась → окно выбора апгрейда.
    const xpH = 7 * DPR
    this.add
      .rectangle(0, 0, w, xpH, 0x0a1426, 0.85)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(99990)
    this.xpBarFill = this.add
      .rectangle(0, 0, w, xpH, 0x2f6bff)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(99991)

    // HP-бар — по центру чуть ниже XP-шкалы.
    const hpY = xpH + 16 * DPR
    this.add
      .rectangle(w / 2, hpY, barW, barH, 0x000000, 0.5)
      .setScrollFactor(0)
      .setDepth(99990)
      .setStrokeStyle(2 * DPR, 0xffffff, 0.4)
    this.hpBarFill = this.add
      .rectangle(w / 2 - barW / 2, hpY, barW, barH - 4 * DPR, 0x4ad295)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(99991)

    this.infoText = this.add
      .text(12 * DPR, hpY + 14 * DPR, '', {
        fontFamily: 'Russo One, sans-serif',
        fontSize: `${13 * DPR}px`,
        color: '#eaffd8',
        stroke: '#0b1b0e',
        strokeThickness: 3 * DPR,
      })
      .setScrollFactor(0)
      .setDepth(99992)

    // ✕ — выход (abandon, без награды).
    this.add
      .text(w - 16 * DPR, xpH + 6 * DPR, '✕', {
        fontFamily: 'Russo One, sans-serif',
        fontSize: `${22 * DPR}px`,
        color: '#ff8b8b',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(99992)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        if (!this.over) eventBus.emit('survivor:exit', {})
      })

    this.updateHud()
  }

  private updateHud() {
    const barW = 220 * DPR
    const pct = Phaser.Math.Clamp(this.hero.hp / this.hero.maxHp, 0, 1)
    this.hpBarFill.width = barW * pct
    this.hpBarFill.fillColor =
      pct > 0.5 ? 0x4ad295 : pct > 0.25 ? 0xffd24a : 0xff5d6c
    this.xpBarFill.width =
      this.scale.width * Phaser.Math.Clamp(this.xp / this.xpNeeded, 0, 1)
    const lives = this.crew.length - this.crewIdx
    const sec = Math.max(
      0,
      Math.ceil((this.mission.bossTimeMs - this.elapsed) / 1000),
    )
    const bossLabel = this.bossSpawned ? '👑 БОСС' : `👑 ${sec}с`
    this.infoText.setText(
      `🐸×${lives}   ⭐${this.heroXpLevel}   ☠ ${this.kills}   ${bossLabel}`,
    )
  }

  // === Main loop ===
  override update(_time: number, deltaMs: number) {
    if (this.over) return
    if (this.paused) {
      // Watchdog: если выбор апгрейда завис (баг) и не пришёл за 30с — аварийно
      // выходим из забега, чтобы игрок не залип навсегда. Нормальный выбор
      // (обычно <30с) сюда не попадает.
      if (Date.now() - this.pausedAt > 30000) {
        this.paused = false
        eventBus.emit('survivor:exit', {})
      }
      return
    }
    const dt = deltaMs / 1000
    this.elapsed += deltaMs

    // try/catch: исключение в кадре не должно морозить весь игровой цикл.
    try {
      this.moveHero(dt)
      this.autoAttack(deltaMs)
      this.updateProjectiles(deltaMs)
      this.updateMobs(deltaMs)
      this.updateOrbs(dt)
      this.updateCrystals()
      this.applyRegen(dt)
      this.handleSpawning(deltaMs)
      this.maybeSpawnBoss()
      this.updateHud()
    } catch (e) {
      this.showFatal(e)
    }
  }

  private showFatal(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[survivor] update error:', e)
    if (!this.fatalText) {
      this.fatalText = this.add
        .text(this.scale.width / 2, 60 * DPR, '', {
          fontFamily: 'monospace',
          fontSize: `${11 * DPR}px`,
          color: '#ff6b6b',
          backgroundColor: 'rgba(0,0,0,0.6)',
          align: 'center',
          wordWrap: { width: this.scale.width - 40 * DPR },
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(100030)
    }
    this.fatalText.setText(`ERR: ${msg}`)
  }

  private applyRegen(dt: number) {
    if (this.regen <= 0 || this.hero.hp >= this.hero.maxHp) return
    this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + this.regen * dt)
  }

  private addOrb() {
    if (this.orbs.length >= MAX_ORBS) return
    const sprite = this.add
      .circle(this.hero.x, this.hero.y, ORB_R, 0x7cfc7c, 0.9)
      .setStrokeStyle(2 * DPR, 0xffffff, 0.7)
      .setDepth(9)
    this.orbs.push({ sprite, alive: true, cdUntil: 0 })
  }

  private updateOrbs(dt: number) {
    if (this.orbs.length === 0) return
    this.orbAngle += ORB_SPEED * dt
    const n = this.orbs.length
    const hx = this.hero.x
    const hy = this.hero.y
    this.orbs.forEach((o, i) => {
      const ang = this.orbAngle + (i * Math.PI * 2) / n
      const ox = hx + Math.cos(ang) * ORB_RADIUS
      const oy = hy + Math.sin(ang) * ORB_RADIUS
      o.sprite.x = ox
      o.sprite.y = oy
      if (!o.alive) {
        // Восстановление после удара.
        if (this.elapsed >= o.cdUntil) {
          o.alive = true
          o.sprite.setVisible(true).setAlpha(0.9)
        }
        return
      }
      for (const m of this.mobs) {
        const r = ORB_HITR + m.hitr
        if ((m.sprite.x - ox) ** 2 + (m.sprite.y - oy) ** 2 <= r * r) {
          m.hp -= ORB_DMG
          this.hitFlash(m.sprite)
          if (m.hp <= 0) this.killMob(m)
          o.alive = false
          o.cdUntil = this.elapsed + ORB_CD
          o.sprite.setVisible(false)
          break
        }
      }
    })
  }

  private moveHero(dt: number) {
    const d = this.joystick.dir
    const moving = d.x !== 0 || d.y !== 0
    if (moving) {
      const spd = HERO_SPEED * this.moveMult
      this.hero.x = Phaser.Math.Clamp(this.hero.x + d.x * spd * dt, 0, WORLD)
      this.hero.y = Phaser.Math.Clamp(this.hero.y + d.y * spd * dt, 0, WORLD)
      if (d.x !== 0) this.hero.sprite.setFlipX(d.x < 0)
    }
    // Хоп идёт ВСЕГДА: движется — полный прыжок; стоит — лёгкий бобинг (герой
    // никогда не статичен). s: 0 у земли → 1 в апексе (|sin|), squash у земли,
    // stretch в воздухе — как на ферме.
    this.heroHopT += dt
    const freq = moving ? HERO_HOP_FREQ : HERO_IDLE_FREQ
    const amp = moving ? HERO_HOP_AMP : HERO_IDLE_AMP
    const k = moving ? 1 : HERO_IDLE_INTENSITY
    const s = Math.abs(Math.sin(this.heroHopT * freq))
    const fx =
      1 + (Phaser.Math.Linear(HERO_HOP_SQUASH_X, HERO_HOP_STRETCH_X, s) - 1) * k
    const fy =
      1 + (Phaser.Math.Linear(HERO_HOP_SQUASH_Y, HERO_HOP_STRETCH_Y, s) - 1) * k
    this.hero.sprite.setScale(this.heroBaseScale * fx, this.heroBaseScale * fy)
    this.hero.sprite.x = this.hero.x
    this.hero.sprite.y = this.hero.y - s * amp
    // Камера держит ЛОГИЧЕСКУЮ позицию в центре — хоп спрайта виден на экране
    // (startFollow за спрайтом гасил бы подскок).
    this.cameras.main.centerOn(this.hero.x, this.hero.y)
  }

  private nearestMobs(n: number): Mob[] {
    if (this.mobs.length === 0) return []
    const hx = this.hero.x
    const hy = this.hero.y
    return [...this.mobs]
      .sort(
        (a, b) =>
          (a.sprite.x - hx) ** 2 +
          (a.sprite.y - hy) ** 2 -
          ((b.sprite.x - hx) ** 2 + (b.sprite.y - hy) ** 2),
      )
      .slice(0, n)
  }

  private autoAttack(deltaMs: number) {
    this.attackAcc += deltaMs
    if (this.attackAcc < this.atkInterval) return
    const targets = this.nearestMobs(this.maxTargets)
    if (targets.length === 0) {
      this.attackAcc = this.atkInterval // готов выстрелить как только появится цель
      return
    }
    this.attackAcc = 0
    const hx = this.hero.x
    const hy = this.hero.y
    for (const t of targets) {
      const base = Math.atan2(t.sprite.y - hy, t.sprite.x - hx)
      // Залп (multishot): веер снарядов вокруг направления на цель.
      const start = base - ((this.multishot - 1) / 2) * MULTISHOT_SPREAD
      for (let i = 0; i < this.multishot; i++) {
        this.fireProjectile(hx, hy, start + i * MULTISHOT_SPREAD)
      }
    }
  }

  private fireProjectile(x: number, y: number, ang: number) {
    const proj = this.add.circle(x, y, PROJ_R, 0xfff3a0, 1)
    proj.setStrokeStyle(2 * DPR, 0xffae42, 0.9)
    proj.setDepth(20)
    this.projectiles.push({
      sprite: proj,
      vx: Math.cos(ang) * PROJ_SPEED,
      vy: Math.sin(ang) * PROJ_SPEED,
      born: this.elapsed,
      dmg: this.dmg,
      pierce: this.pierce,
      hit: new Set(),
    })
  }

  private updateProjectiles(deltaMs: number) {
    const dt = deltaMs / 1000
    for (const p of [...this.projectiles]) {
      p.sprite.x += p.vx * dt
      p.sprite.y += p.vy * dt
      if (this.elapsed - p.born > PROJ_TTL) {
        this.destroyProjectile(p)
        continue
      }
      // Коллизия с мобами (один удар по мобу за снаряд; pierce = сквозь N врагов).
      for (const m of this.mobs) {
        if (p.hit.has(m)) continue
        const r = m.hitr + PROJ_R
        const dd =
          (m.sprite.x - p.sprite.x) ** 2 + (m.sprite.y - p.sprite.y) ** 2
        if (dd <= r * r) {
          m.hp -= p.dmg
          p.hit.add(m)
          this.hitFlash(m.sprite)
          if (m.hp <= 0) this.killMob(m)
          if (p.pierce > 0) p.pierce -= 1
          else this.destroyProjectile(p)
          break
        }
      }
    }
  }

  private destroyProjectile(p: Projectile) {
    p.sprite.destroy()
    this.projectiles = this.projectiles.filter((x) => x !== p)
  }

  private updateMobs(deltaMs: number) {
    const dt = deltaMs / 1000
    const hx = this.hero.x
    const hy = this.hero.y
    const invuln = this.elapsed < this.invulnUntil
    for (const m of this.mobs) {
      const ang = Math.atan2(hy - m.sprite.y, hx - m.sprite.x)
      m.sprite.x += Math.cos(ang) * m.speed * dt
      m.sprite.y += Math.sin(ang) * m.speed * dt
      m.sprite.setFlipX(Math.cos(ang) < 0)

      // Мили-удар при касании героя.
      const r = m.hitr + HERO_HITR
      const dd = (m.sprite.x - hx) ** 2 + (m.sprite.y - hy) ** 2
      if (dd <= r * r && !invuln && this.elapsed - m.lastHit > MOB_HIT_CD) {
        m.lastHit = this.elapsed
        this.damageHero(m.dmg)
      }
    }
  }

  // === Масштабирование врагов (VS-стиль анти-снежоком) ===
  private get minutes(): number {
    return this.elapsed / 60_000
  }
  private enemyHp(mobLevel: number): number {
    // Чем выше уровень самой жабы-врага — тем больше HP.
    const frogMult = 1 + (mobLevel - 1) * ENEMY_HP_PER_FROGLEVEL
    const lvlMult = 1 + (this.heroXpLevel - 1) * ENEMY_HP_PER_LEVEL
    const timeMult = 1 + this.minutes * ENEMY_HP_PER_MIN
    return Math.round(
      MOB_HP * frogMult * this.mission.enemyMult * lvlMult * timeMult,
    )
  }
  private enemyDmg(): number {
    return Math.round(
      MOB_DMG * this.mission.enemyMult * (1 + this.minutes * ENEMY_DMG_PER_MIN),
    )
  }
  private enemySpeed(): number {
    return MOB_SPEED * Math.min(1.6, 1 + this.minutes * ENEMY_SPEED_PER_MIN)
  }

  private handleSpawning(deltaMs: number) {
    if (this.over) return
    this.spawnAcc += deltaMs
    const ramp = Phaser.Math.Clamp(this.elapsed / SPAWN_RAMP_MS, 0, 1)
    // Чем сложнее миссия — тем чаще спавн.
    const interval =
      Phaser.Math.Linear(SPAWN_INTERVAL_START, SPAWN_INTERVAL_MIN, ramp) /
      this.mission.enemyMult
    if (this.spawnAcc >= interval) {
      this.spawnAcc = 0
      // Толпа растёт со временем: +1 моб за тик каждые SPAWN_BURST_EVERY_MS (кап 4).
      const burst = Math.min(
        4,
        1 + Math.floor(this.elapsed / SPAWN_BURST_EVERY_MS),
      )
      for (let i = 0; i < burst; i++) this.spawnMob()
    }
  }

  private spawnMob() {
    // За краем видимой области относительно героя.
    const cam = this.cameras.main
    const margin = Math.max(cam.width, cam.height) / (2 * cam.zoom) + 80 * DPR
    const ang = Math.random() * Math.PI * 2
    const x = Phaser.Math.Clamp(this.hero.x + Math.cos(ang) * margin, 0, WORLD)
    const y = Phaser.Math.Clamp(this.hero.y + Math.sin(ang) * margin, 0, WORLD)
    // Разные жабы-враги из набора миссии (визуальное разнообразие) + лёгкий
    // красный wash (не полная заливка) — детали жабы остаются читаемыми.
    const lvl = Phaser.Utils.Array.GetRandom(this.mission.mobLevels)
    const sprite = this.makeFrogSprite(x, y, lvl, MOB_SIZE, 0xff9d9d)
    sprite.setDepth(5)
    const hp = this.enemyHp(lvl)
    this.mobs.push({
      sprite,
      hp,
      speed: this.enemySpeed(),
      dmg: this.enemyDmg(),
      hitr: MOB_HITR,
      lastHit: 0,
      isBoss: false,
    })
  }

  private maybeSpawnBoss() {
    if (this.bossSpawned || this.elapsed < this.mission.bossTimeMs) return
    this.bossSpawned = true
    hapticNotification('warning')
    const cam = this.cameras.main
    const margin = Math.max(cam.width, cam.height) / (2 * cam.zoom) + 120 * DPR
    const x = Phaser.Math.Clamp(this.hero.x, 0, WORLD)
    const y = Phaser.Math.Clamp(this.hero.y - margin, 0, WORLD)
    const sprite = this.makeFrogSprite(
      x,
      y,
      this.mission.bossLevel,
      BOSS_SIZE,
      0xc29dff,
    )
    sprite.setDepth(8)
    // Босс тоже тянется за уровнем игрока + сложностью миссии.
    const bossHp = Math.round(
      BOSS_HP *
        this.mission.enemyMult *
        (1 + (this.heroXpLevel - 1) * BOSS_HP_PER_LEVEL),
    )
    this.mobs.push({
      sprite,
      hp: bossHp,
      speed: BOSS_SPEED,
      dmg: Math.round(BOSS_DMG * this.mission.enemyMult),
      hitr: BOSS_HITR,
      lastHit: 0,
      isBoss: true,
    })
  }

  private killMob(m: Mob) {
    this.mobs = this.mobs.filter((x) => x !== m)
    this.kills += 1
    const x = m.sprite.x
    const y = m.sprite.y
    m.sprite.destroy()
    // Обычный моб роняет кристалл (XP). Босс не роняет — его смерть = победа.
    if (!m.isBoss) this.spawnCrystal(x, y)
    // Pop-частицы.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const p = this.add.circle(
        x,
        y,
        3 * DPR,
        m.isBoss ? 0xffd24a : 0xff9b9b,
        0.9,
      )
      p.setDepth(15)
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * 30 * DPR,
        y: y + Math.sin(a) * 30 * DPR,
        alpha: 0,
        duration: 320,
        onComplete: () => p.destroy(),
      })
    }
    if (m.isBoss) this.endRun('win')
  }

  // === Кристаллы + прокачка ===
  private spawnCrystal(x: number, y: number) {
    const c = this.add
      .circle(x, y, CRYSTAL_R, 0x46e6ff, 1)
      .setStrokeStyle(2 * DPR, 0xffffff, 0.8)
      .setDepth(4)
    this.crystals.push({ sprite: c })
  }

  private updateCrystals() {
    const hx = this.hero.x
    const hy = this.hero.y
    const pickup2 = this.pickupR * this.pickupR
    const collect2 = CRYSTAL_COLLECT_R * CRYSTAL_COLLECT_R
    for (const c of [...this.crystals]) {
      if (this.paused) break // левелап открыл окно — стоп до выбора апгрейда
      const s = c.sprite
      const d2 = (hx - s.x) ** 2 + (hy - s.y) ** 2
      if (d2 <= collect2) {
        s.destroy()
        this.crystals = this.crystals.filter((x) => x !== c)
        this.gainXp(1)
        continue
      }
      if (d2 <= pickup2) {
        // Притяжение к герою (магнит).
        s.x = Phaser.Math.Linear(s.x, hx, CRYSTAL_PULL)
        s.y = Phaser.Math.Linear(s.y, hy, CRYSTAL_PULL)
      }
    }
  }

  private gainXp(n: number) {
    this.xp += n
    if (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded
      this.heroXpLevel += 1
      this.xpNeeded = XP_BASE + (this.heroXpLevel - 1) * XP_PER_LEVEL
      this.openUpgradePicker()
    }
  }

  /** Левелап: замораживаем забег и шлём 3 варианта в React-оверлей. */
  private openUpgradePicker() {
    if (this.paused) return
    this.paused = true
    this.pausedAt = Date.now() // watchdog: не висеть в paused вечно (см. update)
    this.joystick.end()
    hapticNotification('success')
    eventBus.emit('survivor:level-up', {
      level: this.heroXpLevel,
      choices: this.rollUpgradeChoices(),
    })
  }

  /** 2 атакующих + 1 защитный (с учётом капов). */
  private rollUpgradeChoices() {
    const atk = Phaser.Utils.Array.Shuffle(
      ATTACK_UPGRADES.filter((u) => this.isUpgradeAvailable(u.id)),
    ).slice(0, 2)
    const def = Phaser.Utils.Array.Shuffle(
      DEFENSE_UPGRADES.filter((u) => this.isUpgradeAvailable(u.id)),
    ).slice(0, 1)
    const picks: UpgradeDef[] = [...atk, ...def]
    // Если пул закаплен и не хватило до 3 — добиваем из остального доступного.
    if (picks.length < 3) {
      const rest = Phaser.Utils.Array.Shuffle(
        [...ATTACK_UPGRADES, ...DEFENSE_UPGRADES].filter(
          (u) => this.isUpgradeAvailable(u.id) && !picks.includes(u),
        ),
      )
      while (picks.length < 3 && rest.length > 0) picks.push(rest.shift()!)
    }
    return picks.map((u) => ({
      id: u.id,
      icon: u.icon,
      title: u.title,
      desc: u.desc,
      kind: u.kind,
    }))
  }

  private isUpgradeAvailable(id: string): boolean {
    switch (id) {
      case 'targets':
        return this.maxTargets < MAX_TARGETS
      case 'multishot':
        return this.multishot < MAX_MULTISHOT
      case 'pierce':
        return this.pierce < MAX_PIERCE
      case 'orb':
        return this.orbs.length < MAX_ORBS
      case 'armor':
        return this.armor < MAX_ARMOR
      default:
        return true // dmg/atkspd/hp/regen — без капа
    }
  }

  private applyUpgrade(id: string) {
    switch (id) {
      case 'dmg':
        this.dmg += 8
        break
      case 'atkspd':
        this.atkInterval = Math.max(ATK_INTERVAL_MIN, this.atkInterval * 0.85)
        break
      case 'targets':
        this.maxTargets = Math.min(MAX_TARGETS, this.maxTargets + 1)
        break
      case 'multishot':
        this.multishot = Math.min(MAX_MULTISHOT, this.multishot + 1)
        break
      case 'pierce':
        this.pierce = Math.min(MAX_PIERCE, this.pierce + 1)
        break
      case 'hp':
        this.hero.maxHp += 30
        this.hero.hp += 30
        break
      case 'orb':
        this.addOrb()
        break
      case 'regen':
        this.regen += 2
        break
      case 'armor':
        this.armor = Math.min(MAX_ARMOR, this.armor + 0.12)
        break
    }
  }

  private hitFlash(s: Phaser.GameObjects.Image) {
    this.tweens.add({
      targets: s,
      duration: 60,
      yoyo: true,
      scaleX: s.scaleX * 1.12,
      scaleY: s.scaleY * 1.12,
    })
  }

  private damageHero(dmg: number) {
    this.hero.hp -= dmg * (1 - this.armor) // апгрейд «панцирь» режет урон
    hapticImpact('light')
    this.cameras.main.shake(80, 0.004)
    this.hero.sprite.setTint(0xff7777)
    this.time.delayedCall(90, () => this.hero.sprite.clearTint())
    if (this.hero.hp <= 0) this.swapLifeOrLose()
  }

  private swapLifeOrLose() {
    this.crewIdx += 1
    if (this.crewIdx >= this.crew.length) {
      this.endRun('lose')
      return
    }
    // Следующая (послабее) жаба выходит в той же точке, кратко неуязвима.
    const lvl = this.crew[this.crewIdx]
    const max = heroMaxHpForLevel(lvl)
    this.hero.level = lvl
    this.hero.maxHp = max
    this.hero.hp = max
    const key = textureKeyForLevel(lvl)
    if (this.textures.exists(key)) {
      this.hero.sprite.setTexture(key)
      this.hero.sprite.setScale(HERO_SIZE / this.hero.sprite.height)
      this.heroBaseScale = this.hero.sprite.scaleX
    }
    this.hero.sprite.clearTint()
    this.invulnUntil = this.elapsed + RESPAWN_INVULN
    // Мигание неуязвимости.
    this.tweens.add({
      targets: this.hero.sprite,
      alpha: 0.35,
      duration: 180,
      yoyo: true,
      repeat: Math.floor(RESPAWN_INVULN / 360),
      onComplete: () => this.hero.sprite.setAlpha(1),
    })
    hapticNotification('error')
  }

  private endRun(result: 'win' | 'lose') {
    if (this.over) return
    this.over = true
    this.joystick.end()

    const base = result === 'win' ? 1500 + this.kills * 15 : this.kills * 6
    const reward = Math.round(base * this.mission.rewardMult)
    if (reward > 0) useGameStore.getState().addGold(reward)

    const w = this.scale.width
    const h = this.scale.height
    const D = 100010

    this.add
      .rectangle(w / 2, h / 2, w, h, 0x000000, 0.62)
      .setScrollFactor(0)
      .setDepth(D)

    // Заголовок результата.
    this.add
      .text(
        w / 2,
        h / 2 - 96 * DPR,
        result === 'win' ? '🏆 ПОБЕДА' : '💀 ОТРЯД ПАЛ',
        {
          fontFamily: 'Russo One, sans-serif',
          fontSize: `${30 * DPR}px`,
          color: result === 'win' ? '#ffe27a' : '#ff8b8b',
          stroke: '#0b1b0e',
          strokeThickness: 5 * DPR,
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(D + 1)

    // Сводка забега.
    const survived = Math.max(0, this.crew.length - this.crewIdx)
    const timeSec = Math.floor(this.elapsed / 1000)
    const mm = Math.floor(timeSec / 60)
    const ss = String(timeSec % 60).padStart(2, '0')
    const summary = [
      `☠ Убито жаб:  ${this.kills}`,
      `⏱ Время:  ${mm}:${ss}`,
      `⭐ Уровень героя:  ${this.heroXpLevel}`,
      `🐸 Выжило:  ${survived}/${this.crew.length}`,
      `💧 Награда:  +${reward}`,
    ].join('\n')
    this.add
      .text(w / 2, h / 2 - 56 * DPR, summary, {
        fontFamily: 'Russo One, sans-serif',
        fontSize: `${15 * DPR}px`,
        color: '#eaffd8',
        align: 'left',
        lineSpacing: 8 * DPR,
        stroke: '#0b1b0e',
        strokeThickness: 3 * DPR,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(D + 1)

    // Кнопка «Продолжить» — экран ждёт тап, не выходит сам.
    const contBtn = this.add
      .text(w / 2, h / 2 + 120 * DPR, 'Продолжить ▶', {
        fontFamily: 'Russo One, sans-serif',
        fontSize: `${18 * DPR}px`,
        color: '#ffffff',
        backgroundColor: '#16a34a',
        padding: { x: 24 * DPR, y: 11 * DPR },
      })
      .setStroke('#0f5132', 3 * DPR)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(D + 1)
      .setInteractive({ useHandCursor: true })

    let exited = false
    const finish = () => {
      if (exited) return
      exited = true
      eventBus.emit('survivor:complete', { result, reward, kills: this.kills })
      eventBus.emit('survivor:exit', {})
    }
    contBtn.on('pointerup', finish)

    hapticNotification(result === 'win' ? 'success' : 'error')
  }

  private cleanup() {
    this.input.removeAllListeners()
    eventBus.off('survivor:pick-upgrade', this.onPickUpgrade)
    this.joystick?.destroy()
    for (const m of this.mobs) m.sprite.destroy()
    for (const p of this.projectiles) p.sprite.destroy()
    for (const c of this.crystals) c.sprite.destroy()
    for (const o of this.orbs) o.sprite.destroy()
    this.mobs = []
    this.projectiles = []
    this.crystals = []
    this.orbs = []
  }
}
