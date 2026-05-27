import { ELEMENTS, type Element } from '../config/cosmic'
import { Rng, tickSeed } from './prng'
import { riskAt, EXPEDITION_CONFIG, type ExpeditionConfig } from './config'
import {
  DICT,
  DEPARTURE,
  SCENARIOS,
  RETURN,
  ARRIVAL,
  LOST,
} from './content'
import type {
  ExpeditionResult,
  LogLine,
  LootDelta,
  Scenario,
  SimulateParams,
} from './types'

// Per-expedition fixed context: the galaxy/arm stay constant across the trip.
interface Ctx {
  galaxy: string
  arm: string
}

function zeroSerums(): Record<Element, number> {
  const m = {} as Record<Element, number>
  for (const e of ELEMENTS) m[e] = 0
  return m
}

// Capitalize the first letter of each sentence (slots are stored lowercase, so
// a slot at a sentence start would otherwise read "поле антивещества ближе").
// The lookbehind skips ellipses ("..."), so "тут... довольно" stays lowercase.
function capitalizeSentences(s: string): string {
  return s
    .replace(/^(\s*)(\p{Ll})/u, (_, sp, ch) => sp + ch.toUpperCase())
    .replace(/(?<![.!?])([.!?])(\s+)(\p{Ll})/gu, (_, p, sp, ch) => p + sp + ch.toUpperCase())
}

// Replace {slot} tokens. galaxy/arm come from the fixed ctx; {slime}/{gold} are
// the actual loot this beat granted; the rest roll fresh from the dictionaries.
function fill(text: string, ctx: Ctx, rng: Rng, nums: { slime: number; gold: number }): string {
  const filled = text.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (key === 'galaxy') return ctx.galaxy
    if (key === 'arm') return ctx.arm
    if (key === 'slime') return String(nums.slime)
    if (key === 'gold') return String(nums.gold)
    if (key in DICT) return rng.pick(DICT[key as keyof typeof DICT])
    return key
  })
  return capitalizeSentences(filled)
}

// How much loot a beat narrates (for {slime}/{gold} tokens).
function beatNums(loot?: LootDelta): { slime: number; gold: number } {
  let slime = 0
  if (loot?.serums) {
    const vals = Object.values(loot.serums) as number[]
    slime = vals.length === 0 ? 1 : vals.reduce((a, b) => a + b, 0)
  }
  return { slime, gold: loot?.gold ?? 0 }
}

function applyLoot(
  loot: LootDelta,
  bag: { gold: number; serums: Record<Element, number> },
  rng: Rng,
): void {
  if (loot.gold) bag.gold += loot.gold
  if (loot.serums) {
    const entries = Object.entries(loot.serums) as [Element, number][]
    if (entries.length === 0) {
      // Engine's choice: a random element, one unit (slime cloud finds).
      bag.serums[rng.pick(ELEMENTS)] += 1
    } else {
      for (const [el, qty] of entries) bag.serums[el] += qty
    }
  }
}

