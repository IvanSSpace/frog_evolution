// Phase 19-01 (BALANCE-01..07): unit tests для openBox action.
// Phase 22: rewritten — rarity removed, flat serums model.
// openBox (legacy client-side path) now just increments serums[element] and marks opened.
// Phase 22 Plan 22-06: openBox is cosmos-gated — pre-cosmos opens drop the box БЕЗ серума.
// Tests below set hasCosmosUnlocked=true at the harness level (top-level state field
// owned by gameStore, not by cosmic slice — но harness state object reads through
// get() and the boxSlice does a narrow cast). See client/src/utils/cosmosGate.ts.
//
// Phase 28 tech-debt: migrated from top-level `node:assert/strict` ad-hoc runner
// to vitest describe/it (vitest 4 не подбирал старый формат — «No test suite found»).

import { describe, it, expect } from 'vitest'

// Polyfill crypto.randomUUID (vitest under happy-dom уже даёт его, но безопасно).
if (
  !(globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID
) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `${Date.now()}-${Math.random()}` },
  })
}

import { createCosmicSlice } from './slice'
import type { CosmicState } from './slice'
import type { BoxData } from './types'
import { eventBus } from '../eventBus'

interface Harness {
  state: () => CosmicState
  set: (p: Partial<CosmicState>) => void
}

// Harness mirrors the simple Partial<CosmicState> shape used by other cosmic
// tests. Cosmos gate flag (hasCosmosUnlocked) lives top-level on gameStore;
// we inject it via the spread set() so boxSlice's narrow cast finds it.
function makeHarness(): Harness {
  let state: CosmicState | undefined
  const set = (partial: Partial<CosmicState>): void => {
    state = { ...(state as CosmicState), ...partial }
  }
  const get = (): CosmicState => state as CosmicState
  state = createCosmicSlice(set, get)
  // Required for Phase 22 Plan 22-06 cosmos gate: openBox awards serum only
  // when hasCosmosUnlocked === true. Production: flipped by MergeController
  // на первом L18+L18. Tests exercise the unlocked-state pipeline.
  set({ hasCosmosUnlocked: true } as unknown as Partial<CosmicState>)
  return { state: () => state as CosmicState, set }
}

function makeBox(overrides: Partial<BoxData> = {}): BoxData {
  return {
    id: overrides.id ?? 'box-1',
    planetId: 'home',
    planetName: 'Home',
    archetype: 'swamp',
    element: 'fire',
    opened: false,
    createdAt: 0,
    ...overrides,
  }
}

describe('cosmic slice — openBox action (cosmos-unlocked)', () => {
  it('Test 1: openBox marks box as opened and increments serum', () => {
    const h = makeHarness()
    h.set({ boxes: [makeBox({ id: 'b1', element: 'fire' })] })
    const before = h.state().serums.fire ?? 0
    h.state().openBox('b1')
    const after = h.state()

    expect(after.boxes[0].opened).toBe(true)
    expect(after.serums.fire).toBe(before + 1)
    expect(after.hasOpenedAnyBox).toBe(true)
  })

  it('Test 2: openBox ice → ice serum incremented', () => {
    const h = makeHarness()
    h.set({ boxes: [makeBox({ id: 'b2', element: 'ice' })] })
    const before = h.state().serums.ice ?? 0
    h.state().openBox('b2')
    expect(h.state().serums.ice).toBe(before + 1)
  })

  it('Test 3: openBox water → water serum incremented', () => {
    const h = makeHarness()
    h.set({ boxes: [makeBox({ id: 'b3', element: 'water' })] })
    const before = h.state().serums.water ?? 0
    h.state().openBox('b3')
    expect(h.state().serums.water).toBe(before + 1)
  })

  it('Test 4: openBox plasma → plasma serum incremented', () => {
    const h = makeHarness()
    h.set({ boxes: [makeBox({ id: 'b4', element: 'plasma' })] })
    const before = h.state().serums.plasma ?? 0
    h.state().openBox('b4')
    expect(h.state().serums.plasma).toBe(before + 1)
  })

  it('Test 5: openBox arcane → arcane serum incremented', () => {
    const h = makeHarness()
    h.set({ boxes: [makeBox({ id: 'b5', element: 'arcane' })] })
    const before = h.state().serums.arcane ?? 0
    h.state().openBox('b5')
    expect(h.state().serums.arcane).toBe(before + 1)
  })

  it('Test 6: bonusRarity flag preserved but doesn\'t affect serum count', () => {
    const h = makeHarness()
    h.set({
      boxes: [makeBox({ id: 'b6', element: 'void', bonusRarity: 'epic' })],
    })
    const before = h.state().serums.void ?? 0
    h.state().openBox('b6')
    expect(h.state().serums.void).toBe(before + 1)
  })

  it('Test 7: opening already-opened box → no-op', () => {
    const h = makeHarness()
    const box = makeBox({ id: 'b7', opened: true })
    h.set({ boxes: [box] })
    const beforeFire = h.state().serums.fire ?? 0

    h.state().openBox('b7')
    const after = h.state()

    expect(after.serums.fire).toBe(beforeFire)
  })

  it('Test 8: eventBus emits cosmic:box-opened with element in payload', () => {
    const h = makeHarness()
    let captured: { boxId: string; element: string } | null = null
    const handler = (payload: { boxId: string; element: string }) => {
      captured = payload
    }
    eventBus.on('cosmic:box-opened', handler)

    h.set({
      boxes: [makeBox({ id: 'b8', element: 'shadow' })],
    })
    h.state().openBox('b8')

    eventBus.off('cosmic:box-opened', handler)

    expect(captured).not.toBeNull()
    expect((captured as unknown as { boxId: string }).boxId).toBe('b8')
    expect((captured as unknown as { element: string }).element).toBe('shadow')
  })

  it('Test 9: opening unknown id → no-op', () => {
    const h = makeHarness()
    const beforeFire = h.state().serums.fire ?? 0
    h.state().openBox('nonexistent')
    const after = h.state()
    expect(after.serums.fire).toBe(beforeFire)
    expect(after.hasOpenedAnyBox).toBe(false)
  })
})
