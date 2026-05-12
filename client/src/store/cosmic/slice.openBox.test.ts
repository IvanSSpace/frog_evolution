// Phase 19-01 (BALANCE-01..07): unit tests для openBox + pity wiring.
// Run: npx tsx client/src/store/cosmic/slice.openBox.test.ts
//
// Тестируем:
//   1. common roll → pityCounters растут на 1
//   2. legendary roll → pityCounters сбрасываются
//   3. rare guarantee (pity.rare = 3) → roll НЕ может быть common
//   4. epic guarantee (pity.epic = 10) → roll guaranteed epic+
//   5. hard pity 25 → guaranteed legendary
//   6. bonusRarity epic floor → upgrades common → epic+
//   7. opening already-opened box → no-op
//   8. eventBus.emit'ит 'cosmic:box-opened'
//   9. hasOpenedAnyBox = true после первого open

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

// RNG control: monkey-patch Math.random to return a fixed value or sequence.
let originalRandom: () => number
function mockRandom(value: number): void {
  originalRandom = Math.random
  Math.random = () => value
}
function restoreRandom(): void {
  if (originalRandom) Math.random = originalRandom
}

// ─── Test 1: common roll increments rare/epic/legendary counters; serum awarded ───
{
  const h = makeHarness()
  // r=0.1 * total(100) → common (weights common=50)
  mockRandom(0.1)
  h.set({ boxes: [makeBox({ id: 'b1', element: 'fire' })] })
  h.state().openBox('b1')
  const after = h.state()

  assert.equal(after.boxes[0].opened, true, 'Test 1: box.opened=true')
  assert.equal(after.serums.fire.common, 1, 'Test 1: fire.common=1')
  assert.equal(
    after.pityCounters.rare,
    1,
    'Test 1: pity.rare=1 (common rolled)',
  )
  assert.equal(after.pityCounters.epic, 1, 'Test 1: pity.epic=1')
  assert.equal(after.pityCounters.legendary, 1, 'Test 1: pity.legendary=1')
  assert.equal(after.hasOpenedAnyBox, true, 'Test 1: hasOpenedAnyBox=true')
  restoreRandom()
}

// ─── Test 2: legendary roll resets all pity counters (via hard 40 guarantee) ───
{
  const h = makeHarness()
  // Hard pity threshold is 40 (updated from original 25). Legendary weight=0 but
  // hard pity short-circuit still fires at pity.legendary >= 40.
  h.set({
    pityCounters: { common: 0, rare: 5, epic: 5, legendary: 40 },
    boxes: [makeBox({ id: 'b2', element: 'ice' })],
  })
  h.state().openBox('b2')
  const after = h.state()

  assert.equal(after.serums.ice.legendary, 1, 'Test 2: ice.legendary=1')
  assert.equal(after.pityCounters.rare, 0, 'Test 2: pity.rare reset to 0')
  assert.equal(after.pityCounters.epic, 0, 'Test 2: pity.epic reset to 0')
  assert.equal(
    after.pityCounters.legendary,
    0,
    'Test 2: pity.legendary reset to 0',
  )
}

// ─── Test 3: rare guarantee — pity.rare = 8 → roll cannot be common ───
{
  const h = makeHarness()
  // Current threshold: pity.rare>=8 (updated from original 3).
  // rollRarity returns rare/epic/legendary (70/25/5) from guarantee branch.
  // r=0.5 * total(100) → r-=70 → -20 < 0 → rare.
  mockRandom(0.5)
  h.set({
    pityCounters: { common: 0, rare: 8, epic: 0, legendary: 0 },
    boxes: [makeBox({ id: 'b3', element: 'water' })],
  })
  h.state().openBox('b3')
  const after = h.state()

  assert.equal(
    after.serums.water.common,
    0,
    'Test 3: water.common=0 (cannot be common)',
  )
  assert.equal(
    after.pityCounters.rare,
    0,
    'Test 3: rare counter reset (rolled rare+)',
  )
  // serum awarded should be one of rare/epic/legendary
  const total =
    after.serums.water.rare +
    after.serums.water.epic +
    after.serums.water.legendary
  assert.equal(total, 1, 'Test 3: exactly one rare+ serum awarded')
  restoreRandom()
}

