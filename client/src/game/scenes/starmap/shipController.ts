// Phase 20-04 (Wave 4): Ship lifecycle controller extracted from StarMapScene.ts.
// Owns: ShipSprite singleton, store subscription, follow-mode flag, JSON-dedup of ShipState.
//
// Public API:
//   - setup(): создаёт ShipSprite (auto-spawn at home), подписывается на cosmicSlice.ship,
//     слушает 'starmap:follow-ship' для toggle follow-mode.
//   - teardown(): destroys ShipSprite, отписывает store/event listener, сбрасывает state.
//   - sprite: read-only ссылка на ShipSprite (для camera-follow логики в setupControls).
//   - followingShip: read/write флаг follow-mode. setupControls читает каждый кадр
//     и сбрасывает на drag/pinch.
//
// Design: класс-controller, потому что нужно сохранять state (sprite, unsubscribe)
// и предоставлять access к нему другим частям сцены (setupControls).
//
// Coupling:
//   - useGameStore (cosmicSlice.ship subscribe + ensureShipExists/setShipPosition/arriveShipAt)
//   - eventBus emit 'starmap:follow-changed' при docks → cancel follow
//   - eventBus on 'starmap:follow-ship' (от React-кнопки) → toggle follow flag
//   - ShipSprite (effects/ShipSprite) — Phaser-native sprite с trail и tween-движением

import Phaser from 'phaser'
import { useGameStore } from '../../../store/gameStore'
import { eventBus } from '../../../store/eventBus'
import { ShipSprite } from '../../effects/ShipSprite'
import { findPlanetById } from '../../data/missionConfig'
import type { ShipState } from '../../../store/cosmic/types'

const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))

export class ShipController {
  private scene: Phaser.Scene
  private _shipSprite: ShipSprite | null = null
  private shipUnsubscribe: (() => void) | null = null
  private lastShipStateSig = ''
  private _followingShip = false
  private followShipHandler: ((p: { enable: boolean }) => void) | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Auto-spawn ship и подписка на cosmicSlice.ship. Phase 16 (REQ SHIP-02..06). */
  setup(): void {
    // Гарантируем что ship существует (auto-spawn at home при первом open).
    useGameStore.getState().ensureShipExists()
    const initialShip = useGameStore.getState().ship
    const homeId =
      initialShip?.state === 'docked' ? initialShip.planetId : 'home'
    const homePlanet = findPlanetById(homeId) ?? findPlanetById('home')
    if (!homePlanet) return

    // planetMap.json — DPR=1 base, scene умножает на DPR. Применяем тот же multiplier.
    this._shipSprite = new ShipSprite({
      scene: this.scene,
      parent: null, // scene root; нет worldContainer в этой scene
      initialPosition: { x: homePlanet.x * DPR, y: homePlanet.y * DPR },
      depth: 1500,
      onPositionUpdate: (x, y) => {
        // throttled выше; здесь — простой proxy в store для redirect calc.
        // Позиция нормализуется обратно в DPR=1 base (для slice + sendShipTo math).
        useGameStore.getState().setShipPosition(x / DPR, y / DPR)
      },
    })

    // Sync initial state
    this.applyShipState(useGameStore.getState().ship)

    // Subscribe — реагируем на изменения ship через JSON-сигнатуру dedup.
    this.shipUnsubscribe = useGameStore.subscribe((state) => {
      this.applyShipState(state.ship)
      // Disable follow when ship docks
      if (state.ship?.state !== 'transit' && this._followingShip) {
        this._followingShip = false
        eventBus.emit('starmap:follow-changed', { following: false })
      }
    })

    // React button → toggle follow mode
    this.followShipHandler = ({ enable }: { enable: boolean }) => {
      this._followingShip = enable
    }
    eventBus.on('starmap:follow-ship', this.followShipHandler)
  }

  teardown(): void {
    if (this.shipUnsubscribe) {
      this.shipUnsubscribe()
      this.shipUnsubscribe = null
    }
    if (this._shipSprite) {
      this._shipSprite.destroy()
      this._shipSprite = null
    }
    if (this.followShipHandler) {
      eventBus.off('starmap:follow-ship', this.followShipHandler)
      this.followShipHandler = null
    }
    this.lastShipStateSig = ''
  }

  /** Применить ShipState из store к ShipSprite. JSON-dedup чтобы не reapply identical state. */
  private applyShipState(ship: ShipState | null): void {
    if (!this._shipSprite || ship === null) return

    const sig = JSON.stringify(ship)
    if (sig === this.lastShipStateSig) return
    this.lastShipStateSig = sig

    if (ship.state === 'docked') {
      const p = findPlanetById(ship.planetId)
      if (!p) return
      this._shipSprite.setDocked(
        { x: p.x * DPR, y: p.y * DPR },
        (p.size ?? 60) * DPR,
      )
    } else {
      const fp = findPlanetById(ship.fromPlanetId)
      const tp = findPlanetById(ship.toPlanetId)
      if (!fp || !tp) return
      const onArrive = () => {
        useGameStore.getState().arriveShipAt(ship.toPlanetId)
      }
      this._shipSprite.syncFromState(
        {
          from: { x: fp.x * DPR, y: fp.y * DPR },
          to: { x: tp.x * DPR, y: tp.y * DPR },
          startedAt: ship.startedAt,
          arrivesAt: ship.arrivesAt,
        },
        (tp.size ?? 60) * DPR,
        onArrive,
      )
    }
  }

  /** Read-only access to ShipSprite (для camera-follow в setupControls). */
  get sprite(): ShipSprite | null {
    return this._shipSprite
  }

  /** Read/write follow-mode flag. setupControls сбрасывает на drag/pinch. */
  get followingShip(): boolean {
    return this._followingShip
  }
  set followingShip(value: boolean) {
    this._followingShip = value
  }
}
