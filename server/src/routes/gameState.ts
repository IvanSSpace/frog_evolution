import { FastifyInstance } from 'fastify'
import prisma from '../db/prisma'

interface UpgradesPayload {
  dropSpeed: number
  tractor: number
  magnet: number
  crateQuality: number
}

interface SaveStatePayload {
  gold: number | string
  upgrades: UpgradesPayload
  frogPurchases: number[]
  discoveredLevels: number[]
  magnetEnabled: boolean
  currentLocation: number
  locationFrogs: number[][]
}

// BigInt → строка для JSON, Date → ISO
function serializeState(state: {
  gold: bigint
  upgrades: any
  frogPurchases: any
  discoveredLevels: any
  magnetEnabled: boolean
  currentLocation: number
  locationFrogs: any
  lastSessionAt: Date
}) {
  return {
    gold: state.gold.toString(),
    upgrades: state.upgrades,
    frogPurchases: state.frogPurchases,
    discoveredLevels: state.discoveredLevels,
    magnetEnabled: state.magnetEnabled,
    currentLocation: state.currentLocation,
    locationFrogs: state.locationFrogs,
    lastSessionAt: state.lastSessionAt.toISOString(),
  }
}

function clampLocation(n: unknown): number {
  const v = typeof n === 'number' ? n : parseInt(String(n), 10)
  if (!Number.isFinite(v) || v < 1 || v > 4) return 1
  return Math.floor(v)
}

function sanitizeFrogPurchases(arr: unknown): number[] {
  if (!Array.isArray(arr)) return []
  return arr.slice(0, 24).map((n) => {
    const v = typeof n === 'number' ? n : parseInt(String(n), 10)
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
  })
}

function sanitizeLocationFrogs(arr: unknown): number[][] {
  if (!Array.isArray(arr) || arr.length !== 4) {
    return [[1, 2, 3, 4, 5, 6], [], [], []]
  }
  return arr.map((sub) => {
    if (!Array.isArray(sub)) return []
    return sub
      .filter((n) => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 24)
      .map((n) => Math.floor(n))
  })
}

function sanitizeUpgrades(obj: unknown): UpgradesPayload {
  const o = (obj && typeof obj === 'object' ? obj : {}) as Record<string, unknown>
  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  }
  return {
    dropSpeed: num(o.dropSpeed),
    tractor: num(o.tractor),
    magnet: num(o.magnet),
    crateQuality: num(o.crateQuality),
  }
}

function sanitizeDiscovered(arr: unknown): number[] {
  if (!Array.isArray(arr)) return []
  return arr
    .filter((n) => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 24)
    .map((n) => Math.floor(n))
}

export async function gameStateRoutes(fastify: FastifyInstance) {
  // Загрузить состояние игры
  fastify.get('/game/state', async (request, reply) => {
    const user = request.user!

    const state = await prisma.gameState.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    })

    return reply.send(serializeState(state))
  })

  // Сохранить состояние игры (полная замена)
  fastify.put('/game/state', async (request, reply) => {
    const user = request.user!
    const body = request.body as SaveStatePayload

    if (!body || typeof body !== 'object') {
      return reply.code(400).send({ error: 'Invalid payload' })
    }

    let gold: bigint
    try {
      gold = BigInt(body.gold ?? 0)
      if (gold < 0n) gold = 0n
    } catch {
      return reply.code(400).send({ error: 'Invalid gold value' })
    }

    const cleanUpgrades = sanitizeUpgrades(body.upgrades)
    const cleanFrogPurchases = sanitizeFrogPurchases(body.frogPurchases)
    const cleanDiscovered = sanitizeDiscovered(body.discoveredLevels)
    const cleanLocation = clampLocation(body.currentLocation)
    const cleanLocFrogs = sanitizeLocationFrogs(body.locationFrogs)
    const magnetEnabled = body.magnetEnabled ?? true

    const state = await prisma.gameState.upsert({
      where: { userId: user.id },
      update: {
        gold,
        upgrades: cleanUpgrades as any,
        frogPurchases: cleanFrogPurchases as any,
        discoveredLevels: cleanDiscovered as any,
        magnetEnabled,
        currentLocation: cleanLocation,
        locationFrogs: cleanLocFrogs as any,
        lastSessionAt: new Date(),
      },
      create: {
        userId: user.id,
        gold,
        upgrades: cleanUpgrades as any,
        frogPurchases: cleanFrogPurchases as any,
        discoveredLevels: cleanDiscovered as any,
        magnetEnabled,
        currentLocation: cleanLocation,
        locationFrogs: cleanLocFrogs as any,
      },
    })

    return reply.send(serializeState(state))
  })
}
