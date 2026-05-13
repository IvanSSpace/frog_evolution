// Phase 20-04 (Wave 4): Popover + tap orchestration extracted from StarMapScene.ts.
//
// PopoverController owns:
//   - bgNamePopup container + auto-close timer
//   - selectionMarker (pulsing ring around tapped planet)
//   - popup show/hide flow with «Изучить»/«Лететь» buttons
//   - per-planet press counter (state.planetPressState lives on scene; controller mutates)
//   - tap-driven animation triggering (delegated to AnimationOrchestrator)
//
// Design: класс-controller, потому что popovers содержат значительный state
// (текущий popup, timer). Animation orchestration вынесен в AnimationOrchestrator
// (./popovers/animationOrchestrator.ts) — тот владеет 96 comp* функциями
// и логикой recipe-сборки.
//
// Cross-domain coupling kept intentional:
//   - eventBus emit ('starmap:planet-tapped', 'cosmic:request-flight', 'cosmic:toast')
//   - useGameStore (ship state, investigatePlanet, sendShipTo, crew.missionsToday)
//   - tapHandledThisFrame flag — write-only от controller, read setupControls
//   - cameras.main для popup scale-compensation
//
// Public API:
//   - handlePlanetPress(sys): tap counter + animation trigger + emits
//   - selectSystem(sys): selection marker + emoji floater
//   - scheduleBgNamePopup(sys): задержка 400ms перед openBgNamePopup
//   - closeBgNamePopup(): отменяет timer + destroys popup
//
// Internal: openBgNamePopup

import Phaser from 'phaser'
import type { StarMapScene } from '../StarMapScene'
import type { Race, BgSystem } from './types'
import { effectiveSeed } from './helpers'
import { eventBus } from '../../../store/eventBus'
import { useGameStore } from '../../../store/gameStore'
import { DAILY_CAP } from '../../data/missionConfig'
import { AnimationOrchestrator } from './popovers/animationOrchestrator'

const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))

// Главные расы — по их type, фоновые — по архетипу
const EMOJI_MAP: Record<string, string> = {
  // Главные первичные
  home: '🐸',
  crystal: '💎',
  rocky: '🪨',
  ancient: '⏳',
  mystic: '🔮',
  organic: '🌿',
  forge: '🔥',
  military: '⚔️',
  destroyed: '💔',
  // Расширение — 7 новых рас
  crystal_bio: '🌸',
  mechano: '⚙️',
  energy: '⚡',
  mist: '🌫️',
  aquatic: '🌊',
  shadow: '🌑',
  aerial: '☁️',
  // Архетипы фоновых
  gas_giant: '🌀',
  gas_ringed: '🪐',
  ice: '❄️',
  ocean: '🌊',
  desert: '🏜️',
  lava: '🌋',
  forest: '🌲',
  mineral: '⛏️',
  dead: '💀',
  toxic: '☠️',
  plasma: '☀️',
  binary: '⚡',
}

export class PopoverController {
  private scene: StarMapScene
  // Простая модалка с именем BG-планеты — появляется через 400ms после клика.
  private bgNamePopup?: Phaser.GameObjects.Container
  private bgNamePopupTimer?: Phaser.Time.TimerEvent
  // Кольцо-marker вокруг выбранной планеты (pulsing alpha).
  private selectionMarker: Phaser.GameObjects.Graphics | null = null
  // Animation orchestration вынесен в отдельный класс — recipe-сборка из
  // THEME_COMPONENTS pool + dispatch на 96 comp* функций.
  private animOrchestrator: AnimationOrchestrator

  constructor(scene: StarMapScene) {
    this.scene = scene
    this.animOrchestrator = new AnimationOrchestrator(scene)
  }

  // ============== TAP HANDLING ==============

