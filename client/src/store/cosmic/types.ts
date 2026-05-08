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
  // Phase 16: bonus rarity (additive к base rarity roll), 0..0.15. Optional —
  // старые saved boxes без поля рассматриваются как 0. Phase 15 cascade
  // читает это поле в slot-machine roll.
  bonusRarity?: number
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

// ===== Phase 16: ShipState discriminated union (REQ SHIP-01) =====
export interface ShipStateDocked {
  state: 'docked'
  planetId: string  // unique idx в planetMap.json (e.g. 'home')
}

export interface ShipStateTransit {
  state: 'transit'
  fromPlanetId: string  // для UI «В пути от X к Y»
  toPlanetId: string
  startedAt: number     // unix ms (Date.now())
  arrivesAt: number     // unix ms
}

export type ShipState = ShipStateDocked | ShipStateTransit

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
    lastResetDay: string  // ISO date 'YYYY-MM-DD' (LOCAL — Phase 16 fix CREW-03)
  }

  // Phase 14: serum tap-to-select / drag selection mode (transient UI state, НЕ persisted)
  serumDragActive: boolean
  selectedSerum: { element: Element; rarity: Rarity } | null

  // Phase 16: progressive disclosure flags (REQ UX-09).
  // gates Корабль tab; toggle при первом feed (Phase 17).
  hasFirstFeed: boolean
  // gates Боксы tab; toggle при первой completed mission (Phase 16).
  hasFirstMission: boolean
  // gates Бестиарий visualization; toggle при первом opened box (Phase 17/18).
  hasOpenedAnyBox: boolean

  // Phase 16: transient cached ship world position для redirect calc.
  // НЕ persisted в localStorage (init на null после load → re-derived из planetCoords).
  latestShipPos: { x: number; y: number } | null
}

export interface CosmicToastPayload {
  type:
    | 'scout-returned' | 'box-received' | 'mission-complete'
    | 'serum-applied' | 'serum-mistap' | 'generic'
  msg: string
  action?: {
    label: string
    onClick: () => void
  }
  // Если несколько событий за 1 сек → объединяются (COSMIC-HUB-06)
  count?: number
  // Phase 14 (SERUM-10): override default auto-hide ms (default 4000).
  duration?: number
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
    // Phase 14: transient UI state — defaults на load, не persisted.
    serumDragActive: false,
    selectedSerum: null,
    // Phase 16: progressive disclosure (REQ UX-09)
    hasFirstFeed: false,
    hasFirstMission: false,
    hasOpenedAnyBox: false,
    // Phase 16: transient ship position cache (used for redirect calc)
    latestShipPos: null,
  }
}
