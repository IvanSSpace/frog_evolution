// Phase 26 Plan 26-03: race-overlay visuals для Star Map habitable planets.
//
// Этот модуль — единая точка для всех race-overlay visuals (glow halo + race
// emoji icon + gold pulsing halo для home planets). Reuse pattern texture-gen
// from `client/src/game/effects/ConfettiBurst.ts` — radial gradient white
// texture генерируется один раз per scene, tint накладывается per-overlay.
//
// Visual layering (depth относительно planet depth):
//   home pulse halo (gold)    depth - 2  (самый дальний)
//   race color glow halo      depth - 1
//   planet container           depth     0 (Phaser default для main/bg planets)
//   race emoji icon           depth + 1  (поверх planet)
//
// Pre-cosmos gate (Plan 26-03 D-CosmosGate): controller вызывается ТОЛЬКО когда
// hasCosmosUnlocked === true. До unlock'a planets выглядят как ordinary
// uninhabited. Reactive subscribe в planetRenderer attach'ит overlays при
// unlock без reload.
//
// Cleanup:
//   - detach(planetId): destroy 3 GameObjects + stop/remove tween.
//   - destroy(): cleanup всех entries (вызывается из PlanetRenderer.destroy()
//     при StarMapScene.shutdown()).
//
// Memory feedback_frog_container_alpha: НЕ tween'им alpha на planet container —
// все overlays отдельные GameObjects.
// Memory feedback_animations: НЕ Lottie — Phaser tweens.

import Phaser from 'phaser'
import { getRaceColor, RACES_BY_ID, type RaceId } from '../../../config/races'
import type { PlanetInhabitant } from '../../../../store/cosmic/types'
import type { CullableEntry } from '../lod/lodManager'

/** Cache-key для generated radial gradient texture. Один на whole scene. */
const GLOW_TEX_KEY = 'race-glow-radial-256'

/** Gold tint для home pulsing halo (Phase 25 design token, see CONTEXT). */
const GOLD_HALO_COLOR = 0xfde047

/** Home halo pulse period (ms) — гладкий, не агрессивный (1.5s yoyo). */
const HOME_PULSE_DURATION_MS = 1500

/** Texture size — 256px достаточно для smooth gradient на любом zoom. */
const GLOW_TEXTURE_SIZE = 256

/**
 * LOD min-zoom для всех race-overlay GameObjects. Ниже этого порога overlays
 * полностью убираются из display list — Phaser больше не итерирует их в
 * render-loop. С 30 habitable planets × 2-3 объекта = ~70 GameObjects это
 * измеримая экономия на far zoom (Phase 22-27 FPS-drop survey).
 *
 * Threshold 0.5 совпадает с BG/main planet visibility floor: когда overlays
 * скрыты, planet тоже выглядит как маленькая точка и race-визуал не нужен.
 */
const OVERLAY_LOD_MIN_ZOOM = 0.5

/**
 * Группа GameObjects для одной planet'ы. Trackим все 3 чтобы cleanup был
 * idempotent + leak-free. cullEntries — записи которые мы запушили в
 * lod.cullableData; на detach()/destroy() их нужно вычистить из общего массива.
 */
interface OverlayGroup {
  glow: Phaser.GameObjects.Image
  icon: Phaser.GameObjects.Text
  homeHalo?: Phaser.GameObjects.Image
  homeHaloTween?: Phaser.Tweens.Tween
  /** Entries pushed into lod.cullableData — needed for splice on detach. */
  cullEntries: CullableEntry[]
}

/**
 * Generate radial gradient white texture (один раз per scene). Tint
 * накладывается per-overlay через setTint. Approach reuse от ConfettiBurst:
 * generateTexture + destroy() temporary Graphics object — нет dependency
 * на ассет-файл, работает на любой instance scene.
 *
 * Gradient достигается concentric circles с quadratic alpha falloff
 * (sharper near edges, softer near center). 32 step'а — visually smooth.
 */
function ensureGlowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GLOW_TEX_KEY)) return
  const size = GLOW_TEXTURE_SIZE
  const gfx = scene.add.graphics({ x: 0, y: 0 })
  const steps = 32
  for (let i = steps; i > 0; i--) {
    const radius = (size / 2) * (i / steps)
    // Quadratic falloff: alpha быстрее падает к краю.
    const alpha = (1 - i / steps) ** 2
    gfx.fillStyle(0xffffff, alpha)
    gfx.fillCircle(size / 2, size / 2, radius)
  }
  gfx.generateTexture(GLOW_TEX_KEY, size, size)
  gfx.destroy()
}