// ─── Test 4: epic guarantee — pity.epic = 20 → roll guaranteed epic+ ───
{
  const h = makeHarness()
  // Current threshold: pity.epic>=20 (updated from original 10).
  mockRandom(0.5)
  h.set({
    pityCounters: { common: 0, rare: 0, epic: 20, legendary: 0 },
    boxes: [makeBox({ id: 'b4', element: 'plasma' })],
  })
  h.state().openBox('b4')
  const after = h.state()

  assert.equal(after.serums.plasma.common, 0, 'Test 4: not common')
  assert.equal(after.serums.plasma.rare, 0, 'Test 4: not rare')
  const epicOrLeg = after.serums.plasma.epic + after.serums.plasma.legendary
  assert.equal(epicOrLeg, 1, 'Test 4: exactly one epic/legendary')
  assert.equal(after.pityCounters.epic, 0, 'Test 4: epic counter reset')
  restoreRandom()
}

// ─── Test 5: hard pity 40 — guaranteed legendary ───
{
  const h = makeHarness()
  // Hard pity fires at pity.legendary >= 40 (updated from original 25).
  // Legendary weight=0 but hard pity short-circuit in rollRarity still returns 'legendary'.
  h.set({
    pityCounters: { common: 0, rare: 0, epic: 0, legendary: 40 },
    boxes: [makeBox({ id: 'b5', element: 'arcane' })],
  })
  h.state().openBox('b5')
  const after = h.state()

  assert.equal(after.serums.arcane.legendary, 1, 'Test 5: arcane.legendary=1')
  assert.equal(
    after.pityCounters.legendary,
    0,
    'Test 5: legendary counter reset',
  )
}

// ─── Test 6: bonusRarity epic floor — common roll upgraded to epic+ ───
{
  const h = makeHarness()
  // r=0.1 normally → common; bonusRarity='epic' should upgrade.
  mockRandom(0.1)
  h.set({
    boxes: [makeBox({ id: 'b6', element: 'void', bonusRarity: 'epic' })],
  })
  h.state().openBox('b6')
  const after = h.state()

  assert.equal(after.serums.void.common, 0, 'Test 6: not common (upgraded)')
  assert.equal(after.serums.void.rare, 0, 'Test 6: not rare (epic floor)')
  const epicOrLeg = after.serums.void.epic + after.serums.void.legendary
  assert.equal(epicOrLeg, 1, 'Test 6: epic or legendary awarded')
  restoreRandom()
}

// ─── Test 7: opening already-opened box → no-op ───
{
  const h = makeHarness()
  const box = makeBox({ id: 'b7', opened: true })
  h.set({ boxes: [box] })
  const beforePity = { ...h.state().pityCounters }
  const beforeFireCommon = h.state().serums.fire.common

  h.state().openBox('b7')
  const after = h.state()

  assert.deepEqual(after.pityCounters, beforePity, 'Test 7: pity unchanged')
  assert.equal(
    after.serums.fire.common,
    beforeFireCommon,
    'Test 7: serums unchanged',
  )
}

// ─── Test 8: eventBus emits cosmic:box-opened with correct payload ───
{
  const h = makeHarness()
  let captured: { boxId: string; rarity: string; element: string } | null = null
  const handler = (payload: {
    boxId: string
    rarity: string
    element: string
  }) => {
    captured = payload
  }
  eventBus.on('cosmic:box-opened', handler)

  // Hard pity threshold is 40 (updated from original 25).
  h.set({
    pityCounters: { common: 0, rare: 0, epic: 0, legendary: 40 },
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
    (captured as unknown as { rarity: string }).rarity,
    'legendary',
    'Test 8: rarity in payload',
  )
  assert.equal(
    (captured as unknown as { element: string }).element,
    'shadow',
    'Test 8: element in payload',
  )
}

// ─── Test 9: opening unknown id → no-op (no throw) ───
{
  const h = makeHarness()
  const beforePity = { ...h.state().pityCounters }
  h.state().openBox('nonexistent')
  const after = h.state()
  assert.deepEqual(
    after.pityCounters,
    beforePity,
    'Test 9: unknown id is no-op',
  )
  assert.equal(
    after.hasOpenedAnyBox,
    false,
    'Test 9: hasOpenedAnyBox stays false',
  )
}

console.log('All slice.openBox.test.ts tests passed (9/9)')
