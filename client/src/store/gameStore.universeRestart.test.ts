// Phase 31 Plan 31-06: Unit тесты для universe restart store actions.
//
// Coverage:
//   incrementL19Count — двойной вызов → l19Count === 2
//   resetL19Count — после инкрементов → l19Count === 0
//   applyRestartState — нормальный вызов + caps (99→2, -1→0)
//   applyRestartState — полный вайп gold/upgrades/frogs/discoveredLevels
//   applyRestartState — l18 поля сбрасываются
//
// Run: cd client && npx vitest run src/store/gameStore.universeRestart.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// localStorage полифилл — должен быть установлен ДО импорта gameStore,
// потому что gameStore.ts вызывает loadBoxOpenCount() и другие функции из
// persistence.ts при инициализации Zustand store. Паттерн из gameSync.test.ts.
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

// Установить ДО любого импорта gameStore
installLocalStoragePolyfill()

// Динамический импорт — gameStore создаётся с уже рабочим localStorage.
// Следуем паттерну из gameSync.test.ts.
let useGameStore: Awaited<typeof import('./gameStore')>['useGameStore']

beforeEach(async () => {
  if (!useGameStore) {
    const mod = await import('./gameStore')
    useGameStore = mod.useGameStore
  }
  // Сбросить Phase 31 поля перед каждым тестом
  useGameStore.setState({
    l19Count: 0,
    baseTier: 0,
    universeRestartCount: 0,
    gold: 0,
    l18MergesCount: 0,
    l18AbsoluteBonusPerSec: 0,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('incrementL19Count', () => {
  it('increments l19Count by 1 on single call', async () => {
    useGameStore.getState().incrementL19Count()
    expect(useGameStore.getState().l19Count).toBe(1)
  })

  it('increments l19Count twice → l19Count === 2', async () => {
    useGameStore.getState().incrementL19Count()
    useGameStore.getState().incrementL19Count()
    expect(useGameStore.getState().l19Count).toBe(2)
  })

  it('increments are additive — starting from non-zero', async () => {
    useGameStore.setState({ l19Count: 3 })
    useGameStore.getState().incrementL19Count()
    expect(useGameStore.getState().l19Count).toBe(4)
  })

  it('many calls — no overflow or NaN', async () => {
    for (let i = 0; i < 20; i++) useGameStore.getState().incrementL19Count()
    const { l19Count } = useGameStore.getState()
    expect(Number.isFinite(l19Count)).toBe(true)
    expect(l19Count).toBe(20)
  })
})

describe('resetL19Count', () => {
  it('resets l19Count from 0 to 0 (no-op safe)', async () => {
    useGameStore.getState().resetL19Count()
    expect(useGameStore.getState().l19Count).toBe(0)
  })

  it('resets l19Count to 0 after multiple increments', async () => {
    useGameStore.getState().incrementL19Count()
    useGameStore.getState().incrementL19Count()
    useGameStore.getState().resetL19Count()
    expect(useGameStore.getState().l19Count).toBe(0)
  })

  it('resets l19Count from arbitrary value', async () => {
    useGameStore.setState({ l19Count: 4 })
    useGameStore.getState().resetL19Count()
    expect(useGameStore.getState().l19Count).toBe(0)
  })
})

describe('applyRestartState', () => {
  it('applies base_tier and universe_restart_count from server response', async () => {
    useGameStore.getState().applyRestartState({
      base_tier: 1,
      universe_restart_count: 1,
      l19_count: 0,
      version: 5,
    })
    const s = useGameStore.getState()
    expect(s.baseTier).toBe(1)
    expect(s.universeRestartCount).toBe(1)
    expect(s.l19Count).toBe(0)
  })

  it('caps baseTier at 2 when server returns 99', async () => {
    useGameStore.getState().applyRestartState({
      base_tier: 99,
      universe_restart_count: 10,
      l19_count: 0,
      version: 10,
    })
    expect(useGameStore.getState().baseTier).toBe(2)
  })

  it('clamps baseTier to 0 when server returns negative', async () => {
    useGameStore.getState().applyRestartState({
      base_tier: -1,
      universe_restart_count: 0,
      l19_count: 0,
      version: 1,
    })
    expect(useGameStore.getState().baseTier).toBe(0)
  })

  it('baseTier=2 stays at 2 (boundary value)', async () => {
    useGameStore.getState().applyRestartState({
      base_tier: 2,
      universe_restart_count: 2,
      l19_count: 0,
      version: 7,
    })
    expect(useGameStore.getState().baseTier).toBe(2)
  })

  it('resets l19Count to 0 regardless of previous value', async () => {
    useGameStore.setState({ l19Count: 5 })
    useGameStore.getState().applyRestartState({
      base_tier: 1,
      universe_restart_count: 1,
      l19_count: 0,
      version: 5,
    })
    expect(useGameStore.getState().l19Count).toBe(0)
  })

  it('wipes gold, locationFrogs, discoveredLevels (full prestige wipe)', async () => {
    useGameStore.setState({ gold: 9999, l19Count: 5 })
    useGameStore.getState().applyRestartState({
      base_tier: 1,
      universe_restart_count: 1,
      l19_count: 0,
      version: 5,
    })
    const s = useGameStore.getState()
    expect(s.gold).toBe(0)
    expect(s.locationFrogs[0]).toEqual([1])
    expect(s.locationFrogs[1]).toEqual([])
    expect(s.discoveredLevels).toEqual([1])
    expect(s.currentLocation).toBe(1)
    expect(s.frogPurchases).toEqual([])
  })

  it('resets l18MergesCount and l18AbsoluteBonusPerSec (FIX 3)', async () => {
    useGameStore.setState({ l18MergesCount: 5, l18AbsoluteBonusPerSec: 10 })
    useGameStore.getState().applyRestartState({
      base_tier: 1,
      universe_restart_count: 1,
      l19_count: 0,
      version: 5,
    })
    const s = useGameStore.getState()
    expect(s.l18MergesCount).toBe(0)
    expect(s.l18AbsoluteBonusPerSec).toBe(0)
  })
})
