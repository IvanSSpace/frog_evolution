import { FastifyInstance } from 'fastify'
import { ExpeditionStatus } from '@prisma/client'
import { prisma } from '../prisma'
import { adjustSerum, type Element, type SerumsMap } from '../config/cosmic'
import { simulate } from '../expedition/engine'
import {
  EXPEDITION_CONFIG,
  DEFAULT_SHIP_STATS,
  type ExpeditionConfig,
} from '../expedition/config'
import {
  deriveShip,
  emptyShipUpg,
  shipUpgCost,
  SHIP_UPG_MAX,
  SHIP_UPG_KEYS,
  type ShipUpg,
  type ShipUpgKey,
} from '../expedition/config'
import { renderJournal, lootSummary } from '../expedition/render'
import type { ShipStats, ExpeditionResult } from '../expedition/types'

// A persisted ship entity (lives in GameState.cosmic.ships).
interface ShipEntity {
  id: number
  upg: ShipUpg
}

function readShips(cosmic: Record<string, unknown> | null | undefined): ShipEntity[] {
  const raw = (cosmic?.ships as ShipEntity[] | undefined) ?? []
  return raw.map((s) => ({ id: s.id, upg: { ...emptyShipUpg(), ...s.upg } }))
}

// Ensure one ship entity per owned slot (creates missing). Ids = 1..owned.
function ensureShips(ships: ShipEntity[], owned: number): ShipEntity[] {
  const byId = new Map(ships.map((s) => [s.id, s]))
  const out: ShipEntity[] = []
  for (let id = 1; id <= owned; id++) {
    out.push(byId.get(id) ?? { id, upg: emptyShipUpg() })
  }
  return out
}

// Active = ship is out there or on its way home.
const ACTIVE: ExpeditionStatus[] = [ExpeditionStatus.OUTBOUND, ExpeditionStatus.RETURNING]

type ExpeditionRow = {
  id: number
  seed: number
  status: string
  startedAt: Date
  recalledAt: Date | null
  arrivalAt: Date | null
  tickIntervalSec: number
  shipStats: unknown
}

// Per-expedition config: prod tempo, but the stored tick interval wins so a
// demo-tempo expedition keeps its tempo for its whole life.
function cfgFor(exp: ExpeditionRow): ExpeditionConfig {
  return { ...EXPEDITION_CONFIG, tickIntervalSec: exp.tickIntervalSec }
}

// shipStats JSON also carries { maxHp, shipId, reviveCount } alongside ShipStats.
type StoredStats = ShipStats & {
  maxHp?: number
  shipId?: number
  reviveCount?: number
  income?: number // доход игрока на момент старта (масштабирует gold-награду)
}

// Воскрешение: стоимость в золоте, растёт с каждым воскрешением экспедиции.
const REVIVE_COST_BASE = 50_000

function statsFor(exp: ExpeditionRow): ShipStats {
  const s = exp.shipStats as StoredStats | null
  if (!s) return DEFAULT_SHIP_STATS
  return { speed: s.speed, luck: s.luck, cargo: s.cargo, hull: s.hull }
}

function maxHpFor(exp: ExpeditionRow): number | undefined {
  const s = exp.shipStats as StoredStats | null
  return typeof s?.maxHp === 'number' ? s.maxHp : undefined
}

function reviveCountFor(exp: ExpeditionRow): number {
  const s = exp.shipStats as StoredStats | null
  return Number(s?.reviveCount) || 0
}

function incomeFor(exp: ExpeditionRow): number {
  const s = exp.shipStats as StoredStats | null
  return Number(s?.income) || 0
}

function shipIdFor(exp: ExpeditionRow): number | undefined {
  const s = exp.shipStats as StoredStats | null
  return typeof s?.shipId === 'number' ? s.shipId : undefined
}

const secBetween = (a: Date, b: Date) => Math.max(0, (a.getTime() - b.getTime()) / 1000)

