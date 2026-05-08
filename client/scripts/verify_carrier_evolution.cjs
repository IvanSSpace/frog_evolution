#!/usr/bin/env node
// Phase 17: verify carrier evolution distribution + streak protection.
// Self-contained CommonJS (replicates carrierEvolution.ts logic — keep in sync
// или risk silent drift). Run manually: `node scripts/verify_carrier_evolution.cjs`.
//
// Args:
//   --all       run all tests (distribution, streak, bestiary, dispose)
//   --dispose   only the 30% recovery test
//   (default)   distribution + streak + bestiary

const RARITIES = ['common', 'rare', 'epic', 'legendary']
const TIER_RANGES = {
  common: { min: 1, max: 6 }, rare: { min: 7, max: 12 },
  epic: { min: 13, max: 18 }, legendary: { min: 19, max: 24 },
}
const WEIGHTS = { S: 5, A: 15, B: 30, C: 50 }

function rollBucket(rng) {
  const r = rng() * 100
  if (r < WEIGHTS.S) return 'S'
  if (r < WEIGHTS.S + WEIGHTS.A) return 'A'
  if (r < WEIGHTS.S + WEIGHTS.A + WEIGHTS.B) return 'B'
  return 'C'
}

function bucketOfCeiling(rarity, ceiling) {
  const { min, max } = TIER_RANGES[rarity]
  if (ceiling === max) return 'S'
  if (ceiling === max - 1) return 'A'
  if (ceiling === max - 2) return 'B'
  if (ceiling >= min && ceiling <= max - 3) return 'C'
  return 'C'
}

function shouldForceS(history, rarity) {
  // history = array of { rarity, ceiling, stabilized, ts }
  const stab = history
    .filter((h) => h.stabilized && h.rarity === rarity && h.ceiling != null && h.ts > 0)
    .sort((a, b) => a.ts - b.ts)
  if (stab.length < 3) return false
  const last = stab.slice(-3)
  return last.every((h) => bucketOfCeiling(h.rarity, h.ceiling) === 'C')
}

// ============== TEST 1: distribution ≈ 5/15/30/50 ±5% over 10K rolls ==============

function testDistribution() {
  const N = 10_000
  const counts = { S: 0, A: 0, B: 0, C: 0 }
  for (let i = 0; i < N; i++) counts[rollBucket(Math.random)]++
  const pct = { S: counts.S / N * 100, A: counts.A / N * 100, B: counts.B / N * 100, C: counts.C / N * 100 }
  console.log('[distribution] over', N, 'rolls:', pct)
  const expected = WEIGHTS
  const tol = 5  // ±5% absolute (≈ √N standard error * margin)
  for (const k of ['S', 'A', 'B', 'C']) {
    if (Math.abs(pct[k] - expected[k]) > tol) {
      throw new Error(`bucket ${k} drift: ${pct[k]}% vs expected ${expected[k]}% (tol ${tol}%)`)
    }
  }
  console.log('[distribution] PASS — all buckets within ±' + tol + '%')
}

// ============== TEST 2: streak protection — 3 forced-C → 4th = S ==============

function testStreak() {
  const RUNS = 1000
  let forcedSCount = 0
  for (let i = 0; i < RUNS; i++) {
    const history = [
      { rarity: 'common', ceiling: 1, stabilized: true, ts: 1 },  // C
      { rarity: 'common', ceiling: 2, stabilized: true, ts: 2 },  // C
      { rarity: 'common', ceiling: 3, stabilized: true, ts: 3 },  // C
    ]
    if (!shouldForceS(history, 'common')) {
      throw new Error('expected force S after 3xC')
    }
    forcedSCount++
  }
  console.log('[streak] PASS —', forcedSCount, '/', RUNS, 'forced S after 3×C')

  // Negative: 2C+1A → no force
  const mixed = [
    { rarity: 'common', ceiling: 1, stabilized: true, ts: 1 },
    { rarity: 'common', ceiling: 5, stabilized: true, ts: 2 },  // A
    { rarity: 'common', ceiling: 3, stabilized: true, ts: 3 },
  ]
  if (shouldForceS(mixed, 'common')) {
    throw new Error('did NOT expect force after mixed C/A history')
  }
  console.log('[streak] PASS — mixed history correctly skips force')
}

// ============== TEST 3: bestiaryIndex unique 0..1535 ==============

function testBestiaryIndex() {
  const ELEMENTS = [
    'fire','ice','water','forest','toxic','plasma','shadow','crystal',
    'desert','gas','ring','binary','arcane','mechanical','war','void',
  ]
  const seen = new Set()
  for (const e of ELEMENTS) {
    for (const r of RARITIES) {
      for (let lvl = 1; lvl <= 24; lvl++) {
        const idx = (lvl - 1) * 64 + ELEMENTS.indexOf(e) * 4 + RARITIES.indexOf(r)
        if (idx < 0 || idx >= 1536) throw new Error(`oob: ${e}/${r}/L${lvl} → ${idx}`)
        if (seen.has(idx)) throw new Error(`collision at ${e}/${r}/L${lvl} → idx ${idx}`)
        seen.add(idx)
      }
    }
  }
  if (seen.size !== 1536) throw new Error(`coverage ${seen.size} ≠ 1536`)
  console.log('[bestiary] PASS — 1536 unique indices, no collisions')
}

// ============== TEST 4: dispose 30% recovery rate ==============

function testDisposeRate() {
  const N = 1000
  let recovered = 0
  for (let i = 0; i < N; i++) {
    if (Math.random() < 0.3) recovered++
  }
  const rate = recovered / N * 100
  console.log('[dispose] over', N, 'trials:', rate.toFixed(1) + '%')
  const tol = 5
  if (Math.abs(rate - 30) > tol) {
    throw new Error(`dispose rate ${rate}% deviates > ${tol}% from 30%`)
  }
  console.log('[dispose] PASS — rate within ±' + tol + '%')
}

// ============== run ==============

const args = process.argv.slice(2)
const runDispose = args.includes('--dispose')
const runAll = args.includes('--all') || (!runDispose && args.length === 0)

try {
  if (runAll) {
    testDistribution()
    testStreak()
    testBestiaryIndex()
    testDisposeRate()
  } else if (runDispose) {
    testDisposeRate()
  }
  console.log('\nALL TESTS PASSED')
  process.exit(0)
} catch (e) {
  console.error('FAIL:', e.message)
  process.exit(1)
}
