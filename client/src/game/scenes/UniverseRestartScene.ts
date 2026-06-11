import Phaser from 'phaser'

const SCENE_KEY = 'UniverseRestartScene'
const BG_COLOR = 0x0a0a1a
const STAR_COUNT = 80
const TWINKLE_MIN_ALPHA = 0.2
const TWINKLE_MAX_ALPHA = 0.9

interface StarData {
  gfx: Phaser.GameObjects.Arc
  tween: Phaser.Tweens.Tween
}

export class UniverseRestartScene extends Phaser.Scene {
  private stars: StarData[] = []
  private galaxy!: Phaser.GameObjects.Graphics
  private galaxyTween!: Phaser.Tweens.Tween
  private galaxyAngle = 0

  constructor() {
    super({ key: SCENE_KEY })
  }

  create() {
    const { width, height } = this.scale

    this.cameras.main.setBackgroundColor(BG_COLOR)

    this.buildStarfield(width, height)
    this.buildGalaxy(width, height)
  }

  private buildStarfield(width: number, height: number) {
    for (let i = 0; i < STAR_COUNT; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)
      const radius = Phaser.Math.FloatBetween(0.5, 2.0)
      const alpha = Phaser.Math.FloatBetween(TWINKLE_MIN_ALPHA, TWINKLE_MAX_ALPHA)

      const star = this.add.circle(x, y, radius, 0xffffff, alpha)

      const duration = Phaser.Math.Between(1200, 4000)
      const delay = Phaser.Math.Between(0, 3000)
      const tween = this.tweens.add({
        targets: star,
        alpha: { from: TWINKLE_MIN_ALPHA, to: TWINKLE_MAX_ALPHA },
        duration,
        delay,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })

      this.stars.push({ gfx: star, tween })
    }
  }

  private buildGalaxy(width: number, height: number) {
    this.galaxy = this.add.graphics()
    this.galaxy.setPosition(width / 2, height / 2)
    this.galaxy.setAlpha(0.12)

    this.drawGalaxyRings()

    this.galaxyTween = this.tweens.addCounter({
      from: 0,
      to: 360,
      duration: 24000,
      repeat: -1,
      ease: 'Linear',
      onUpdate: (tween) => {
        this.galaxyAngle = tween.getValue() ?? 0
        this.galaxy.setRotation(Phaser.Math.DegToRad(this.galaxyAngle))
      },
    })
  }

  private drawGalaxyRings() {
    const g = this.galaxy
    g.clear()

    const radii = [60, 110, 160, 210]
    const colors = [0xa855f7, 0x7c3aed, 0x6d28d9, 0x4c1d95]

    radii.forEach((r, idx) => {
      const color = colors[idx]
      const alpha = 0.6 - idx * 0.1
      g.lineStyle(1.5, color, alpha)
      g.strokeEllipse(0, 0, r * 2, r * 0.7)
    })

    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2
      const spread = Phaser.Math.FloatBetween(40, 220)
      const px = Math.cos(angle) * spread
      const py = Math.sin(angle) * spread * 0.35
      const size = Phaser.Math.FloatBetween(0.5, 1.5)
      const alphaVal = Phaser.Math.FloatBetween(0.3, 0.8)
      g.fillStyle(0xc4b5fd, alphaVal)
      g.fillCircle(px, py, size)
    }

    g.fillStyle(0xe9d5ff, 0.6)
    g.fillCircle(0, 0, 4)
    g.fillStyle(0xffffff, 0.9)
    g.fillCircle(0, 0, 2)
  }

  shutdown() {
    for (const { tween } of this.stars) {
      tween.stop()
      tween.remove()
    }
    this.stars = []

    if (this.galaxyTween) {
      this.galaxyTween.stop()
      this.galaxyTween.remove()
    }

    if (this.galaxy) {
      this.galaxy.destroy()
    }
  }
}
