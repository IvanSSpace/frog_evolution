// Tests for mergeCarriers — merge two stabilized same-element same-level carriers
// into one new carrier at level+1 with S-bucket guaranteed ceiling.
//
// Bug being prevented: cross-location merge bug from MainScene.performCarrierMerge —
// frog records were removed from field but mergeCarriers wasn't called → orphan
// carriers in store. These tests verify the slice action's contract directly.

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

function addStabilized(
  s: () => CosmicState,
  frogId: string,
  level = 5,
  element: 'fire' | 'ice' = 'fire',
  rarity: 'common' | 'rare' = 'common',
) {
  s().addCarrier({
    frogId,
    element,
    rarity,
    level,
    feedCount: 5,
    stabilized: true,
    ceiling: 5,
  })
}

describe('mergeCarriers — happy path', () => {
  it('merges two stabilized same-element same-level carriers into a new one', () => {
    const { s } = makeHarness()
    addStabilized(s, 'A', 5)
    addStabilized(s, 'B', 5)

    const result = s().mergeCarriers('A', 'B', 'C')

    expect(result).not.toBeNull()
    expect(s().carriers).toHaveLength(1)
    expect(s().carriers[0].frogId).toBe('C')
    expect(s().carriers[0].level).toBe(6)
    expect(s().carriers[0].element).toBe('fire')
    expect(s().carriers[0].rarity).toBe('common')
    expect(s().carriers[0].stabilized).toBe(false)
    expect(s().carriers[0].feedCount).toBe(0)
  })

  it('removes both source carriers from store', () => {
    const { s } = makeHarness()
    addStabilized(s, 'A', 5)
    addStabilized(s, 'B', 5)

    s().mergeCarriers('A', 'B', 'C')

    expect(s().carriers.find((c) => c.frogId === 'A')).toBeUndefined()
    expect(s().carriers.find((c) => c.frogId === 'B')).toBeUndefined()
  })

  it('sets bestiary bit for the new (element, rarity, newLevel) cell', () => {
    const { s } = makeHarness()
    const before = s().bestiaryBitset.slice()
    addStabilized(s, 'A', 7, 'fire', 'rare')
    addStabilized(s, 'B', 7, 'fire', 'rare')

    s().mergeCarriers('A', 'B', 'C')

    // Some bit changed
    const after = s().bestiaryBitset
    expect(after).not.toEqual(before)
  })
})

describe('mergeCarriers — validation rejects', () => {
  it('returns null when source carriers do not exist', () => {
    const { s } = makeHarness()
    const result = s().mergeCarriers('ghost1', 'ghost2', 'C')
    expect(result).toBeNull()
  })

  it('returns null when one of the carriers is missing', () => {
    const { s } = makeHarness()
    addStabilized(s, 'A', 5)
    const result = s().mergeCarriers('A', 'missing', 'C')
    expect(result).toBeNull()
    // A still in store — defensive: only mutate if validation passes
    expect(s().carriers.find((c) => c.frogId === 'A')).toBeDefined()
  })

  it('returns null when carriers are not stabilized', () => {
    const { s } = makeHarness()
    s().addCarrier({
      frogId: 'A',
      element: 'fire',
      rarity: 'common',
      level: 5,
      feedCount: 1,
      stabilized: false,
    })
    s().addCarrier({
      frogId: 'B',
      element: 'fire',
      rarity: 'common',
      level: 5,
      feedCount: 1,
      stabilized: false,
    })
    const result = s().mergeCarriers('A', 'B', 'C')
    expect(result).toBeNull()
  })

  it('returns null when elements differ', () => {
    const { s } = makeHarness()
    addStabilized(s, 'A', 5, 'fire')
    addStabilized(s, 'B', 5, 'ice')
    const result = s().mergeCarriers('A', 'B', 'C')
    expect(result).toBeNull()
  })

  it('returns null when rarities differ', () => {
    const { s } = makeHarness()
    addStabilized(s, 'A', 5, 'fire', 'common')
    addStabilized(s, 'B', 5, 'fire', 'rare')
    const result = s().mergeCarriers('A', 'B', 'C')
    expect(result).toBeNull()
  })

  it('returns null when levels differ', () => {
    const { s } = makeHarness()
    addStabilized(s, 'A', 5)
    addStabilized(s, 'B', 6)
    const result = s().mergeCarriers('A', 'B', 'C')
    expect(result).toBeNull()
  })

  it('returns null when source ids are identical', () => {
    const { s } = makeHarness()
    addStabilized(s, 'A', 5)
    const result = s().mergeCarriers('A', 'A', 'B')
    expect(result).toBeNull()
  })

  it('preserves both source carriers in store on validation fail', () => {
    const { s } = makeHarness()
    addStabilized(s, 'A', 5)
    addStabilized(s, 'B', 6) // different level
    s().mergeCarriers('A', 'B', 'C')

    expect(s().carriers).toHaveLength(2)
    expect(s().carriers.find((c) => c.frogId === 'A')).toBeDefined()
    expect(s().carriers.find((c) => c.frogId === 'B')).toBeDefined()
  })
})

describe('mergeCarriers — edge cases', () => {
  it('clamps newLevel at MAX_LEVEL (24)', () => {
    const { s } = makeHarness()
    addStabilized(s, 'A', 24)
    addStabilized(s, 'B', 24)
    const result = s().mergeCarriers('A', 'B', 'C')
    expect(result).not.toBeNull()
    expect(result?.level).toBe(24) // clamped, not 25
  })

  it('keeps other carriers untouched', () => {
    const { s } = makeHarness()
    addStabilized(s, 'A', 5)
    addStabilized(s, 'B', 5)
    addStabilized(s, 'X', 7) // unrelated
    s().addCarrier({
      frogId: 'Y',
      element: 'ice',
      rarity: 'rare',
      level: 3,
      feedCount: 0,
      stabilized: false,
    })

    s().mergeCarriers('A', 'B', 'C')

    expect(s().carriers.find((c) => c.frogId === 'X')).toBeDefined()
    expect(s().carriers.find((c) => c.frogId === 'Y')).toBeDefined()
  })

  it('cross-location levels still merge in slice (UI handles cross-location visual)', () => {
    // Note: cross-location handling lives in MainScene.performCarrierMerge,
    // not in slice. The slice action is unaware of locations — it just
    // merges if validation passes. This test documents that contract.
    const { s } = makeHarness()
    // level 6 is in swamp (loc 1), level 7 is in forest (loc 2)
    addStabilized(s, 'A', 6)
    addStabilized(s, 'B', 6)
    const result = s().mergeCarriers('A', 'B', 'C')
    expect(result).not.toBeNull()
    expect(result?.level).toBe(7) // crosses location boundary, still merges
  })
})
