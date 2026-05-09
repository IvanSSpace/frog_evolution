#!/usr/bin/env node
// Phase 19-02 (BALANCE-08) — Monte Carlo simulation for box-open rarity distribution.
//
// MIRROR of client/src/utils/rarityRoll.ts (pure logic, no React/Phaser).
// Keep in sync — last verified against rarityRoll.ts: 2026-05-08 (Phase 19-02).
//
// ─── BASELINE NUMBERS (committed snapshot, seed = Math.random) ───
//
// IMPORTANT: avgLegendaryPer100 ≈ 5.5..6.5 — это **pity-effective** rate
// (hard 25 + soft 15/20 boost + epic-pity 10 spillover). Base weight = 3%, но
// после wiring всех pity guarantees effective rate ≈ 6%. Это не bug — это
// expected emergent behavior от Locked Decisions.
//
// 10K iterations (typical CI run, fresh Math.random):
//   pct.common=44.5 / pct.rare=35.5 / pct.epic=14.0 / pct.legendary=6.0 (±0.5)
//   avgLegendaryPer100 ≈ 5.8..6.1
//   pityHard25Breaches = 0  (must be 0)
//   legendaryGap: min=0, max=25, median≈17
//
// 100K iterations (high-confidence baseline, last run 2026-05-08):
//   pct.common=44.29 / pct.rare=35.34 / pct.epic=14.29 / pct.legendary=6.07
//   avgLegendaryPer100=6.073
//   pityHard25Breaches=0
//   legendaryGap: min=0, max=25, median=17
//   timeToFirstLegendary=25
//
// Acceptance bounds (in code below):
//   avgLegendaryPer100 ∈ [4.0, 7.0]   pity-effective range
//   pityHard25Breaches === 0          hard guarantee
//   legendaryGap.max ≤ 25             hard pity cap
//
// Last refresh: 2026-05-08 (Phase 19-02)
//
// Запуск:
//   node client/scripts/simulate_balance.cjs            # 10K default
//   node client/scripts/simulate_balance.cjs 100000     # 100K iterations
//
// Verify acceptance:
//   pct.legendary ∈ [2.7, 3.3]  (95% CI на 10K)
//   pityHard25Breaches === 0
//   legendaryGap.max ≤ 25

'use strict'

const RARITY_WEIGHTS = { common: 50, rare: 35, epic: 12, legendary: 3 }
const ORDER = ['common', 'rare', 'epic', 'legendary']

function weightedRandom(w, rng) {
  const total = w.common + w.rare + w.epic + w.legendary
  let r = rng() * total
  if ((r -= w.common) < 0) return 'common'
  if ((r -= w.rare) < 0) return 'rare'
  if ((r -= w.epic) < 0) return 'epic'
  return 'legendary'
}

function rollWeighted(rng, options, weights) {
  const total = weights.reduce((s, x) => s + x, 0)
  let r = rng() * total
  for (let i = 0; i < options.length; i++) {
    if ((r -= weights[i]) < 0) return options[i]
  }
  return options[options.length - 1]
}

function rollRarity(pity, bonusRarity, rng = Math.random) {
  // 1. Hard guarantees
  if (pity.legendary >= 25) return 'legendary'
  if (pity.epic >= 10) return rollWeighted(rng, ['epic', 'legendary'], [80, 20])
  if (pity.rare >= 3 && !bonusRarity) {
    return rollWeighted(rng, ['rare', 'epic', 'legendary'], [70, 25, 5])
  }

  // 2. Soft pity boost
  let weights = { ...RARITY_WEIGHTS }
  if (pity.legendary >= 20) {
    weights = { common: 45, rare: 33, epic: 12, legendary: 10 } // +7%
  } else if (pity.legendary >= 15) {
    weights = { common: 48, rare: 34, epic: 12, legendary: 6 } // +3%
  }

  // 3. Weighted random
  let rolled = weightedRandom(weights, rng)

  // 4. bonusRarity floor
  if (bonusRarity && ORDER.indexOf(rolled) < ORDER.indexOf(bonusRarity)) {
    rolled = bonusRarity
  }
  return rolled
}