/**
 * Параметры одной attach операции.
 * x/y — world coords planet'ы; size — её visual radius (DPR-aware).
 * depth — depth Phaser container'а planet'ы (для stacking calcs).
 */
export interface RaceGlowAttachInput {
  planetId: string
  x: number
  y: number
  /** Planet visual radius (DPR-aware) — overlay sizes derived from this. */
  size: number
  /** Planet container depth (overlay sits at depth-2/-1/+1). */
  depth: number
  inhabitant: PlanetInhabitant
}

/**
 * Controller для race-overlay visuals на Star Map.
 *
 * Создаётся per-scene (один instance в PlanetRenderer'е). Attach'ит overlays
 * для habitable planets, tracks их в Map для idempotent re-attach + clean
 * detach. destroy() ОБЯЗАТЕЛЬНО вызывается при scene shutdown — иначе утечка
 * Phaser GameObjects + infinite home-halo tweens.
 */
export class RaceGlowController {
  private scene: Phaser.Scene
  private overlays = new Map<string, OverlayGroup>()
  /**
   * LOD sink — общий массив cullable entries сцены. Если передан, attach() пушит
   * сюда glow/icon/homeHalo чтобы они hide за viewport + при far zoom.
   * Optional чтобы не ломать call-sites которые могут инстанцировать controller
   * вне Star Map контекста (юнит-тесты).
   */
  private cullSink?: CullableEntry[]

  constructor(scene: Phaser.Scene, cullSink?: CullableEntry[]) {
    this.scene = scene
    this.cullSink = cullSink
    ensureGlowTexture(scene)
  }