  // Обработка нажатия на планету: первое нажатие после смены планеты или
  // после перерыва срабатывает анимацию, далее — каждые 2-6 нажатий случайно.
  handlePlanetPress(sys: Race | BgSystem): void {
    const scene = this.scene
    if (scene.currentPressedPlanetId !== sys.id) {
      scene.planetPressState.set(sys.id, { count: 0, threshold: 1 })
      scene.currentPressedPlanetId = sys.id
    }
    let st = scene.planetPressState.get(sys.id)
    if (!st) {
      st = { count: 0, threshold: 1 }
      scene.planetPressState.set(sys.id, st)
    }
    st.count++
    if (st.count >= st.threshold) {
      const durationMs = this.animOrchestrator.getAnimationDurationMs(sys)
      eventBus.emit('starmap:planet-tapped', {
        id: sys.id,
        type: sys.type,
        archetype: 'archetype' in sys ? (sys as BgSystem).archetype : undefined,
        durationMs,
        seed: effectiveSeed(sys, scene.mainSeedOverride),
      })
      // Phase 16 (REQ SHIP-07): parallel emit для Cosmic Hub flight flow.
      // App-side subscriber решает, открыт ли Hub, и показывает confirm dialog.
      eventBus.emit('cosmic:request-flight', { planetId: sys.id })
      // ВРЕМЕННО: tap-анимация отключена для теста perf-impact.
      // this.animOrchestrator.playUniqueAnimation(sys)
      st.count = 0
      st.threshold = 2 + Math.floor(Math.random() * 5) // 2-6
    }
  }

  // ============== SELECTION ==============

  selectSystem(sys: Race | BgSystem): void {
    // ВРЕМЕННО: tap-эффекты выбора отключены для perf-теста.
    // Selection marker, sprite squish, emoji float — все skipped.
    // Popup с именем планеты (bgNamePopup) — отдельный канал, работает.
    void sys
    if (false as boolean) {
    const scene = this.scene
    if (this.selectionMarker) this.selectionMarker.destroy()
    const m = scene.add.graphics()
    const sz = sys.size || 14 * DPR
    m.lineStyle(2 * DPR, 0xffd700, 1)
    m.strokeCircle(sys.x, sys.y, sz + 14 * DPR)
    m.lineStyle(1 * DPR, 0xffd700, 0.5)
    m.strokeCircle(sys.x, sys.y, sz + 22 * DPR)
    m.setDepth(15)
    this.selectionMarker = m
    scene.tweens.add({
      targets: m,
      alpha: { from: 1, to: 0.4 },
      yoyo: true,
      repeat: -1,
      duration: 700,
      ease: 'Sine.easeInOut',
    })

    // Selection marker, анимация и музыка планет — отрабатывают ниже.
    // Popup с именем + кнопкой Лететь — теперь показывается одинаково для всех
    // планет (main + bg) через scheduleBgNamePopup в pointerup-handler'е.

    const sprite = scene.systemSprites.get(sys.id)
    if (sprite) {
      scene.tweens.killTweensOf(sprite)
      scene.tweens.add({
        targets: sprite,
        scaleY: 0.85,
        scaleX: 1.15,
        duration: 100,
        yoyo: true,
        ease: 'Power2',
        onComplete: () => {
          scene.tweens.add({
            targets: sprite,
            scale: { from: 1.05, to: 1 },
            duration: 200,
            ease: 'Back.easeOut',
            onComplete: () => {
              scene.tweens.add({
                targets: sprite,
                scale: { from: 0.97, to: 1.03 },
                duration: 2500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
              })
            },
          })
        },
      })
    }

    const archKey = (sys as BgSystem).archetype
    const emoji = EMOJI_MAP[archKey] || EMOJI_MAP[sys.type] || '?'
    const float = scene.add.text(sys.x, sys.y - sz - 8 * DPR, emoji, {
      fontSize: 22 * DPR,
    })
    float.setOrigin(0.5)
    float.setDepth(80)
    scene.tweens.add({
      targets: float,
      y: sys.y - sz - 50 * DPR,
      alpha: { from: 1, to: 0 },
      duration: 1400,
      ease: 'Sine.easeOut',
      onComplete: () => float.destroy(),
    })
    } // closing if(false) для ВРЕМЕННОГО отключения tap-эффектов
  }

  // ============== BG NAME POPUP ==============

  closeBgNamePopup(): void {
    if (this.bgNamePopupTimer) {
      this.bgNamePopupTimer.remove()
      this.bgNamePopupTimer = undefined
    }
    if (this.bgNamePopup) {
      this.bgNamePopup.destroy(true)
      this.bgNamePopup = undefined
    }
  }

  // Открывает popup с именем планеты (BG или main) с задержкой.
  scheduleBgNamePopup(sys: BgSystem | Race): void {
    this.closeBgNamePopup()
    // Задержка ~400ms чтобы не наслаивать на анимацию клика
    this.bgNamePopupTimer = this.scene.time.delayedCall(400, () => {
      this.openBgNamePopup(sys)
    })
  }

