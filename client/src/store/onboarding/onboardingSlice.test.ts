// Phase 23 Plan 23-01: vitest suite for useOnboardingStore.
//
// We exercise the full load → mutate → save round-trip. Each test clears
// localStorage AND re-imports the slice via vi.resetModules() so module-scope
// `initial` is recomputed against a clean storage.
//
// NOTE: happy-dom + Node 25 (with RTK proxy in this dev env) ships a broken
// localStorage without .removeItem — same issue documented in cosmosGate.test.ts.
// We install an in-memory polyfill BEFORE any dynamic import so persistence.ts
// (which calls localStorage on module init) sees a sane Storage.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'frog_evolution_onboarding'

function installLocalStoragePolyfill() {
  const store: Record<string, string> = {}
  const ls: Storage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v)
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: ls,
    writable: true,
    configurable: true,
  })
}

installLocalStoragePolyfill()

async function freshStore() {
  vi.resetModules()
  const mod = await import('./onboardingSlice')
  return mod.useOnboardingStore
}

beforeEach(() => {
  localStorage.removeItem(KEY)
})

afterEach(() => {
  localStorage.removeItem(KEY)
})

describe('useOnboardingStore — defaults', () => {
  it('returns all flags false and empty locationsCelebrated on first load', async () => {
    const useStore = await freshStore()
    const s = useStore.getState()
    expect(s.welcomeSeen).toBe(false)
    expect(s.firstBoxTapSeen).toBe(false)
    expect(s.firstMergeSeen).toBe(false)
    expect(s.locationsCelebrated).toEqual({})
  })
})

describe('useOnboardingStore — mark actions', () => {
  it('markWelcomeSeen sets welcomeSeen=true, others unchanged', async () => {
    const useStore = await freshStore()
    useStore.getState().markWelcomeSeen()
    const s = useStore.getState()
    expect(s.welcomeSeen).toBe(true)
    expect(s.firstBoxTapSeen).toBe(false)
    expect(s.firstMergeSeen).toBe(false)
    expect(s.locationsCelebrated).toEqual({})
  })

  it('markFirstBoxTapSeen flips only firstBoxTapSeen', async () => {
    const useStore = await freshStore()
    useStore.getState().markFirstBoxTapSeen()
    const s = useStore.getState()
    expect(s.firstBoxTapSeen).toBe(true)
    expect(s.welcomeSeen).toBe(false)
    expect(s.firstMergeSeen).toBe(false)
  })

  it('markFirstMergeSeen flips only firstMergeSeen', async () => {
    const useStore = await freshStore()
    useStore.getState().markFirstMergeSeen()
    const s = useStore.getState()
    expect(s.firstMergeSeen).toBe(true)
    expect(s.welcomeSeen).toBe(false)
    expect(s.firstBoxTapSeen).toBe(false)
  })
})

describe('useOnboardingStore — locationsCelebrated', () => {
  it('markLocationCelebrated(2) records id 2 only', async () => {
    const useStore = await freshStore()
    useStore.getState().markLocationCelebrated(2)
    expect(useStore.getState().locationsCelebrated).toEqual({ 2: true })
  })

  it('marking multiple locations merges them — does not overwrite', async () => {
    const useStore = await freshStore()
    useStore.getState().markLocationCelebrated(2)
    useStore.getState().markLocationCelebrated(3)
    useStore.getState().markLocationCelebrated(6)
    expect(useStore.getState().locationsCelebrated).toEqual({
      2: true,
      3: true,
      6: true,
    })
  })

  it('marking the same location twice is idempotent (still true)', async () => {
    const useStore = await freshStore()
    useStore.getState().markLocationCelebrated(2)
    useStore.getState().markLocationCelebrated(2)
    expect(useStore.getState().locationsCelebrated).toEqual({ 2: true })
  })
})

describe('useOnboardingStore — __reset', () => {
  it('__reset() returns store and localStorage to defaults', async () => {
    const useStore = await freshStore()
    useStore.getState().markWelcomeSeen()
    useStore.getState().markFirstBoxTapSeen()
    useStore.getState().markFirstMergeSeen()
    useStore.getState().markLocationCelebrated(3)

    useStore.getState().__reset()
    const s = useStore.getState()
    expect(s.welcomeSeen).toBe(false)
    expect(s.firstBoxTapSeen).toBe(false)
    expect(s.firstMergeSeen).toBe(false)
    expect(s.locationsCelebrated).toEqual({})

    // localStorage reflects reset shape
    const raw = localStorage.getItem(KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed).toEqual({
      welcomeSeen: false,
      firstBoxTapSeen: false,
      firstMergeSeen: false,
      locationsCelebrated: {},
    })
  })
})

describe('useOnboardingStore — persistence round-trip', () => {
  it('mark actions persist, fresh import sees them', async () => {
    // First module instance — mutate and let it save to localStorage.
    const useStoreA = await freshStore()
    useStoreA.getState().markWelcomeSeen()
    useStoreA.getState().markLocationCelebrated(2)
    useStoreA.getState().markLocationCelebrated(6)

    // Sanity: localStorage now has the persisted shape.
    const raw = localStorage.getItem(KEY)
    expect(raw).not.toBeNull()

    // Re-import → loadOnboarding runs again against the same localStorage.
    const useStoreB = await freshStore()
    const s = useStoreB.getState()
    expect(s.welcomeSeen).toBe(true)
    expect(s.firstBoxTapSeen).toBe(false)
    expect(s.firstMergeSeen).toBe(false)
    expect(s.locationsCelebrated).toEqual({ 2: true, 6: true })
  })

  it('corrupt localStorage JSON falls back to defaults without throwing', async () => {
    localStorage.setItem(KEY, '{not valid json')
    const useStore = await freshStore()
    const s = useStore.getState()
    expect(s.welcomeSeen).toBe(false)
    expect(s.firstBoxTapSeen).toBe(false)
    expect(s.firstMergeSeen).toBe(false)
    expect(s.locationsCelebrated).toEqual({})
  })

  it('partial corruption preserves valid fields, defaults the rest', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        welcomeSeen: true,
        firstBoxTapSeen: 'not-a-boolean', // invalid
        firstMergeSeen: false,
        locationsCelebrated: { 2: true, bad: 'oops' }, // mixed
      }),
    )
    const useStore = await freshStore()
    const s = useStore.getState()
    expect(s.welcomeSeen).toBe(true)
    expect(s.firstBoxTapSeen).toBe(false) // sanitized
    expect(s.firstMergeSeen).toBe(false)
    // only numeric-key + boolean-value entries survive
    expect(s.locationsCelebrated).toEqual({ 2: true })
  })
})
