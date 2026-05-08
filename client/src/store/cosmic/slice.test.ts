// Phase 15 Plan 15-01 Task 2: unit tests for new box actions in cosmicSlice.
// Run: tsx client/src/store/cosmic/slice.test.ts
//
// Тестируем addBox, rollBoxRarity, commitOpenedBox, removeBox.
// Mock gameStore не нужен — createCosmicSlice принимает custom set/get.

import assert from 'node:assert/strict'

// Polyfill crypto.randomUUID для node test (Node 19+ has it natively, but ensure).
if (!(globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID) {
  ;(globalThis as { crypto?: { randomUUID: () => string } }).crypto = {
    randomUUID: () => `${Date.now()}-${Math.random()}`,
  }
}

import { createCosmicSlice } from './slice'
import type { CosmicState } from './slice'

interface Harness {
  state: () => CosmicState
}

function makeHarness(): Harness {
  let state: CosmicState | undefined
  const set = (partial: Partial<CosmicState>): void => {
    state = { ...(state as CosmicState), ...partial }
  }
  const get = (): CosmicState => state as CosmicState
  state = createCosmicSlice(set, get)
  return { state: () => state as CosmicState }
}

// ─── Test 1: addBox returns BoxData with auto-id, opened=false, createdAt > 0 ───
{
  const h = makeHarness()
  const box = h.state().addBox({
    planetId: 'p1', planetName: 'Kepler', archetype: 'lava', element: 'fire',
  })
  assert.equal(typeof box.id, 'string', 'Test 1: id is string')
  assert(box.id.length > 0, 'Test 1: id non-empty')
  assert.equal(box.opened, false, 'Test 1: opened=false')
  assert(box.createdAt > 0, 'Test 1: createdAt > 0')
  assert.equal(box.element, 'fire', 'Test 1: element=fire')
  assert.equal(h.state().boxes.length, 1, 'Test 1: boxes.length=1')
}

// ─── Test 2: addBox дважды → 2 boxes, ids различаются ───
{
  const h = makeHarness()
  const a = h.state().addBox({ planetId: 'p', planetName: 'A', archetype: 'lava', element: 'fire' })
  const b = h.state().addBox({ planetId: 'p', planetName: 'B', archetype: 'ice', element: 'ice' })
  assert.equal(h.state().boxes.length, 2, 'Test 2: 2 boxes')
  assert.notEqual(a.id, b.id, 'Test 2: ids differ')
}

// ─── Test 3: rollBoxRarity unknown id → null ───
{
  const h = makeHarness()
  assert.equal(h.state().rollBoxRarity('unknown'), null, 'Test 3: unknown id → null')
}

// ─── Test 4: rollBoxRarity для opened box → null ───
{
  const h = makeHarness()
  const box = h.state().addBox({ planetId: 'p', planetName: 'A', archetype: 'lava', element: 'fire' })
  // mark opened manually (через store mutation; в реальности commitOpenedBox удаляет, но тест граничный case)
  // Используем openBox-like manual mark через filter+map approach. Проще: проверим, что после commitOpenedBox
  // box удалён → rollBoxRarity возвращает null (другой test path).
  h.state().commitOpenedBox(box.id, 'common')
  assert.equal(h.state().rollBoxRarity(box.id), null, 'Test 4: opened/removed box → null')
}

// ─── Test 5: rollBoxRarity returns {rarity, element} без mutation ───
{
  const h = makeHarness()
  const box = h.state().addBox({ planetId: 'p', planetName: 'A', archetype: 'lava', element: 'fire' })
  const before = JSON.stringify({
    serums: h.state().serums,
    pity: h.state().pityCounters,
    boxesLen: h.state().boxes.length,
  })
  const result = h.state().rollBoxRarity(box.id)
  assert(result !== null, 'Test 5: result not null')
  assert(['common', 'rare', 'epic', 'legendary'].includes(result!.rarity), 'Test 5: rarity is valid')
  assert.equal(result!.element, 'fire', 'Test 5: element=fire')
  const after = JSON.stringify({
    serums: h.state().serums,
    pity: h.state().pityCounters,
    boxesLen: h.state().boxes.length,
  })
  assert.equal(before, after, 'Test 5: rollBoxRarity must be pure (no mutations)')
}

// ─── Test 6: commitOpenedBox 'rare' → serums++, box removed, pity update ───
{
  const h = makeHarness()
  const box = h.state().addBox({ planetId: 'p', planetName: 'A', archetype: 'lava', element: 'fire' })
  const before = h.state().serums.fire.rare
  h.state().commitOpenedBox(box.id, 'rare')
  assert.equal(h.state().serums.fire.rare, before + 1, 'Test 6: fire rare incremented')
  assert.equal(h.state().boxes.length, 0, 'Test 6: box removed')
  assert.equal(h.state().pityCounters.rare, 0, 'Test 6: pity.rare reset on rare')
  assert(h.state().pityCounters.epic >= 1, 'Test 6: pity.epic incremented (rare not epic+)')
}

// ─── Test 7: commitOpenedBox unknown id → no-op ───
{
  const h = makeHarness()
  const before = JSON.stringify({
    serums: h.state().serums,
    pity: h.state().pityCounters,
  })
  h.state().commitOpenedBox('unknown', 'rare')
  const after = JSON.stringify({
    serums: h.state().serums,
    pity: h.state().pityCounters,
  })
  assert.equal(before, after, 'Test 7: unknown id no-op')
}

// ─── Test 8: commitOpenedBox 'legendary' → pity.legendary=0, others incremented ───
{
  const h = makeHarness()
  const box = h.state().addBox({ planetId: 'p', planetName: 'A', archetype: 'mystic', element: 'arcane' })
  h.state().commitOpenedBox(box.id, 'legendary')
  assert.equal(h.state().pityCounters.legendary, 0, 'Test 8: legendary resets legendary counter')
  assert.equal(h.state().serums.arcane.legendary, 1, 'Test 8: arcane legendary serum +1')
}

// ─── Test 9: removeBox filters by id ───
{
  const h = makeHarness()
  const a = h.state().addBox({ planetId: 'p', planetName: 'A', archetype: 'lava', element: 'fire' })
  const b = h.state().addBox({ planetId: 'p', planetName: 'B', archetype: 'ice', element: 'ice' })
  h.state().removeBox(a.id)
  assert.equal(h.state().boxes.length, 1, 'Test 9: 1 box left')
  assert.equal(h.state().boxes[0].id, b.id, 'Test 9: kept box B')
}

// ─── Test 10: bonusRarity carries through addBox + rollBoxRarity floor ───
{
  const h = makeHarness()
  const box = h.state().addBox({
    planetId: 'p', planetName: 'A', archetype: 'lava', element: 'fire',
    bonusRarity: 'epic',
  })
  assert.equal(box.bonusRarity, 'epic', 'Test 10: bonusRarity stored')
  // 100 rolls — все >= epic
  for (let i = 0; i < 100; i++) {
    const r = h.state().rollBoxRarity(box.id)
    assert(r !== null, 'Test 10: roll not null')
    assert(r!.rarity === 'epic' || r!.rarity === 'legendary',
      `Test 10: bonus epic should yield epic+, got ${r!.rarity}`)
  }
}

// ─── Test 11: hasOpenedAnyBox toggled на commitOpenedBox ───
{
  const h = makeHarness()
  assert.equal(h.state().hasOpenedAnyBox, false, 'Test 11a: default false')
  const box = h.state().addBox({ planetId: 'p', planetName: 'A', archetype: 'lava', element: 'fire' })
  h.state().commitOpenedBox(box.id, 'common')
  assert.equal(h.state().hasOpenedAnyBox, true, 'Test 11b: toggled after commit')
}

console.log('All slice tests passed.')
