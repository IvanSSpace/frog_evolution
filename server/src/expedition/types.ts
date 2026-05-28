import type { Element } from '../config/cosmic'

// Narrative category of a log line. Drives content selection + client styling.
export type EventCategory =
  | 'departure'
  | 'travel'
  | 'discovery'
  | 'encounter'
  | 'lore'
  | 'mundane'
  | 'loot'
  | 'hazard'
  | 'return'
  | 'arrival'

// One line in the ship's journal.
//   t         = display time (journal clock, ЧЧ:ММ) since departure
//   revealSec = REAL seconds since departure when this line should appear in
//               the UI. Lines of one beat are spread across the minute so the
//               feed trickles like real reports, not a burst.
export interface LogLine {
  t: number
  revealSec: number
  text: string
  category: EventCategory
}

export type RouteRarity = 'common' | 'rare' | 'epic'

// What a scenario hands the ship. Folded into the running loot bag.
export interface LootDelta {
  gold?: number
  serums?: Partial<Record<Element, number>>
  mutagen?: number // 🧬 редкий лут, тратится на эволюцию лягушек
  route?: RouteRarity // 🗺️ звёздный маршрут (= миссия), редкость = сложность
}

// Ship capabilities. Bias the engine's weights and yields.
// v1 ships all share DEFAULT_SHIP_STATS; upgrades will tune these later.
export interface ShipStats {
  speed: number // travel/loot rate multiplier
  luck: number // rare-event + rare-serum chance multiplier
  cargo: number // soft cap on gold per tick
  hull: number // risk resistance (0..1 shaves catastrophe chance)
}

// A reusable scenario beat: emits 1..N timestamped lines and optional loot.
// `dt` on each line is the offset (seconds) WITHIN the beat.
//
// Continuity: a beat may `set` mood tags after firing; a beat with `needs` is
// only eligible while that tag is still "recent" (decays over a few beats).
// That's how a fight gets "played out" — its aftermath beats need 'combat'.
//
// Tokens in text: {galaxy}/{planet}/... from dictionaries; {slime}/{gold} are
// replaced with the actual loot this beat grants.
export interface Scenario {
  id: string
  category: EventCategory
  weight: number
  minSec?: number // earliest travel time this beat may appear
  lines: { dt: number; text: string }[]
  loot?: LootDelta
  set?: string[] // mood tags this beat leaves behind
  needs?: string // only eligible while this tag is recent (reaction beats)
}

export type ExpeditionPhase = 'outbound' | 'returning' | 'arrived'

// Fully-resolved expedition state. Pure output of the engine.
export interface ExpeditionResult {
  seed: number
  phase: ExpeditionPhase
  outboundSec: number // how long the ship traveled outward
  elapsedSec: number // total wall time the journey covers in the log
  log: LogLine[]
  loot: {
    gold: number
    serums: Record<Element, number>
    // Мутаген (🧬) — три уровня: gen1 (для лягушек L1-6), gen2 (L7-12), gen3 (L13-18).
    // При дропе тип выбирается weighted (50/35/15) — см. applyLoot в engine.ts.
    mutagen1: number
    mutagen2: number
    mutagen3: number
    routes: Record<RouteRarity, number>
  }
  risk: number // 0..1, escalating danger at the moment shown
  shipLost: boolean // true if HP hit 0 (wrecked) — можно воскресить
  hp: number // current ship health (0 if wrecked)
  maxHp: number // baseHp + fleet bonus
  wreckedAtSec: number | null // outbound-сек момента крушения (для resume при воскрешении)
}

export interface SimulateParams {
  seed: number
  shipStats: ShipStats
  outboundSec: number // travel time outward (elapsed if not yet recalled)
  recalled: boolean // append the return leg + arrival beat
  fleet?: number // лягушек во флоте → поднимает maxHp (legacy, v1: 0)
  maxHp?: number // explicit max HP (from ship upgrades); overrides fleet calc
  reviveCount?: number // сколько раз воскрешали — каждое даёт +1 «жизнь» (maxHp буфер)
  incomePerSec?: number // доход игрока на момент старта — масштабирует gold-награду
}
