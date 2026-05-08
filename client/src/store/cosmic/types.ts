// Cosmic Frogs System — типы для Phase 11+
// Pure types + constants. Не импортирует из gameStore (избегаем циклов).

export type Element =
  | 'fire' | 'ice' | 'water' | 'forest' | 'toxic' | 'plasma'
  | 'shadow' | 'crystal' | 'desert' | 'gas' | 'ring' | 'binary'
  | 'arcane' | 'mechanical' | 'war' | 'void'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export const ELEMENTS: readonly Element[] = [
  'fire', 'ice', 'water', 'forest', 'toxic', 'plasma',
  'shadow', 'crystal', 'desert', 'gas', 'ring', 'binary',
  'arcane', 'mechanical', 'war', 'void',
]

export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary']

// Placeholder структуры — наполняются в Phase 14/15/16/17
export interface BoxData {
  id: string
  element: Element
  opened: boolean
  sourceArchetype?: string  // планета-источник (Phase 16)
}

export interface ScoutData {
  id: string
  missionId: string
  returnsAt: number  // unix ms
  planetId: string
}

export interface CarrierData {
  frogId: string
  element: Element
  rarity: Rarity
  feedCount: number
  stabilized: boolean
  // Phase 12+: опциональный уровень лягушки на момент привязки сыворотки.
  // Phase 12 manager не использует это поле; добавлено для будущей логики (Phase 17 evolution).
  level?: number
}

export interface ShipState {
  state: 'docked' | 'transit'
  dockedAt?: string         // planetId при docked
  from?: string             // planetId при transit
  to?: string               // planetId при transit
  startedAt?: number        // unix ms при transit
  arrivesAt?: number        // unix ms при transit
}

export interface PityCounters {
  common: number    // боксов без гарантии common (всегда 0, placeholder)
  rare: number      // боксов подряд без rare+
  epic: number      // боксов подряд без epic+
  legendary: number // боксов подряд без legendary
}

export type CosmicTab = 'scouts' | 'boxes' | 'serums' | 'bestiary'

export interface CosmicSlice {
  // Инвентарь сывороток: Record<Element, Record<Rarity, count>>
  serums: Record<Element, Record<Rarity, number>>

  // Инвентарь боксов (Phase 15)
  boxes: BoxData[]

  // Скауты в полёте (Phase 16)
  scouts: ScoutData[]

  // Корабль (Phase 16)
  ship: ShipState | null

  // Карьеры (Phase 14/17)
  carriers: CarrierData[]

  // Бестиарий bitset: 24 байта = 192 бита (placeholder Phase 18; финал — 1536 ячеек)
  // Хранится как number[] (JSON-serializable). Восстанавливается в Uint8Array при использовании.
  bestiaryBitset: number[]  // length = 24

  // Pity counters (Phase 19)
  pityCounters: PityCounters

  // UI: последний активный таб (sessionStorage, не persist в localStorage)
  lastActiveTab: CosmicTab

  // Crew (Phase 16)
  crew: {
    missionsToday: number
    lastResetDay: string  // ISO date 'YYYY-MM-DD'
  }
}

export interface CosmicToastPayload {
  type: 'scout-returned' | 'box-received' | 'mission-complete' | 'generic'
  msg: string
  action?: {
    label: string
    onClick: () => void
  }
  // Если несколько событий за 1 сек → объединяются (COSMIC-HUB-06)
  count?: number
}

// Фабрика начального состояния
export function makeInitialCosmicSlice(): CosmicSlice {
  // Инициализация serums: все 16 × 4 = 0
  const serums = {} as Record<Element, Record<Rarity, number>>
  for (const el of ELEMENTS) {
    serums[el] = { common: 0, rare: 0, epic: 0, legendary: 0 }
  }
  return {
    serums,
    boxes: [],
    scouts: [],
    ship: null,
    carriers: [],
    bestiaryBitset: new Array(24).fill(0),  // 192 bits, все нули
    pityCounters: { common: 0, rare: 0, epic: 0, legendary: 0 },
    lastActiveTab: 'scouts',
    crew: { missionsToday: 0, lastResetDay: '' },
  }
}
