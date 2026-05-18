// Cosmic Frogs System — типы для Phase 11+
// Pure types + constants. Не импортирует из gameStore (избегаем циклов).
// Phase 22: Rarity removed. Carrier развивается через стандартный merge до L18 → ascension.
// Phase 26: добавлен firstContactsSeen для per-race first contact gating (Plan 26-01).

import type { RaceId } from '../../game/config/races'

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

// Phase 15 (REQ BOX-01): полный shape для inventory + cascade reveal flow.
// Phase 22: bonusRarity legacy kept as cosmetic-only flag (boxSlice cleanup в Task 2).
export interface BoxData {
  id: string
  planetId: string // origin planet (Phase 16 source)
  planetName: string // отображается в BoxesTab («С KEPLER»)
  archetype: string // BG archetype или main race key
  element: Element // computed at addBox via elementFromPlanet
  opened: boolean // marked true при slot-machine reveal start
  createdAt: number // unix ms — sortable «недавно полученные»
  bonusRarity?: 'rare' | 'epic' | 'legendary' // cosmetic-only legacy flag (Phase 22)
  // Legacy Phase 11 поле — оставлено для backward compat parsing; deprecated.
  sourceArchetype?: string
}

// Phase 22: carrier = простая лягушка под сывороткой.
// Развивается через стандартный merge до L18, на L18 → instant ascension (см. ascensionSlice).
export interface CarrierData {
  frogId: string
  element: Element
  level: number
}

// Phase 22 Plan 22-03: carrier достигший L18 instant ascends — исчезает с поля,
// слот освобождается, в global pool добавляется AscendedCarrier (permanent).
// Persisted в localStorage (loadCosmicSlice whitelist).
export interface AscendedCarrier {
  id: string // unique ascension id (asc-<ts>-<rnd>)
  element: Element // unchanged, инкапсулирует категорию для archetype pool
  ascendedAt: number // unix ms — для UI sorting / age display
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

// Phase 22: PityCounters остаются как string-keyed (не Rarity тип).
// Используются boxRollers (cosmetic в Phase 22) — boxSlice cleanup в Task 2.
export interface PityCounters {
  common: number
  rare: number
  epic: number
  legendary: number
}

// Phase 17: добавлен carriers tab.
// Phase 22 Plan 22-05: добавлен shop tab (cosmic shop с двумя валютами).
export type CosmicTab = 'scouts' | 'boxes' | 'bestiary' | 'carriers' | 'shop'

// Phase 22 Plan 22-05: ShopItemId mirror (импорт из config/cosmicShop вызвал бы
// циклическую зависимость types <-> config). Источник истины — config/cosmicShop.ts.
export type ShopItemId =
  | 'cosmic_box'
  | 'slot_plus_one'
  | 'ship_speed'
  | 'serum_drop_chance'
  | 'skip_ship_cooldown'
  | 'serum_trade_up'

// Phase 19-05 (UX-08): tutorial overlay step IDs.
// Phase 22: first-feed/first-stabilize устарели (нет feed-stabilize механики). Plan 22-07 решит cleanup.
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
  // Phase 22: плоский серум-инвентарь (без rarity dimension)
  serums: Record<Element, number>

  // Инвентарь боксов (Phase 15)
  boxes: BoxData[]

  // Корабль (Phase 16)
  ship: ShipState | null

  // Карьеры (Phase 14/17)
  carriers: CarrierData[]

  // Phase 22 Plan 22-03: ascended carriers pool (permanent, persisted).
  // Растёт линейно — Plan 22-04 будет агрегировать archetype bonuses из этого массива.
  ascendedCarriers: AscendedCarrier[]

  // Phase 22 Plan 22-03: meta-currency, выдаётся по +1 при каждом ascension (placeholder).
  // Balance — Plan 22-07.
  essence: number

