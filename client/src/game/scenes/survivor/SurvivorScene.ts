// SurvivorScene — VS-арена (Vampire Survivors в формате нашей игры). Phase 1 прототип.
//
// Петля: 1 жаба-герой в центре, камера за ней. Мобы прут со сторон и бьют в
// МИЛИ при касании. Герой авто-атакует ДАЛЬНОБОЙНО (снаряд в ближайшего).
// Экипаж = «жизни»: герой умер → выходит следующая жаба (послабее), урон отряда
// КОНСТАНТНЫЙ. Кончился экипаж → fail. На BOSS_TIME спавнится босс → убил → win.
// Прокачки в забеге пока НЕТ (Phase 2 — кристаллы с мобов).
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
const HERO_HOP_FREQ = 13 // рад/с — частота хопа
// Squash-stretch как на ферме: в воздухе тянется вверх, у земли сжимается.
const HERO_HOP_STRETCH_Y = 1.18
const HERO_HOP_SQUASH_Y = 0.82
const HERO_HOP_STRETCH_X = 0.92
const HERO_HOP_SQUASH_X = 1.12

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

  // HUD
  private hpBarFill!: Phaser.GameObjects.Rectangle
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
    this.cameras.main.startFollow(sprite, true, 0.12, 0.12)

    // Joystick + input.
    this.joystick = new VirtualJoystick(this)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) =>
      this.joystick.start(p.x, p.y),
    )
    this.input.on('pointermove', (p: Phaser.Input.Pointer) =>
      this.joystick.move(p.x, p.y),
    )
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
    const top = 18 * DPR

    this.add
      .rectangle(w / 2, top, barW, barH, 0x000000, 0.5)
      .setScrollFactor(0)
      .setDepth(99990)
      .setStrokeStyle(2 * DPR, 0xffffff, 0.4)
    this.hpBarFill = this.add
      .rectangle(w / 2 - barW / 2, top, barW, barH - 4 * DPR, 0x4ad295)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(99991)

    this.infoText = this.add
      .text(12 * DPR, 12 * DPR, '', {
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
      .text(w - 16 * DPR, 14 * DPR, '✕', {
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
    const lives = this.crew.length - this.crewIdx
    const sec = Math.max(0, Math.ceil((BOSS_TIME - this.elapsed) / 1000))
    const bossLabel = this.bossSpawned ? '👑 БОСС' : `👑 ${sec}с`
    this.infoText.setText(`🐸×${lives}   ☠ ${this.kills}   ${bossLabel}`)
  }

  // === Main loop ===
  override update(_time: number, deltaMs: number) {
    if (this.over) return
    const dt = deltaMs / 1000
    this.elapsed += deltaMs

    this.moveHero(dt)
    this.autoAttack(deltaMs)
    this.updateProjectiles(deltaMs)
    this.updateMobs(deltaMs)
    this.handleSpawning(deltaMs)
    this.maybeSpawnBoss()
    this.updateHud()
  }

  private moveHero(dt: number) {
    const d = this.joystick.dir
    const moving = d.x !== 0 || d.y !== 0
    if (moving) {
      this.hero.x = Phaser.Math.Clamp(
        this.hero.x + d.x * HERO_SPEED * dt,
        0,
        WORLD,
      )
      this.hero.y = Phaser.Math.Clamp(
        this.hero.y + d.y * HERO_SPEED * dt,
        0,
        WORLD,
      )
      this.heroHopT += dt
      if (d.x !== 0) this.hero.sprite.setFlipX(d.x < 0)
    } else {
      this.heroHopT = 0 // стоит на земле
    }
    // s: 0 у земли → 1 в апексе (|sin|). Высота подскока + squash-stretch:
    // у земли сжат (squash), в воздухе вытянут (stretch) — как на ферме.
    const s = moving ? Math.abs(Math.sin(this.heroHopT * HERO_HOP_FREQ)) : 0
    const sx =
      this.heroBaseScale *
      (moving
        ? Phaser.Math.Linear(HERO_HOP_SQUASH_X, HERO_HOP_STRETCH_X, s)
        : 1)
    const sy =
      this.heroBaseScale *
      (moving
        ? Phaser.Math.Linear(HERO_HOP_SQUASH_Y, HERO_HOP_STRETCH_Y, s)
        : 1)
    this.hero.sprite.setScale(sx, sy)
    this.hero.sprite.x = this.hero.x
    this.hero.sprite.y = this.hero.y - s * HERO_HOP_AMP
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
    if (this.attackAcc < ATTACK_INTERVAL) return
    const target = this.nearestMob()
    if (!target) {
      this.attackAcc = ATTACK_INTERVAL // готов выстрелить как только появится цель
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
          m.hp -= ATTACK_DMG
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
    // Pop-частицы (Phase 2 — здесь будет дроп кристалла).
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
    for (const m of this.mobs) m.sprite.destroy()
    for (const p of this.projectiles) p.sprite.destroy()
    this.mobs = []
    this.projectiles = []
  }
}
