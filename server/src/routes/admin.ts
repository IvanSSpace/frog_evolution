import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma'
import { config } from '../config'
import { CHAINS_RESPONSE } from '../data/chains'

// ── Admin JWT payload ─────────────────────────────────────────────────────────

type AdminJwtPayload = { sub: string }

// ── Middleware ────────────────────────────────────────────────────────────────

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    // Cast to admin payload shape — the JWT plugin stores the verified payload in request.user
    const payload = (request.user as unknown) as AdminJwtPayload
    if (payload.sub !== 'super-admin') {
      return reply.code(403).send({ error: 'forbidden' })
    }
  } catch {
    return reply.code(401).send({ error: 'unauthorized' })
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type GrantBody = {
  kind: 'gold' | 'essence' | 'serum'
  element?: string
  amount: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractMaxLevel(discoveredLevels: unknown): number {
  if (Array.isArray(discoveredLevels) && discoveredLevels.length > 0) {
    const nums = discoveredLevels.filter((v): v is number => typeof v === 'number')
    return nums.length > 0 ? Math.max(...nums) : 1
  }
  return 1
}

function extractEssence(cosmic: unknown): number {
  if (cosmic !== null && typeof cosmic === 'object' && 'essence' in cosmic) {
    const val = (cosmic as Record<string, unknown>).essence
    return typeof val === 'number' ? val : 0
  }
  return 0
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function adminRoutes(app: FastifyInstance) {
  // POST /admin/login — no auth required
  app.post('/admin/login', async (request, reply) => {
    const body = request.body as { email?: string; password?: string }

    if (!body.email || !body.password) {
      return reply.code(400).send({ error: 'email and password required' })
    }

    const emailMatch = body.email === config.adminEmail

    // Always run bcrypt compare to prevent timing attacks on email enumeration.
    // If adminPasswordHash is empty, use a dummy hash that always fails.
    const hashToCompare =
      config.adminPasswordHash ||
      '$2a$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const passwordMatch = await bcrypt.compare(body.password, hashToCompare)

    if (!emailMatch || !passwordMatch) {
      return reply.code(401).send({ error: 'invalid credentials' })
    }

    // app.jwt.sign is synchronous and fully typed against the registered secret.
    // We cast the payload to 'any' to bypass the strict FastifyJWT augmentation
    // (which expects game user payload) — admin tokens carry { sub: 'super-admin' }.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = app.jwt.sign({ sub: 'super-admin' } as any, { expiresIn: '24h' })

    return reply.send({ token, expiresIn: 86400 })
  })

  // ── Protected routes ──────────────────────────────────────────────────────

  // GET /admin/users?page=1&pageSize=20&search=Q&sortBy=col&sortDir=asc
  app.get(
    '/admin/users',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const query = request.query as {
        page?: string
        pageSize?: string
        search?: string
        sortBy?: string
        sortDir?: string
      }

      const page = Math.max(1, parseInt(query.page ?? '1', 10))
      const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10)))
      const search = query.search?.trim() ?? ''
      const sortDir = query.sortDir === 'desc' ? 'desc' : 'asc'

      // Only allow sort on User-level columns (GameState columns need subquery ordering)
      const allowedSortFields = ['createdAt', 'updatedAt'] as const
      type AllowedSortField = (typeof allowedSortFields)[number]
      const sortBy: AllowedSortField = allowedSortFields.includes(
        query.sortBy as AllowedSortField,
      )
        ? (query.sortBy as AllowedSortField)
        : 'createdAt'

      const where = search
        ? {
            OR: [
              { telegramId: { contains: search, mode: 'insensitive' as const } },
              { username: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          include: { gameState: true },
          orderBy: { [sortBy]: sortDir },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.user.count({ where }),
      ])

      const items = users.map((u) => ({
        id: u.id,
        telegramId: u.telegramId,
        username: u.username,
        currentLocation: u.gameState?.currentLocation ?? 1,
        maxLevel: extractMaxLevel(u.gameState?.discoveredLevels),
        gold: (u.gameState?.gold ?? 0n).toString(),
        essence: extractEssence(u.gameState?.cosmic),
        lastSeen: (u.gameState?.lastSessionAt ?? u.updatedAt).toISOString(),
        banned: u.banned,
        createdAt: u.createdAt.toISOString(),
      }))

      return reply.send({ items, total, page, pageSize })
    },
  )

  // GET /admin/users/:id
  app.get(
    '/admin/users/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const userId = parseInt(id, 10)

      if (isNaN(userId)) {
        return reply.code(400).send({ error: 'invalid id' })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { gameState: true },
      })

      if (!user) {
        return reply.code(404).send({ error: 'user not found' })
      }

      const gs = user.gameState

      return reply.send({
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        currentLocation: gs?.currentLocation ?? 1,
        maxLevel: extractMaxLevel(gs?.discoveredLevels),
        gold: (gs?.gold ?? 0n).toString(),
        essence: extractEssence(gs?.cosmic),
        lastSeen: (gs?.lastSessionAt ?? user.updatedAt).toISOString(),
        banned: user.banned,
        createdAt: user.createdAt.toISOString(),
        // Full GameState fields
        upgrades: gs?.upgrades ?? {},
        frogPurchases: gs?.frogPurchases ?? [],
        discoveredLevels: gs?.discoveredLevels ?? [1],
        magnetEnabled: gs?.magnetEnabled ?? true,
        locationFrogs: gs?.locationFrogs ?? [],
        cosmic: gs?.cosmic ?? null,
        boxOpenCount: gs?.boxOpenCount ?? 0,
        incomePerSec: gs?.incomePerSec ?? 0,
      })
    },
  )

  // POST /admin/users/:id/grant
  app.post(
    '/admin/users/:id/grant',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const userId = parseInt(id, 10)

      if (isNaN(userId)) {
        return reply.code(400).send({ error: 'invalid id' })
      }

      const body = request.body as GrantBody
      const { kind, element, amount } = body

      if (!kind || !['gold', 'essence', 'serum'].includes(kind)) {
        return reply.code(400).send({ error: 'invalid kind' })
      }
      if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
        return reply.code(400).send({ error: 'amount must be a positive integer' })
      }
      if (kind === 'serum' && !element) {
        return reply.code(400).send({ error: 'element is required for serum grant' })
      }

      const gs = await prisma.gameState.findUnique({ where: { userId } })
      if (!gs) {
        return reply.code(404).send({ error: 'user or game state not found' })
      }

      let newValue: number | string

      if (kind === 'gold') {
        const updated = await prisma.gameState.update({
          where: { userId },
          data: { gold: gs.gold + BigInt(amount) },
        })
        newValue = updated.gold.toString()
      } else if (kind === 'essence') {
        const cosmic = (gs.cosmic ?? {}) as Record<string, unknown>
        const currentEssence = typeof cosmic.essence === 'number' ? cosmic.essence : 0
        const newEssence = currentEssence + amount
        await prisma.gameState.update({
          where: { userId },
          data: { cosmic: { ...cosmic, essence: newEssence } },
        })
        newValue = newEssence
      } else {
        // kind === 'serum'
        const cosmic = (gs.cosmic ?? {}) as Record<string, unknown>
        const serums = (
          cosmic.serums !== null && typeof cosmic.serums === 'object'
            ? cosmic.serums
            : {}
        ) as Record<string, number>
        const current = typeof serums[element!] === 'number' ? serums[element!] : 0
        const newAmount = current + amount
        await prisma.gameState.update({
          where: { userId },
          data: {
            cosmic: { ...cosmic, serums: { ...serums, [element!]: newAmount } },
          },
        })
        newValue = newAmount
      }

      return reply.send({ success: true, newValue })
    },
  )

  // GET /admin/chains — race chain + quest config (for admin Race Chains page)
  app.get(
    '/admin/chains',
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      return reply.send(CHAINS_RESPONSE)
    },
  )

  // POST /admin/users/:id/ban
  app.post(
    '/admin/users/:id/ban',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const userId = parseInt(id, 10)

      if (isNaN(userId)) {
        return reply.code(400).send({ error: 'invalid id' })
      }

      const body = request.body as { banned?: boolean }
      if (typeof body.banned !== 'boolean') {
        return reply.code(400).send({ error: 'banned must be a boolean' })
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { banned: body.banned },
      })

      return reply.send({ success: true, banned: user.banned })
    },
  )
}
