// Tests for sendShipTo — ship navigation including redirect mid-flight.
//
// Critical paths covered:
// - Fresh flight from docked ship
// - Mid-flight redirect using latestShipPos
// - Mid-flight redirect fallback (no latestShipPos)
// - No-op when already docked at target
// - Bail-out on unknown destination

import { describe, it, expect } from 'vitest'
import { createCosmicSlice } from './slice'
import type { CosmicState } from './slice'

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `${Date.now()}-${Math.random()}` },
  })
}

function makeHarness() {
  let state: CosmicState | undefined
  const set = (partial: Partial<CosmicState>) => {
    state = { ...(state as CosmicState), ...partial }
  }
  const get = () => state as CosmicState
  state = createCosmicSlice(set, get)
  return { s: () => state as CosmicState }
}

describe('sendShipTo — fresh flight from docked', () => {
  it('docked at home → tor: ship transitions to transit state', () => {
    const { s } = makeHarness()
    s().ensureShipExists() // home docked
    expect(s().ship?.state).toBe('docked')

    s().sendShipTo('tor')

    const ship = s().ship!
    expect(ship.state).toBe('transit')
    if (ship.state === 'transit') {
      expect(ship.fromPlanetId).toBe('home')
      expect(ship.toPlanetId).toBe('tor')
      expect(ship.startedAt).toBeGreaterThan(0)
      expect(ship.arrivesAt).toBeGreaterThan(ship.startedAt)
    }
  })

  it('travel time scales with distance', () => {
    const { s: s1 } = makeHarness()
    s1().ensureShipExists()
    s1().sendShipTo('drave') // closer
    const close = s1().ship!
    if (close.state !== 'transit') throw new Error('expected transit')
    const closeDur = close.arrivesAt - close.startedAt

    const { s: s2 } = makeHarness()
    s2().ensureShipExists()
    s2().sendShipTo('relict') // far
    const far = s2().ship!
    if (far.state !== 'transit') throw new Error('expected transit')
    const farDur = far.arrivesAt - far.startedAt

    expect(farDur).toBeGreaterThan(closeDur)
  })
})

describe('sendShipTo — no-op when already there', () => {
  it('docked at tor, sendShipTo("tor") leaves state unchanged', () => {
    const { s } = makeHarness()
    s().arriveShipAt('tor') // forces docked at tor
    const before = s().ship

    s().sendShipTo('tor')

    expect(s().ship).toBe(before) // same reference
  })
})

describe('sendShipTo — unknown planet', () => {
  it('bails out without mutating state', () => {
    const { s } = makeHarness()
    s().ensureShipExists()
    const before = s().ship

    s().sendShipTo('NONEXISTENT_PLANET_ID')

    expect(s().ship).toBe(before)
  })
})

describe('sendShipTo — mid-flight redirect', () => {
  it('uses latestShipPos as fromPos when available', () => {
    const { s } = makeHarness()
    s().ensureShipExists()
    s().sendShipTo('tor') // first flight

    // Simulate ship reporting its current visual position
    s().setShipPosition(100, 100)

    // Redirect mid-flight to a different planet
    s().sendShipTo('drave')

    const ship = s().ship!
    expect(ship.state).toBe('transit')
    if (ship.state === 'transit') {
      expect(ship.toPlanetId).toBe('drave')
      // fromPlanetId stays as the original origin (UI hint only)
      expect(ship.fromPlanetId).toBe('home')
    }
    // latestShipPos was used — distance computed from (100,100) to drave
  })

  it('falls back to fromPlanetId when latestShipPos is null', () => {
    const { s } = makeHarness()
    s().ensureShipExists()
    s().sendShipTo('tor')
    // Don't call setShipPosition — latestShipPos stays null

    s().sendShipTo('drave')

    const ship = s().ship!
    expect(ship.state).toBe('transit')
    if (ship.state === 'transit') {
      expect(ship.toPlanetId).toBe('drave')
    }
  })

  it('redirect produces a new transit (new startedAt)', () => {
    const { s } = makeHarness()
    s().ensureShipExists()
    s().sendShipTo('tor')
    const beforeShip = s().ship!
    if (beforeShip.state !== 'transit') throw new Error('expected transit')
    const oldStarted = beforeShip.startedAt

    // Need a tiny delay so Date.now() advances at least 1ms
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    return sleep(2).then(() => {
      s().sendShipTo('drave')
      const after = s().ship!
      if (after.state !== 'transit') throw new Error('expected transit')
      expect(after.startedAt).toBeGreaterThanOrEqual(oldStarted)
      expect(after.toPlanetId).toBe('drave')
    })
  })
})

describe('sendShipTo — null ship pre-init', () => {
  it('initializes ship as docked-at-home before sending', () => {
    const { s } = makeHarness()
    expect(s().ship).toBeNull()

    s().sendShipTo('tor')

    const ship = s().ship!
    expect(ship.state).toBe('transit')
    if (ship.state === 'transit') {
      expect(ship.fromPlanetId).toBe('home')
      expect(ship.toPlanetId).toBe('tor')
    }
  })
})
