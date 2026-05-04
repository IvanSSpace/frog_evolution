import Phaser from 'phaser'
import { MainScene } from './scenes/MainScene'

let game: Phaser.Game | null = null

export function startGame(): Phaser.Game {
  if (game) return game

  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))
  const parent = document.getElementById('game-canvas') as HTMLElement

  // Размеры CSS-родителя (game-canvas div занимает между Header и BottomBar)
  const cssW = parent.clientWidth || window.innerWidth
  const cssH = parent.clientHeight || window.innerHeight

  // Игровая логика и backing store в ФИЗИЧЕСКИХ пикселях, CSS-display через zoom
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    parent,
    backgroundColor: 'transparent',
    transparent: true,
    scale: {
      mode: Phaser.Scale.NONE,
      width: cssW * dpr,
      height: cssH * dpr,
      zoom: 1 / dpr,
    },
    render: {
      antialias: true,
      antialiasGL: true,
      pixelArt: false,
      roundPixels: false,
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

  // Подгоняем размер игры при ресайзе окна
  window.addEventListener('resize', () => {
    if (!game) return
    const newW = parent.clientWidth
    const newH = parent.clientHeight
    game.scale.resize(newW * dpr, newH * dpr)
  })

  return game
}
