// Phase 15: rarity roll utility для box-open flow.
// Weights 70/20/8/2 (BALANCE rebalance: common должен падать чаще редких).
// Pity guarantees: rare 8, epic 20, legendary hard 40 + soft 28/35.
// Phase 19-01: WIRED into cosmic/slice.openBox (BALANCE-01..07).
//              PityState shape синхронизирован с PityCounters (без common поля).
//              При изменении shape — синхронизировать оба места + simulate_balance.cjs.

import type { Rarity } from '../store/cosmic/types'

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 70,
  rare: 20,
  epic: 8,
  legendary: 2,
}

export interface PityState {
  rare: number // боксов подряд без rare+ (8 → guarantee rare+)
  epic: number // боксов подряд без epic+ (20 → guarantee epic+)
  legendary: number // боксов подряд без legendary (40 → hard; 28/35 → soft boost)
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
  if (pity.legendary >= 40) return 'legendary'
  if (pity.epic >= 20) {
    // epic+ guarantee. bonusRarity epic/legendary effectively уже >= epic.
    return rollWeighted(rng, ['epic', 'legendary'], [80, 20])
  }
  if (pity.rare >= 8 && !bonusRarity) {
    // rare+ guarantee. bonusRarity rare уже floor; не overlap.
    return rollWeighted(rng, ['rare', 'epic', 'legendary'], [70, 25, 5])
  }

  // 2. Soft pity boost (legendary)
  let weights = { ...RARITY_WEIGHTS }
  if (pity.legendary >= 35) {
    weights = { common: 55, rare: 18, epic: 14, legendary: 13 } // сильный буст
  } else if (pity.legendary >= 28) {
    weights = { common: 63, rare: 19, epic: 10, legendary: 8 } // умеренный буст
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

function rollWeighted(
  rng: () => number,
  options: Rarity[],
  weights: number[],
): Rarity {
  const total = weights.reduce((s, x) => s + x, 0)
  let r = rng() * total
  for (let i = 0; i < options.length; i++) {
    if ((r -= weights[i]) < 0) return options[i]
  }
  return options[options.length - 1]
}
