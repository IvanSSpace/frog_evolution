// Phase 22 Plan 22-06: cosmosGate selector + hook unit tests (vitest).
// Run: cd client && npx vitest run src/utils/cosmosGate.test.ts
//
// Покрытие:
//   Test 1: selectCosmosUnlocked возвращает false для initial state
//   Test 2: selectCosmosUnlocked возвращает true после "unlock" (state mutation)
//   Test 3: selectCosmosUnlocked игнорирует не-boolean / undefined значения
//   Test 4: SKIP — backward compat (legacy state с discovered[19] без флага)
//           — defer на Plan 22-07 migration, см. migrations/phase22.ts
//   Test 5: store-level integration — markCosmosUnlocked idempotent + persist
//
// NOTE: useGameStore импортирует persistence.ts которая вызывает localStorage
// на module init. В happy-dom это OK, но Node 25 RTK proxy интерферирует —
// поэтому интеграционные тесты вынесены в Test 5 c try/skip wrapper.

import { describe, it, expect, beforeAll } from 'vitest'

// Polyfill localStorage ДО любого импорта (важно: Node 25 + RTK proxy дают
// сломанный встроенный localStorage без .getItem метода, что ломает persistence.ts
// при module init useGameStore. Перед dynamic import заменяем на in-memory polyfill).
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

// Type-only import — не тянет runtime side-effects gameStore.
type GateState = { hasCosmosUnlocked: boolean }
let selectCosmosUnlocked: (s: GateState) => boolean

beforeAll(async () => {
  const mod = await import('./cosmosGate')
  selectCosmosUnlocked = mod.selectCosmosUnlocked
})

describe('selectCosmosUnlocked (pure selector)', () => {
  it('Test 1: false для initial state', () => {
    expect(selectCosmosUnlocked({ hasCosmosUnlocked: false })).toBe(false)
  })

  it('Test 2: true когда флаг выставлен', () => {
    expect(selectCosmosUnlocked({ hasCosmosUnlocked: true })).toBe(true)
  })

  it('Test 3: только строгий boolean true → true (defensive)', () => {
    expect(
      selectCosmosUnlocked({
        hasCosmosUnlocked: 'true' as unknown as boolean,
      }),
    ).toBe(false)
    expect(
      selectCosmosUnlocked({
        hasCosmosUnlocked: 1 as unknown as boolean,
      }),
    ).toBe(false)
    expect(
      selectCosmosUnlocked({
        hasCosmosUnlocked: undefined as unknown as boolean,
      }),
    ).toBe(false)
  })

  // Test 4 — backward compat: legacy state с discovered[19]=true без флага.
  // Покрыт migratePhase22() в Plan 22-07. Skip здесь.
  it.skip('Test 4 [Plan 22-07]: legacy discovered[19] → hasCosmosUnlocked=true on load', () => {
    // Реализован в src/store/migrations/phase22.test.ts.
  })
})

describe('useGameStore.markCosmosUnlocked (integration)', () => {
  it('Test 5: markCosmosUnlocked idempotent + persist в localStorage', async () => {
    const { useGameStore } = await import('../store/gameStore')

    localStorage.removeItem('frog_evolution_cosmos_unlocked')
    useGameStore.setState({ hasCosmosUnlocked: false })

    expect(useGameStore.getState().hasCosmosUnlocked).toBe(false)

    useGameStore.getState().markCosmosUnlocked()
    expect(useGameStore.getState().hasCosmosUnlocked).toBe(true)
    expect(localStorage.getItem('frog_evolution_cosmos_unlocked')).toBe('true')

    // Idempotent — второй вызов не падает и состояние то же.
    useGameStore.getState().markCosmosUnlocked()
    expect(useGameStore.getState().hasCosmosUnlocked).toBe(true)
  })
})
