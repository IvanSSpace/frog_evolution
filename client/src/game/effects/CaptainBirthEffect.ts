// Phase 24 Plan 24-02 — Captain creation cinematic (Beat 2).
//
// «Cosmic Growing Effect»: радиальный particle burst (golden + white + cosmic
// blue) + 3 расширяющихся concentric rings + camera zoom 1.0 → 1.08 → 1.0.
// Длительность ~3 секунды от eventBus 'captain:birth-start' (x,y) до emit
// 'captain:birth-effect-complete' (триггер для DOM modal в Plan 24-03).
//
// IMPORTANT (memory feedback_frog_container_alpha): эффект НЕ трогает alpha
// frog.container — никаких tween-ов чужих GameObject'ов. Particles и rings —
// отдельные GameObjects (depth 9000, поверх всего). Camera zoom влияет на
// frogs визуально через scale, но это масштабирование камеры, не alpha
// frog.container, так что мерцания не будет.
//
// Pattern: re-use ConfettiBurst.ts texture-generation подхода. 6x6 white pixel
// генерируется один раз на scene (TEXTURE_KEY), tint накладывается per-particle
// эмиттером (golden / white / cosmic blue palette).
//
// Lifecycle: install(scene) подписывает один global handler на eventBus
// (mitt), uninstall() — снимает. Idempotent: повторный install() сначала
// снимает старый handler. Это защищает от double-listener при scene restart /
// HMR. Parent scene (MainScene) обязан вызвать uninstall() в shutdown/destroy.
//
// Camera zoom completion: Phaser CameraZoomCallback ((cam, progress, zoom) =>)
// вызывается КАЖДЫЙ кадр (как onUpdate), не только в конце. Поэтому для
// детерминированного emit 'captain:birth-effect-complete' используем
// scene.time.delayedCall на сумму durations + safety buffer.

import Phaser from 'phaser'
import { eventBus } from '../../store/eventBus'

const TEXTURE_KEY = 'captain-birth-particle'
const DEPTH = 9000

// Golden / white / cosmic blue — задано в CONTEXT.md как «cosmic palette».
const PALETTE = [0xfde047, 0xffffff, 0x67e8f9]
const PARTICLE_COUNT = 70 // CONTEXT диапазон 60-80, выбран центр.
const PARTICLE_LIFESPAN_MS = 2500
const PARTICLE_SPEED_MIN = 80
const PARTICLE_SPEED_MAX = 200

const RING_COUNT = 3
const RING_OFFSET_MS = 400 // delay между запуском колец (0ms, 400ms, 800ms).
const RING_DURATION_MS = 1500
const RING_START_RADIUS = 20
const RING_END_RADIUS = 200
const RING_STROKE_PX = 4
const RING_COLOR = 0xfde047
const RING_START_ALPHA = 0.8

const CAMERA_ZOOM_TARGET = 1.08
const CAMERA_ZOOM_IN_MS = 1500
const CAMERA_ZOOM_OUT_MS = 800
// Safety buffer перед emit completion — чтобы zoom-out tween гарантированно
// успел доиграть прежде чем DOM modal начнёт mount'иться.
const COMPLETION_BUFFER_MS = 200

/**
 * Ensure 6x6 white pixel texture exists in scene. Generated once per scene
 * (lookup через scene.textures.exists). Tint и scale накладываются per-particle
 * через emitter config — никакого asset-файла не нужно.
 */
function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEY)) return
  const gfx = scene.add.graphics({ x: 0, y: 0 })
  gfx.fillStyle(0xffffff, 1)
  gfx.fillRect(0, 0, 6, 6)
  gfx.generateTexture(TEXTURE_KEY, 6, 6)
  gfx.destroy()
}

/**
 * 360° radial particle burst. PARTICLE_COUNT частиц разлетаются от (x,y),
 * gravity=0, lifespan 2.5s, scale 0.5→2.0 (grow), alpha 1→0 (fade).
 * Emitter уничтожается через (lifespan + 300ms) — safety buffer чтобы
 * последние particles успели исчезнуть.
 */
function spawnParticles(scene: Phaser.Scene, x: number, y: number): void {
  ensureTexture(scene)
  const emitter = scene.add.particles(x, y, TEXTURE_KEY, {
    speed: { min: PARTICLE_SPEED_MIN, max: PARTICLE_SPEED_MAX },
    angle: { min: 0, max: 360 }, // radial spread (полный круг).
    gravityY: 0, // cosmic floating effect, без падения.
    lifespan: PARTICLE_LIFESPAN_MS,
    scale: { start: 0.5, end: 2.0 }, // grow за время жизни.
    alpha: { start: 1, end: 0 },
    tint: PALETTE,
    rotate: { min: 0, max: 360 },
    emitting: false, // single-shot — explode() ниже.
  })
  emitter.setDepth(DEPTH)
  emitter.explode(PARTICLE_COUNT, x, y)

  scene.time.delayedCall(PARTICLE_LIFESPAN_MS + 300, () => {
    emitter.destroy()
  })
}

