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

interface SurvivorInit {
  crew: number[]
  shipId: number
  planetId?: string
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

const BOSS_TIME = 60_000 // ms до появления босса
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
const XP_BASE = 4 // кристаллов на 1→2 уровень
const XP_PER_LEVEL = 2 // +N к порогу за каждый следующий уровень
const ATK_INTERVAL_MIN = 150 // пол скорострельности (апгрейд не опустит ниже)

// Пул апгрейдов (выбор 3 случайных на левелапе). apply — в applyUpgrade().
const UPGRADE_POOL: { id: string; label: string }[] = [
  { id: 'hp', label: '❤️ +30 макс. HP' },
  { id: 'dmg', label: '🗡 +8 урон' },
  { id: 'atkspd', label: '⚡ Скорострельность +15%' },
  { id: 'speed', label: '🥾 +12% скорость' },
  { id: 'magnet', label: '🧲 +35% радиус сбора' },
]

interface Crystal {
  sprite: Phaser.GameObjects.Arc
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
}

function heroMaxHpForLevel(level: number): number {
  // Слабее последующие «жизни» (crew отсортирован по убыванию уровня).
  return 60 + level * 14
}

export class SurvivorScene extends Phaser.Scene {
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
  private moveMult = 1
  private pickupR = CRYSTAL_PICKUP_R

  // Прокачка через кристаллы.
  private crystals: Crystal[] = []
  private xp = 0
  private heroXpLevel = 1
  private xpNeeded = XP_BASE
  private paused = false // true пока открыто окно апгрейда (логика заморожена)
  private pickerLayer?: Phaser.GameObjects.Container

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
    this.crystals = []
    this.xp = 0
    this.heroXpLevel = 1
    this.xpNeeded = XP_BASE
    this.paused = false
    this.pickerLayer = undefined
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