function updatePity(pity, rolled) {
  return {
    rare: rolled === 'common' ? pity.rare + 1 : 0,
    epic: rolled === 'common' || rolled === 'rare' ? pity.epic + 1 : 0,
    legendary: rolled === 'legendary' ? 0 : pity.legendary + 1,
  }
}

// ─── Simulation harness ───

function runSimulation(iterations, rng = Math.random) {
  let pity = { rare: 0, epic: 0, legendary: 0 }
  const dist = { common: 0, rare: 0, epic: 0, legendary: 0 }
  let firstLegIdx = -1
  const legendaryGaps = []
  let consecNonLeg = 0
  let pityBreaches = 0

  for (let i = 0; i < iterations; i++) {
    // Track if pre-roll pity breaches hard 25 (should never happen).
    if (pity.legendary > 25) pityBreaches++

    const rolled = rollRarity(pity, undefined, rng)
    pity = updatePity(pity, rolled)
    dist[rolled]++

    if (rolled === 'legendary') {
      if (firstLegIdx < 0) firstLegIdx = i
      legendaryGaps.push(consecNonLeg)
      consecNonLeg = 0
    } else {
      consecNonLeg++
    }
  }

  const sortedGaps = [...legendaryGaps].sort((a, b) => a - b)
  const median = sortedGaps[Math.floor(sortedGaps.length / 2)] ?? 0

  return {
    iterations,
    distribution: dist,
    pct: {
      common: +((dist.common * 100) / iterations).toFixed(2),
      rare: +((dist.rare * 100) / iterations).toFixed(2),
      epic: +((dist.epic * 100) / iterations).toFixed(2),
      legendary: +((dist.legendary * 100) / iterations).toFixed(2),
    },
    avgLegendaryPer100: +((dist.legendary * 100) / iterations).toFixed(3),
    timeToFirstLegendary: firstLegIdx,
    pityHard25Breaches: pityBreaches,
    legendaryGap: {
      count: legendaryGaps.length,
      min: sortedGaps[0] ?? null,
      max: sortedGaps[sortedGaps.length - 1] ?? null,
      median,
    },
  }
}

// ─── Entry point ───

if (require.main === module) {
  const iterations = parseInt(process.argv[2] || '10000', 10)
  if (!Number.isFinite(iterations) || iterations < 100) {
    console.error('Usage: node simulate_balance.cjs [iterations >= 100]')
    process.exit(1)
  }
  const result = runSimulation(iterations)
  console.log(JSON.stringify(result, null, 2))

  // Acceptance asserts (Locked Decision baseline).
  // NOTE Phase 19-02: bounds widened к [4.0, 7.0] потому что effective
  // legendary rate включает pity guarantees (hard 25 → +4%, soft 15/20 boost,
  // epic-pity 10 → 20% leg). Base weight 3% — это до pity. Effective ≈ 5.5% при
  // фактическом play loop. Hard guarantees (max gap ≤ 25) — самое важное.
  const errors = []
  if (result.avgLegendaryPer100 < 4.0 || result.avgLegendaryPer100 > 7.0) {
    errors.push(
      `avgLegendaryPer100 ${result.avgLegendaryPer100} outside [4.0, 7.0] (pity-effective range)`,
    )
  }
  if (result.pityHard25Breaches !== 0) {
    errors.push(`pityHard25Breaches ${result.pityHard25Breaches} (expected 0)`)
  }
  if (result.legendaryGap.max != null && result.legendaryGap.max > 25) {
    errors.push(
      `legendaryGap.max ${result.legendaryGap.max} exceeds hard 25 cap`,
    )
  }

  if (errors.length > 0) {
    console.error('\nAcceptance FAILED:')
    for (const e of errors) console.error('  -', e)
    process.exit(2)
  }
  console.error(`\nAcceptance PASSED (${iterations} iterations)`)
}

module.exports = { rollRarity, updatePity, runSimulation }