/**
 * 3 concentric expanding rings, staggered с offset RING_OFFSET_MS (0ms, 400ms,
 * 800ms). Каждое кольцо — Graphics object с tween'ом радиуса (start→end) и
 * альфы (RING_START_ALPHA → 0). После tween — graphics destroy.
 *
 * Depth ниже particles (DEPTH - 1), чтобы кольца не перекрывали частицы.
 */
function spawnRings(scene: Phaser.Scene, x: number, y: number): void {
  for (let i = 0; i < RING_COUNT; i++) {
    scene.time.delayedCall(i * RING_OFFSET_MS, () => {
      const gfx = scene.add.graphics({ x, y })
      gfx.setDepth(DEPTH - 1)
      const state = { r: RING_START_RADIUS, a: RING_START_ALPHA }

      const draw = () => {
        gfx.clear()
        gfx.lineStyle(RING_STROKE_PX, RING_COLOR, state.a)
        gfx.strokeCircle(0, 0, state.r)
      }
      draw()

      scene.tweens.add({
        targets: state,
        r: RING_END_RADIUS,
        a: 0,
        duration: RING_DURATION_MS,
        ease: 'Sine.easeOut',
        onUpdate: draw,
        onComplete: () => gfx.destroy(),
      })
    })
  }
}

/**
 * Camera dramatic zoom: 1.0 → CAMERA_ZOOM_TARGET (1500ms) → 1.0 (800ms).
 * Force=true в return-zoom чтобы override active zoom effect.
 *
 * onAllDone() вызывается через delayedCall (sum durations + buffer), не через
 * CameraZoomCallback — последний срабатывает per-frame (like onUpdate), не
 * детерминированно в конце.
 */
function playCameraZoom(scene: Phaser.Scene, onAllDone: () => void): void {
  const cam = scene.cameras.main
  cam.zoomTo(CAMERA_ZOOM_TARGET, CAMERA_ZOOM_IN_MS, 'Sine.easeInOut')
  scene.time.delayedCall(CAMERA_ZOOM_IN_MS + 50, () => {
    cam.zoomTo(1.0, CAMERA_ZOOM_OUT_MS, 'Sine.easeInOut', true)
  })
  scene.time.delayedCall(
    CAMERA_ZOOM_IN_MS + 50 + CAMERA_ZOOM_OUT_MS + COMPLETION_BUFFER_MS,
    onAllDone,
  )
}

export class CaptainBirthEffect {
  private static handler: ((p: { x: number; y: number }) => void) | null = null

  /**
   * Subscribe scene to captain:birth-start events. Caller (MainScene.create)
   * получает exclusive ownership cinematic playback. Idempotent: повторный
   * install переустанавливает handler (защита от HMR/restart двойной
   * подписки).
   */
  static install(scene: Phaser.Scene): void {
    if (CaptainBirthEffect.handler) {
      eventBus.off('captain:birth-start', CaptainBirthEffect.handler)
    }
    const handler = (p: { x: number; y: number }) => {
      // Если scene уже не active (свернута / shutdown в процессе) — skip,
      // не пытаемся spawn'ить на dead scene.
      if (!scene.scene.isActive()) return
      CaptainBirthEffect.play(scene, p.x, p.y)
    }
    CaptainBirthEffect.handler = handler
    eventBus.on('captain:birth-start', handler)
  }

  /**
   * Снимает global handler. Вызывается MainScene.destroy() / shutdown.
   * No-op если install() не был вызван.
   */
  static uninstall(): void {
    if (CaptainBirthEffect.handler) {
      eventBus.off('captain:birth-start', CaptainBirthEffect.handler)
      CaptainBirthEffect.handler = null
    }
  }

  /**
   * Play full cinematic at (x,y). Triggered handler'ом из install(), но также
   * exposed для прямого вызова (smoke tests, dev console). Emit'ит
   * 'captain:birth-effect-complete' через ~2.55s после старта (zoom-in 1.5s
   * + zoom-out 0.8s + buffer 0.2s + small 0.05s delay = ~2.55s).
   */
  static play(scene: Phaser.Scene, x: number, y: number): void {
    spawnParticles(scene, x, y)
    spawnRings(scene, x, y)
    playCameraZoom(scene, () => {
      eventBus.emit('captain:birth-effect-complete')
    })
  }
}