  private openBgNamePopup(sys: BgSystem | Race): void {
    const scene = this.scene
    const PADDING_X = 14 * DPR
    const PADDING_Y = 8 * DPR
    const offsetY = -(sys.size + 70 * DPR) // над планетой

    const container = scene.add.container(sys.x, sys.y + offsetY)
    container.setDepth(1500)
    this.bgNamePopup = container

    // Текст имени
    const nameText = scene.add.text(0, 0, sys.name, {
      fontFamily: 'Russo One, system-ui, sans-serif',
      fontSize: `${13 * DPR}px`,
      color: '#fef9d7',
      stroke: '#1f2a14',
      strokeThickness: 2 * DPR,
    })
    nameText.setOrigin(0.5, 0.5)

    // Подпись: для bg = "type · archetype" (resource · forest), для main = "type" (military / mystic / etc)
    const typeLabel =
      'archetype' in sys && sys.archetype
        ? `${sys.type} · ${sys.archetype}`
        : sys.type
    const subText = scene.add.text(0, 14 * DPR, typeLabel, {
      fontFamily: 'Nunito, system-ui, sans-serif',
      fontSize: `${9 * DPR}px`,
      color: '#a3e635',
    })
    subText.setOrigin(0.5, 0.5)

    // Фон-капсула
    const w = Math.max(nameText.width, subText.width) + PADDING_X * 2
    const h = nameText.height + subText.height + PADDING_Y * 2 + 4
    const bg = scene.add.graphics()
    bg.fillStyle(0x1f2a14, 0.92)
    bg.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 8 * DPR)
    bg.lineStyle(1.5 * DPR, 0xa3e635, 0.6)
    bg.strokeRoundedRect(-w / 2, -h / 2 + 4, w, h, 8 * DPR)

    container.add(bg)
    container.add(nameText)
    container.add(subText)

    // Кнопка действия под капсулой: «Изучить» если здесь, «Лететь» если docked-elsewhere,
    // «Перенаправить» если в полёте к ДРУГОЙ планете, ничего если уже летим именно сюда.
    const shipState = useGameStore.getState().ship
    const isCurrentPlanet =
      shipState?.state === 'docked' && shipState.planetId === sys.id
    const isAlreadyHeadingHere =
      shipState?.state === 'transit' && shipState.toPlanetId === sys.id
    const BTN_W = 76 * DPR
    const BTN_H = 22 * DPR
    const BTN_Y = h / 2 + 4 + 6 * DPR + BTN_H / 2

