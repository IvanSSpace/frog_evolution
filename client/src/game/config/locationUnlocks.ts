// Progressive location unlock — derived state from discoveredLevels.
//
// Болото (id=1) — всегда открыто.
// Остальные локации открываются когда соответствующий уровень лягушки
// впервые регистрируется в discoveredLevels. L25 — sentinel
// (см. MergeController: при merge L24+L24 вызывается markDiscovered(25)
// без материализации L25).
//
// См. spec: docs/superpowers/specs/2026-05-11-progressive-location-unlock-design.md

export const LOCATION_UNLOCK_THRESHOLD: Readonly<Record<number, number>> = {
  1: 0, // Болото — всегда открыто (0 = no threshold)
  2: 7, // Лес
  3: 13, // Континент
  4: 19, // Планета
  6: 25, // Звёздная карта (sentinel, merge L24+L24)
} as const

export const LOCATION_BY_TRIGGER_LEVEL: Readonly<Record<number, number>> = {
  7: 2,
  13: 3,
  19: 4,
  25: 6,
} as const

export function getUnlockedLocations(discovered: number[]): Set<number> {
  const unlocked = new Set<number>()
  for (const [locId, threshold] of Object.entries(LOCATION_UNLOCK_THRESHOLD)) {
    if (threshold === 0 || discovered.includes(threshold)) {
      unlocked.add(Number(locId))
    }
  }
  return unlocked
}

export function isLocationUnlocked(id: number, discovered: number[]): boolean {
  return getUnlockedLocations(discovered).has(id)
}

export function getLocationUnlockedByLevel(level: number): number | null {
  return LOCATION_BY_TRIGGER_LEVEL[level] ?? null
}
