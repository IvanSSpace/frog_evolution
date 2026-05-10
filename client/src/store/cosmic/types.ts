// Cosmic Frogs System — типы для Phase 11+
// Pure types + constants. Не импортирует из gameStore (избегаем циклов).

export type Element =
  | 'fire'
  | 'ice'
  | 'water'
  | 'forest'
  | 'toxic'
  | 'plasma'
  | 'shadow'
  | 'crystal'
  | 'desert'
  | 'gas'
  | 'ring'
  | 'binary'
  | 'arcane'
  | 'mechanical'
  | 'war'
  | 'void'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export const ELEMENTS: readonly Element[] = [
  'fire',
  'ice',
  'water',
  'forest',
  'toxic',
  'plasma',
  'shadow',
  'crystal',
  'desert',
  'gas',
  'ring',
  'binary',
  'arcane',
  'mechanical',
  'war',
  'void',
]

export const RARITIES: readonly Rarity[] = [
  'common',
  'rare',
  'epic',
  'legendary',
]

// Phase 15 (REQ BOX-01): полный shape для inventory + cascade reveal flow.
// Phase 11 stub имел { id, element, opened, sourceArchetype? } — расширено
// до 8 полей (planetId/planetName/archetype/createdAt/bonusRarity).
// STORAGE_VERSION 17 wipes Phase 11 boxes на load (clean migration).
export interface BoxData {
  id: string
  planetId: string // origin planet (Phase 16 source)
  planetName: string // отображается в BoxesTab («С KEPLER»)
  archetype: string // BG archetype или main race key
  element: Element // computed at addBox via elementFromPlanet
  opened: boolean // marked true при slot-machine reveal start
  createdAt: number // unix ms — sortable «недавно полученные»
  bonusRarity?: 'rare' | 'epic' | 'legendary' // optional mission perfect-bonus floor (REQ MISSION-03)
  // Legacy Phase 11 поле — оставлено для backward compat parsing; deprecated.
  sourceArchetype?: string
}

/**
 * Phase 17: исход одного feed roll.
 *  - 'success'   → carrier.level += 1
 *  - 'fail'      → carrier.level unchanged
 *  - 'stabilize' → carrier достиг ceiling (carrier.stabilized = true)
 */
export type RollResult =
  | { type: 'success'; timestamp: number }
  | { type: 'fail'; timestamp: number }
  | { type: 'stabilize'; timestamp: number }

export interface CarrierData {
  frogId: string
  element: Element
  rarity: Rarity
  feedCount: number
  stabilized: boolean
  // Phase 12+: опциональный уровень лягушки на момент привязки сыворотки.
  // Phase 12 manager не использует это поле; добавлено для будущей логики (Phase 17 evolution).
  level?: number
  // Phase 17 NEW (все optional для backward compat):
  /** Pre-determined ceiling level (1..24). undefined = ещё не было feed'ов. */
  ceiling?: number
  /** Sequence of feed outcomes; clamped to last 24 entries. */
  rollHistory?: RollResult[]
}

// ===== Phase 16: ShipState discriminated union (REQ SHIP-01) =====
export interface ShipStateDocked {
  state: 'docked'
  planetId: string // unique idx в planetMap.json (e.g. 'home')
}

export interface ShipStateTransit {
  state: 'transit'
  fromPlanetId: string // для UI «В пути от X к Y»
  toPlanetId: string
  startedAt: number // unix ms (Date.now())
  arrivesAt: number // unix ms
}

export type ShipState = ShipStateDocked | ShipStateTransit

export interface PityCounters {
  common: number // боксов без гарантии common (всегда 0, placeholder)
  rare: number // боксов подряд без rare+
  epic: number // боксов подряд без epic+
  legendary: number // боксов подряд без legendary
}

// Phase 17: добавлен carriers tab.
export type CosmicTab = 'scouts' | 'boxes' | 'bestiary' | 'carriers'

// Phase 19-05 (UX-08): tutorial overlay step IDs.
export type TutorialStepId =
  | 'first-box'
  | 'first-serum'
  | 'first-feed'
  | 'first-stabilize'

// Phase 19-05 (UX-08): persisted seen-flags для tutorial overlays.
export interface TutorialState {
  seenFirstBox: boolean
  seenFirstSerum: boolean
  seenFirstFeed: boolean
  seenFirstStabilize: boolean
}

export interface CosmicSlice {
  // Инвентарь сывороток: Record<Element, Record<Rarity, count>>
  serums: Record<Element, Record<Rarity, number>>

  // Инвентарь боксов (Phase 15)
  boxes: BoxData[]

  // Корабль (Phase 16)
  ship: ShipState | null

  // Карьеры (Phase 14/17)
  carriers: CarrierData[]

  // Бестиарий bitset: Phase 17 расширен до 192 байт = 1536 битов.
  // Layout: 16 elements × 4 rarities × 24 levels = 1536 уникальных combos.
  // Хранится как number[] (JSON-serializable).
  bestiaryBitset: number[] // length = 192

  // Pity counters (Phase 19)
  pityCounters: PityCounters

  // UI: последний активный таб (sessionStorage, не persist в localStorage)
  lastActiveTab: CosmicTab

  // Crew (Phase 16)
  crew: {
    missionsToday: number
    lastResetDay: string // ISO date 'YYYY-MM-DD' (LOCAL — Phase 16 fix CREW-03)
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

  // Phase 18 (REQ BESTIARY-07): 576-cells milestone unlock flag.
  // Persisted в localStorage; placeholder для exclusive frog visual (final visual TBD).
  frogExclusiveUnlocked: boolean

  // Phase 19-05 (UX-08): tutorial overlay seen-flags (persisted).
  tutorialState: TutorialState

  // Phase 16: transient cached ship world position для redirect calc.
  // НЕ persisted в localStorage (init на null после load → re-derived из planetCoords).
  latestShipPos: { x: number; y: number } | null
}

export interface CosmicToastPayload {
  type:
    | 'box-received'
    | 'mission-complete'
    | 'serum-applied'
    | 'serum-mistap'
    | 'generic'
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
    ship: null,
    carriers: [],
    bestiaryBitset: new Array(192).fill(0), // Phase 17: full 1536 bits = 192 bytes
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
    // Phase 18 (REQ BESTIARY-07): 576-cells milestone unlock placeholder.
    frogExclusiveUnlocked: false,
    // Phase 19-05 (UX-08): tutorial seen-flags initial — все false.
    tutorialState: {
      seenFirstBox: false,
      seenFirstSerum: false,
      seenFirstFeed: false,
      seenFirstStabilize: false,
    },
    // Phase 16: transient ship position cache (used for redirect calc)
    latestShipPos: null,
  }
}
