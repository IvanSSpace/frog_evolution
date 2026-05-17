// Phase 22 Plan 22-02: unit tests for carrier merge actions.
// Run: cd client && npx vitest run src/store/cosmic/carrierMerge.test.ts
//
// Tests:
//   - mergeCarrierWithNormal happy path (element inherited from carrier)
//   - mergeCarrierWithCarrier same element (single result)
//   - mergeCarrierWithCarrier different elements (TARGET element survives)
//   - mergeCarrierWithNormal unknown carrier id → no-op
//   - mergeCarrierWithCarrier unknown target id → no-op
//   - level cap (L18 still creates carrier; ascension trigger is Plan 22-03)
//   - drag direction switch (target-wins is direction-aware, not coincidence)

import { describe, it, expect } from 'vitest'

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

describe('carrier merge: mergeCarrierWithNormal', () => {
  it('Test 1: carrier(fire, L5) + normal(L5) → carrier(fire, L6) — element inherited', () => {
    const h = makeHarness()
    h.state().addCarrier({ frogId: 'f1', element: 'fire', level: 5 })

    h.state().mergeCarrierWithNormal('f1', 'f2-normal', 'f3-new', 6)

    const carriers = h.state().carriers
    expect(carriers.length).toBe(1)
    expect(carriers[0].frogId).toBe('f3-new')
    expect(carriers[0].element).toBe('fire')
    expect(carriers[0].level).toBe(6)
  })

  it('Test 4: unknown carrier id → no-op, state unchanged', () => {
    const h = makeHarness()
    h.state().addCarrier({ frogId: 'real', element: 'water', level: 3 })
    const before = JSON.stringify(h.state().carriers)

    h.state().mergeCarrierWithNormal('unknown', 'f2', 'f3', 4)

    const after = JSON.stringify(h.state().carriers)
    expect(after).toBe(before)
  })
})

describe('carrier merge: mergeCarrierWithCarrier', () => {
  it('Test 2: carrier(fire, L5) + carrier(fire, L5) → carrier(fire, L6)', () => {
    const h = makeHarness()
    h.state().addCarrier({ frogId: 'a', element: 'fire', level: 5 })
    h.state().addCarrier({ frogId: 'b', element: 'fire', level: 5 })

    h.state().mergeCarrierWithCarrier('a', 'b', 'c', 6)

    const carriers = h.state().carriers
    expect(carriers.length).toBe(1)
    expect(carriers[0].frogId).toBe('c')
    expect(carriers[0].element).toBe('fire')
    expect(carriers[0].level).toBe(6)
  })

  it('Test 3: dropped(fire) on target(water) → carrier(water, L8) — TARGET element wins', () => {
    const h = makeHarness()
    h.state().addCarrier({ frogId: 'a-dropped', element: 'fire', level: 7 })
    h.state().addCarrier({ frogId: 'b-target', element: 'water', level: 7 })

    h.state().mergeCarrierWithCarrier('a-dropped', 'b-target', 'c-new', 8)

    const carriers = h.state().carriers
    expect(carriers.length).toBe(1)
    expect(carriers[0].element).toBe('water')
    expect(carriers[0].level).toBe(8)
  })

  it('Test 5: drag direction switch — dropping water on fire → fire wins (consistency)', () => {
    // Reverse roles of Test 3 to prove target-wins is direction-aware,
    // not coincidence of element ordering.
    const h = makeHarness()
    h.state().addCarrier({ frogId: 'water-dropped', element: 'water', level: 4 })
    h.state().addCarrier({ frogId: 'fire-target', element: 'fire', level: 4 })

    h.state().mergeCarrierWithCarrier('water-dropped', 'fire-target', 'merged', 5)

    const carriers = h.state().carriers
    expect(carriers.length).toBe(1)
    expect(carriers[0].element).toBe('fire')
    expect(carriers[0].level).toBe(5)
  })

  it('Test 5b: unknown target id → no-op, state unchanged', () => {
    const h = makeHarness()
    h.state().addCarrier({ frogId: 'a', element: 'forest', level: 2 })
    const before = JSON.stringify(h.state().carriers)

    h.state().mergeCarrierWithCarrier('a', 'unknown-target', 'c', 3)

    const after = JSON.stringify(h.state().carriers)
    expect(after).toBe(before)
  })

  it('Test 6: level cap — newLevel=18 still creates carrier L18 (ascension is Plan 22-03)', () => {
    const h = makeHarness()
    h.state().addCarrier({ frogId: 'a', element: 'plasma', level: 17 })
    h.state().addCarrier({ frogId: 'b', element: 'plasma', level: 17 })

    h.state().mergeCarrierWithCarrier('a', 'b', 'apex', 18)

    const carriers = h.state().carriers
    expect(carriers.length).toBe(1)
    expect(carriers[0].level).toBe(18)
    expect(carriers[0].element).toBe('plasma')
  })
})
