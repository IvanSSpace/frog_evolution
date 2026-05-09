import { describe, it, expect, beforeEach, vi } from 'vitest'

// FrogElementOverlay must be mocked as a proper class (arrow fn can't be `new`-ed).
vi.mock('./FrogElementOverlay', () => {
  class FrogElementOverlay {
    container: { active: boolean; scene: object; parentContainer: null } = {
      active: true,
      scene: {},
      parentContainer: null,
    }
    element: string = 'fire'
    tier: string = 'dormant'
    hostFrogId: string | null = null
    locked: boolean = false
    attach = vi.fn()
    detach = vi.fn()
    setTier = vi.fn()
    setLocked = vi.fn()
    setVisible = vi.fn()
    dispose = vi.fn()
  }
  return { FrogElementOverlay }
})

import { elementOverlayPool } from './elementOverlayPool'

const fakeScene = {} as Parameters<typeof elementOverlayPool.acquire>[0]

beforeEach(() => {
  elementOverlayPool.drainAll()
  vi.clearAllMocks()
})

describe('elementOverlayPool acquire', () => {
  it('creates new overlay when pool is empty', () => {
    const overlay = elementOverlayPool.acquire(fakeScene, 'fire', 'dormant')
    expect(overlay).toBeDefined()
    expect(elementOverlayPool.totalActive).toBe(1)
    expect(elementOverlayPool.totalPooled).toBe(0)
  })

  it('reuses pooled overlay on second acquire', () => {
    const o1 = elementOverlayPool.acquire(fakeScene, 'fire', 'dormant')
    elementOverlayPool.release(o1)
    const o2 = elementOverlayPool.acquire(fakeScene, 'fire', 'dormant')
    expect(o2).toBe(o1)
    expect(elementOverlayPool.totalPooled).toBe(0)
    expect(elementOverlayPool.totalActive).toBe(1)
  })

  it('skips destroyed overlay from pool and creates fresh', () => {
    const live = elementOverlayPool.acquire(fakeScene, 'fire', 'dormant')
    // Simulate Phaser destroying the container
    live.container.active = false
    elementOverlayPool.release(live)
    // Pool should have discarded it (release checks container.active)
    expect(elementOverlayPool.totalPooled).toBe(0)
    // acquire should create a fresh one
    const fresh = elementOverlayPool.acquire(fakeScene, 'fire', 'dormant')
    expect(fresh).not.toBe(live)
    expect(fresh.container.active).toBe(true)
  })

  it('does not mix element buckets', () => {
    const fire = elementOverlayPool.acquire(fakeScene, 'fire', 'dormant')
    // Simulate what attach() does in real code: set element/tier on the overlay
    fire.element = 'fire'
    const ice = elementOverlayPool.acquire(fakeScene, 'ice', 'dormant')
    ice.element = 'ice'
    elementOverlayPool.release(fire)
    elementOverlayPool.release(ice)
    const gotFire = elementOverlayPool.acquire(fakeScene, 'fire', 'dormant')
    const gotIce = elementOverlayPool.acquire(fakeScene, 'ice', 'dormant')
    expect(gotFire).toBe(fire)
    expect(gotIce).toBe(ice)
  })
})

describe('elementOverlayPool release', () => {
  it('moves overlay from active to pool', () => {
    const o = elementOverlayPool.acquire(fakeScene, 'fire', 'dormant')
    expect(elementOverlayPool.totalActive).toBe(1)
    elementOverlayPool.release(o)
    expect(elementOverlayPool.totalActive).toBe(0)
    expect(elementOverlayPool.totalPooled).toBe(1)
  })

  it('calls detach() on release', () => {
    const o = elementOverlayPool.acquire(fakeScene, 'fire', 'dormant')
    elementOverlayPool.release(o)
    expect(o.detach).toHaveBeenCalledOnce()
  })

  it('does not pool destroyed overlay', () => {
    const o = elementOverlayPool.acquire(fakeScene, 'fire', 'dormant')
    o.container.active = false
    elementOverlayPool.release(o)
    expect(elementOverlayPool.totalPooled).toBe(0)
  })

  it('double release is a no-op', () => {
    const o = elementOverlayPool.acquire(fakeScene, 'fire', 'dormant')
    elementOverlayPool.release(o)
    elementOverlayPool.release(o)
    expect(elementOverlayPool.totalPooled).toBe(1)
    expect(o.detach).toHaveBeenCalledOnce()
  })
})
