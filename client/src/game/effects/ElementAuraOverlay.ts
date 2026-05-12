import Phaser from 'phaser'
import { useGameStore } from '../../store/gameStore'
import type { CarrierData, Element, Rarity } from '../../store/cosmic/types'

const HARD_CAP_VISIBLE = 4
const CULL_FRAME_INTERVAL = 6

export interface FrogLike {
  id: string
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Image
}

export type FrogProvider = () => FrogLike[]

export interface AuraInstance {
  container: Phaser.GameObjects.Container
  tweens: Phaser.Tweens.Tween[]
  rarity: Rarity
}

export interface AuraSpec {
  ensureTextures(scene: Phaser.Scene): void
  createAura(scene: Phaser.Scene, rarity: Rarity): AuraInstance
}

export class ElementAuraOverlay {
  private scene: Phaser.Scene
  private getFrogs: FrogProvider
  private element: Element
  private spec: AuraSpec
  private active = new Map<string, AuraInstance>()
  private unsubStore: (() => void) | null = null
  private frame = 0
  private dirty = true
  private lastCarriersSnapshot: CarrierData[] = []
  private disposed = false

  constructor(
    scene: Phaser.Scene,
    getFrogs: FrogProvider,
    element: Element,
    spec: AuraSpec,
  ) {
    this.scene = scene
    this.getFrogs = getFrogs
    this.element = element
    this.spec = spec

    spec.ensureTextures(scene)

    const initial = useGameStore.getState().carriers
    this.lastCarriersSnapshot = initial
    this.dirty = true

    this.unsubStore = useGameStore.subscribe((state) => {
      if (this.disposed) return
      if (state.carriers !== this.lastCarriersSnapshot) {
        this.lastCarriersSnapshot = state.carriers
        this.dirty = true
      }
    })
  }

  tick(): void {
    if (this.disposed) return
    this.frame++
    if (this.dirty) {
      this.syncCarriers(this.lastCarriersSnapshot)
      this.dirty = false
    }
    const frogs = this.getFrogs()
    const frogById = new Map(frogs.map((f) => [f.id, f]))
    for (const [frogId, aura] of this.active) {
      const frog = frogById.get(frogId)
      if (!frog) continue
      aura.container.setPosition(frog.container.x, frog.container.y)
      aura.container.setDepth((frog.container.depth ?? frog.container.y) - 1)
    }
    if (this.frame % CULL_FRAME_INTERVAL === 0) this.applyCulling(frogById)
  }

  private syncCarriers(carriers: CarrierData[]): void {
    const elementCarriers = carriers.filter((c) => c.element === this.element)
    const frogs = this.getFrogs()
    const frogById = new Map(frogs.map((f) => [f.id, f]))

    const cam = this.scene.cameras.main
    const cx = cam.scrollX + cam.width / 2
    const cy = cam.scrollY + cam.height / 2
    const live = elementCarriers
      .map((c) => ({ carrier: c, frog: frogById.get(c.frogId) }))
      .filter((x) => x.frog) as { carrier: CarrierData; frog: FrogLike }[]
    live.sort((a, b) => {
      const da = (a.frog.container.x - cx) ** 2 + (a.frog.container.y - cy) ** 2
      const db = (b.frog.container.x - cx) ** 2 + (b.frog.container.y - cy) ** 2
      return da - db
    })
    const top = live.slice(0, HARD_CAP_VISIBLE)
    const topIds = new Set(top.map((t) => t.carrier.frogId))

    for (const [frogId, aura] of [...this.active]) {
      if (!topIds.has(frogId)) {
        this.destroyAura(aura)
        this.active.delete(frogId)
      }
    }

    for (const { carrier, frog } of top) {
      if (this.active.has(carrier.frogId)) continue
      const aura = this.spec.createAura(this.scene, carrier.rarity)
      aura.container.setPosition(frog.container.x, frog.container.y)
      this.active.set(carrier.frogId, aura)
    }
  }

  private destroyAura(aura: AuraInstance): void {
    for (const t of aura.tweens) t.stop()
    aura.container.destroy(true)
  }

  private applyCulling(frogById: Map<string, FrogLike>): void {
    const cam = this.scene.cameras.main
    const view = cam.worldView
    for (const [frogId, aura] of this.active) {
      const frog = frogById.get(frogId)
      if (!frog) {
        aura.container.setVisible(false)
        continue
      }
      const visible = view.contains(frog.container.x, frog.container.y)
      aura.container.setVisible(visible)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubStore?.()
    this.unsubStore = null
    for (const [, aura] of this.active) {
      this.destroyAura(aura)
    }
    this.active.clear()
  }
}

// ============ Shared helpers ============

export function makeRadialTexture(
  scene: Phaser.Scene,
  key: string,
  size: number,
  stops: Array<[number, string]>,
  innerRadius = 0,
): void {
  if (scene.textures.exists(key)) return
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    innerRadius,
    size / 2,
    size / 2,
    size / 2,
  )
  for (const [stop, color] of stops) grad.addColorStop(stop, color)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  scene.textures.addCanvas(key, canvas)
}
