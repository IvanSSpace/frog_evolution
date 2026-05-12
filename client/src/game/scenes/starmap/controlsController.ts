// Phase 20-05 (Wave 5): pointer/wheel/touch input + drag inertia + follow-ship
// cancellation extracted from StarMapScene.ts. Самая coupled часть сцены —
// owns весь input pipeline и взаимодействие с ShipController/CameraController/PopoverController.
//
// Public API:
//   - setup() — регистрирует pointerdown/move/up + wheel handlers + per-frame inertia
//     tick (events.on('update')). Идемпотентно за счёт того, что вызывается ОДИН РАЗ
//     из StarMapScene.create().
//
// Coupling:
//   - CameraController (camera.setCenter / camera.getMinZoom / camera.scheduleBoundsUpdate /
//     camera.centerX/centerY) — все движения камеры идут через него.
//   - ShipController (ship.followingShip / ship.sprite) — drag отменяет follow,
//     follow-mode перехватывает камеру в update tick.
//   - StarMapScene (selectedMainRaceId / popoverController / tapHandledThisFrame /
//     currentPressedPlanetId / closePhaserPopover) — tap-в-пустоту закрывает popover'ы.
//
// Constants:
//   - VEL_THRESHOLD = 0.005 px/ms — ниже этой скорости считаем что инерция остановилась.
//   - FRICTION_PER_16MS = 0.92 — насколько velocity сохраняется за ~один кадр (16ms).
//   - TAP_MAX_DURATION_MS = 300 / TAP_MAX_MOVE = 8 * DPR — порог что pointerup был тапом.

import Phaser from 'phaser'
import { eventBus } from '../../../store/eventBus'
import type { CameraController } from './cameraController'
import type { ShipController } from './shipController'
import type { StarMapScene } from '../StarMapScene'

const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))

const VEL_THRESHOLD = 0.005 // px/ms — ниже считаем что остановились
const FRICTION_PER_16MS = 0.92 // насколько velocity сохраняется за ~кадр
const TAP_MAX_DURATION_MS = 300
const TAP_MAX_MOVE = 8 * DPR

export class ControlsController {
  // Drag state — мигрировано из closure'а setupControls в class fields.
  private isDragging = false
  private lastX = 0
  private lastY = 0
  private initialPinchDist: number | null = null
  private initialZoom = 1
  // Инерция камеры: сохраняем velocity при drag, применяем после pointerup.
  private velX = 0
  private velY = 0
  private lastMoveTime = 0
  // Tap detection state.
  private tapDownX = 0
  private tapDownY = 0
  private tapDownTime = 0

  constructor(
    private scene: StarMapScene,
    private camera: CameraController,
    private ship: ShipController,
  ) {}

