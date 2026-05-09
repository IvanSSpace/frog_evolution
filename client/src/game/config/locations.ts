// Game locations (биомы): static config + lookup helper.

export interface LocationConfig {
  id: number
  name: string
  minLevel: number // first frog level that lives here
  maxLevel: number // last frog level
  magnetEnabled: boolean // is magnet upgrade usable on this location
}

export const LOCATIONS: readonly LocationConfig[] = [
  { id: 1, name: 'Болото', minLevel: 1, maxLevel: 6, magnetEnabled: true },
  { id: 2, name: 'Лес', minLevel: 7, maxLevel: 12, magnetEnabled: false },
  { id: 3, name: 'Земля', minLevel: 13, maxLevel: 18, magnetEnabled: false },
  { id: 4, name: 'Космос', minLevel: 19, maxLevel: 24, magnetEnabled: false },
] as const

export function getLocationById(id: number): LocationConfig {
  return LOCATIONS.find((l) => l.id === id) ?? LOCATIONS[0]
}
