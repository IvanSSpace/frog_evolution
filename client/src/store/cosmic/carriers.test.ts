import { describe, it, expect, beforeEach } from 'vitest'
import { createCosmicSlice } from './slice'
import type { CosmicState } from './slice'

// Crypto polyfill for happy-dom
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

describe('addCarrier / removeCarrier', () => {
  it('addCarrier appends to carriers array', () => {
    const { s } = makeHarness()
    s().addCarrier({
      frogId: 'f1',
      element: 'fire',
      rarity: 'common',
      feedCount: 0,
      stabilized: false,
      level: 1,
    })
    expect(s().carriers).toHaveLength(1)
    expect(s().carriers[0].frogId).toBe('f1')
  })

  it('addCarrier does not deduplicate — caller must guard', () => {
    const { s } = makeHarness()
    const carrier = {
      frogId: 'f1',
      element: 'fire' as const,
      rarity: 'common' as const,
      feedCount: 0,
      stabilized: false,
      level: 1,
    }
    s().addCarrier(carrier)
    s().addCarrier(carrier)
    expect(s().carriers).toHaveLength(2)
  })

  it('removeCarrier removes by frogId', () => {
    const { s } = makeHarness()
    s().addCarrier({
      frogId: 'f1',
      element: 'fire',
      rarity: 'common',
      feedCount: 0,
      stabilized: false,
      level: 1,
    })
    s().addCarrier({
      frogId: 'f2',
      element: 'ice',
      rarity: 'rare',
      feedCount: 0,
      stabilized: false,
      level: 2,
    })
    s().removeCarrier('f1')
    expect(s().carriers).toHaveLength(1)
    expect(s().carriers[0].frogId).toBe('f2')
  })

  it('removeCarrier on unknown id is a no-op', () => {
    const { s } = makeHarness()
    s().addCarrier({
      frogId: 'f1',
      element: 'fire',
      rarity: 'common',
      feedCount: 0,
      stabilized: false,
      level: 1,
    })
    s().removeCarrier('ghost')
    expect(s().carriers).toHaveLength(1)
  })

  it('removeCarrier produces new array reference', () => {
    const { s } = makeHarness()
    s().addCarrier({
      frogId: 'f1',
      element: 'fire',
      rarity: 'common',
      feedCount: 0,
      stabilized: false,
      level: 1,
    })
    const before = s().carriers
    s().removeCarrier('f1')
    expect(s().carriers).not.toBe(before)
  })
})

describe('applySerum', () => {
  let h: ReturnType<typeof makeHarness>

  beforeEach(() => {
    h = makeHarness()
    // Give 2 fire:common serums
    h.s().addSerum('fire', 'common', 2)
  })

  it('applySerum adds carrier and decrements serum', () => {
    h.s().applySerum('frog1', 'fire', 'common', 1)
    expect(h.s().carriers).toHaveLength(1)
    expect(h.s().carriers[0]).toMatchObject({
      frogId: 'frog1',
      element: 'fire',
      rarity: 'common',
      feedCount: 0,
      stabilized: false,
    })
    expect(h.s().serums.fire.common).toBe(1)
  })

  it('applySerum is idempotent — second call with same frogId is no-op', () => {
    h.s().applySerum('frog1', 'fire', 'common', 1)
    h.s().applySerum('frog1', 'fire', 'common', 1)
    expect(h.s().carriers).toHaveLength(1)
    expect(h.s().serums.fire.common).toBe(1)
  })

  it('applySerum fails silently when serum count is 0', () => {
    h.s().applySerum('a', 'fire', 'common', 1)
    h.s().applySerum('b', 'fire', 'common', 1)
    const serumsAfter = h.s().serums.fire.common
    h.s().applySerum('c', 'fire', 'common', 1)
    expect(h.s().carriers).toHaveLength(2)
    expect(h.s().serums.fire.common).toBe(serumsAfter)
  })
})