  setup(): void {
    this.scene.input.setTopOnly(false)

    this.scene.input.on('pointerdown', this.onPointerDown, this)
    this.scene.input.on('pointermove', this.onPointerMove, this)
    this.scene.input.on('pointerup', this.onPointerUp, this)
    this.scene.input.on('wheel', this.onWheel, this)

    // Inertia + follow-ship per-frame tick. Регистрируется как метод класса —
    // `this` биндится через 3-й аргумент events.on (Phaser API).
    this.scene.events.on('update', this.onUpdate, this)
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    this.isDragging = true
    this.lastX = p.x
    this.lastY = p.y
    this.velX = 0
    this.velY = 0
    // Drag cancels follow mode
    if (this.ship.followingShip) {
      this.ship.followingShip = false
      eventBus.emit('starmap:follow-changed', { following: false })
    }
    this.lastMoveTime = Date.now()
    this.initialPinchDist = null
    // Сброс tap-флага. Если планета его не выставит до pointerup и не было drag —
    // на pointerup закроем popover (тап в пустое место карты).
    this.scene.tapHandledThisFrame = false
    this.tapDownX = p.x
    this.tapDownY = p.y
    this.tapDownTime = Date.now()
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    // Counter-loop вместо .filter() — pointermove на mobile фаерится 60+/сек,
    // .filter() на каждом аллоцирует array и закрытие → GC давление в hot path.
    const pointers = this.scene.input.manager.pointers
    let activeCount = 0
    let p0: Phaser.Input.Pointer | null = null
    let p1: Phaser.Input.Pointer | null = null
    for (let i = 0; i < pointers.length; i++) {
      const pt = pointers[i]
      if (pt.active && pt.isDown) {
        if (activeCount === 0) p0 = pt
        else if (activeCount === 1) p1 = pt
        activeCount++
      }
    }
    const cam = this.scene.cameras.main
    if (activeCount === 2 && p0 && p1) {
      const dx = p0.x - p1.x
      const dy = p0.y - p1.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (this.initialPinchDist == null) {
        this.initialPinchDist = d
        this.initialZoom = cam.zoom
      } else {
        const ratio = d / this.initialPinchDist
        cam.setZoom(
          Phaser.Math.Clamp(
            this.initialZoom * ratio,
            this.camera.getMinZoom(),
            1.8,
          ),
        )
        // Re-clamp center после изменения zoom
        this.camera.setCenter(this.camera.centerX, this.camera.centerY)
        this.camera.scheduleBoundsUpdate()
      }
      this.velX = 0
      this.velY = 0
    } else if (this.isDragging && activeCount === 1) {
      const dx = p.x - this.lastX
      const dy = p.y - this.lastY
      const now = Date.now()
      const dt = Math.max(1, now - this.lastMoveTime)
      // Накопление velocity + движение камеры через единую API camera.setCenter
      const instantVX = dx / dt
      const instantVY = dy / dt
      this.velX = this.velX * 0.6 + instantVX * 0.4
      this.velY = this.velY * 0.6 + instantVY * 0.4
      const dxWorld = dx / cam.zoom
      const dyWorld = dy / cam.zoom
      const result = this.camera.setCenter(
        this.camera.centerX - dxWorld,
        this.camera.centerY - dyWorld,
      )
      if (result.hitX) this.velX = 0
      if (result.hitY) this.velY = 0
      this.lastX = p.x
      this.lastY = p.y
      this.lastMoveTime = now
      this.initialPinchDist = null
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    this.isDragging = false
    this.initialPinchDist = null
    // Если клик был быстрым, без перемещения и НЕ был перехвачен interactive объектом
    // (планета/звезда) — закрываем popover (тап в пустое место).
    const dt = Date.now() - this.tapDownTime
    const moved = Math.abs(p.x - this.tapDownX) + Math.abs(p.y - this.tapDownY)
    if (
      !this.scene.tapHandledThisFrame &&
      dt < TAP_MAX_DURATION_MS &&
      moved < TAP_MAX_MOVE
    ) {
      // Тап в пустое место карты — закрываем popover'ы.
      // Сбрасываем счётчик нажатий → следующий тап на планету снова
      // запустит уникальную анимацию (как на первом нажатии).
      this.scene.currentPressedPlanetId = null
      if (this.scene.selectedMainRaceId) {
        this.scene.selectedMainRaceId = null
        this.scene.closePhaserPopover()
      }
      this.scene.popoverController.closeBgNamePopup()
    }
  }

  // Inertia — двигаем камеру через единую camera.setCenter() с автоматическим clamp.
  // Дополнительный «hard re-center» каждый кадр: на всякий случай, если что-то снаружи
  // меняет scroll (Phaser internals, resize и т.п.) — заявляем целевую позицию заново.
  private onUpdate(_t: number, dt: number): void {
    // Ship follow mode — overrides inertia/drag
    const shipSprite = this.ship.sprite
    if (this.ship.followingShip && shipSprite) {
      this.velX = 0
      this.velY = 0
      this.camera.setCenter(shipSprite.worldX, shipSprite.worldY)
      return
    }
    // Inertia только когда не идёт активный drag
    if (!this.isDragging) {
      const speed = Math.sqrt(this.velX * this.velX + this.velY * this.velY)
      if (speed >= VEL_THRESHOLD) {
        const cam = this.scene.cameras.main
        const dxWorld = (this.velX * dt) / cam.zoom
        const dyWorld = (this.velY * dt) / cam.zoom
        const result = this.camera.setCenter(
          this.camera.centerX - dxWorld,
          this.camera.centerY - dyWorld,
        )
        if (result.hitX) this.velX = 0
        if (result.hitY) this.velY = 0
        const decay = Math.pow(FRICTION_PER_16MS, dt / 16)
        this.velX *= decay
        this.velY *= decay
      } else {
        this.velX = 0
        this.velY = 0
        // Жёсткий re-center каждый кадр — гарантия что Phaser не "уехал" сам.
        // Это идемпотентная операция: если уже на месте — ничего не меняет.
        this.camera.setCenter(this.camera.centerX, this.camera.centerY)
      }
    }
  }

  private onWheel(
    _p: Phaser.Input.Pointer,
    _gos: Phaser.GameObjects.GameObject[],
    _dx: number,
    dy: number,
  ): void {
    const cam = this.scene.cameras.main
    const factor = dy > 0 ? 0.9 : 1.1
    cam.setZoom(
      Phaser.Math.Clamp(cam.zoom * factor, this.camera.getMinZoom(), 1.8),
    )
    // Re-clamp center: пределы изменились с zoom, текущая позиция могла стать невалидной
    this.camera.setCenter(this.camera.centerX, this.camera.centerY)
    this.camera.scheduleBoundsUpdate()
  }
}
