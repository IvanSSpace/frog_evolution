// Barracks / PvP raid mode state — Этап 1 (config + state).
//
// - barracksGrid: фиксированная сетка 5×4 = 20 клеток. Каждая клетка либо
//   null, либо хранит уровень жабы-воина (level → class через warriors.ts).
// - vats: 3 чана (по одному на каждую фарм-локацию). Накапливают slime со
//   временем, до cap'а (capacity). Захватываются при успешном raid'е.
// - barracksUnlocked: гейт после открытия Леса (L7 discovered).

export const BARRACKS_GRID_W = 4
export const BARRACKS_GRID_H = 5
export const BARRACKS_GRID_SIZE = BARRACKS_GRID_W * BARRACKS_GRID_H // 20
export const MAX_DECK_SIZE = 7 // сколько воинов идут в бой

// Верхние 3 ряда = «боевая колода». Эти 12 клеток (idx 0-11) подсвечиваются
// в UI и из них (максимум 7) отправляются на поле боя 4×3 player'a.
// Нижние 2 ряда (idx 12-19) = «резерв», в бой не идут.
export const BATTLE_DECK_ROWS = 3
export const BATTLE_DECK_SIZE = BATTLE_DECK_ROWS * BARRACKS_GRID_W // 12
export const RESERVE_START_IDX = BATTLE_DECK_SIZE // первая клетка резерва (12)

/** Возвращает true если индекс клетки в боевой зоне (верхние 3 ряда). */
export function isDeckSlot(idx: number): boolean {
  return idx >= 0 && idx < BATTLE_DECK_SIZE
}

/** Количество занятых клеток в боевой зоне. */
export function deckCount(grid: readonly (unknown | null)[]): number {
  let n = 0
  for (let i = 0; i < BATTLE_DECK_SIZE; i++) {
    if (grid[i] !== null && grid[i] !== undefined) n++
  }
  return n
}

export const VATS_COUNT = 3 // по одному на Болото/Лес/Континент
/** Максимальное время накопления = 6 часов (MVP). Расширяемо через upgrade. */
export const VAT_CAP_MS = 6 * 60 * 60 * 1000
/** Доля slime жертвы, которую может разграбить нападающий. */
export const RAID_LOOT_FRACTION = 0.8
/** Доля slime, остающаяся у жертвы после полного разграбления. */
export const RAID_REMAINS_FRACTION = 0.2

// ─── Types ────────────────────────────────────────────────────────────────

/** Одна клетка казармы. Если null — клетка пустая. */
export interface BarracksCell {
  /** Уровень исходной жабы (1..18). Класс выводится из warriors.ts. */
  level: number
  /** Tier эволюции (0/1/2) на момент конвертации. Влияет на статы. */
  tier: 0 | 1 | 2
  /** Когда добавлен в казарму — для будущих cooldown'ов / cosmetic. */
  addedAtMs: number
}

/** Один чан с slime. */
export interface Vat {
  /** Текущий накопленный slime. */
  slime: number
  /** Базовая capacity (per-level upgradeable; MVP = константа). */
  capacity: number
  /** Timestamp последнего accrual'а / claim'а — для расчёта прироста. */
  lastUpdateMs: number
}

// ─── Defaults ─────────────────────────────────────────────────────────────

export function defaultBarracksGrid(): (BarracksCell | null)[] {
  return new Array(BARRACKS_GRID_SIZE).fill(null)
}

/**
 * Базовая capacity чана.
 * MVP: фиксированная 10k. Можно расширить через upgrade позже
 * (capacityUpgrade level → ×1.5 множитель).
 */
export const DEFAULT_VAT_CAPACITY = 10_000

export function defaultVats(): Vat[] {
  const now = Date.now()
  return new Array(VATS_COUNT).fill(0).map(() => ({
    slime: 0,
    capacity: DEFAULT_VAT_CAPACITY,
    lastUpdateMs: now,
  }))
}

// ─── Validators (для legacy/corrupt save) ────────────────────────────────

export function validateBarracksGrid(
  raw: unknown,
): (BarracksCell | null)[] | null {
  if (!Array.isArray(raw)) return null
  if (raw.length !== BARRACKS_GRID_SIZE) return null
  const out: (BarracksCell | null)[] = []
  for (const cell of raw) {
    if (cell === null) {
      out.push(null)
      continue
    }
    if (
      typeof cell !== 'object' ||
      cell === null ||
      typeof (cell as BarracksCell).level !== 'number' ||
      (cell as BarracksCell).level < 1 ||
      (cell as BarracksCell).level > 18
    ) {
      return null
    }
    const c = cell as BarracksCell
    out.push({
      level: c.level,
      tier: (c.tier === 1 || c.tier === 2 ? c.tier : 0) as 0 | 1 | 2,
      addedAtMs: typeof c.addedAtMs === 'number' ? c.addedAtMs : Date.now(),
    })
  }
  return out
}

export function validateVats(raw: unknown): Vat[] | null {
  if (!Array.isArray(raw)) return null
  if (raw.length !== VATS_COUNT) return null
  const out: Vat[] = []
  const now = Date.now()
  for (const v of raw) {
    if (typeof v !== 'object' || v === null) return null
    const vat = v as Vat
    if (
      typeof vat.slime !== 'number' ||
      typeof vat.capacity !== 'number' ||
      typeof vat.lastUpdateMs !== 'number'
    ) {
      return null
    }
    out.push({
      slime: Math.max(0, vat.slime),
      capacity: Math.max(0, vat.capacity),
      lastUpdateMs: Math.min(now, vat.lastUpdateMs),
    })
  }
  return out
}
