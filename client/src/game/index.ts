import Phaser from 'phaser'
import { MainScene } from './scenes/MainScene'
import { StarMapScene } from './scenes/StarMapScene'
import { eventBus } from '../store/eventBus'

let game: Phaser.Game | null = null

// Экспорт для React-HUD overlay
export function getStarMapHUD(): {
  x: number
  y: number
  zoom: number
  fps: number
  vis: number
  total: number
} | null {
  if (!game) return null
  const sm = game.scene
  if (!sm.isActive('StarMapScene')) return null
  const star = sm.getScene('StarMapScene') as StarMapScene
  const cam = star.cameras?.main
  if (!cam) return null
  return {
    x: Math.round(cam.scrollX + cam.width / (2 * cam.zoom)),
    y: Math.round(cam.scrollY + cam.height / (2 * cam.zoom)),
    zoom: cam.zoom,
    fps: star.hudFps,
    vis: star.hudVisible,
    total: star.hudTotal,
  }
}

export function startGame(): Phaser.Game {
  if (game) return game

  // DPR cap=2: на mobile WebView (особенно TG) DPR=3 даёт 9× pixels и убивает GPU.
  // Cap=2 — индустриальный стандарт для mobile canvas-игр (Phaser/PixiJS recommend).
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
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
    // MainScene стартует автоматически. StarMapScene регистрируется,
    // но автостарт=false — запускается вручную через event bus.
    scene: [MainScene, StarMapScene],
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    fps: { target: 60 },
    input: {
      touch: true,
      mouse: true,
      // По умолчанию Phaser слышит 1 active pointer — для pinch-zoom (StarMap)
      // нужно минимум 2. Без этого второй палец просто игнорируется.
      activePointers: 3,
    },
  }

  game = new Phaser.Game(config)

  // Переключение Phaser-сцен через event bus с плавной анимацией.
  // Логика «полёта»:
  //   Open  (Ферма → StarMap): отдаляемся ОТ фермы (zoom OUT) → подлетаем К карте (zoom IN)
  //   Close (StarMap → Ферма): отдаляемся ОТ карты (zoom OUT) → подлетаем К ферме (zoom IN)
  const sm = () => game!.scene
  let isTransitioning = false
  // Длительность fade — увеличена до 600мс для плавности (раньше 450, бликало при быстром появлении)
  const FADE_MS = 600

  eventBus.on('starmap:open', () => {
    if (isTransitioning) return
    if (sm().isActive('StarMapScene')) return
    isTransitioning = true

    const main = sm().getScene('MainScene') as Phaser.Scene
    const mainCam = main.cameras.main
    const startZoom = mainCam.zoom

    // Шаг 1: ОТДАЛЯЕМСЯ от фермы — она уменьшается + fade out
    main.tweens.add({
      targets: mainCam,
      zoom: startZoom * 0.4,
      duration: FADE_MS,
      ease: 'Quad.easeIn',
    })
    mainCam.fadeOut(FADE_MS, 0, 0, 0)

    main.time.delayedCall(FADE_MS, () => {
      mainCam.setZoom(startZoom)
      mainCam.resetFX()
      sm().pause('MainScene')

      const wasSleeping = sm().isSleeping('StarMapScene')
      if (wasSleeping) sm().wake('StarMapScene')
      else sm().start('StarMapScene')

      const animate = () => {
        const star = sm().getScene('StarMapScene') as Phaser.Scene
        if (!star || !star.cameras?.main) {
          requestAnimationFrame(animate)
          return
        }
        const starCam = star.cameras.main
        starCam.setZoom(1.0)
        // Используем camera.alpha tween, не fadeIn — fadeIn это overlay,
        // который не предотвращает мерцание объектов до его старта.
        starCam.setAlpha(0)
        starCam.resetFX()
        star.tweens.add({
          targets: starCam,
          alpha: 1,
          duration: FADE_MS,
          ease: 'Sine.easeOut',
          onComplete: () => {
            isTransitioning = false
          },
        })
      }
      requestAnimationFrame(animate)
    })
  })

  eventBus.on('starmap:close', () => {
    if (isTransitioning) return
    if (!sm().isActive('StarMapScene')) return
    isTransitioning = true

    const star = sm().getScene('StarMapScene') as Phaser.Scene
    const starCam = star.cameras.main

    // Плавно скрываем через alpha tween (не fadeOut overlay)
    star.tweens.add({
      targets: starCam,
      alpha: 0,
      duration: FADE_MS,
      ease: 'Sine.easeIn',
    })

    star.time.delayedCall(FADE_MS, () => {
      starCam.setZoom(1.0)
      starCam.resetFX()
      // alpha остаётся 0 — при следующем wake/open опять подкрутим к 1
      sm().sleep('StarMapScene')

      sm().resume('MainScene')
      const main = sm().getScene('MainScene') as Phaser.Scene
      const mainCam = main.cameras.main
      // Шаг 2: ПОДЛЕТАЕМ к ферме — стартуем издалека, приближаемся (zoom IN)
      mainCam.setZoom(0.4)
      mainCam.fadeIn(FADE_MS, 0, 0, 0)
      main.tweens.add({
        targets: mainCam,
        zoom: 1.0,
        duration: FADE_MS,
        ease: 'Sine.easeOut',
        onComplete: () => {
          isTransitioning = false
        },
      })
    })
  })

  // Подгоняем размер игры при ресайзе окна
  window.addEventListener('resize', () => {
    if (!game) return
    const newW = parent.clientWidth
    const newH = parent.clientHeight
    game.scale.resize(newW * dpr, newH * dpr)
  })

  return game
}
