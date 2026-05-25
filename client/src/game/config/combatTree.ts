// Combat upgrade tree — глобальная боевая прокачка (одно древо на аккаунт).
//
// 3 вертикальные ветки: Урон / Здоровье / Броня. Узлы открываются
// последовательно сверху вниз. Бонусы применяются ко ВСЕМ воинам игрока
// в createUnit (battleUnits.ts), только для side==='player'.
//
// Валюта — slime (боевой кошелёк, начисляется за победы в рейдах).
// Калибровка цен: рейд даёт ~800/4000/16000 slime по локациям.
//
// MVP client-прототип: трата валидируется локально (spendSlime), сервер позже.

export type CombatBranch = 'damage' | 'hp' | 'armor'

export const COMBAT_MAX_NODES = 8

export interface CombatBranchConfig {
  id: CombatBranch
  name: string
  emoji: string
  /** Прирост за один узел (для UI). */
  perNode: number
  /** 'pct' = проценты, 'flat' = плоское число. */
  unit: 'pct' | 'flat'
  /** Цена каждого узла (slime). Индекс = уровень, который покупаем (0 → 1-й узел). */
  costs: readonly number[]
}

// Общая эскалирующая кривая цен (slime) на 8 узлов.
const COST_CURVE = [800, 2000, 4500, 9000, 17000, 30000, 50000, 80000] as const

export const COMBAT_TREE: Record<CombatBranch, CombatBranchConfig> = {
  damage: {
    id: 'damage',
    name: 'Урон',
    emoji: '🗡',
    perNode: 6, // +6% урона за узел
    unit: 'pct',
    costs: COST_CURVE,
  },
  hp: {
    id: 'hp',
    name: 'Здоровье',
    emoji: '❤',
    perNode: 7, // +7% maxHP за узел
    unit: 'pct',
    costs: COST_CURVE,
  },
  armor: {
    id: 'armor',
    name: 'Броня',
    emoji: '🛡',
    perNode: 6, // +6 брони за узел (flat)
    unit: 'flat',
    costs: COST_CURVE,
  },
}

export const COMBAT_BRANCHES: readonly CombatBranch[] = [
  'damage',
  'hp',
  'armor',
]

/** Уровни узлов по веткам (0..COMBAT_MAX_NODES). */
export interface CombatTreeLevels {
  damage: number
  hp: number
  armor: number
}

export function defaultCombatTree(): CombatTreeLevels {
  return { damage: 0, hp: 0, armor: 0 }
}

// ─── Селекторы бонусов (применяются к player-юнитам) ──────────────────────

/** Множитель урона: 1 + 0.06 × level. */
export function combatDamageMult(level: number): number {
  return 1 + 0.06 * Math.max(0, level)
}

/** Множитель maxHP: 1 + 0.07 × level. */
export function combatHpMult(level: number): number {
  return 1 + 0.07 * Math.max(0, level)
}

/** Плоская броня: 6 × level. */
export function combatArmorFlat(level: number): number {
  return 6 * Math.max(0, level)
}

/**
 * Цена следующего узла ветки при текущем уровне.
 * @returns стоимость slime, либо null если ветка максимально прокачана.
 */
export function combatNodeCost(
  branch: CombatBranch,
  currentLevel: number,
): number | null {
  if (currentLevel >= COMBAT_MAX_NODES) return null
  return COMBAT_TREE[branch].costs[currentLevel] ?? null
}
