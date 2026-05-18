// Server-side mirror of client economy logic.
// SYNC POINT: any change to FROG_ECONOMY / UPGRADE_CONFIG / getFrogPrice / getUpgradeCost
// MUST be mirrored in client/src/game/config/{frogs,upgrades}.ts.
// Future: extract to shared/ package.

// === Frog levels (only economy-relevant fields) ===
interface FrogEconomy {
  basePrice: number
  growthRate: number // multiplier per purchase (always 1.15)
  location: number // 1=Лужа, 2=Болото, 3=Лес
  availableInShop: boolean
}

// Copied from client/src/game/config/frogs.ts FROG_LEVELS.
// Order matches level (index 0 = L1, index 17 = L18).
export const FROG_ECONOMY: readonly FrogEconomy[] = [
  // Цены по формуле: basePrice(T) = round(560 × 2.8^(T-1)), growthRate = 1.15.
  // ─── Лужа (L1-6) ───
  { basePrice: 560, growthRate: 1.15, location: 1, availableInShop: true },           /* 2.8^0  */
  { basePrice: 1_568, growthRate: 1.15, location: 1, availableInShop: true },         /* 2.8^1  */
  { basePrice: 4_390, growthRate: 1.15, location: 1, availableInShop: true },         /* 2.8^2  */
  { basePrice: 12_293, growthRate: 1.15, location: 1, availableInShop: true },        /* 2.8^3  */
  { basePrice: 34_421, growthRate: 1.15, location: 1, availableInShop: true },        /* 2.8^4  */
  { basePrice: 96_378, growthRate: 1.15, location: 1, availableInShop: true },        /* 2.8^5  */
  // ─── Болото (L7-12) ───
  { basePrice: 269_859, growthRate: 1.15, location: 2, availableInShop: true },       /* 2.8^6  */
  { basePrice: 755_604, growthRate: 1.15, location: 2, availableInShop: true },       /* 2.8^7  */
  { basePrice: 2_115_691, growthRate: 1.15, location: 2, availableInShop: true },     /* 2.8^8  */
  { basePrice: 5_923_935, growthRate: 1.15, location: 2, availableInShop: true },     /* 2.8^9  */
  { basePrice: 16_587_019, growthRate: 1.15, location: 2, availableInShop: true },    /* 2.8^10 */
  { basePrice: 46_443_653, growthRate: 1.15, location: 2, availableInShop: true },    /* 2.8^11 */
  // ─── Лес (L13-18) — original 3-этап values (rounded round numbers,
  // restored from commit pre-2d6f2cb). Formula approx 560 × 2.8^(T-1). ───
  { basePrice: 130_000_000, growthRate: 1.15, location: 3, availableInShop: true },
  { basePrice: 364_100_000, growthRate: 1.15, location: 3, availableInShop: true },
  { basePrice: 1_000_000_000, growthRate: 1.15, location: 3, availableInShop: true },
  { basePrice: 2_900_000_000, growthRate: 1.15, location: 3, availableInShop: true },
  { basePrice: 8_000_000_000, growthRate: 1.15, location: 3, availableInShop: true },
  { basePrice: 22_400_000_000, growthRate: 1.15, location: 3, availableInShop: true },
]

export const MAX_LEVEL = FROG_ECONOMY.length // = 18

// Total cap of frogs on the field (same as ENTITY_CAP in client/src/game/config/upgrades.ts).
export const ENTITY_CAP = 16

export function getFrogPrice(level: number, purchases: number): number {
  if (level < 1 || level > MAX_LEVEL) return Infinity
  const cfg = FROG_ECONOMY[level - 1]
  return Math.floor(cfg.basePrice * Math.pow(cfg.growthRate, purchases))
}

// === Upgrades ===
export type UpgradeKey =
  | 'dropSpeed'
  | 'tractor'
  | 'magnet'
  | 'crateQuality'
  | 'rareBoxSpeed'

interface UpgradeCfg {
  maxLevel: number
  costs: readonly number[] // costs[i] = price to go from level i to i+1
}

// Copied from client/src/game/config/upgrades.ts UPGRADE_CONFIG.
// Only validation-relevant fields: maxLevel and costs array.
export const UPGRADE_CONFIG: Readonly<Record<UpgradeKey, UpgradeCfg>> = {
  dropSpeed: {
    maxLevel: 8,
    costs: [99, 3_000, 20_000, 130_000, 900_000, 5_800_000, 58_000_000, 580_000_000],
  },
  tractor: {
    maxLevel: 8,
    costs: [550, 3_500, 23_000, 250_000, 2_500_000, 25_000_000, 250_000_000, 2_500_000_000],
  },
  magnet: {
    maxLevel: 6,
    costs: [300_000, 1_000_000, 5_000_000, 50_000_000, 500_000_000, 5_000_000_000],
  },
  crateQuality: {
    maxLevel: 5,
    costs: [5_000_000, 50_000_000, 500_000_000, 5_000_000_000, 50_000_000_000],
  },
  rareBoxSpeed: {
    maxLevel: 10,
    costs: [
      50_000, 150_000, 750_000, 3_800_000, 18_000_000, 90_000_000, 450_000_000,
      1_500_000_000, 6_000_000_000, 20_000_000_000,
    ],
  },
}

// Returns cost to buy next upgrade level (currentLevel → currentLevel+1).
// Returns Infinity if already at maxLevel.
export function getUpgradeCost(key: UpgradeKey, currentLevel: number): number {
  const cfg = UPGRADE_CONFIG[key]
  if (!cfg || currentLevel >= cfg.maxLevel) return Infinity
  return cfg.costs[currentLevel]
}

// === Tractor offline income ===

// MAX_INCOME_PER_SEC clamp for incomePerSec stored by client.
// L18 frog with poop interval ~2s → ~5.4e12 gold/sec at full 16-frog cap.
// 1e14 gives ~18x headroom — blocks absurd cheat values, doesn't trip legit play.
export const MAX_INCOME_PER_SEC = 1e14

// Tractor cap per level in milliseconds.
// Mirrored from client/src/game/config/upgrades.ts UPGRADE_CONFIG.tractor.capHours.
// SYNC POINT: coordinate changes with client.
// capHours: [0, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6] — index = tractor level.
const TRACTOR_CAP_HOURS = [0, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6] as const

export function getTractorCapMs(level: number): number {
  const hours = TRACTOR_CAP_HOURS[Math.min(level, TRACTOR_CAP_HOURS.length - 1)]
  return hours * 3600 * 1000
}

// Возвращает locationId куда переезжает лягушка level (1..18).
// L1-6 → Болото (1), L7-12 → Лес (2), L13-18 → Планета (3).
// Для L19 (sentinel) → не используется, special-case в merge endpoint.
export function getFrogLocation(level: number): number {
  if (level < 1 || level > MAX_LEVEL) return 1
  return FROG_ECONOMY[level - 1].location
}