// Resolve the live state of one expedition at `now`. Pure read — no writes.
function computeView(exp: ExpeditionRow, now: Date) {
  const cfg = cfgFor(exp)
  const stats = statsFor(exp)

  let outboundSec: number
  let recalled: boolean
  if (exp.status === 'OUTBOUND') {
    outboundSec = Math.min(secBetween(now, exp.startedAt), cfg.maxOutboundSec)
    recalled = false
  } else {
    // RETURNING / CLAIMED / LOST: outbound is frozen at recall time.
    outboundSec = Math.min(
      secBetween(exp.recalledAt ?? now, exp.startedAt),
      cfg.maxOutboundSec,
    )
    recalled = true
  }

  const result = simulate(
    {
      seed: exp.seed,
      shipStats: stats,
      outboundSec,
      recalled,
      maxHp: maxHpFor(exp),
      reviveCount: reviveCountFor(exp),
      incomePerSec: incomeFor(exp),
    },
    cfg,
  )

  const arrived = exp.arrivalAt ? now >= exp.arrivalAt : false
  let phase: 'outbound' | 'returning' | 'arrived' | 'lost'
  if (result.shipLost) phase = 'lost'
  else if (exp.status === 'OUTBOUND') phase = 'outbound'
  else phase = arrived ? 'arrived' : 'returning'

  return { result, phase, arrived, cfg }
}

function viewPayload(exp: ExpeditionRow, now: Date) {
  const { result, phase, arrived } = computeView(exp, now)
  return {
    id: exp.id,
    seed: exp.seed,
    shipId: shipIdFor(exp) ?? null,
    phase,
    status: exp.status,
    startedAt: exp.startedAt.toISOString(),
    recalledAt: exp.recalledAt?.toISOString() ?? null,
    arrivalAt: exp.arrivalAt?.toISOString() ?? null,
    outboundSec: result.outboundSec,
    risk: Number(result.risk.toFixed(3)),
    shipLost: result.shipLost,
    hp: result.hp,
    maxHp: result.maxHp,
    canRecall: exp.status === 'OUTBOUND' && !result.shipLost,
    canClaim: exp.status === 'RETURNING' && arrived,
    canRevive: result.shipLost && exp.status !== 'CLAIMED',
    reviveCost: REVIVE_COST_BASE * (reviveCountFor(exp) + 1),
    loot: lootSummary(result),
    journal: renderJournal(result.log),
  }
}

// Apply loot to the player's snapshot: gold (BigInt) + serums (cosmic JSON).
async function grantLoot(userId: number, result: ExpeditionResult) {
  const state = await prisma.gameState.findUnique({ where: { userId } })
  if (!state) return
  const cosmic = (state.cosmic as Record<string, unknown> | null) ?? {}
  let serums = cosmic.serums as SerumsMap | undefined
  for (const [el, qty] of Object.entries(result.loot.serums)) {
    if (qty > 0) serums = adjustSerum(serums, el as Element, qty)
  }
  const mutagen = (Number(cosmic.mutagen) || 0) + result.loot.mutagen
  const prevRoutes = (cosmic.routes as Record<string, number> | null) ?? {}
  const routes = {
    common: (Number(prevRoutes.common) || 0) + result.loot.routes.common,
    rare: (Number(prevRoutes.rare) || 0) + result.loot.routes.rare,
    epic: (Number(prevRoutes.epic) || 0) + result.loot.routes.epic,
  }
  await prisma.gameState.update({
    where: { userId },
    data: {
      gold: state.gold + BigInt(result.loot.gold),
      cosmic: { ...cosmic, serums, mutagen, routes } as object,
    },
  })
}

