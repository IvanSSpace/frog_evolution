import Phaser from 'phaser'
import { MainScene } from './scenes/MainScene'
import { StarMapScene } from './scenes/StarMapScene'
import { BattleScene } from './scenes/battle/BattleScene'
import { BarracksScene } from './scenes/barracks/BarracksScene'
import { eventBus } from '../store/eventBus'
import { useGameStore } from '../store/gameStore'

let game: Phaser.Game | null = null

/** Включает/выключает весь Phaser input. Используется useModalLock — пока открыта
 *  любая модалка, тапы не доходят до сцены даже если DOM events каким-то путём
 *  просочились через overlay. */
export function setPhaserInputEnabled(enabled: boolean): void {
  if (!game) return
  if (game.input) {
    game.input.enabled = enabled
  }
  // Также отключаем input на каждой сцене (per-scene InputPlugin),
  // иначе scene.input.on('pointerdown') слушатели могут продолжать срабатывать.
  game.scene.scenes.forEach((sc) => {
    if (sc.input) sc.input.enabled = enabled
  })
  // Hard kill: pointer-events на canvas DOM element напрямую. CSS body.modal-open
  // может не успеть применится в фрейме открытия модалки.
  const canvas = game.canvas
  if (canvas) {
    canvas.style.pointerEvents = enabled ? '' : 'none'
  }
}

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
      // antialias=true для canvas-fallback (мягкие линии); antialiasGL=false
      // выключает MSAA на WebGL — на mobile GPU MSAA даёт ~30-40% накладных
      // на каждый пиксель. На сцене с blur/glow визуально незаметно.
      antialias: true,
      antialiasGL: false,
      pixelArt: false,
      roundPixels: false,
      // На устройствах с двумя GPU (флагман-телефоны, ноуты) подсказывает браузеру
      // использовать дискретный GPU для WebGL вместо интегрированного.
      powerPreference: 'high-performance',
    },
    // MainScene стартует автоматически. StarMapScene + BattleScene регистрируются,
    // но автостарт=false — запускаются вручную через event bus.
    scene: [MainScene, StarMapScene, BattleScene, BarracksScene],
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    // Mobile: cap to 30 FPS для стабильности. Mobile WebView не вытягивает 60
    // на сложной сцене StarMap; вместо рваных 15-25 → стабильные 30, гораздо
    // приятнее перцептивно. На десктопе detect через touch — там 60.
    fps: { target: 'ontouchstart' in window ? 30 : 60 },
    input: {
      touch: true,
      mouse: true,
      // По умолчанию Phaser слышит 1 active pointer — для pinch-zoom (StarMap)
      // нужно минимум 2. Без этого второй палец просто игнорируется.
      activePointers: 3,
    },
  }

  game = new Phaser.Game(config)

  // Переключение Phaser-сцен через event bus с тем же dual-container zoom-feel
  // что и при смене обычной локации. «Промежуточная локация» = map4.webp:
  //   Open  (Ферма → StarMap): ферма сжимается в точку, map4 разрастается
  //                            на полный экран → sleep MainScene → wake StarMap
  //                            с fade-in поверх (фон у Star уже чёрный).
  //   Close (StarMap → Ферма): обратно — StarMap fade-out → wake MainScene
  //                            (там bg=map4) → dual-container на целевую локацию.
  const sm = () => game!.scene
  let isTransitioning = false
  const FADE_MS = 350 // fade StarMap поверх map4

  eventBus.on('starmap:open', async () => {
    if (isTransitioning) return
    if (sm().isActive('StarMapScene')) return
    isTransitioning = true

    const main = sm().getScene('MainScene') as MainScene
    // Этап 1: dual-container zoom-out фермы + zoom-in map4 (тот же эффект,
    // что переключение на обычную локацию).
    await main.locTransition.runOpenStarMapTransition()

    // Этап 2: засыпаем MainScene и поднимаем StarMap.
    sm().sleep('MainScene')

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

  eventBus.on('starmap:close', () => {
    if (isTransitioning) return
    if (!sm().isActive('StarMapScene')) return
    isTransitioning = true

    const star = sm().getScene('StarMapScene') as Phaser.Scene
    const starCam = star.cameras.main

    // Этап 1: затухание StarMap (под ней лежит спящая MainScene с bg=map4)
    star.tweens.add({
      targets: starCam,
      alpha: 0,
      duration: FADE_MS,
      ease: 'Sine.easeIn',
    })

    star.time.delayedCall(FADE_MS, async () => {
      starCam.setZoom(1.0)
      starCam.resetFX()
      sm().sleep('StarMapScene')

      sm().wake('MainScene')
      const main = sm().getScene('MainScene') as MainScene

      // Этап 2: dual-container zoom от map4 к фактической локации игрока.
      const targetLoc = useGameStore.getState().currentLocation
      await main.locTransition.runCloseStarMapTransition(targetLoc)
      isTransitioning = false
    })
  })

  // Battle scene (PvP raid) — переключение MainScene <-> BattleScene.
  // Этап 3a: простой sleep/wake без transition cinematics.
  eventBus.on('battle:start', (payload?: { locationId?: number }) => {
    const locId = payload?.locationId ?? 1
    if (sm().isActive('BattleScene')) return
    sm().sleep('MainScene')
    if (sm().isSleeping('BattleScene')) {
      sm().wake('BattleScene', { locationId: locId })
    } else {
      sm().start('BattleScene', { locationId: locId })
    }
    useGameStore.getState().setBattleSceneActive(true)
  })

  eventBus.on('battle:exit', () => {
    if (!sm().isActive('BattleScene')) return
    sm().sleep('BattleScene')
    sm().wake('MainScene')
    useGameStore.getState().setBattleSceneActive(false)
  })

  // Barracks scene — отдельная локация казармы.
  eventBus.on('barracks:open', () => {
    if (sm().isActive('BarracksScene')) return
    sm().sleep('MainScene')
    if (sm().isSleeping('BarracksScene')) {
      sm().wake('BarracksScene')
    } else {
      sm().start('BarracksScene')
    }
    useGameStore.getState().setBattleSceneActive(true)
  })

  eventBus.on('barracks:exit', () => {
    if (!sm().isActive('BarracksScene')) return
    sm().sleep('BarracksScene')
    sm().wake('MainScene')
    useGameStore.getState().setBattleSceneActive(false)
  })

  // При старте боя из казармы — убеждаемся что BarracksScene закрыта.
  eventBus.on('battle:start', () => {
    if (sm().isActive('BarracksScene')) {
      sm().sleep('BarracksScene')
    }
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
