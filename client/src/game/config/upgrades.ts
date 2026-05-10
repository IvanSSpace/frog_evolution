// Upgrade tables and accessors. Pure data + helpers (no store, no side effects).
//
// Index = current level. intervalMs[i] / capHours[i] = effect at level i.
// costs[i] = price to buy next level (i → i+1).

export interface Upgrades {
  dropSpeed: number
  tractor: number
  magnet: number
  crateQuality: number
  rareBoxSpeed: number
}

export const UPGRADE_CONFIG = {
  dropSpeed: {
    maxLevel: 8,
    intervalMs: [10000, 7000, 5500, 4500, 3500, 2800, 2200, 1800, 1500],
    costs: [
      99, 3_000, 20_000, 130_000, 900_000, 5_800_000, 58_000_000, 580_000_000,
    ],
  },
  tractor: {
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
    radiusPx: [0, 120, 140, 160, 180, 200, 220],
    mergesPerCycle: [0, 1, 1, 2, 2, 3, 3],
    costs: [
      300_000, 1_000_000, 5_000_000, 50_000_000, 500_000_000, 5_000_000_000,
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

export function getTractorCapMs(level: number): number {
  const arr = UPGRADE_CONFIG.tractor.capHours
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

export function getMagnetRadius(level: number): number {
  const arr = UPGRADE_CONFIG.magnet.radiusPx
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
