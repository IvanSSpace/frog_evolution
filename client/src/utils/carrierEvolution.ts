// Phase 17: pure carrier evolution helpers.
// No side-effects — all functions accept injected RNG для testability.
//
// Used by:
//   - cosmic/slice.feedCarrier (Plan 17-02)
//   - cosmic/slice.mergeCarriers (Plan 17-05) → ceilingForBucket('S')
//   - components/CosmicHub/CeilingDisplay (Plan 17-03) → bucketOfCeiling
//   - StabilizationModal (Plan 17-04) → bucket label

import type { CarrierData, RollResult, Rarity } from '../store/cosmic/types'

/** Range уровней внутри каждого rarity tier (locked, REQ CARRIER-05). */
export const TIER_RANGES: Record<Rarity, { min: number; max: number }> = {
  common: { min: 1, max: 6 },
  rare: { min: 7, max: 12 },
  epic: { min: 13, max: 18 },
  legendary: { min: 19, max: 24 },
}

/** S=top, A=top-1, B=top-2, C=any of bottom 3 (locked, BALANCE-09). */
export type Bucket = 'S' | 'A' | 'B' | 'C'

export const TIER_BUCKET_WEIGHTS: Record<Bucket, number> = {
  S: 5,
  A: 15,
  B: 30,
  C: 50,
}

/** Concrete level из bucket. C → uniform random в нижних 3 уровнях tier. */
export function ceilingForBucket(
  rarity: Rarity,
  bucket: Bucket,
  rng: () => number = Math.random,
): number {
  const { min, max } = TIER_RANGES[rarity]
  switch (bucket) {
    case 'S':
      return max
    case 'A':
      return max - 1
    case 'B':
      return max - 2
    case 'C': {
      const lo = min
      const hi = max - 3
      return Math.floor(rng() * (hi - lo + 1)) + lo
    }
  }
}

/** Reverse: какой bucket принадлежит данному ceiling. Defensive — out-of-range → C. */
export function bucketOfCeiling(rarity: Rarity, ceiling: number): Bucket {
  const { min, max } = TIER_RANGES[rarity]
  if (ceiling === max) return 'S'
  if (ceiling === max - 1) return 'A'
  if (ceiling === max - 2) return 'B'
  if (ceiling >= min && ceiling <= max - 3) return 'C'
  return 'C' // defensive — tampered/invalid ceiling treated as worst
}

/** Weighted random bucket S/A/B/C with bias 5/15/30/50. */
export function rollBucket(rng: () => number = Math.random): Bucket {
  const r = rng() * 100
  if (r < TIER_BUCKET_WEIGHTS.S) return 'S'
  if (r < TIER_BUCKET_WEIGHTS.S + TIER_BUCKET_WEIGHTS.A) return 'A'
  if (r < TIER_BUCKET_WEIGHTS.S + TIER_BUCKET_WEIGHTS.A + TIER_BUCKET_WEIGHTS.B)
    return 'B'
  return 'C'
}

/**
 * Streak protection (REQ CARRIER-06, BALANCE-06):
 *   "3 last stabilized carriers того же rarity все имеют bucket=C"
 *    → forced 'S' bucket для следующего ceiling-roll того же rarity.
 *
 * History order: stabilized carriers сортированы по `last RollResult.timestamp` где
 * `result.type === 'stabilize'`. Carriers без stabilize-history excluded.
 */
export function shouldForceS(
  carriers: ReadonlyArray<CarrierData>,
  rarity: Rarity,
): boolean {
  const stabilized = carriers
    .filter(
      (c) => c.stabilized && c.rarity === rarity && c.ceiling !== undefined,
    )
    .map((c) => {
      const lastStab = (c.rollHistory ?? [])
        .filter(
          (r): r is RollResult & { type: 'stabilize' } =>
            r.type === 'stabilize',
        )
        .pop()
      return { c, ts: lastStab?.timestamp ?? 0 }
    })
    .filter((entry) => entry.ts > 0) // exclude stabilized без recorded timestamp
    .sort((a, b) => a.ts - b.ts)

  if (stabilized.length < 3) return false
  const lastThree = stabilized.slice(-3)
  return lastThree.every(
    ({ c }) => bucketOfCeiling(c.rarity, c.ceiling!) === 'C',
  )
}

/** Pre-determine ceiling для нового carrier при первом feed. */
export function rollCeilingForCarrier(
  rarity: Rarity,
  carriers: ReadonlyArray<CarrierData>,
  rng: () => number = Math.random,
): { ceiling: number; bucket: Bucket; forced: boolean } {
  const forced = shouldForceS(carriers, rarity)
  const bucket: Bucket = forced ? 'S' : rollBucket(rng)
  const ceiling = ceilingForBucket(rarity, bucket, rng)
  return { ceiling, bucket, forced }
}

/** Locked (REQ CARRIER-04): success rate. Phase 19 balance может tune'ить. */
export const SUCCESS_RATE_BASE = 0.7

export interface FeedOutcome {
  result: 'success' | 'fail' | 'stabilize'
  newLevel: number
  newStabilized: boolean
}

/**
 * Compute roll outcome для конкретного feed.
 * Invariant: если carrier.stabilized || level >= ceiling → 'stabilize' (idempotent).
 * Иначе rng < SUCCESS_RATE_BASE → 'success' (level+1) else 'fail'.
 *
 * NOTE: 'stabilize' помечается ТОЛЬКО если carrier УЖЕ был на ceiling до этого feed.
 * Если success этим feed'ом ДОВЁЛ до ceiling — outcome всё ещё 'success' (next feed
 * вернёт 'stabilize' и triggers modal).
 */
export function rollFeedOutcome(
  carrier: { level: number; ceiling: number; stabilized: boolean },
  rng: () => number = Math.random,
): FeedOutcome {
  if (carrier.stabilized || carrier.level >= carrier.ceiling) {
    return { result: 'stabilize', newLevel: carrier.level, newStabilized: true }
  }
  if (rng() < SUCCESS_RATE_BASE) {
    return {
      result: 'success',
      newLevel: carrier.level + 1,
      newStabilized: false,
    }
  }
  return { result: 'fail', newLevel: carrier.level, newStabilized: false }
}
