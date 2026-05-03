import Phaser from 'phaser'
import { MainScene } from './scenes/MainScene'

let game: Phaser.Game | null = null

export function startGame(): Phaser.Game {
  if (game) return game

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-canvas',
    backgroundColor: 'transparent',
    transparent: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [MainScene],
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    fps: { target: 60 },
    input: {
      touch: true,
      mouse: true,
    },
  }

  game = new Phaser.Game(config)
  return game
}