  // Phase 22 Plan 22-05: cosmic shop perma upgrades + purchase counters.
  // Все ×N (raw counter, не процент). Game systems читают и применяют:
  //   - permaSlotBonus → FrogSpawner.slotCap += N
  //   - permaShipSpeedBonus → travelTimeMs / (1 + 0.05 * N)
  //   - permaSerumDropBonus → rollSerumDrop base + 0.005 * N
  // Cost scaling геометрический (см. config/cosmicShop.ts) — shopPurchaseCounts хранит
  // historical count для каждого item id.
  permaSlotBonus: number
  permaShipSpeedBonus: number
  permaSerumDropBonus: number
  shopPurchaseCounts: Partial<Record<ShopItemId, number>>

  // Бестиарий bitset: Phase 20 shrink до 144 байт = 1152 битов (24→18 frog levels).
  // Layout: 16 elements × 4 rarities × 18 levels = 1152 уникальных combos.
  // Phase 22: rarity dimension legacy — обсудить shrink (768 = 16×3×18 без legendary,
  // или 288 = 16×18 если rarity полностью отказаться от бестиария) в отдельном плане.
  bestiaryBitset: number[] // length = 144

  // Pity counters (Phase 19; Phase 22 cosmetic-only)
  pityCounters: PityCounters

  // UI: последний активный таб (sessionStorage, не persist в localStorage)
  lastActiveTab: CosmicTab

  // Crew (Phase 16)
  crew: {
    missionsToday: number
    lastResetDay: string // ISO date 'YYYY-MM-DD' (LOCAL — Phase 16 fix CREW-03)
  }

  // Phase 14: serum tap-to-select / drag selection mode (transient UI state, НЕ persisted)
  // Phase 22: selectedSerum упрощён до { element } (rarity removed).
  serumDragActive: boolean
  selectedSerum: { element: Element } | null

  // Phase 16: progressive disclosure flags (REQ UX-09).
  // Phase 22: hasFirstFeed устарел (нет feed механики), но оставлен для backward-compat persist.
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

  // Phase 26 Plan 26-01: per-race first contact tracker.
  // Server-syncable (cosmic JSON blob via gameSync.ts).
  // Default: все 10 false. markFirstContactSeen(raceId) idempotent.
  firstContactsSeen: Record<RaceId, boolean>
}

// Phase 26 Plan 26-01: canonical race-id array для init `firstContactsSeen` и
// defensive `loadCosmicSlice` iteration. Hardcoded здесь (НЕ import RACES из
// config/races.ts) для:
//   1. Избежать циклической deps types.ts → races.ts → types.ts (race uses Element).
//   2. Slice init остаётся lightweight (no config-file pull в bootstrap path).
// Compile-time check через `RaceId[]` ловит drift если RaceId union расширится.
export const ALL_RACE_IDS: readonly RaceId[] = [
  'crystalloids',
  'gasouls',
  'mechanidons',
  'fireworms',
  'liquidoids',
  'tenebrians',
  'plasmaspirits',
  'forestcores',
  'timeweavers',
  'cometfolk',
] as const

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
  // Phase 22: плоский серум — Record<Element, number>, все 16 = 0
  const serums = {} as Record<Element, number>
  for (const el of ELEMENTS) {
    serums[el] = 0
  }
  // Phase 26 Plan 26-01: per-race first contact tracker — все 10 false at init.
  const firstContactsSeen = {} as Record<RaceId, boolean>
  for (const id of ALL_RACE_IDS) {
    firstContactsSeen[id] = false
  }
  return {
    serums,
    boxes: [],
    ship: null,
    carriers: [],
    // Phase 22 Plan 22-03: ascended pool + essence start empty.
    ascendedCarriers: [],
    essence: 0,
    // Phase 22 Plan 22-05: shop perma upgrades + counters start at 0.
    permaSlotBonus: 0,
    permaShipSpeedBonus: 0,
    permaSerumDropBonus: 0,
    shopPurchaseCounts: {},
    bestiaryBitset: new Array(144).fill(0), // Phase 20: 1152 bits = 144 bytes (18 levels)
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
    // Phase 26 Plan 26-01: per-race first contact (все 10 false initial).
    firstContactsSeen,
  }
}