    this.buildHud()

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup())
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
    const sec = Math.max(0, Math.ceil((BOSS_TIME - this.elapsed) / 1000))
    const bossLabel = this.bossSpawned ? '👑 БОСС' : `👑 ${sec}с`
    this.infoText.setText(
      `🐸×${lives}   ⭐${this.heroXpLevel}   ☠ ${this.kills}   ${bossLabel}`,
    )
  }

  // === Main loop ===
  override update(_time: number, deltaMs: number) {
    if (this.over || this.paused) return // окно апгрейда замораживает забег
    const dt = deltaMs / 1000
    this.elapsed += deltaMs

    this.moveHero(dt)
    this.autoAttack(deltaMs)
    this.updateProjectiles(deltaMs)
    this.updateMobs(deltaMs)
    this.updateCrystals()
    this.handleSpawning(deltaMs)
    this.maybeSpawnBoss()
    this.updateHud()
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

  private nearestMob(): Mob | null {
    let best: Mob | null = null
    let bestD = Infinity
    const hx = this.hero.x
    const hy = this.hero.y
    for (const m of this.mobs) {
      const dd = (m.sprite.x - hx) ** 2 + (m.sprite.y - hy) ** 2
      if (dd < bestD) {
        bestD = dd
        best = m
      }
    }
    return best
  }

  private autoAttack(deltaMs: number) {
    this.attackAcc += deltaMs
    if (this.attackAcc < this.atkInterval) return
    const target = this.nearestMob()
    if (!target) {
      this.attackAcc = this.atkInterval // готов выстрелить как только появится цель
      return
    }
    this.attackAcc = 0
    const hx = this.hero.x
    const hy = this.hero.y
    const ang = Math.atan2(target.sprite.y - hy, target.sprite.x - hx)
    const proj = this.add.circle(hx, hy, PROJ_R, 0xfff3a0, 1)
    proj.setStrokeStyle(2 * DPR, 0xffae42, 0.9)
    proj.setDepth(20)
    this.projectiles.push({
      sprite: proj,
      vx: Math.cos(ang) * PROJ_SPEED,
      vy: Math.sin(ang) * PROJ_SPEED,
      born: this.elapsed,
      dmg: this.dmg,
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
      // Коллизия с мобами.
      for (const m of this.mobs) {
        const r = m.hitr + PROJ_R
        const dd =
          (m.sprite.x - p.sprite.x) ** 2 + (m.sprite.y - p.sprite.y) ** 2
        if (dd <= r * r) {
          m.hp -= p.dmg
          this.hitFlash(m.sprite)
          this.destroyProjectile(p)
          if (m.hp <= 0) this.killMob(m)
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

  private handleSpawning(deltaMs: number) {
    if (this.over) return
    this.spawnAcc += deltaMs
    const ramp = Phaser.Math.Clamp(this.elapsed / SPAWN_RAMP_MS, 0, 1)
    const interval = Phaser.Math.Linear(
      SPAWN_INTERVAL_START,
      SPAWN_INTERVAL_MIN,
      ramp,
    )
    if (this.spawnAcc >= interval) {
      this.spawnAcc = 0
      this.spawnMob()
    }
  }

  private spawnMob() {
    // За краем видимой области относительно героя.
    const cam = this.cameras.main
    const margin = Math.max(cam.width, cam.height) / (2 * cam.zoom) + 80 * DPR
    const ang = Math.random() * Math.PI * 2
    const x = Phaser.Math.Clamp(this.hero.x + Math.cos(ang) * margin, 0, WORLD)
    const y = Phaser.Math.Clamp(this.hero.y + Math.sin(ang) * margin, 0, WORLD)
    const sprite = this.makeFrogSprite(x, y, 1, MOB_SIZE, 0xff6b6b)
    sprite.setDepth(5)
    this.mobs.push({
      sprite,
      hp: MOB_HP,
      speed: MOB_SPEED,
      dmg: MOB_DMG,
      hitr: MOB_HITR,
      lastHit: 0,
      isBoss: false,
    })
  }

  private maybeSpawnBoss() {
    if (this.bossSpawned || this.elapsed < BOSS_TIME) return
    this.bossSpawned = true
    hapticNotification('warning')
    const cam = this.cameras.main
    const margin = Math.max(cam.width, cam.height) / (2 * cam.zoom) + 120 * DPR
    const x = Phaser.Math.Clamp(this.hero.x, 0, WORLD)
    const y = Phaser.Math.Clamp(this.hero.y - margin, 0, WORLD)
    const sprite = this.makeFrogSprite(x, y, 18, BOSS_SIZE, 0x9b30ff)
    sprite.setDepth(8)
    this.mobs.push({
      sprite,
      hp: BOSS_HP,
      speed: BOSS_SPEED,
      dmg: BOSS_DMG,
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

  /** Модалка выбора 1 из 3 апгрейдов поверх игры — забег заморожен (paused). */
  private openUpgradePicker() {
    if (this.pickerLayer) return
    this.paused = true
    this.joystick.end()
    hapticNotification('success')

    const w = this.scale.width
    const h = this.scale.height
    const layer = this.add.container(0, 0).setScrollFactor(0).setDepth(100020)

    layer.add(this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.62))
    layer.add(
      this.add
        .text(w / 2, h * 0.28, `Уровень ${this.heroXpLevel}!\nВыбери апгрейд`, {
          fontFamily: 'Russo One, sans-serif',
          fontSize: `${20 * DPR}px`,
          color: '#ffe27a',
          align: 'center',
          stroke: '#0b1b0e',
          strokeThickness: 4 * DPR,
        })
        .setOrigin(0.5),
    )

    const pool = Phaser.Utils.Array.Shuffle([...UPGRADE_POOL]).slice(0, 3)
    pool.forEach((u, i) => {
      const cy = h * 0.44 + i * 74 * DPR
      const card = this.add
        .text(w / 2, cy, u.label, {
          fontFamily: 'sans-serif',
          fontSize: `${17 * DPR}px`,
          color: '#ffffff',
          backgroundColor: '#16a34a',
          padding: { x: 26 * DPR, y: 14 * DPR },
          fontStyle: 'bold',
          align: 'center',
          fixedWidth: w * 0.7,
        })
        .setStroke('#0f5132', 3 * DPR)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      card.on('pointerup', () => this.chooseUpgrade(u.id))
      layer.add(card)
    })

    this.pickerLayer = layer
  }

  private chooseUpgrade(id: string) {
    this.applyUpgrade(id)
    this.pickerLayer?.destroy()
    this.pickerLayer = undefined
    this.joystick.end()
    this.paused = false
  }

  private applyUpgrade(id: string) {
    switch (id) {
      case 'hp':
        this.hero.maxHp += 30
        this.hero.hp += 30
        break
      case 'dmg':
        this.dmg += 8
        break
      case 'atkspd':
        this.atkInterval = Math.max(ATK_INTERVAL_MIN, this.atkInterval * 0.85)
        break
      case 'speed':
        this.moveMult *= 1.12
        break
      case 'magnet':
        this.pickupR *= 1.35
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
    this.hero.hp -= dmg
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

    const reward = result === 'win' ? 1500 + this.kills * 15 : this.kills * 6
    if (reward > 0) useGameStore.getState().addGold(reward)

    const w = this.scale.width
    const h = this.scale.height
    this.add
      .rectangle(w / 2, h / 2, w, h, 0x000000, 0.55)
      .setScrollFactor(0)
      .setDepth(100010)
    this.add
      .text(
        w / 2,
        h / 2 - 20 * DPR,
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
      .setDepth(100011)
    this.add
      .text(w / 2, h / 2 + 24 * DPR, `Убито: ${this.kills}   +${reward} 💧`, {
        fontFamily: 'Russo One, sans-serif',
        fontSize: `${15 * DPR}px`,
        color: '#eaffd8',
        stroke: '#0b1b0e',
        strokeThickness: 3 * DPR,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100011)

    hapticNotification(result === 'win' ? 'success' : 'error')

    this.time.delayedCall(2200, () => {
      eventBus.emit('survivor:complete', { result, reward, kills: this.kills })
      eventBus.emit('survivor:exit', {})
    })
  }

  private cleanup() {
    this.input.removeAllListeners()
    this.joystick?.destroy()
    this.pickerLayer?.destroy()
    this.pickerLayer = undefined
    for (const m of this.mobs) m.sprite.destroy()
    for (const p of this.projectiles) p.sprite.destroy()
    for (const c of this.crystals) c.sprite.destroy()
    this.mobs = []
    this.projectiles = []
    this.crystals = []
  }
}
