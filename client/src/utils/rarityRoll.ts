// Phase 15: rarity roll utility для box-open flow.
// Locked weights 50/35/12/3 (REQ BALANCE-01..05).
// Pity guarantees: rare 3, epic 10, legendary hard 25 + soft 15/20.
// Phase 19 wire visible UI counter; здесь — invisible but functional.

import type { Rarity } from '../store/cosmic/types'

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 50,
  rare: 35,
  epic: 12,
  legendary: 3,
}

export interface PityState {
  rare: number      // боксов подряд без rare+ (3 → guarantee rare+)
  epic: number      // боксов подряд без epic+ (10 → guarantee epic+)
  legendary: number // боксов подряд без legendary (25 → hard; 15/20 → soft boost)
}

const ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary']

/**
 * Roll rarity для одного бокса.
 *
 * Priority order:
 *   1. Hard pity guarantees (BALANCE-03/04/05)
 *   2. Soft pity boost (BALANCE-05)
 *   3. Weighted random
 *   4. bonusRarity floor
 *
 * @param pity текущий pity state
 * @param bonusRarity optional mission perfect/good bonus floor
 * @param rng injectable RNG (default Math.random)
 * @returns rolled rarity. Caller обязан вызвать updatePity для обновления.
 */
export function rollRarity(
  pity: PityState,
  bonusRarity?: 'rare' | 'epic' | 'legendary',
  rng: () => number = Math.random,
): Rarity {
  // 1. Hard guarantees
  if (pity.legendary >= 25) return 'legendary'
  if (pity.epic >= 10) {
    // epic+ guarantee. bonusRarity epic/legendary effectively уже >= epic.
    return rollWeighted(rng, ['epic', 'legendary'], [80, 20])
  }
  if (pity.rare >= 3 && !bonusRarity) {
    // rare+ guarantee. bonusRarity rare уже floor; не overlap.
    return rollWeighted(rng, ['rare', 'epic', 'legendary'], [70, 25, 5])
  }

  // 2. Soft pity boost
  let weights = { ...RARITY_WEIGHTS }
  if (pity.legendary >= 20) {
    weights = { common: 45, rare: 33, epic: 12, legendary: 10 }   // +7%
  } else if (pity.legendary >= 15) {
    weights = { common: 48, rare: 34, epic: 12, legendary: 6 }    // +3%
  }

  // 3. Weighted random
  let rolled = weightedRandom(weights, rng)

  // 4. bonusRarity floor
  if (bonusRarity) {
    if (ORDER.indexOf(rolled) < ORDER.indexOf(bonusRarity)) {
      rolled = bonusRarity
    }
  }
  return rolled
}

/**
 * Update pity counters after a roll.
 * - rare: reset on rare+, increment on common
 * - epic: reset on epic+, increment on common/rare
 * - legendary: reset on legendary, increment on anything else
 */
export function updatePity(pity: PityState, rolled: Rarity): PityState {
  return {
    rare: rolled === 'common' ? pity.rare + 1 : 0,
    epic: rolled === 'common' || rolled === 'rare' ? pity.epic + 1 : 0,
    legendary: rolled === 'legendary' ? 0 : pity.legendary + 1,
  }
}

// ─── Internal helpers ───

function weightedRandom(w: Record<Rarity, number>, rng: () => number): Rarity {
  const total = w.common + w.rare + w.epic + w.legendary
  let r = rng() * total
  if ((r -= w.common) < 0) return 'common'
  if ((r -= w.rare) < 0) return 'rare'
  if ((r -= w.epic) < 0) return 'epic'
  return 'legendary'
}

function rollWeighted(rng: () => number, options: Rarity[], weights: number[]): Rarity {
  const total = weights.reduce((s, x) => s + x, 0)
  let r = rng() * total
  for (let i = 0; i < options.length; i++) {
    if ((r -= weights[i]) < 0) return options[i]
  }
  return options[options.length - 1]
}