    if (isCurrentPlanet) {
      const canInvestigate =
        (useGameStore.getState().crew?.missionsToday ?? 0) < DAILY_CAP
      const btnBg = scene.add.graphics()
      btnBg.fillStyle(canInvestigate ? 0xd97706 : 0x374151, 1)
      btnBg.fillRoundedRect(
        -BTN_W / 2,
        BTN_Y - BTN_H / 2,
        BTN_W,
        BTN_H,
        5 * DPR,
      )
      if (canInvestigate) {
        btnBg.lineStyle(1.5 * DPR, 0xfbbf24, 0.7)
        btnBg.strokeRoundedRect(
          -BTN_W / 2,
          BTN_Y - BTN_H / 2,
          BTN_W,
          BTN_H,
          5 * DPR,
        )
        btnBg.setInteractive(
          new Phaser.Geom.Rectangle(
            -BTN_W / 2,
            BTN_Y - BTN_H / 2,
            BTN_W,
            BTN_H,
          ),
          Phaser.Geom.Rectangle.Contains,
        )
        let btnDownTime = 0
        btnBg.on(
          'pointerdown',
          (
            _p: unknown,
            _lx: unknown,
            _ly: unknown,
            ev: Phaser.Types.Input.EventData,
          ) => {
            btnDownTime = Date.now()
            ev.stopPropagation()
          },
        )
        btnBg.on(
          'pointerup',
          (
            _p: unknown,
            _lx: unknown,
            _ly: unknown,
            ev: Phaser.Types.Input.EventData,
          ) => {
            ev.stopPropagation()
            if (Date.now() - btnDownTime < 400) {
              scene.tapHandledThisFrame = true
              const ok = useGameStore
                .getState()
                .investigatePlanet(sys.id, 'good')
              if (ok)
                eventBus.emit('cosmic:toast', {
                  type: 'generic',
                  msg: '📦 Бокс получен!',
                })
              this.closeBgNamePopup()
            }
          },
        )
      }
      const btnText = scene.add.text(
        0,
        BTN_Y,
        canInvestigate ? '🔬 Изучить' : '⏱ Устал',
        {
          fontFamily: 'Nunito, system-ui, sans-serif',
          fontSize: `${9 * DPR}px`,
          color: canInvestigate ? '#ffffff' : '#9ca3af',
          fontStyle: 'bold',
        },
      )
      btnText.setOrigin(0.5, 0.5)
      container.add(btnBg)
      container.add(btnText)
    } else if (!isAlreadyHeadingHere) {
      // Не текущая planet и не та куда уже летим → показываем кнопку «Лететь».
      // Работает одинаково: docked → fresh flight, in-transit → redirect (внутри store).
      const btnBg = scene.add.graphics()
      btnBg.fillStyle(0x16a34a, 1)
      btnBg.fillRoundedRect(
        -BTN_W / 2,
        BTN_Y - BTN_H / 2,
        BTN_W,
        BTN_H,
        5 * DPR,
      )
      btnBg.lineStyle(1.5 * DPR, 0x4ade80, 0.7)
      btnBg.strokeRoundedRect(
        -BTN_W / 2,
        BTN_Y - BTN_H / 2,
        BTN_W,
        BTN_H,
        5 * DPR,
      )
      btnBg.setInteractive(
        new Phaser.Geom.Rectangle(-BTN_W / 2, BTN_Y - BTN_H / 2, BTN_W, BTN_H),
        Phaser.Geom.Rectangle.Contains,
      )
      let btnDownTime = 0
      btnBg.on(
        'pointerdown',
        (
          _p: unknown,
          _lx: unknown,
          _ly: unknown,
          ev: Phaser.Types.Input.EventData,
        ) => {
          btnDownTime = Date.now()
          ev.stopPropagation()
        },
      )
      btnBg.on(
        'pointerup',
        (
          _p: unknown,
          _lx: unknown,
          _ly: unknown,
          ev: Phaser.Types.Input.EventData,
        ) => {
          ev.stopPropagation()
          if (Date.now() - btnDownTime < 400) {
            scene.tapHandledThisFrame = true
            this.closeBgNamePopup()
            // sendShipTo сам обрабатывает redirect (использует latestShipPos)
            useGameStore.getState().sendShipTo(sys.id)
          }
        },
      )
      const btnText = scene.add.text(0, BTN_Y, '🚀 Лететь', {
        fontFamily: 'Nunito, system-ui, sans-serif',
        fontSize: `${9 * DPR}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      btnText.setOrigin(0.5, 0.5)
      container.add(btnBg)
      container.add(btnText)
    }

    // Blocking zone — absorbs taps on the popup background so they don't fall
    // through to the planet container underneath (which would re-schedule the popup).
    // Zone at index 0 (lowest depth) → receives events AFTER buttons (buttons
    // already call ev.stopPropagation(), so zone only fires for background taps).
    {
      const ZONE_TOP = -(h / 2 + PADDING_Y)
      const ZONE_BOTTOM = BTN_Y + BTN_H / 2 + PADDING_Y
      const blockZone = scene.add.zone(
        0,
        (ZONE_TOP + ZONE_BOTTOM) / 2,
        w + PADDING_X * 2,
        ZONE_BOTTOM - ZONE_TOP,
      )
      blockZone.setInteractive()
      blockZone.on(
        'pointerdown',
        (
          _p: unknown,
          _lx: unknown,
          _ly: unknown,
          ev: Phaser.Types.Input.EventData,
        ) => {
          scene.tapHandledThisFrame = true
          ev.stopPropagation()
        },
      )
      blockZone.on(
        'pointerup',
        (
          _p: unknown,
          _lx: unknown,
          _ly: unknown,
          ev: Phaser.Types.Input.EventData,
        ) => {
          scene.tapHandledThisFrame = true
          ev.stopPropagation()
        },
      )
      container.addAt(blockZone, 0)
    }

    // Compensation zoom — popup всегда фиксированного размера на экране
    const cam = scene.cameras.main
    container.setScale(Math.max(0.3, 1 / cam.zoom))

    // Appear-анимация: fade-in + slight slide вверх
    container.setAlpha(0)
    container.y += 6 * DPR
    scene.tweens.add({
      targets: container,
      alpha: 1,
      y: container.y - 6 * DPR,
      duration: 220,
      ease: 'Cubic.easeOut',
    })

    // Auto-close через 3.5 сек
    this.bgNamePopupTimer = scene.time.delayedCall(3500, () => {
      if (!this.bgNamePopup) return
      scene.tweens.add({
        targets: this.bgNamePopup,
        alpha: 0,
        duration: 200,
        onComplete: () => this.closeBgNamePopup(),
      })
    })
  }
}
