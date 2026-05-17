// Phase 22 Plan 22-03: unit tests for ascendCarrier action.
// Run: cd client && npx vitest run src/store/cosmic/ascension.test.ts
//
// Behaviour:
//   - ascendCarrier(frogId) removes carrier from `carriers`,
//     appends an AscendedCarrier {id, element, ascendedAt} to `ascendedCarriers`,
//     and increments `essence` by 1.
//   - No-op if frogId is not in `carriers`.
//   - AscendedCarrier shape must JSON-roundtrip (for persist).

import { describe, it, expect, beforeEach, vi } from 'vitest'

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `${Date.now()}-${Math.random()}` },
  })
}

import { createCosmicSlice } from './slice'
import type { CosmicState } from './slice'

interface Harness {
  state: () => CosmicState
}

function makeHarness(): Harness {
  let state: CosmicState | undefined
  const set = (partial: Partial<CosmicState>): void => {
    state = { ...(state as CosmicState), ...partial }
  }
  const get = (): CosmicState => state as CosmicState
  state = createCosmicSlice(set, get)
  return { state: () => state as CosmicState }
}

describe('ascensionSlice — ascendCarrier action', () => {
  beforeEach(() => {
    // Deterministic timestamps for ascendedAt assertions.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-17T12:00:00Z'))
  })

  it('Test 1: ascendCarrier removes carrier, appends AscendedCarrier, +1 essence', () => {
    const h = makeHarness()
    h.state().addCarrier({ frogId: 'f1', element: 'fire', level: 18 })
    expect(h.state().carriers.length).toBe(1)
    expect(h.state().ascendedCarriers.length).toBe(0)
    expect(h.state().essence).toBe(0)

    h.state().ascendCarrier('f1')

    expect(h.state().carriers.length).toBe(0)
    expect(h.state().ascendedCarriers.length).toBe(1)
    const ascended = h.state().ascendedCarriers[0]
    expect(ascended.element).toBe('fire')
    expect(typeof ascended.id).toBe('string')
    expect(ascended.id.length).toBeGreaterThan(0)
    expect(typeof ascended.ascendedAt).toBe('number')
    expect(ascended.ascendedAt).toBeGreaterThan(0)
    expect(h.state().essence).toBe(1)
  })

  it('Test 2: ascendCarrier for unknown frogId → no-op (state unchanged)', () => {
    const h = makeHarness()
    const before = {
      carriers: JSON.stringify(h.state().carriers),
      ascended: JSON.stringify(h.state().ascendedCarriers),
      essence: h.state().essence,
    }

    h.state().ascendCarrier('does-not-exist')

    expect(JSON.stringify(h.state().carriers)).toBe(before.carriers)
    expect(JSON.stringify(h.state().ascendedCarriers)).toBe(before.ascended)
    expect(h.state().essence).toBe(before.essence)
  })

  it('Test 3: repeated ascend of same frogId → no-op (carrier already removed)', () => {
    const h = makeHarness()
    h.state().addCarrier({ frogId: 'f1', element: 'water', level: 18 })

    h.state().ascendCarrier('f1')
    const afterFirst = {
      ascendedLen: h.state().ascendedCarriers.length,
      essence: h.state().essence,
    }

    h.state().ascendCarrier('f1') // second call — carrier no longer exists

    expect(h.state().ascendedCarriers.length).toBe(afterFirst.ascendedLen)
    expect(h.state().essence).toBe(afterFirst.essence)
  })

  it('Test 4: multiple ascensions → essence increments linearly (1 per ascend)', () => {
    const h = makeHarness()
    h.state().addCarrier({ frogId: 'f1', element: 'fire', level: 18 })
    h.state().addCarrier({ frogId: 'f2', element: 'crystal', level: 18 })
    h.state().addCarrier({ frogId: 'f3', element: 'shadow', level: 18 })

    h.state().ascendCarrier('f1')
    h.state().ascendCarrier('f2')
    h.state().ascendCarrier('f3')

    expect(h.state().ascendedCarriers.length).toBe(3)
    expect(h.state().essence).toBe(3)
    expect(h.state().carriers.length).toBe(0)
  })

  it('Test 5: AscendedCarrier shape JSON-roundtrips (persist safety)', () => {
    const h = makeHarness()
    h.state().addCarrier({ frogId: 'f1', element: 'plasma', level: 18 })
    h.state().ascendCarrier('f1')

    const ascended = h.state().ascendedCarriers[0]
    const round = JSON.parse(JSON.stringify(ascended))

    expect(round.id).toBe(ascended.id)
    expect(round.element).toBe(ascended.element)
    expect(round.ascendedAt).toBe(ascended.ascendedAt)
  })
})
