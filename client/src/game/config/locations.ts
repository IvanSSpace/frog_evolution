// Game locations (биомы): static config + lookup helper.

export interface LocationConfig {
  id: number
  name: string
  minLevel: number // first frog level that lives here
  maxLevel: number // last frog level
  magnetEnabled: boolean // is magnet upgrade usable on this location
}

export const LOCATIONS: readonly LocationConfig[] = [
  { id: 1, name: 'Лужа', minLevel: 1, maxLevel: 6, magnetEnabled: true },
  { id: 2, name: 'Болото', minLevel: 7, maxLevel: 12, magnetEnabled: false },
  { id: 3, name: 'Лес', minLevel: 13, maxLevel: 18, magnetEnabled: false },
  // Локация для покупки апгрейдов / зданий — не для размещения лягушек.
  // minLevel/maxLevel не используются (лягушки сюда не спавнятся), фоном служит map3.webp.
  {
    id: 4,
    name: 'Континент',
    minLevel: 19,
    maxLevel: 24,
    magnetEnabled: false,
  },
] as const

export function getLocationById(id: number): LocationConfig {
  return LOCATIONS.find((l) => l.id === id) ?? LOCATIONS[0]
}