  /**
   * Attach race-overlay visuals на planet. Idempotent: повторный вызов для
   * того же planetId no-op (return), не дублирует GameObjects.
   *
   * Defensive: unknown raceId (corrupt planetMap) → silent return без error
   * (T-26-03-02 mitigation).
   */
  attach(input: RaceGlowAttachInput): void {
    if (this.overlays.has(input.planetId)) return // idempotent

    const raceId = input.inhabitant.raceId as RaceId
    const race = RACES_BY_ID[raceId]
    if (!race) return // defensive — unknown raceId (T-26-03-02)

    const color = getRaceColor(raceId)
    const isHome = input.inhabitant.role === 'home'
    const glowRadius = input.size + 8
    const glowAlpha = isHome ? 0.65 : 0.5

    // Glow halo — race color tint, ADD blend для bright soft glow поверх nebula bg.
    const glow = this.scene.add
      .image(input.x, input.y, GLOW_TEX_KEY)
      .setDepth(input.depth - 1)
      .setTint(color)
      .setAlpha(glowAlpha)
      .setDisplaySize(glowRadius * 2, glowRadius * 2)
      .setBlendMode(Phaser.BlendModes.ADD)

    // Icon overlay — emoji от race config. Phaser Text origin centered.
    // Home: bold 18px. Colony: normal 14px.
    const icon = this.scene.add
      .text(input.x, input.y, race.emojiIcon, {
        fontSize: isHome ? '18px' : '14px',
        fontStyle: isHome ? 'bold' : 'normal',
      })
      .setOrigin(0.5)
      .setDepth(input.depth + 1)

    let homeHalo: Phaser.GameObjects.Image | undefined
    let homeHaloTween: Phaser.Tweens.Tween | undefined

    // Home planets: дополнительный gold pulsing halo за race glow'ом.
    if (isHome) {
      const haloRadius = input.size + 18
      homeHalo = this.scene.add
        .image(input.x, input.y, GLOW_TEX_KEY)
        .setDepth(input.depth - 2)
        .setTint(GOLD_HALO_COLOR)
        .setAlpha(0.4)
        .setDisplaySize(haloRadius * 2, haloRadius * 2)
        .setBlendMode(Phaser.BlendModes.ADD)
      homeHaloTween = this.scene.tweens.add({
        targets: homeHalo,
        alpha: { from: 0.2, to: 0.6 },
        duration: HOME_PULSE_DURATION_MS,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    // Регистрируем overlays в LOD-sink сцены. Без этого ~70 GameObjects
    // (для 30 habitable planets × 2-3 объекта) обходились Phaser'ом в каждом
    // кадре render-loop'а независимо от zoom/viewport — measurable FPS drop
    // на far zoom (Phase 22-27 perf survey).
    //
    // setVisible signature у Image/Text — `(value: boolean) => this`, который
    // совместим с CullableEntry.obj.setVisible `(v: boolean) => unknown`.
    const cullEntries: CullableEntry[] = []
    if (this.cullSink) {
      cullEntries.push({
        obj: glow,
        x: input.x,
        y: input.y,
        r: glowRadius,
        lodMinZoom: OVERLAY_LOD_MIN_ZOOM,
      })
      // Icon radius ≈ font-size; используем size+10 в качестве conservative
      // bbox — соответствует glow margin, не выпадает из culling раньше glow'а.
      cullEntries.push({
        obj: icon,
        x: input.x,
        y: input.y,
        r: input.size + 10,
        lodMinZoom: OVERLAY_LOD_MIN_ZOOM,
      })
      if (homeHalo) {
        const haloRadius = input.size + 18
        cullEntries.push({
          obj: homeHalo,
          x: input.x,
          y: input.y,
          r: haloRadius,
          lodMinZoom: OVERLAY_LOD_MIN_ZOOM,
        })
      }
      // Push all at once (single Array.prototype.push) — avoid intermediate
      // length resizes.
      this.cullSink.push(...cullEntries)
    }

    this.overlays.set(input.planetId, {
      glow,
      icon,
      homeHalo,
      homeHaloTween,
      cullEntries,
    })
  }

  /**
   * Detach overlay group для конкретной planet'ы. No-op если не attached.
   * Cleanup: 3 GameObjects + tween (stop+remove) + cull-sink entries (splice).
   */
  detach(planetId: string): void {
    const o = this.overlays.get(planetId)
    if (!o) return
    // Сначала вычищаем LOD-entries — destroy() ниже разрушает obj reference,
    // и cullable-loop в coordinatesHUD прочитает stale obj.visible если
    // забудем splice.
    if (this.cullSink && o.cullEntries.length > 0) {
      this.removeCullEntries(o.cullEntries)
    }
    o.glow.destroy()
    o.icon.destroy()
    o.homeHalo?.destroy()
    if (o.homeHaloTween) {
      o.homeHaloTween.stop()
      o.homeHaloTween.remove()
    }
    this.overlays.delete(planetId)
  }

  /**
   * Вырезает entries из общего cullSink'а одним проходом (O(N) по всему массиву,
   * не O(N*M) per-element indexOf). Используется идентичность по object reference.
   */
  private removeCullEntries(entries: CullableEntry[]): void {
    const sink = this.cullSink
    if (!sink) return
    // Set lookup → O(1) на entry; O(N) на проход sink'а. С N≈600 и M≤3
    // это копеечно, но единообразно с другими LOD operations.
    const toRemove = new Set<CullableEntry>(entries)
    let write = 0
    for (let read = 0; read < sink.length; read++) {
      const e = sink[read]
      if (toRemove.has(e)) continue
      if (write !== read) sink[write] = e
      write++
    }
    sink.length = write
  }

  /**
   * Update positions при camera/planet movement (currently planet positions
   * static, но API доступен — например для будущих panning эффектов).
   */
  updatePosition(planetId: string, x: number, y: number): void {
    const o = this.overlays.get(planetId)
    if (!o) return
    o.glow.setPosition(x, y)
    o.icon.setPosition(x, y)
    o.homeHalo?.setPosition(x, y)
  }

  /**
   * Cleanup всех overlays. ОБЯЗАТЕЛЬНО вызывается при scene shutdown
   * (T-26-03-03 mitigation: GameObject + tween leak'и).
   */
  destroy(): void {
    for (const id of Array.from(this.overlays.keys())) {
      this.detach(id)
    }
    this.overlays.clear()
  }

  /** Diagnostic — сколько overlays сейчас attached. */
  get attachedCount(): number {
    return this.overlays.size
  }
}

/**
 * Convenience factory — instantiate + return controller. Параллель API
 * с другими star-map controllers (PopoverController, CameraController создаются
 * через `new X(scene)`; экспортируем функцию-инсталлятор для consistency
 * с pattern PlanetRenderer/TapEffectController, где у scene есть named field).
 *
 * Optional cullSink — общий lod.cullableData массив сцены, чтобы overlays
 * автоматически hide за viewport и при far zoom.
 */
export function installRaceGlow(
  scene: Phaser.Scene,
  cullSink?: CullableEntry[],
): RaceGlowController {
  return new RaceGlowController(scene, cullSink)
}
