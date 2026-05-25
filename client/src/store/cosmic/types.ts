// Cosmic Frogs System — типы для Phase 11+
// Pure types + constants. Не импортирует из gameStore (избегаем циклов).
// Phase 22: Rarity removed. Carrier развивается через стандартный merge до L18 → ascension.
// Phase 26: добавлен firstContactsSeen для per-race first contact gating (Plan 26-01).
// Phase 26 Plan 26-02: добавлен PlanetInhabitant type — race ownership of planet.

import type { RaceId } from '../../game/config/races'
import type { PendingItem } from '../../game/config/raceChains'
import { INITIAL_RELATIONSHIP } from '../../game/config/raceChains'
// Phase 28 Plan 28-01: quest mechanic state types.
import type { ActiveQuest, CompletedQuest } from '../../game/config/quests'

/**
 * Phase 26 Plan 26-02: race ownership of a habitable planet.
 *
 * Attached к подмножеству planets in `client/src/game/data/planetMap.json`
 * (30 of 350 → 1 home + 2 colonies × 10 races). Read-only — planets с inhabitant
 * визуализируются glow/icon в Star Map (Plan 26-03).
 *
 * Roles:
 *   - 'home'   : communicative leader planet of the race (Phase 28 communications root).
 *   - 'colony' : silent representation, race visible but no chat.
 *
 * **NB:** planetMap.json shape живёт only as JSON-loaded structure (нет общего
 * `Planet` TS типа в репо). Optional поле `inhabitant?: PlanetInhabitant` присутствует
 * на 30 of 350 entries; uninhabited planets просто не имеют этого поля. Closest
 * existing TS shape — `PlanetMapEntry` in `src/game/scenes/starmap/types.ts`;
 * там тоже добавлен optional `inhabitant?: PlanetInhabitant`.
 */
export interface PlanetInhabitant {
  raceId: RaceId
  role: 'home' | 'colony'
}

// 2026-05-23: серум типов сокращено до 11 — 1:1 с архетипами планет.
// Удалены: shadow, arcane, mechanical, war, void (не имели planet archetype'ов).
// Расы tenebrians/mechanidons/timeweavers переназначены на toxic/crystal/binary
// (см. races.ts).
export type Element =
  | 'fire'
  | 'ice'
  | 'water'
  | 'forest'
  | 'toxic'
  | 'plasma'
  | 'crystal'
  | 'desert'
  | 'gas'
  | 'ring'
  | 'binary'

export const ELEMENTS: readonly Element[] = [
  'fire',
  'ice',
  'water',
  'forest',
  'toxic',
  'plasma',
  'crystal',
  'desert',
  'gas',
  'ring',
  'binary',
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
// Phase 26 Plan 26-04: добавлен inventory tab (read-only single-view все ресурсы).
// Phase 27 Plan 27-04: добавлен contacts tab (relationship + chain UI).
// Phase 28 Plan 28-01: добавлен quests tab (active + completed quest tracker UI in Plan 28-04).
export type CosmicTab =
  | 'scouts'
  | 'boxes'
  | 'carriers'
  | 'shop'
  | 'contacts'
  | 'quests'
  | 'serum'

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
  //   - permaSerumDropBonus → serumDropChance(base, N) (см. game/utils/shopBonuses.ts)
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

  // Phase 27 Plan 27-01: relationship-driven contacts foundation.
  // raceRelationships: per-race score 1-10 integer (5 tiers in raceChains.ts).
  //   Default INITIAL_RELATIONSHIP=2 (low threshold per CONTEXT D-Relationship system).
  //   Clamped via slice actions (Plan 27-03 applyAccept/applyRefuse/applyEvent).
  // chainProgress: per-race index into RACE_CHAINS[raceId]. 0 = first item.
  //   Advanced by Plan 27-03 pending engine after each item consumed.
  // pendingItems: global queue (cap CHAIN_PENDING_CAP=3 — enforced by engine, NOT slice shape).
  //   Persisted; cross-device sync via cosmic blob.
  raceRelationships: Record<RaceId, number>
  chainProgress: Record<RaceId, number>
  pendingItems: PendingItem[]

  // Phase 28 Plan 28-01: quest mechanic state.
  //   activeQuests: cap ACTIVE_QUEST_CAP=5 enforced by engine при activation
  //     (Plan 28-03 activateQuestFromHook). Defensive load NOT enforce cap —
  //     forward-compat если cap raised в будущем (mirror CHAIN_PENDING_CAP pattern).
  //   completedQuests: history list, capped at COMPLETED_QUEST_HISTORY_CAP=100 newest
  //     (FIFO trim on defensive load by completedAt desc).
  activeQuests: ActiveQuest[]
  completedQuests: CompletedQuest[]
}

// Phase 26 Plan 26-01: canonical race-id array для init `firstContactsSeen` и
// defensive `loadCosmicSlice` iteration. Hardcoded здесь (НЕ import RACES из
// config/races.ts) для:
//   1. Избежать циклической deps types.ts → races.ts → types.ts (race uses Element).
//   2. Slice init остаётся lightweight (no config-file pull в bootstrap path).
// Compile-time check через `RaceId[]` ловит drift если RaceId union расширится.
export const ALL_RACE_IDS: readonly RaceId[] = [
  'crystalloids',
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
  // Phase 27 Plan 27-01: per-race relationship + chain progress init.
  // raceRelationships = INITIAL_RELATIONSHIP (2) per race; chainProgress = 0 per race.
  // pendingItems = [] (engine fills через Plan 27-03).
  const raceRelationships = {} as Record<RaceId, number>
  const chainProgress = {} as Record<RaceId, number>
  for (const id of ALL_RACE_IDS) {
    raceRelationships[id] = INITIAL_RELATIONSHIP
    chainProgress[id] = 0
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
    // Phase 27 Plan 27-01: relationship/chain/pending foundation.
    raceRelationships,
    chainProgress,
    pendingItems: [],
    // Phase 28 Plan 28-01: quest state — engine fills через Plan 28-03 activateQuestFromHook.
    activeQuests: [],
    completedQuests: [],
  }
}
