// Upgrade tables and accessors. Pure data + helpers (no store, no side effects).
//
// Index = current level. intervalMs[i] / capHours[i] = effect at level i.
// costs[i] = price to buy next level (i → i+1).

export interface Upgrades {
  dropSpeed: number
  gooCollector: number
  magnet: number
  // 2026-05-23: магниты для L2 (Лес) и L3 (Континент) — отдельные апгрейды.
  // 2026-05-28: перенесены из косм. магазина в обычные улучшения.
  magnet2: number
  magnet3: number
  crateQuality: number
  rareBoxSpeed: number
  // Космос: число купленных кораблей (0-3). Гейтится прогрессией (SHIP_UNLOCK).
  ships: number
  // Автосбор: дрон на Болоте (локация 1) открывает обычные боксы онлайн.
  autoCollect: number
}

// Прогрессивный анлок кораблей: чтобы купить корабль №(i+1), max discoveredLevel
// должен достичь этого значения. 7=Лес, 13=Континент, 19=L19-лягушка.
// SYNC: дублируется в server/src/config/economy.ts.
export const SHIP_UNLOCK: readonly number[] = [7, 13, 19]

// Открыт ли для покупки следующий корабль при текущем числе кораблей.
export function shipUnlocked(
  currentShips: number,
  discovered: number[],
): boolean {
  const need = SHIP_UNLOCK[currentShips]
  if (need === undefined) return false
  const maxDiscovered = discovered.length ? Math.max(...discovered) : 0
  return maxDiscovered >= need
}

/** Безопасная конверсия "сырого" upgrades-объекта (например, с сервера) в Upgrades.
 *  Отсутствующие поля заполняются нулями. */
export function toUpgrades(
  raw: Record<string, number> | null | undefined,
): Upgrades {
  const r = raw ?? {}
  return {
    dropSpeed: r.dropSpeed ?? 0,
    gooCollector: r.gooCollector ?? r.tractor ?? 0,
    magnet: r.magnet ?? 0,
    magnet2: r.magnet2 ?? 0,
    magnet3: r.magnet3 ?? 0,
    crateQuality: r.crateQuality ?? 0,
    rareBoxSpeed: r.rareBoxSpeed ?? 0,
    ships: r.ships ?? 0,
    autoCollect: r.autoCollect ?? 0,
  }
}

// Helper: какой ключ апгрейда магнита соответствует данной локации.
export function magnetKeyForLocation(
  locationId: number,
): 'magnet' | 'magnet2' | 'magnet3' {
  if (locationId === 2) return 'magnet2'
  if (locationId === 3) return 'magnet3'
  return 'magnet'
}

