// Phase 26 Plan 26-05 — First contact cinematic.
//
// Lighter-scale version of CaptainBirthEffect (Phase 24):
//   - ~35 particles (vs 70) tinted с race.homeColor + white
//   - 1 expanding ring (vs 3 cascade) — race color
//   - No camera zoom (читы pre-existing camera state)
//   - ~2s total duration (vs 3s)
//
// Trigger: eventBus 'cosmos:first-contact' с {raceId, x, y}.
// On completion: emit 'cosmos:first-contact-effect-complete' (no payload).
//
// Mount: installFirstContactEffect() подписывает global handler на eventBus.
// Idempotent через scene.textures.exists для texture-gen + activeHandler swap.
// Scene resolution lazy в handler — может играть на MainScene ИЛИ StarMapScene
// (whichever is active через window.__starMapScene / window.__mainScene).
//
// НЕ trogаем frog.container alpha (memory feedback_frog_container_alpha) —
// все GameObjects independent depth 9000, без tween'а чужих контейнеров.
//
// Pattern reuse: CaptainBirthEffect texture-gen + ring tween-via-state-object.

import Phaser from 'phaser'
import { eventBus } from '../../store/eventBus'
import { RACES_BY_ID, type RaceId } from '../config/races'

const TEXTURE_KEY = 'first-contact-particle'
const DEPTH = 9000

const PARTICLE_COUNT = 35
const PARTICLE_LIFESPAN_MS = 1800
const PARTICLE_SPEED_MIN = 60
const PARTICLE_SPEED_MAX = 160

const RING_DURATION_MS = 1500
const RING_START_RADIUS = 12
const RING_END_RADIUS = 140
const RING_STROKE_PX = 3
const RING_START_ALPHA = 0.8

// emit 'cosmos:first-contact-effect-complete' через этот timeout —
// ~ring duration с safety buffer чтобы particles тоже успели dissolve визуально.
const TOTAL_DURATION_MS = 2000

interface SceneRef {
  __starMapScene?: Phaser.Scene
  __mainScene?: Phaser.Scene
}

/**
 * Ensure 4x4 white pixel texture exists in scene. Generated once per scene
 * (lookup через scene.textures.exists). Tint накладывается per-particle через
 * emitter config — никакого asset-файла не нужно.
 */
function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEY)) return
  const gfx = scene.add.graphics({ x: 0, y: 0 })
  gfx.fillStyle(0xffffff, 1)
  gfx.fillRect(0, 0, 4, 4)
  gfx.generateTexture(TEXTURE_KEY, 4, 4)
  gfx.destroy()
}

/**
 * Find active scene для cinematic playback. First contact может triggerнуться
 * когда player на Star Map (most common) ИЛИ на Main Scene (если controller
 * как-то emit'ит outside Star Map, e.g. через DEV helper).
 */
function getActiveScene(): Phaser.Scene | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as SceneRef
  // Star Map предпочтительнее — first contact эмитится из planet-tapped.
  // Main fallback — на случай DEV helper'а вне Star Map.
  return w.__starMapScene ?? w.__mainScene ?? null
}

/**
 * 360° radial particle burst с race-color tint mixed с white. PARTICLE_COUNT
 * частиц разлетаются от (x,y), gravity=0, lifespan 1.8s, scale 0.4→1.6 (grow),
 * alpha 1→0 (fade). Emitter destroyed через lifespan + 200ms buffer.
 */
function spawnParticles(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
): void {
  ensureTexture(scene)
  const emitter = scene.add.particles(x, y, TEXTURE_KEY, {
    speed: { min: PARTICLE_SPEED_MIN, max: PARTICLE_SPEED_MAX },
    angle: { min: 0, max: 360 },
    lifespan: PARTICLE_LIFESPAN_MS,
    scale: { start: 0.4, end: 1.6 },
    alpha: { start: 1, end: 0 },
    gravityY: 0,
    tint: [color, 0xffffff],
    emitting: false,
  })
  emitter.setDepth(DEPTH)
  emitter.explode(PARTICLE_COUNT, x, y)
  scene.time.delayedCall(PARTICLE_LIFESPAN_MS + 200, () => emitter.destroy())
}

/**
 * Single expanding ring tween'нутый через state object (Phaser 4 tween targets
 * mutates plain object props; onUpdate re-draws ring graphics из state).
 * Pattern mirror CaptainBirthEffect.spawnRings.
 */
function spawnRing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
): void {
  const gfx = scene.add.graphics({ x, y })
  gfx.setDepth(DEPTH - 1)
  const state = { r: RING_START_RADIUS, a: RING_START_ALPHA }

  const draw = () => {
    gfx.clear()
    gfx.lineStyle(RING_STROKE_PX, color, state.a)
    gfx.strokeCircle(0, 0, state.r)
  }
  draw()

  scene.tweens.add({
    targets: state,
    r: RING_END_RADIUS,
    a: 0,
    duration: RING_DURATION_MS,
    ease: 'Quad.easeOut',
    onUpdate: draw,
    onComplete: () => gfx.destroy(),
  })
}

let activeHandler:
  | ((p: { raceId: string; x: number; y: number }) => void)
  | null = null

/**
 * Subscribes global eventBus handler 'cosmos:first-contact'. Idempotent —
 * повторный install() сначала снимает старый handler (защита от HMR/double-mount).
 * Returns cleanup function для useEffect symmetry.
 */
export function installFirstContactEffect(): () => void {
  if (activeHandler) {
    eventBus.off('cosmos:first-contact', activeHandler)
    activeHandler = null
  }

  const handler = (payload: { raceId: string; x: number; y: number }) => {
    const scene = getActiveScene()
    const race = RACES_BY_ID[payload.raceId as RaceId]
    if (!race) {
      // Defensive: unknown raceId (T-26-05-01 mitigation) — emit complete
      // synchronously чтобы controller не залип в pending state.
      // Используем queueMicrotask для async-семантики (как fallback ниже).
      queueMicrotask(() => {
        eventBus.emit('cosmos:first-contact-effect-complete')
      })
      return
    }

    if (!scene) {
      // No active scene — skip cinematic visually, но все равно emit complete.
      console.warn(
        '[FirstContactEffect] no active scene — skip cinematic, modal will still fire',
      )
      // setTimeout 0 — micro-async (mitt off → on protection if controller
      // только-только подписался; queueMicrotask тоже работает).
      setTimeout(() => eventBus.emit('cosmos:first-contact-effect-complete'), 0)
      return
    }

    spawnParticles(scene, payload.x, payload.y, race.homeColor)
    spawnRing(scene, payload.x, payload.y, race.homeColor)

    scene.time.delayedCall(TOTAL_DURATION_MS, () => {
      eventBus.emit('cosmos:first-contact-effect-complete')
    })
  }

  eventBus.on('cosmos:first-contact', handler)
  activeHandler = handler

  return () => {
    if (activeHandler === handler) {
      eventBus.off('cosmos:first-contact', handler)
      activeHandler = null
    }
  }
}

/**
 * Manual uninstall — снимает global handler без cleanup function reference.
 * Используется когда install/uninstall lifecycle owned не useEffect (e.g.
 * smoke tests или direct API).
 */
export function uninstallFirstContactEffect(): void {
  if (activeHandler) {
    eventBus.off('cosmos:first-contact', activeHandler)
    activeHandler = null
  }
}
