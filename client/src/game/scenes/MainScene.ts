import Phaser from 'phaser'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'

const SWAMP_COLOR = 0x2d5a1b
const WATER_COLOR = 0x1a3d2b
const DASH_RADIUS = 70

interface Poop {
  img: Phaser.GameObjects.Image
  value: number
  expiresAt: number
}

interface FrogData {
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Image
  facingRight: boolean
  isMoving: boolean
}

export class MainScene extends Phaser.Scene {
  private frogs: FrogData[] = []
  private poops: Poop[] = []

  constructor() {
    super({ key: 'MainScene' })
  }

  preload() {
    this.load.svg('frog1', '/frog1.svg', { width: 72, height: 68 })
    this.load.svg('poop', '/poop.svg', { width: 26, height: 26 })
  }

  create() {
    const { width, height } = this.scale

    this.add.rectangle(width / 2, height / 2, width, height, SWAMP_COLOR)
    this.add.ellipse(width * 0.3, height * 0.6, 120, 60, WATER_COLOR, 0.6)
    this.add.ellipse(width * 0.7, height * 0.7, 90, 45, WATER_COLOR, 0.6)
    this.add.ellipse(width * 0.5, height * 0.4, 150, 70, WATER_COLOR, 0.5)

    this.spawnFrog(width / 2, height * 0.55)
  }

  private spawnFrog(x: number, y: number) {
    const container = this.add.container(x, y)

    const body = this.add.image(0, 0, 'frog1')
    body.scaleY = 0.8
    body.setInteractive({ useHandCursor: true })

    container.add(body)

    const frog: FrogData = { container, body, facingRight: true, isMoving: false }
    body.on('pointerdown', () => this.onFrogTapped(frog))
    this.frogs.push(frog)

    this.startIdleAnim(frog)
    this.scheduleNextDash(frog)
  }

  private startIdleAnim(frog: FrogData) {
    this.tweens.add({
      targets: frog.body,
      scaleY: 0.72,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private scheduleNextDash(frog: FrogData) {
    this.time.addEvent({
      delay: Phaser.Math.Between(2000, 4000),
      callback: () => this.performDash(frog),
    })
  }

  private performDash(frog: FrogData) {
    if (frog.isMoving) {
      this.scheduleNextDash(frog)
      return
    }

    const { width, height } = this.scale
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const dist = Phaser.Math.FloatBetween(40, DASH_RADIUS)

    const fromX = frog.container.x
    const fromY = frog.container.y
    const toX = Phaser.Math.Clamp(fromX + Math.cos(angle) * dist, 50, width - 50)
    const toY = Phaser.Math.Clamp(fromY + Math.sin(angle) * dist, 50, height - 50)

    const movingRight = toX >= fromX
    if (movingRight !== frog.facingRight) {
      frog.container.scaleX = movingRight ? 1 : -1
      frog.facingRight = movingRight
    }

    frog.isMoving = true
    this.tweens.killTweensOf(frog.body)

    // 1. Poop appears at current position
    this.spawnPoop(fromX, fromY, frog.facingRight)

    // 2. Short pause, then leap
    this.time.delayedCall(350, () => {
      // Squash before leap
      this.tweens.add({
        targets: frog.body,
        scaleY: 0.55,
        duration: 90,
        ease: 'Power2.easeIn',
        onComplete: () => {
          // Stretch during dash
          this.tweens.add({
            targets: frog.body,
            scaleY: 1.05,
            duration: 160,
            ease: 'Linear',
          })

          // Move to target
          this.tweens.add({
            targets: frog.container,
            x: toX,
            y: toY,
            duration: 200,
            ease: 'Power2.easeOut',
            onComplete: () => {
              this.tweens.killTweensOf(frog.body)

              // Landing squash
              this.tweens.add({
                targets: frog.body,
                scaleY: 0.5,
                duration: 60,
                ease: 'Power2.easeIn',
                onComplete: () => {
                  // Settle to resting squish
                  this.tweens.add({
                    targets: frog.body,
                    scaleY: 0.8,
                    duration: 220,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                      frog.isMoving = false
                      this.startIdleAnim(frog)
                      this.scheduleNextDash(frog)
                    },
                  })
                },
              })
            },
          })
        },
      })
    })
  }

  private onFrogTapped(frog: FrogData) {
    this.spawnPoop(frog.container.x, frog.container.y, frog.facingRight)

    this.tweens.add({
      targets: frog.body,
      scaleY: 0.55,
      duration: 80,
      yoyo: true,
      ease: 'Power2',
    })
  }

  private spawnPoop(x: number, y: number, facingRight: boolean) {
    const value = 1
    // Spawn from behind the frog, slightly above center
    const behindX = x + (facingRight ? -16 : 16)
    const img = this.add.image(behindX, y + 10, 'poop')
    img.setInteractive({ useHandCursor: true })
    img.setAlpha(0)
    img.setScale(0.4)

    // Shoot diagonally: 75° from vertical = mostly backward, little downward
    const rad = (75 * Math.PI) / 180
    const dist = 28
    const dx = dist * Math.sin(rad)  // ≈ 27 — horizontal
    const dy = dist * Math.cos(rad)  // ≈ 7  — vertical
    const landX = behindX + (facingRight ? -dx : dx)
    const landY = y + 10 + dy

    this.tweens.add({
      targets: img,
      x: landX,
      y: landY,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Power2.easeOut',
    })

    const poopObj: Poop = { img, value, expiresAt: Date.now() + 1000 }
    img.on('pointerdown', () => this.collectPoop(poopObj))
    this.poops.push(poopObj)
  }

  private collectPoop(poopObj: Poop) {
    const { img, value } = poopObj
    if (!img.active) return

    useGameStore.getState().addGold(value)
    eventBus.emit('poop:collected', { value })

    this.tweens.add({
      targets: img,
      y: img.y - 40,
      alpha: 0,
      scale: 1.5,
      duration: 350,
      ease: 'Power2',
      onComplete: () => {
        img.destroy()
        this.poops = this.poops.filter((p) => p !== poopObj)
      },
    })
  }

  update() {
    const now = Date.now()
    this.poops = this.poops.filter((p) => {
      if (p.expiresAt < now && p.img.active) {
        this.tweens.add({
          targets: p.img,
          alpha: 0,
          duration: 200,
          onComplete: () => p.img.destroy(),
        })
        return false
      }
      return true
    })
  }
}
