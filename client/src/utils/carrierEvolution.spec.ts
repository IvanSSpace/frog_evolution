// client/src/utils/carrierEvolution.spec.ts
// Pure type-level + value tests для carrierEvolution.ts.
// Запускается через `node -e "import('./dist/carrierEvolution.spec.js').then(m => m.run())"`
// после tsc compile (Phase 18 может перейти на vitest; пока — manual assert на CI).
//
// Этот файл TYPECHECKED через `tsc --noEmit` (он в client/src), но НЕ запускается
// автоматически. Cross-checked verify_carrier_evolution.cjs (Plan 17-01 Task 3).

import {
  TIER_RANGES,
  TIER_BUCKET_WEIGHTS,
  ceilingForBucket,
  bucketOfCeiling,
  rollBucket,
  shouldForceS,
  rollCeilingForCarrier,
  rollFeedOutcome,
  SUCCESS_RATE_BASE,
  type Bucket,
} from './carrierEvolution'
import type { CarrierData } from '../store/cosmic/types'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assertion failed: ${msg}`)
}

export function run(): void {
  // TIER_RANGES
  assert(
    TIER_RANGES.common.min === 1 && TIER_RANGES.common.max === 6,
    'TIER_RANGES.common',
  )
  assert(
    TIER_RANGES.rare.min === 7 && TIER_RANGES.rare.max === 12,
    'TIER_RANGES.rare',
  )
  assert(
    TIER_RANGES.epic.min === 13 && TIER_RANGES.epic.max === 18,
    'TIER_RANGES.epic',
  )
  assert(
    TIER_RANGES.legendary.min === 19 && TIER_RANGES.legendary.max === 24,
    'TIER_RANGES.legendary',
  )

  // weights sum to 100
  const sumW =
    TIER_BUCKET_WEIGHTS.S +
    TIER_BUCKET_WEIGHTS.A +
    TIER_BUCKET_WEIGHTS.B +
    TIER_BUCKET_WEIGHTS.C
  assert(sumW === 100, 'weights sum=100')

  // ceilingForBucket S/A/B
  assert(ceilingForBucket('common', 'S') === 6, 'common S=6')
  assert(ceilingForBucket('common', 'A') === 5, 'common A=5')
  assert(ceilingForBucket('common', 'B') === 4, 'common B=4')
  assert(ceilingForBucket('rare', 'S') === 12, 'rare S=12')
  assert(ceilingForBucket('legendary', 'S') === 24, 'leg S=24')

  // ceilingForBucket C with rng=()=>0 → lowest
  assert(ceilingForBucket('common', 'C', () => 0) === 1, 'common C lo=1')
  assert(ceilingForBucket('common', 'C', () => 0.999) === 3, 'common C hi=3')

  // bucketOfCeiling
  assert(bucketOfCeiling('common', 6) === 'S', 'bucket(6)=S')
  assert(bucketOfCeiling('common', 5) === 'A', 'bucket(5)=A')
  assert(bucketOfCeiling('common', 4) === 'B', 'bucket(4)=B')
  assert(bucketOfCeiling('common', 1) === 'C', 'bucket(1)=C')
  assert(bucketOfCeiling('common', 99) === 'C', 'bucket(99)=C defensive')

  // rollBucket with deterministic RNG
  const buckets: Bucket[] = [
    rollBucket(() => 0.0), // S
    rollBucket(() => 0.04), // S (r=4 < 5)
    rollBucket(() => 0.1), // A (r=10 < 20)
    rollBucket(() => 0.3), // B (r=30 < 50)
    rollBucket(() => 0.99), // C
  ]
  assert(
    buckets[0] === 'S' &&
      buckets[1] === 'S' &&
      buckets[2] === 'A' &&
      buckets[3] === 'B' &&
      buckets[4] === 'C',
    'rollBucket boundaries',
  )

  // shouldForceS — empty
  assert(shouldForceS([], 'common') === false, 'empty → false')

  // shouldForceS — 3 stabilized common bucket=C consecutive
  const c = (
    level: number,
    ceiling: number,
    stabilized: boolean,
    ts: number,
    rarity: 'common' | 'rare' = 'common',
  ): CarrierData => ({
    frogId: `f${ts}`,
    element: 'fire',
    rarity,
    level,
    feedCount: 5,
    stabilized,
    ceiling,
    rollHistory: [{ type: 'stabilize', timestamp: ts }],
  })
  // ceiling=2 → bucket=C для common (range 1-6, max-3=3, 2 ≤ 3)
  const carriers3C = [
    c(2, 2, true, 1000),
    c(3, 3, true, 2000),
    c(1, 1, true, 3000),
  ]
  assert(shouldForceS(carriers3C, 'common') === true, '3×C → forceS')

  // shouldForceS — different rarity → false
  assert(shouldForceS(carriers3C, 'rare') === false, 'rare uses own history')

  // shouldForceS — 1 of 3 has bucket=A (ceiling=5)
  const carriers2C1A = [
    c(2, 2, true, 1000),
    c(5, 5, true, 2000),
    c(3, 3, true, 3000),
  ]
  assert(shouldForceS(carriers2C1A, 'common') === false, '2C+1A → no force')

  // rollCeilingForCarrier — empty + rng=0 → S bucket → ceiling=6
  const r1 = rollCeilingForCarrier('common', [], () => 0)
  assert(
    r1.bucket === 'S' && r1.ceiling === 6 && r1.forced === false,
    'rollCeiling empty rng0 → S6',
  )

  // rollCeilingForCarrier — forced via streak
  const r2 = rollCeilingForCarrier('common', carriers3C, () => 0.99)
  assert(
    r2.forced === true && r2.bucket === 'S' && r2.ceiling === 6,
    'forced overrides rng',
  )

  // rollFeedOutcome
  const o1 = rollFeedOutcome(
    { level: 5, ceiling: 6, stabilized: false },
    () => 0,
  )
  assert(
    o1.result === 'success' && o1.newLevel === 6 && o1.newStabilized === false,
    'success rng0',
  )
  const o2 = rollFeedOutcome(
    { level: 6, ceiling: 6, stabilized: false },
    () => 0,
  )
  assert(
    o2.result === 'stabilize' && o2.newLevel === 6 && o2.newStabilized === true,
    'stabilize at ceiling',
  )
  const o3 = rollFeedOutcome(
    { level: 5, ceiling: 6, stabilized: true },
    () => 0,
  )
  assert(
    o3.result === 'stabilize' && o3.newStabilized === true,
    'pre-stabilized → stabilize idempotent',
  )
  const o4 = rollFeedOutcome(
    { level: 5, ceiling: 6, stabilized: false },
    () => 0.99,
  )
  assert(o4.result === 'fail' && o4.newLevel === 5, 'fail rng99')

  // SUCCESS_RATE_BASE locked
  assert(SUCCESS_RATE_BASE === 0.7, 'success rate locked 0.7')

  console.log('[carrierEvolution.spec] all assertions passed')
}