export async function expeditionRoutes(app: FastifyInstance) {
  // POST /expedition/start — launch a ship if a slot is free.
  app.post('/expedition/start', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.id

    // Owned ships = purchased "ships" upgrade level (bought in прокачка, gated
    // by progression). Caps how many expeditions can run at once.
    const gs = await prisma.gameState.findUnique({ where: { userId } })
    const upgrades = (gs?.upgrades as Record<string, number> | null) ?? {}
    const owned = Math.min(upgrades.ships ?? 0, EXPEDITION_CONFIG.ships.max)
    if (owned < 1) {
      return reply.code(409).send({ error: 'no ship owned', owned })
    }

    const activeRows = await prisma.expedition.findMany({
      where: { userId, status: { in: ACTIVE } },
    })

    const body = (request.body ?? {}) as {
      demo?: boolean
      shipId?: number
      crew?: number[]
    }
    const cosmic = (gs?.cosmic as Record<string, unknown> | null) ?? {}
    const ships = ensureShips(readShips(cosmic), owned)
    const flyingIds = new Set(
      activeRows.map((r) => shipIdFor(r as ExpeditionRow)).filter(Boolean),
    )

    // Pick the requested ship if free; else the first idle one.
    const target =
      ships.find((s) => s.id === body.shipId && !flyingIds.has(s.id)) ??
      ships.find((s) => !flyingIds.has(s.id))
    if (!target) {
      return reply.code(409).send({ error: 'no free ship' })
    }

    const { stats, maxHp } = deriveShip(target.upg)
    // Crew: каждая лягушка +20 HP (мин 1 для запуска). Уровни в диапазоне корабля.
    const crew = Array.isArray(body.crew)
      ? body.crew.filter((l) => typeof l === 'number').slice(0, 6)
      : []
    if (crew.length < 1) {
      return reply.code(400).send({ error: 'crew required', need: 1 })
    }
    const crewHp = crew.length * 20

    const exp = await prisma.expedition.create({
      data: {
        userId,
        seed: Math.floor(Math.random() * 2_147_483_647),
        status: 'OUTBOUND',
        tickIntervalSec: body.demo ? 2 : EXPEDITION_CONFIG.tickIntervalSec,
        shipStats: {
          ...stats,
          maxHp: maxHp + crewHp,
          shipId: target.id,
          crew,
          income: gs?.incomePerSec ?? 0,
        } as object,
      },
    })
    return { ok: true, expedition: viewPayload(exp as ExpeditionRow, new Date()) }
  })

  // GET /expedition/ships — owned ships with derived stats + which is flying.
  app.get('/expedition/ships', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.id
    const gs = await prisma.gameState.findUnique({ where: { userId } })
    const upgrades = (gs?.upgrades as Record<string, number> | null) ?? {}
    const owned = Math.min(upgrades.ships ?? 0, EXPEDITION_CONFIG.ships.max)
    const ships = ensureShips(readShips(gs?.cosmic as Record<string, unknown>), owned)

    const activeRows = await prisma.expedition.findMany({
      where: { userId, status: { in: ACTIVE } },
    })
    const activeByShip = new Map<number, number>()
    for (const r of activeRows) {
      const sid = shipIdFor(r as ExpeditionRow)
      if (sid) activeByShip.set(sid, r.id)
    }

    return {
      ok: true,
      ships: ships.map((s) => {
        const { stats, maxHp } = deriveShip(s.upg)
        return {
          id: s.id,
          name: `Головастик-${s.id}`,
          upg: s.upg,
          stats,
          maxHp,
          activeExpeditionId: activeByShip.get(s.id) ?? null,
          upgCosts: Object.fromEntries(
            SHIP_UPG_KEYS.map((k) => [
              k,
              s.upg[k] >= SHIP_UPG_MAX ? null : shipUpgCost(s.upg[k]),
            ]),
          ),
          maxUpg: SHIP_UPG_MAX,
        }
      }),
    }
  })

  // POST /expedition/ship/upgrade { shipId, stat } — spend gold to raise a stat.
  app.post('/expedition/ship/upgrade', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.id
    const body = (request.body ?? {}) as { shipId?: number; stat?: string }
    const stat = body.stat as ShipUpgKey | undefined
    if (!stat || !SHIP_UPG_KEYS.includes(stat)) {
      return reply.code(400).send({ error: 'invalid stat' })
    }

    const gs = await prisma.gameState.findUnique({ where: { userId } })
    if (!gs) return reply.code(404).send({ error: 'no game state' })
    const upgrades = (gs.upgrades as Record<string, number> | null) ?? {}
    const owned = Math.min(upgrades.ships ?? 0, EXPEDITION_CONFIG.ships.max)
    const cosmic = (gs.cosmic as Record<string, unknown> | null) ?? {}
    const ships = ensureShips(readShips(cosmic), owned)

    const ship = ships.find((s) => s.id === body.shipId)
    if (!ship) return reply.code(404).send({ error: 'ship not found' })

    const level = ship.upg[stat]
    if (level >= SHIP_UPG_MAX) {
      return reply.code(400).send({ error: 'max level' })
    }
    const cost = shipUpgCost(level)
    if (gs.gold < BigInt(cost)) {
      return reply.code(400).send({ error: 'insufficient gold', need: cost })
    }

    ship.upg = { ...ship.upg, [stat]: level + 1 }
    await prisma.gameState.update({
      where: { userId },
      data: {
        gold: gs.gold - BigInt(cost),
        cosmic: { ...cosmic, ships } as object,
      },
    })

    const { stats, maxHp } = deriveShip(ship.upg)
    return {
      ok: true,
      gold: (gs.gold - BigInt(cost)).toString(),
      ship: { id: ship.id, upg: ship.upg, stats, maxHp },
    }
  })

  // GET /expedition/active — all in-flight expeditions, with live journals.
  app.get('/expedition/active', { preHandler: [app.authenticate] }, async (request) => {
    const rows = await prisma.expedition.findMany({
      where: { userId: request.user.id, status: { in: ACTIVE } },
      orderBy: { startedAt: 'asc' },
    })
    const now = new Date()
    return { ok: true, expeditions: rows.map((r) => viewPayload(r as ExpeditionRow, now)) }
  })

  // GET /expedition/:id — single expedition, full journal.
  app.get('/expedition/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    const exp = await prisma.expedition.findFirst({ where: { id, userId: request.user.id } })
    if (!exp) return reply.code(404).send({ error: 'not found' })
    return { ok: true, expedition: viewPayload(exp as ExpeditionRow, new Date()) }
  })

  // POST /expedition/:id/recall — turn the ship around (return = outbound / 3).
  app.post('/expedition/:id/recall', { preHandler: [app.authenticate] }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    const exp = await prisma.expedition.findFirst({ where: { id, userId: request.user.id } })
    if (!exp) return reply.code(404).send({ error: 'not found' })
    if (exp.status !== 'OUTBOUND') return reply.code(400).send({ error: 'not outbound' })

    const now = new Date()
    const { result, cfg } = computeView(exp as ExpeditionRow, now)

    // Recalled too late — the catastrophe already happened.
    if (result.shipLost) {
      const lost = await prisma.expedition.update({ where: { id }, data: { status: 'LOST' } })
      return { ok: true, expedition: viewPayload(lost as ExpeditionRow, now) }
    }

    const returnSec = result.outboundSec / cfg.returnSpeedMultiplier
    const arrivalAt = new Date(now.getTime() + returnSec * 1000)
    const updated = await prisma.expedition.update({
      where: { id },
      data: { status: 'RETURNING', recalledAt: now, arrivalAt },
    })
    return { ok: true, expedition: viewPayload(updated as ExpeditionRow, now) }
  })

  // POST /expedition/:id/continue — отмена возврата (мисклик): снова летим.
  // Сдвигаем startedAt вперёд на время, проведённое в возврате, чтобы outboundSec
  // продолжился с той же секунды (3 мин → дальше), а не прыгнул вперёд.
  app.post('/expedition/:id/continue', { preHandler: [app.authenticate] }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    const exp = await prisma.expedition.findFirst({ where: { id, userId: request.user.id } })
    if (!exp) return reply.code(404).send({ error: 'not found' })
    if (exp.status !== 'RETURNING') return reply.code(400).send({ error: 'not returning' })

    const now = new Date()
    if (exp.arrivalAt && now >= exp.arrivalAt) {
      return reply.code(400).send({ error: 'already home' })
    }

    const returnedMs = now.getTime() - (exp.recalledAt?.getTime() ?? now.getTime())
    const newStarted = new Date(exp.startedAt.getTime() + returnedMs)
    const updated = await prisma.expedition.update({
      where: { id },
      data: { status: 'OUTBOUND', startedAt: newStarted, recalledAt: null, arrivalAt: null },
    })
    return { ok: true, expedition: viewPayload(updated as ExpeditionRow, now) }
  })

  // POST /expedition/:id/revive — воскресить разбитый корабль за золото.
  // Восстанавливает HP (ещё одна «жизнь»), лут сохраняется, корабль летит дальше
  // с момента крушения (startedAt сдвигается на wreckedAtSec).
  app.post('/expedition/:id/revive', { preHandler: [app.authenticate] }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    const exp = await prisma.expedition.findFirst({ where: { id, userId: request.user.id } })
    if (!exp) return reply.code(404).send({ error: 'not found' })

    const now = new Date()
    const { result } = computeView(exp as ExpeditionRow, now)
    if (!result.shipLost) return reply.code(400).send({ error: 'not wrecked' })

    const gs = await prisma.gameState.findUnique({ where: { userId: request.user.id } })
    if (!gs) return reply.code(404).send({ error: 'no game state' })
    const reviveCount = reviveCountFor(exp as ExpeditionRow)
    const cost = REVIVE_COST_BASE * (reviveCount + 1)
    if (gs.gold < BigInt(cost)) {
      return reply.code(400).send({ error: 'insufficient gold', need: cost })
    }

    const wreckedAtSec = result.wreckedAtSec ?? result.outboundSec
    const newStarted = new Date(now.getTime() - wreckedAtSec * 1000)
    const stored = (exp.shipStats as Record<string, unknown> | null) ?? {}

    await prisma.gameState.update({
      where: { userId: request.user.id },
      data: { gold: gs.gold - BigInt(cost) },
    })
    const updated = await prisma.expedition.update({
      where: { id },
      data: {
        status: 'OUTBOUND',
        startedAt: newStarted,
        recalledAt: null,
        arrivalAt: null,
        shipStats: { ...stored, reviveCount: reviveCount + 1 } as object,
      },
    })
    return { ok: true, expedition: viewPayload(updated as ExpeditionRow, now) }
  })

  // POST /expedition/:id/claim — collect loot once the ship has docked.
  app.post('/expedition/:id/claim', { preHandler: [app.authenticate] }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    const exp = await prisma.expedition.findFirst({ where: { id, userId: request.user.id } })
    if (!exp) return reply.code(404).send({ error: 'not found' })

    const now = new Date()
    const { result } = computeView(exp as ExpeditionRow, now)

    // Lost ship — no loot. Covers both DB status LOST (recalled too late) and
    // an OUTBOUND ship whose catastrophe already happened by wall-clock (the
    // player never recalled, just sees "потерян" and acknowledges).
    if (exp.status === 'LOST' || result.shipLost) {
      await prisma.expedition.update({ where: { id }, data: { status: 'CLAIMED', claimedAt: now } })
      return { ok: true, shipLost: true, loot: { gold: 0, serums: {} } }
    }
    if (exp.status !== 'RETURNING') return reply.code(400).send({ error: 'nothing to claim' })
    if (!exp.arrivalAt || now < exp.arrivalAt) {
      return reply.code(425).send({ error: 'still returning', arrivalAt: exp.arrivalAt?.toISOString() })
    }

    await grantLoot(request.user.id, result)
    await prisma.expedition.update({ where: { id }, data: { status: 'CLAIMED', claimedAt: now } })
    return { ok: true, shipLost: false, loot: lootSummary(result) }
  })
}
