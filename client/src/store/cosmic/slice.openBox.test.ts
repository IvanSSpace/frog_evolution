// Phase 19-01 (BALANCE-01..07): unit tests для openBox action.
// Phase 22: rewritten — rarity removed, flat serums model.
// openBox (legacy client-side path) now just increments serums[element] and marks opened.
// Run: npx tsx client/src/store/cosmic/slice.openBox.test.ts

import assert from 'node:assert/strict'

// Polyfill crypto.randomUUID
if (
  !(globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID
) {
  ;(globalThis as { crypto?: { randomUUID: () => string } }).crypto = {
    randomUUID: () => `${Date.now()}-${Math.random()}`,
  }
}

import { createCosmicSlice } from './slice'
import type { CosmicState } from './slice'
import type { BoxData } from './types'
import { eventBus } from '../eventBus'

interface Harness {
  state: () => CosmicState
  set: (p: Partial<CosmicState>) => void
}

function makeHarness(): Harness {
  let state: CosmicState | undefined
  const set = (partial: Partial<CosmicState>): void => {
    state = { ...(state as CosmicState), ...partial }
  }
  const get = (): CosmicState => state as CosmicState
  state = createCosmicSlice(set, get)
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

// ─── Test 1: openBox marks box as opened and increments serum ───
{
  const h = makeHarness()
  h.set({ boxes: [makeBox({ id: 'b1', element: 'fire' })] })
  const before = h.state().serums.fire ?? 0
  h.state().openBox('b1')
  const after = h.state()

  assert.equal(after.boxes[0].opened, true, 'Test 1: box.opened=true')
  assert.equal(after.serums.fire, before + 1, 'Test 1: fire serum +1')
  assert.equal(after.hasOpenedAnyBox, true, 'Test 1: hasOpenedAnyBox=true')
}

// ─── Test 2: openBox ice → ice serum incremented ───
{
  const h = makeHarness()
  h.set({ boxes: [makeBox({ id: 'b2', element: 'ice' })] })
  const before = h.state().serums.ice ?? 0
  h.state().openBox('b2')
  assert.equal(h.state().serums.ice, before + 1, 'Test 2: ice serum +1')
}

// ─── Test 3: openBox water → water serum incremented ───
{
  const h = makeHarness()
  h.set({ boxes: [makeBox({ id: 'b3', element: 'water' })] })
  const before = h.state().serums.water ?? 0
  h.state().openBox('b3')
  assert.equal(h.state().serums.water, before + 1, 'Test 3: water serum +1')
}

// ─── Test 4: openBox plasma → plasma serum incremented ───
{
  const h = makeHarness()
  h.set({ boxes: [makeBox({ id: 'b4', element: 'plasma' })] })
  const before = h.state().serums.plasma ?? 0
  h.state().openBox('b4')
  assert.equal(h.state().serums.plasma, before + 1, 'Test 4: plasma serum +1')
}

// ─── Test 5: openBox arcane → arcane serum incremented ───
{
  const h = makeHarness()
  h.set({ boxes: [makeBox({ id: 'b5', element: 'arcane' })] })
  const before = h.state().serums.arcane ?? 0
  h.state().openBox('b5')
  assert.equal(h.state().serums.arcane, before + 1, 'Test 5: arcane serum +1')
}

// ─── Test 6: bonusRarity flag preserved but doesn't affect serum count ───
{
  const h = makeHarness()
  h.set({
    boxes: [makeBox({ id: 'b6', element: 'void', bonusRarity: 'epic' })],
  })
  const before = h.state().serums.void ?? 0
  h.state().openBox('b6')
  assert.equal(h.state().serums.void, before + 1, 'Test 6: void serum +1 regardless of bonusRarity')
}

// ─── Test 7: opening already-opened box → no-op ───
{
  const h = makeHarness()
  const box = makeBox({ id: 'b7', opened: true })
  h.set({ boxes: [box] })
  const beforeFire = h.state().serums.fire ?? 0

  h.state().openBox('b7')
  const after = h.state()

  assert.equal(
    after.serums.fire,
    beforeFire,
    'Test 7: serums unchanged for already-opened',
  )
}

// ─── Test 8: eventBus emits cosmic:box-opened with element in payload ───
{
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

  assert.notEqual(captured, null, 'Test 8: event captured')
  assert.equal(
    (captured as unknown as { boxId: string }).boxId,
    'b8',
    'Test 8: boxId in payload',
  )
  assert.equal(
    (captured as unknown as { element: string }).element,
    'shadow',
    'Test 8: element in payload',
  )
}

// ─── Test 9: opening unknown id → no-op ───
{
  const h = makeHarness()
  const beforeFire = h.state().serums.fire ?? 0
  h.state().openBox('nonexistent')
  const after = h.state()
  assert.equal(
    after.serums.fire,
    beforeFire,
    'Test 9: unknown id is no-op',
  )
  assert.equal(
    after.hasOpenedAnyBox,
    false,
    'Test 9: hasOpenedAnyBox stays false',
  )
}

console.log('All slice.openBox.test.ts tests passed (9/9)')
