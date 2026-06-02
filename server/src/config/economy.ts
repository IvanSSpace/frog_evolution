// Server-side mirror of client economy logic.
// SYNC POINT: any change to FROG_ECONOMY / UPGRADE_CONFIG / getFrogPrice / getUpgradeCost
// MUST be mirrored in client/src/game/config/{frogs,upgrades}.ts.
// Future: extract to shared/ package.

// === Frog levels (only economy-relevant fields) ===
interface FrogEconomy {
  basePrice: number
  growthRate: number // multiplier per purchase (always 1.15)
  location: number // 1=Болото, 2=Лес, 3=Континент
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
// 2026-05-23: добавлены magnet2/magnet3 — магниты для L2/L3 (gate в UI после cosmos).
export type UpgradeKey =
  | 'dropSpeed'
  | 'gooCollector'
  | 'magnet'
  | 'magnet2'
  | 'magnet3'
  | 'crateQuality'
  | 'rareBoxSpeed'
  | 'ships'
  | 'autoCollect'
  | 'droneSlots'

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
  gooCollector: {
    maxLevel: 8,
    costs: [550, 3_500, 23_000, 250_000, 2_500_000, 25_000_000, 250_000_000, 2_500_000_000],
  },
  magnet: {
    maxLevel: 6,
    costs: [300_000, 1_000_000, 5_000_000, 50_000_000, 500_000_000, 5_000_000_000],
  },
  magnet2: {
    maxLevel: 6,
    costs: [300_000, 1_000_000, 5_000_000, 50_000_000, 500_000_000, 5_000_000_000],
  },
  magnet3: {
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
  // Космические корабли для экспедиций. maxLevel 3 = до 3 кораблей.
  // Покупка каждого гейтится прогрессией (SHIP_UNLOCK + shop.ts).
  ships: {
    maxLevel: 3,
    costs: [2_000_000, 200_000_000, 20_000_000_000],
  },
  // Автосбор: дрон на Болоте открывает обычные боксы онлайн.
  autoCollect: {
    maxLevel: 6,
    costs: [300_000, 1_500_000, 8_000_000, 60_000_000, 500_000_000, 4_000_000_000],
  },
  // Слоты дронов: докупаемые сверх 2 базовых (ёмкость до 8). SYNC с клиентом.
  droneSlots: {
    maxLevel: 6,
    costs: [
      10_000_000, 40_000_000, 150_000_000, 500_000_000, 1_500_000_000,
      4_000_000_000,
    ],
  },
}

// Прогрессивный анлок кораблей: чтобы купить корабль №(i+1), в discoveredLevels
// должен быть достигнут этот уровень. 7=Лес, 13=Континент, 19=L19-лягушка.
export const SHIP_UNLOCK: readonly number[] = [7, 13, 19]

// Открыт ли для покупки следующий корабль при текущем числе кораблей.
export function shipUnlocked(currentShips: number, discovered: number[]): boolean {
  const need = SHIP_UNLOCK[currentShips]
  if (need === undefined) return false
  const maxDiscovered = discovered.length ? Math.max(...discovered) : 0
  return maxDiscovered >= need
}

// Returns cost to buy next upgrade level (currentLevel → currentLevel+1).
// Returns Infinity if already at maxLevel.
export function getUpgradeCost(key: UpgradeKey, currentLevel: number): number {
  const cfg = UPGRADE_CONFIG[key]
  if (!cfg || currentLevel >= cfg.maxLevel) return Infinity
  return cfg.costs[currentLevel]
}

// === Goo Collector offline income ===

// MAX_INCOME_PER_SEC clamp for incomePerSec stored by client.
// L18 frog with poop interval ~2s → ~5.4e12 gold/sec at full 16-frog cap.
// 1e14 gives ~18x headroom — blocks absurd cheat values, doesn't trip legit play.
export const MAX_INCOME_PER_SEC = 1e14

// Goo Collector cap per level in milliseconds.
// Mirrored from client/src/game/config/upgrades.ts UPGRADE_CONFIG.gooCollector.capHours.
// SYNC POINT: coordinate changes with client.
// capHours: [0, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6] — index = goo collector level.
const GOO_COLLECTOR_CAP_HOURS = [0, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6] as const

export function getGooCollectorCapMs(level: number): number {
  const hours = GOO_COLLECTOR_CAP_HOURS[Math.min(level, GOO_COLLECTOR_CAP_HOURS.length - 1)]
  return hours * 3600 * 1000
}

// 2026-05-30: дроны автосбора (autoCollect>0) продолжают работать офлайн —
// +6ч к капу офлайн-дохода. «Онлайн-сбор» механика привязана к дронам.
export const DRONE_OFFLINE_BONUS_MS = 6 * 3600 * 1000

// === Offline box fill (перенос с клиента на сервер, AUDIT §2) ===
// SYNC POINT: зеркало client/src/game/config/upgrades.ts UPGRADE_CONFIG.dropSpeed.intervalMs
// и autoCollect.cooldownSec. Координировать изменения с клиентом.
const DROP_INTERVAL_MS = [10000, 7000, 5500, 4500, 3500, 2800, 2200, 1800, 1500] as const
const AUTO_COLLECT_COOLDOWN_SEC = [0, 20, 17, 14, 11, 8, 5] as const

export function getDropIntervalMs(level: number): number {
  return DROP_INTERVAL_MS[Math.min(Math.max(0, level), DROP_INTERVAL_MS.length - 1)]
}

export function getAutoCollectCooldownMs(level: number): number {
  const i = Math.min(Math.max(0, level), AUTO_COLLECT_COOLDOWN_SEC.length - 1)
  return AUTO_COLLECT_COOLDOWN_SEC[i] * 1000
}

// Кап числа боксов, выкладываемых за офлайн. Без капа долгий AFK → сотни боксов
// на поле (raw elapsed). 64 — щедро, но защищает от флуда поля.
export const OFFLINE_BOX_CAP = 64

// Считает сколько боксов накопилось за офлайн: спавн по dropSpeed минус собранные
// дронами автосбора (collectorDrones × циклы cooldown). Детерминированно от elapsedMs.
export function computeOfflineBoxes(
  elapsedMs: number,
  dropSpeedLevel: number,
  autoCollectLevel: number,
  collectorDrones: number,
): number {
  if (elapsedMs <= 0) return 0
  const dropInterval = getDropIntervalMs(dropSpeedLevel)
  const spawned = dropInterval > 0 ? Math.floor(elapsedMs / dropInterval) : 0
  const drones = autoCollectLevel > 0 ? Math.max(0, collectorDrones) : 0
  const cooldownMs = getAutoCollectCooldownMs(autoCollectLevel)
  const collected =
    drones > 0 && cooldownMs > 0 ? drones * Math.floor(elapsedMs / cooldownMs) : 0
  return Math.min(OFFLINE_BOX_CAP, Math.max(0, spawned - collected))
}

// Возвращает locationId куда переезжает лягушка level (1..18).
// L1-6 → Болото (1), L7-12 → Лес (2), L13-18 → Планета (3).
// Для L19 (sentinel) → не используется, special-case в merge endpoint.
export function getFrogLocation(level: number): number {
  if (level < 1 || level > MAX_LEVEL) return 1
  return FROG_ECONOMY[level - 1].location
}