// Pure simulation. Same inputs → identical output, always.
export function simulate(
  params: SimulateParams,
  cfg: ExpeditionConfig = EXPEDITION_CONFIG,
): ExpeditionResult {
  const { seed, shipStats, outboundSec, recalled, fleet = 0 } = params
  const maxHp = params.maxHp ?? cfg.baseHp + cfg.hpPerFrog * fleet

  const rootRng = new Rng(seed)
  const ctx: Ctx = {
    galaxy: rootRng.pick(DICT.galaxy),
    arm: rootRng.pick(DICT.arm),
  }

  const log: LogLine[] = []
  const loot = { gold: 0, serums: zeroSerums() }
  let shipLost = false

  // displayBase = journal clock (ЧЧ:ММ); realBase = real seconds since departure
  // for this beat. Lines spread evenly across the beat's real-time window
  // (tickIntervalSec) so 3 lines in one minute reveal ~20s apart, not at once.
  const emit = (s: Scenario, displayBase: number, realBase: number, rng: Rng) => {
    const nums = beatNums(s.loot)
    const n = s.lines.length
    s.lines.forEach((line, i) => {
      log.push({
        t: displayBase + line.dt,
        revealSec: realBase + (n > 1 ? (i * cfg.tickIntervalSec) / n : 0),
        text: fill(line.text, ctx, rng, nums),
        category: s.category,
      })
    })
    if (s.loot) applyLoot(s.loot, loot, rng)
  }

  // One beat = one journal-minute. Beat N is stamped at minute N, so the clock
  // reads as flight time: 00:00 = under a minute aloft, 00:07 = 7th minute.
  // (cfg.fictionGapSec = 60 = seconds per journal-minute.)
  const beatBase = (i: number) => i * cfg.fictionGapSec
  // Real seconds since departure for beat i — gates UI reveal (client compares
  // to wall-clock elapsed). Continuous across outbound + return legs.
  const realBaseAt = (i: number) => i * cfg.tickIntervalSec

  // Continuity state, carried beat-to-beat.
  // recentTags: mood left by recent beats (ttl in beats) → gates `needs` beats.
  // recentIds: last few beat ids → anti-repetition cooldown.
  const recentTags = new Map<string, number>()
  const recentIds: string[] = []
  const TAG_TTL = 3
  const ID_COOLDOWN = 6

  const remember = (s: Scenario) => {
    for (const [tag, ttl] of recentTags) {
      if (ttl - 1 <= 0) recentTags.delete(tag)
      else recentTags.set(tag, ttl - 1)
    }
    for (const tag of s.set ?? []) recentTags.set(tag, TAG_TTL)
    recentIds.push(s.id)
    if (recentIds.length > ID_COOLDOWN) recentIds.shift()
  }

  let beatIndex = 0
  const departure = rootRng.weighted(DEPARTURE)
  emit(departure, beatBase(beatIndex), realBaseAt(beatIndex), new Rng(tickSeed(seed, beatIndex)))
  remember(departure)
  beatIndex++

  // One beat per `tickIntervalSec` of REAL travel → log grows over real time.
  const beats = Math.floor(outboundSec / cfg.tickIntervalSec)
  for (; beatIndex <= beats; beatIndex++) {
    const base = beatBase(beatIndex) // journal timestamp of this beat
    const rng = new Rng(tickSeed(seed, beatIndex))
    const realSec = beatIndex * cfg.tickIntervalSec
    const risk = riskAt(realSec, cfg) // recall-timing tension = real time

    // Catastrophe roll — the "recall in time" tension. Hull shaves it.
    const catChance = risk * cfg.catastrophePerTickMax * (1 - shipStats.hull)
    if (risk > 0 && rng.chance(catChance)) {
      emit(LOST, base, realSec, rng)
      shipLost = true
      break
    }

    // Eligible = unlocked by journal progress, not on cooldown, and (reaction
    // beats) only while their trigger mood is still recent.
    let pool = SCENARIOS.filter(
      (s) =>
        (s.minSec ?? 0) <= base &&
        !recentIds.includes(s.id) &&
        (!s.needs || recentTags.has(s.needs)),
    )
    if (pool.length === 0) {
      pool = SCENARIOS.filter((s) => (s.minSec ?? 0) <= base && !s.needs)
    }

    // Weighting: hazards climb with risk (foreshadowing); reaction beats are
    // boosted so a fresh event reliably gets "played out" next.
    const weighted = pool.map((s) => {
      let w = s.weight
      if (s.category === 'hazard') w *= 1 + risk * 3
      if (s.needs) w *= 3
      return { ...s, weight: w }
    })
    const beat = rng.weighted(weighted)
    emit(beat, base, realSec, rng)
    remember(beat)

    // Passive yield per beat.
    loot.gold += Math.round(cfg.goldPerTickBase * shipStats.speed)
    if (rng.chance(cfg.serumChancePerTick * shipStats.luck)) {
      loot.serums[rng.pick(ELEMENTS)] += 1
    }
  }

  let elapsedSec = outboundSec
  let phase: ExpeditionResult['phase'] = 'outbound'

  if (shipLost) {
    // Lost everything. Loot is forfeit; the journey ends here.
    loot.gold = 0
    loot.serums = zeroSerums()
    phase = 'arrived'
  } else if (recalled) {
    // Return leg: 3× shorter, and far safer — catastrophe chance is scaled by
    // returnRiskFactor (0.25 = 75% less dangerous than the outbound leg).
    const returnSec = outboundSec / cfg.returnSpeedMultiplier
    const returnBeats = Math.floor(returnSec / cfg.tickIntervalSec)
    const recallRisk = riskAt(outboundSec, cfg)
    const returnPool = SCENARIOS.filter(
      (s) => !s.needs && (s.category === 'travel' || s.category === 'mundane'),
    )

    beatIndex++
    emit(
      rootRng.weighted(RETURN),
      beatBase(beatIndex),
      realBaseAt(beatIndex),
      new Rng(tickSeed(seed, beatIndex)),
    )

    for (let k = 1; k <= returnBeats && !shipLost; k++) {
      beatIndex++
      const base = beatBase(beatIndex)
      const rng = new Rng(tickSeed(seed, beatIndex))
      const catChance =
        recallRisk *
        cfg.catastrophePerTickMax *
        (1 - shipStats.hull) *
        cfg.returnRiskFactor
      if (catChance > 0 && rng.chance(catChance)) {
        emit(LOST, base, realBaseAt(beatIndex), rng)
        shipLost = true
        break
      }
      emit(rng.weighted(returnPool), base, realBaseAt(beatIndex), rng)
    }

    if (shipLost) {
      loot.gold = 0
      loot.serums = zeroSerums()
    } else {
      beatIndex++
      emit(
        rootRng.weighted(ARRIVAL),
        beatBase(beatIndex),
        realBaseAt(beatIndex),
        new Rng(tickSeed(seed, -2)),
      )
    }
    elapsedSec = outboundSec + returnSec
    phase = 'arrived'
  }

  // Stable ordering: by timestamp, preserving insertion for equal t.
  log.sort((a, b) => a.t - b.t)

  return {
    seed,
    phase,
    outboundSec,
    elapsedSec,
    log,
    loot,
    risk: riskAt(outboundSec, cfg),
    shipLost,
    hp: shipLost ? 0 : maxHp,
    maxHp,
  }
}
