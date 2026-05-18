// 2026-05-18 audit: cosmic state sync round-trip coverage.
//
// Purpose: prevent save-loss regression where a new cosmic state field exists
// в `CosmicSlice` + `persistence.loadCosmicSlice`, но gameSync.snapshotForSave
// (client → server) или gameSync hydrate path (server → client) забывает его
// упомянуть. Drift между этими тремя слоями = silent save loss across devices.
//
// Strategy: rather than mocking apiJson + zustand, тестируем чистую функцию
// `snapshotForSave` экспортированную ради tests. Если в makeInitialCosmicSlice
// добавлено поле, но gameSync не обновлён — этот тест поймает.
//
// Run: cd client && npx vitest run src/api/gameSync.test.ts

import { describe, it, expect, vi } from 'vitest'

// Mock putServerGameState ДО любого импорта gameSync — esm bindings live as
// getters, mutate-after-import не работает. vi.mock хойстится в начало файла.
let capturedPayload: Record<string, unknown> | null = null
vi.mock('./gameState', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./gameState')>()
  return {
    ...actual,
    putServerGameState: async (p: unknown) => {
      capturedPayload = p as Record<string, unknown>
      return {
        id: 1,
        userId: 1,
        gold: '0',
        upgrades: {},
        frogPurchases: [],
        discoveredLevels: [],
        magnetEnabled: true,
        currentLocation: 1,
        locationFrogs: [[]],
        boxOpenCount: 0,
        cosmic: null,
        incomePerSec: 0,
        lastSessionAt: '',
        createdAt: '',
        updatedAt: '',
      }
    },
  }
})

// localStorage polyfill — happy-dom + Node 25 + RTK proxy comes up empty.
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

// Все cosmic state поля, которые ДОЛЖНЫ синхронизироваться с сервером.
// Список derived from CosmicSlice fields в client/src/store/cosmic/types.ts,
// MINUS transient-only fields (см. EPHEMERAL_FIELDS ниже).
//
// Если добавляешь новое поле в CosmicSlice — добавь сюда (или явно в
// EPHEMERAL_FIELDS если это transient runtime state).
const REQUIRED_COSMIC_SYNC_FIELDS = [
  // Inventory / state
  'serums',
  'boxes',
  'ship',
  'carriers',
  // Phase 22 Plan 22-03: ascension state (permanent progress).
  'ascendedCarriers',
  'essence',
  // Phase 22 Plan 22-05: cosmic shop perma upgrades + purchase counters.
  'permaSlotBonus',
  'permaShipSpeedBonus',
  'permaSerumDropBonus',
  'shopPurchaseCounts',
  // Bestiary / pity
  'bestiaryBitset',
  'pityCounters',
  // UI persistence
  'lastActiveTab',
  // Crew (Phase 16)
  'crew',
  // Phase 16 progressive disclosure
  'hasFirstFeed',
  'hasFirstMission',
  'hasOpenedAnyBox',
  // Phase 18 milestone
  'frogExclusiveUnlocked',
  // Phase 19-05 tutorial
  'tutorialState',
  // Phase 24 captain birth (Phase 24 Plan 24-01).
  'captainBirthSeen',
  // Phase 26 first contact (Phase 26 Plan 26-01).
  'firstContactsSeen',
  // Phase 27 relationship/chain/pending (Phase 27 Plan 27-01).
  'raceRelationships',
  'chainProgress',
  'pendingItems',
] as const

// Ephemeral runtime state — NOT persisted, NOT synced. Explicit list keeps
// this test honest: добавляя transient поле, развиватель явно его mark'ает.
//
// Каждое поле документировано почему оно ephemeral.
const EPHEMERAL_COSMIC_FIELDS = new Set<string>([
  // Phase 14 UI drag selection — re-initialised at boot, never persists.
  'serumDragActive',
  // Phase 14 selected serum для drag flow — UI-only.
  'selectedSerum',
  // Phase 16 cached ship world pixel position — re-derived from planetCoords.
  // Persisting would risk stale pos mismatching Star Map render scale.
  'latestShipPos',
])

// Top-level (gameStore-base, не cosmic-slice) state поля, которые также
// должны лежать в snapshot.cosmic blob (cross-device sync) — server schema
// для top-level columns не покрывает их, отсюда piggyback через cosmic blob.
const REQUIRED_TOPLEVEL_SYNC_FIELDS = [
  // Phase 22 Plan 22-06: cosmos unlock gate.
  'hasCosmosUnlocked',
  // 2026-05-18: L18+L18 merge multiplier counter + absolute bonus per sec.
  'l18MergesCount',
  'l18AbsoluteBonusPerSec',
]

describe('gameSync — cosmic state sync coverage', () => {
  it('REQUIRED_COSMIC_SYNC_FIELDS covers all non-ephemeral CosmicSlice keys', async () => {
    const { makeInitialCosmicSlice } = await import('../store/cosmic/types')
    const slice = makeInitialCosmicSlice()
    const sliceKeys = Object.keys(slice)

    const known = new Set([
      ...REQUIRED_COSMIC_SYNC_FIELDS,
      ...EPHEMERAL_COSMIC_FIELDS,
    ])
    const unknownKeys = sliceKeys.filter((k) => !known.has(k))

    expect(unknownKeys).toEqual([])
  })

  it('snapshotForSave includes every REQUIRED_COSMIC_SYNC_FIELDS key', async () => {
    const { useGameStore } = await import('../store/gameStore')
    const state = useGameStore.getState()
    const { saveGameState } = await import('./gameSync')

    capturedPayload = null
    const ok = await saveGameState(true)
    expect(ok).toBe(true)
    expect(capturedPayload).not.toBeNull()

    const cosmic = (capturedPayload as { cosmic?: Record<string, unknown> })
      ?.cosmic
    expect(cosmic).toBeDefined()
    expect(cosmic).toBeTypeOf('object')

    const cosmicKeys = new Set(Object.keys(cosmic ?? {}))

    const missing: string[] = []
    for (const f of REQUIRED_COSMIC_SYNC_FIELDS) {
      if (!cosmicKeys.has(f)) missing.push(f)
    }
    expect(missing).toEqual([])

    // Top-level fields routed через cosmic blob (preferences + L18 + cosmos
    // gate). Validate they're there too.
    const toplevelMissing: string[] = []
    for (const f of REQUIRED_TOPLEVEL_SYNC_FIELDS) {
      if (!cosmicKeys.has(f)) toplevelMissing.push(f)
    }
    expect(toplevelMissing).toEqual([])

    // Sanity: state matches snapshot for one anchor cosmic field
    expect(cosmic?.serums).toEqual(state.serums)
  })
})
