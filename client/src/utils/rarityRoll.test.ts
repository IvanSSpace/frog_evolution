// Phase 15 Plan 15-01 Task 1: unit tests for rarityRoll.
// Run: npx tsx client/src/utils/rarityRoll.test.ts

import assert from 'node:assert/strict'
import { rollRarity, updatePity, RARITY_WEIGHTS, type PityState } from './rarityRoll'

const ZERO_PITY: PityState = { rare: 0, epic: 0, legendary: 0 }

// ─── Test 1: distribution within ±5% from 50/35/12/3 ───
{
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0 }
  const N = 10000
  for (let i = 0; i < N; i++) {
    const r = rollRarity(ZERO_PITY)
    counts[r]++
  }
  const cf = counts.common / N
  const rf = counts.rare / N
  const ef = counts.epic / N
  const lf = counts.legendary / N
  assert(Math.abs(cf - 0.5) < 0.05, `Test 1: common dist ${cf} not within ±5% of 0.5`)
  assert(Math.abs(rf - 0.35) < 0.05, `Test 1: rare dist ${rf} not within ±5% of 0.35`)
  assert(Math.abs(ef - 0.12) < 0.05, `Test 1: epic dist ${ef} not within ±5% of 0.12`)
  assert(Math.abs(lf - 0.03) < 0.04, `Test 1: legendary dist ${lf} not within ±4% of 0.03`)
}

// ─── Test 2: pity.legendary = 25 → guaranteed legendary ───
for (let i = 0; i < 200; i++) {
  const r = rollRarity({ rare: 0, epic: 0, legendary: 25 })
  assert.equal(r, 'legendary', `Test 2: expected legendary at pity 25, got ${r}`)
}

// ─── Test 3: pity.epic = 10 → epic or legendary ───
for (let i = 0; i < 200; i++) {
  const r = rollRarity({ rare: 0, epic: 10, legendary: 0 })
  assert(r === 'epic' || r === 'legendary', `Test 3: expected epic/legendary at pity.epic 10, got ${r}`)
}

// ─── Test 4: pity.rare = 3, no bonus → rare/epic/legendary ───
for (let i = 0; i < 200; i++) {
  const r = rollRarity({ rare: 3, epic: 0, legendary: 0 })
  assert(r === 'rare' || r === 'epic' || r === 'legendary',
    `Test 4: expected rare+ at pity.rare 3, got ${r}`)
}

// ─── Test 5: bonusRarity='epic' → result >= epic ───
for (let i = 0; i < 200; i++) {
  const r = rollRarity(ZERO_PITY, 'epic')
  assert(r === 'epic' || r === 'legendary',
    `Test 5: bonusRarity epic should yield epic+, got ${r}`)
}

// ─── Test 6: pity.legendary = 15 → soft boost legendary frequency >= ~5% ───
{
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0 }
  const N = 5000
  for (let i = 0; i < N; i++) {
    const r = rollRarity({ rare: 0, epic: 0, legendary: 15 })
    counts[r]++
  }
  // baseline 3% → boost +3% = 6%; ±2% jitter on 5000 samples
  assert(counts.legendary / N >= 0.04,
    `Test 6: soft boost (15) expected ≥4%, got ${counts.legendary / N}`)
}

// ─── Test 7-9: updatePity behavior ───
{
  const u1 = updatePity({ rare: 0, epic: 0, legendary: 0 }, 'common')
  assert.deepEqual(u1, { rare: 1, epic: 1, legendary: 1 }, 'Test 7: common increments all')

  const u2 = updatePity({ rare: 5, epic: 5, legendary: 5 }, 'rare')
  assert.deepEqual(u2, { rare: 0, epic: 6, legendary: 6 }, 'Test 8: rare resets rare, increments epic/legendary')

  const u3 = updatePity({ rare: 5, epic: 5, legendary: 5 }, 'legendary')
  assert.deepEqual(u3, { rare: 0, epic: 0, legendary: 0 }, 'Test 9: legendary resets all')
}

// ─── Test 10: epic resets rare/epic, increments legendary ───
{
  const u = updatePity({ rare: 5, epic: 5, legendary: 5 }, 'epic')
  assert.deepEqual(u, { rare: 0, epic: 0, legendary: 6 }, 'Test 10: epic resets rare/epic')
}

// ─── Test 11: RARITY_WEIGHTS sums to 100 ───
{
  const total = RARITY_WEIGHTS.common + RARITY_WEIGHTS.rare + RARITY_WEIGHTS.epic + RARITY_WEIGHTS.legendary
  assert.equal(total, 100, `Test 11: weights should sum to 100, got ${total}`)
}

console.log('All rarityRoll tests passed.')