export const UPGRADE_CONFIG = {
  dropSpeed: {
    maxLevel: 8,
    intervalMs: [10000, 7000, 5500, 4500, 3500, 2800, 2200, 1800, 1500],
    costs: [
      99, 3_000, 20_000, 130_000, 900_000, 5_800_000, 58_000_000, 580_000_000,
    ],
  },
  gooCollector: {
    maxLevel: 8,
    capHours: [0, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6],
    costs: [
      550, 3_500, 23_000, 250_000, 2_500_000, 25_000_000, 250_000_000,
      2_500_000_000,
    ],
  },
  magnet: {
    maxLevel: 6,
    spawnIntervalMs: [Infinity, 10000, 8000, 7000, 6000, 5000, 4000],
    durationMs: [0, 5000, 5500, 6000, 6500, 7000, 8000],
    // 2026-05-29: ровно 1 merge за цикл на всех уровнях (раньше lvl3+ делал
    // 2-3 — выглядело «странно», магнит перелетал и мерджил несколько пар).
    // Уровень теперь влияет только на частоту (spawnInterval) и duration.
    mergesPerCycle: [0, 1, 1, 1, 1, 1, 1],
    costs: [
      300_000, 1_000_000, 5_000_000, 50_000_000, 500_000_000, 5_000_000_000,
    ],
  },
  // 2026-05-23: магниты для L2/L3 — те же параметры что L1, но отдельный
  // upgrade pathway. 2026-05-28: доступны в обычной вкладке «Улучшения»
  // (раньше гейтились космосом). Backend гейта не имеет.
  // Градация цен: magnet (Болото) × 1.0, magnet2 (Лес) × 1.5,
  // magnet3 (Континент) × 2.5 — поздние локации = более ценный магнит.
  magnet2: {
    maxLevel: 6,
    spawnIntervalMs: [Infinity, 10000, 8000, 7000, 6000, 5000, 4000],
    durationMs: [0, 5000, 5500, 6000, 6500, 7000, 8000],
    mergesPerCycle: [0, 1, 1, 1, 1, 1, 1],
    costs: [
      450_000, 1_500_000, 7_500_000, 75_000_000, 750_000_000, 7_500_000_000,
    ],
  },
  magnet3: {
    maxLevel: 6,
    spawnIntervalMs: [Infinity, 10000, 8000, 7000, 6000, 5000, 4000],
    durationMs: [0, 5000, 5500, 6000, 6500, 7000, 8000],
    mergesPerCycle: [0, 1, 1, 1, 1, 1, 1],
    costs: [
      750_000, 2_500_000, 12_500_000, 125_000_000, 1_250_000_000,
      12_500_000_000,
    ],
  },
  crateQuality: {
    maxLevel: 5,
    // upgrade level → frog level dropped from box (0 = L1 default)
    frogLevel: [1, 2, 3, 4, 5, 6],
    costs: [5_000_000, 50_000_000, 500_000_000, 5_000_000_000, 50_000_000_000],
  },
  rareBoxSpeed: {
    maxLevel: 10,
    // counts[i] = threshold of opened normal boxes before mega-box at level i
    // 30 - 1.5*level rounded: 30→15 over 10 levels
    counts: [30, 29, 27, 26, 24, 23, 21, 20, 18, 17, 15],
    costs: [
      50_000, 150_000, 750_000, 3_800_000, 18_000_000, 90_000_000, 450_000_000,
      1_500_000_000, 6_000_000_000, 20_000_000_000,
    ],
  },
  // Космические корабли для экспедиций (покупка в космо-табе магазина прокачки).
  ships: {
    maxLevel: 3,
    costs: [2_000_000, 200_000_000, 20_000_000_000],
  },
  // Автосбор: дрон на Болоте, открывает обычные боксы онлайн.
  // cooldownSec[level] = кулдаун между открытиями (index 0 не используется).
  autoCollect: {
    maxLevel: 6,
    cooldownSec: [0, 20, 17, 14, 11, 8, 5] as readonly number[],
    costs: [
      300_000, 1_500_000, 8_000_000, 60_000_000, 500_000_000, 4_000_000_000,
    ],
  },
} as const

export const ENTITY_CAP = 16 // total cap of frogs + boxes on field

// ─── accessors ───────────────────────────────────────────────────────────────

export function getUpgradeCost(key: keyof Upgrades, level: number): number {
  const arr = UPGRADE_CONFIG[key].costs
  if (level >= arr.length) return Infinity
  return arr[level]
}

export function getDropIntervalMs(level: number): number {
  const arr = UPGRADE_CONFIG.dropSpeed.intervalMs
  return arr[Math.min(level, arr.length - 1)]
}

export function getGooCollectorCapMs(level: number): number {
  const arr = UPGRADE_CONFIG.gooCollector.capHours
  const hours = arr[Math.min(level, arr.length - 1)]
  return hours * 3600 * 1000
}

export function getMagnetSpawnInterval(level: number): number {
  const arr = UPGRADE_CONFIG.magnet.spawnIntervalMs
  return arr[Math.min(level, arr.length - 1)]
}

export function getMagnetDuration(level: number): number {
  const arr = UPGRADE_CONFIG.magnet.durationMs
  return arr[Math.min(level, arr.length - 1)]
}

export function getMagnetMergesPerCycle(level: number): number {
  const arr = UPGRADE_CONFIG.magnet.mergesPerCycle
  return arr[Math.min(level, arr.length - 1)]
}

export function getCrateLevel(upgradeLevel: number): number {
  const arr = UPGRADE_CONFIG.crateQuality.frogLevel
  return arr[Math.min(upgradeLevel, arr.length - 1)]
}

export function getRareBoxThreshold(upgradeLevel: number): number {
  const arr = UPGRADE_CONFIG.rareBoxSpeed.counts
  return arr[Math.min(upgradeLevel, arr.length - 1)]
}

export function getAutoCollectCooldownMs(level: number): number {
  const arr = UPGRADE_CONFIG.autoCollect.cooldownSec
  const clamped = Math.min(Math.max(0, level), arr.length - 1)
  return arr[clamped] * 1000
}
