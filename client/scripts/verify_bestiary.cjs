#!/usr/bin/env node
// Phase 18: verify bestiary helpers + milestone logic.
// Self-contained CommonJS — реплицирует bestiary.ts logic 1:1.
// Run: node client/scripts/verify_bestiary.cjs

const ELEMENTS = [
  'fire',
  'ice',
  'water',
  'forest',
  'toxic',
  'plasma',
  'shadow',
  'crystal',
  'desert',
  'gas',
  'ring',
  'binary',
  'arcane',
  'mechanical',
  'war',
  'void',
]
const RARITIES = ['common', 'rare', 'epic', 'legendary']
const BESTIARY_BIT_COUNT = 1536
const BESTIARY_BYTE_COUNT = 192

function bestiaryIndex(element, rarity, level) {
  const e = ELEMENTS.indexOf(element)
  const r = RARITIES.indexOf(rarity)
  if (e < 0 || r < 0 || level < 1 || level > 24) return -1
  return (level - 1) * 64 + e * 4 + r
}

function readBit(bitset, idx) {
  if (idx < 0 || idx >= BESTIARY_BIT_COUNT) return false
  const byte = bitset[idx >> 3] ?? 0
  return ((byte >> (idx & 7)) & 1) === 1
}

function setBit(bitset, idx) {
  if (idx < 0 || idx >= BESTIARY_BIT_COUNT) return bitset.slice()
  const byteIdx = idx >> 3
  const bitOffset = idx & 7
  const next = bitset.slice()
  while (next.length < BESTIARY_BYTE_COUNT) next.push(0)
  next[byteIdx] = (next[byteIdx] ?? 0) | (1 << bitOffset)
  return next
}

function countUnlocked(bitset) {
  let count = 0
  const limit = Math.min(bitset.length, BESTIARY_BYTE_COUNT)
  for (let i = 0; i < limit; i++) {
    let b = bitset[i] ?? 0
    while (b) {
      b &= b - 1
      count++
    }
  }
  return count
}

function unlockedInLocation(bitset, rarity) {
  let count = 0
  const r = RARITIES.indexOf(rarity)
  if (r < 0) return 0
  for (let level = 1; level <= 24; level++) {
    for (let e = 0; e < ELEMENTS.length; e++) {
      const idx = (level - 1) * 64 + e * 4 + r
      if (readBit(bitset, idx)) count++
    }
  }
  return count
}

const BESTIARY_MILESTONES = [
  { threshold: 10, reward: { type: 'coins', amount: 1000 } },
  { threshold: 24, reward: { type: 'serum', rarity: 'epic' } },
  { threshold: 96, reward: { type: 'serum', rarity: 'legendary' } },
  { threshold: 576, reward: { type: 'frog-exclusive' } },
]

function milestonesCrossed(prev, next) {
  if (next <= prev) return []
  return BESTIARY_MILESTONES.filter(
    (m) => prev < m.threshold && next >= m.threshold,
  )
}

// =================== TESTS ===================

function testCountUnlocked() {
  if (countUnlocked(new Array(192).fill(0)) !== 0)
    throw new Error('empty count != 0')
  if (countUnlocked(new Array(192).fill(0xff)) !== 1536)
    throw new Error('full count != 1536')
  // Legacy Phase 11 size (24 bytes): 24 × 8 = 192 bits
  if (countUnlocked(new Array(24).fill(0xff)) !== 192)
    throw new Error('legacy 24×8 != 192')
  let bs = new Array(192).fill(0)
  bs = setBit(bs, 0)
  if (countUnlocked(bs) !== 1) throw new Error('single bit count != 1')
  bs = setBit(bs, 100)
  if (countUnlocked(bs) !== 2) throw new Error('two bits count != 2')
  bs = setBit(bs, 0) // already set — but new array via slice; bit re-OR no count change
  if (countUnlocked(bs) !== 2) throw new Error('re-set bit affected count')
  console.log('[countUnlocked] PASS')
}

function testUnlockedInLocation() {
  let bs = new Array(192).fill(0)
  for (let i = 0; i < 5; i++) {
    bs = setBit(bs, bestiaryIndex(ELEMENTS[i], 'common', 1))
  }
  if (unlockedInLocation(bs, 'common') !== 5)
    throw new Error('common count != 5')
  if (unlockedInLocation(bs, 'rare') !== 0) throw new Error('rare count != 0')
  for (let i = 0; i < 3; i++) {
    bs = setBit(bs, bestiaryIndex(ELEMENTS[i], 'legendary', 24))
  }
  if (unlockedInLocation(bs, 'legendary') !== 3)
    throw new Error('legendary count != 3')
  if (unlockedInLocation(bs, 'common') !== 5)
    throw new Error('common changed unexpectedly')
  console.log('[unlockedInLocation] PASS')
}

function testMilestones() {
  // Cross 10 only
  let crossed = milestonesCrossed(9, 10)
  if (crossed.length !== 1 || crossed[0].threshold !== 10)
    throw new Error('cross 10 fail')
  // Cross 10 + 24 in one jump
  crossed = milestonesCrossed(9, 25)
  if (
    crossed.length !== 2 ||
    crossed[0].threshold !== 10 ||
    crossed[1].threshold !== 24
  ) {
    throw new Error('multi-cross fail')
  }
  // No cross
  if (milestonesCrossed(50, 60).length !== 0) throw new Error('no cross fail')
  // Cross 10/24/96 (576 not yet)
  crossed = milestonesCrossed(0, 100)
  if (crossed.length !== 3) throw new Error('triple cross fail')
  // Cross all 4
  crossed = milestonesCrossed(0, 600)
  if (crossed.length !== 4) throw new Error('all-4 cross fail')
  // Boundary: prev exactly at threshold should not retrigger
  if (milestonesCrossed(10, 11).length !== 0)
    throw new Error('boundary retrigger fail')
  // No-op when next < prev
  if (milestonesCrossed(100, 50).length !== 0)
    throw new Error('reverse direction fail')
  console.log('[milestones] PASS')
}

function testBitsetSize() {
  // setBit auto-pads legacy 24 → 192
  let bs = new Array(24).fill(0)
  bs = setBit(bs, 1500)
  if (bs.length !== 192)
    throw new Error(`setBit didn't pad to 192: got ${bs.length}`)
  if (countUnlocked(bs) !== 1) throw new Error('after pad, count wrong')
  // Boundary: idx 1535 (last valid)
  bs = new Array(192).fill(0)
  bs = setBit(bs, 1535)
  if (!readBit(bs, 1535)) throw new Error('bit 1535 not set')
  // Boundary: idx 1536 (out of range) — should be no-op
  bs = setBit(bs, 1536)
  if (countUnlocked(bs) !== 1)
    throw new Error('out-of-range idx affected count')
  console.log('[bitset size] PASS')
}

try {
  testCountUnlocked()
  testUnlockedInLocation()
  testMilestones()
  testBitsetSize()
  console.log('\nALL BESTIARY TESTS PASSED ✓')
  process.exit(0)
} catch (e) {
  console.error('FAIL:', e.message)
  process.exit(1)
}
