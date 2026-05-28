import { FastifyInstance } from 'fastify'
import { ClanRole, ClanRequestType } from '@prisma/client'
import { prisma } from '../prisma'
import {
  slimeRequestCap,
  ESSENCE_REQUEST_CAP,
  SERUM_REQUEST_CAP,
} from '../services/clanLimits'

const CREATE_COST = 3
const MAX_MEMBERS = 30
const COOLDOWN_MS = 60 * 60 * 1000
const REQUEST_TTL_MS = 18 * 60 * 60 * 1000
const PIN_TTL_MS = 24 * 60 * 60 * 1000
const MSG_MAX_LEN = 500
const PIN_MAX_LEN = 300
const NAME_MIN = 2
const NAME_MAX = 24
const HEX_RE = /^#[0-9a-fA-F]{6}$/
const VALID_ELEMENTS = ['fire', 'ice', 'water', 'forest', 'toxic', 'plasma', 'crystal', 'desert', 'gas', 'ring', 'binary']

type CosmicBlob = Record<string, unknown> & { essence?: number; serums?: Record<string, number> }

async function readCosmic(userId: number): Promise<CosmicBlob> {
  const gs = await prisma.gameState.findUnique({ where: { userId }, select: { cosmic: true } })
  return ((gs?.cosmic as CosmicBlob | null) ?? {}) as CosmicBlob
}

async function writeCosmic(userId: number, mutate: (b: CosmicBlob) => void) {
  const cur = await readCosmic(userId)
  mutate(cur)
  await prisma.gameState.update({ where: { userId }, data: { cosmic: cur as object } })
}

function serializeRequest(r: {
  id: number
  clanId: number
  requesterId: number
  type: ClanRequestType
  element: string | null
  targetAmount: bigint
  currentAmount: bigint
  completed: boolean
  createdAt: Date
  expiresAt: Date
}) {
  return {
    id: r.id,
    clanId: r.clanId,
    requesterId: r.requesterId,
    type: r.type,
    element: r.element,
    targetAmount: String(r.targetAmount),
    currentAmount: String(r.currentAmount),
    completed: r.completed,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
  }
}

async function cleanupExpired(clanId: number) {
  const now = new Date()
  await prisma.clanRequest.deleteMany({
    where: { clanId, expiresAt: { lt: now }, completed: false },
  })
  await prisma.clanPin.deleteMany({
    where: { clanId, expiresAt: { lt: now } },
  })
}

async function getMePayload(userId: number) {
  const membership = await prisma.clanMember.findUnique({
    where: { userId },
    include: { clan: true },
  })

  const cooldownRow = await prisma.userClanCooldown.findUnique({ where: { userId } })
  const cooldownUntil = cooldownRow?.until?.toISOString() ?? null

  if (!membership) {
    return { clan: null, cooldownUntil }
  }

  const clanId = membership.clanId
  await cleanupExpired(clanId)

  const members = await prisma.clanMember.findMany({
    where: { clanId },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { joinedAt: 'asc' },
  })

  const messages = await prisma.clanMessage.findMany({
    where: { clanId },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  messages.reverse()

  const now = new Date()
  const requests = await prisma.clanRequest.findMany({
    where: { clanId, expiresAt: { gte: now }, completed: false },
    orderBy: { createdAt: 'asc' },
  })

  const pin = await prisma.clanPin.findFirst({
    where: { clanId, expiresAt: { gte: now } },
    orderBy: { createdAt: 'desc' },
  })

  return {
    clan: {
      id: membership.clan.id,
      name: membership.clan.name,
      emblem: {
        variant: membership.clan.emblemVariant,
        style: membership.clan.emblemStyle,
        bg: membership.clan.emblemBg,
        frog: membership.clan.emblemFrog,
        topColor: membership.clan.emblemTopColor ?? undefined,
        stripeColor: membership.clan.emblemStripeColor ?? undefined,
      },
      minEssence: membership.clan.minEssence,
      leaderId: membership.clan.leaderId,
      createdAt: membership.clan.createdAt.toISOString(),
    },
    me: { role: membership.role },
    members: members.map((m) => ({
      userId: m.userId,
      username: m.user.username ?? null,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
    messages: messages.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username ?? null,
      text: m.text,
      createdAt: m.createdAt.toISOString(),
    })),
    requests: requests.map(serializeRequest),
    pin: pin
      ? {
          id: pin.id,
          authorId: pin.authorId,
          text: pin.text,
          missionRef: pin.missionRef,
          createdAt: pin.createdAt.toISOString(),
          expiresAt: pin.expiresAt.toISOString(),
        }
      : null,
  }
}

export async function clanRoutes(app: FastifyInstance) {
  // GET /clan/list
  app.get('/clan/list', { preHandler: [app.authenticate] }, async (request) => {
    const query = request.query as { search?: string; page?: string }
    const page = Math.max(0, parseInt(query.page ?? '0', 10) || 0)
    const search = query.search?.trim() ?? ''
    const pageSize = 20

    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {}

    const [clans, total] = await Promise.all([
      prisma.clan.findMany({
        where,
        orderBy: { lastActivityAt: 'desc' },
        skip: page * pageSize,
        take: pageSize,
        include: { _count: { select: { members: true } } },
      }),
      prisma.clan.count({ where }),
    ])

    return {
      clans: clans.map((c) => ({
        id: c.id,
        name: c.name,
        emblem: {
          variant: c.emblemVariant,
          style: c.emblemStyle,
          bg: c.emblemBg,
          frog: c.emblemFrog,
          topColor: c.emblemTopColor ?? undefined,
          stripeColor: c.emblemStripeColor ?? undefined,
        },
        minEssence: c.minEssence,
        memberCount: c._count.members,
      })),
      total,
    }
  })

  // GET /clan/me
  app.get('/clan/me', { preHandler: [app.authenticate] }, async (request) => {
    return getMePayload(request.user.id)
  })

  // POST /clan/create
  app.post('/clan/create', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.id
    type EmblemBody = { variant?: unknown; style?: unknown; bg?: unknown; frog?: unknown; topColor?: unknown; stripeColor?: unknown }
    const body = request.body as { name?: string; emblem?: EmblemBody; minEssence?: number }

    const name = (body.name ?? '').trim()
    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      return reply.code(400).send({ error: `name must be ${NAME_MIN}-${NAME_MAX} chars` })
    }

    const emb = body.emblem ?? {}
    const emblemVariant = Number(emb.variant ?? 0)
    if (!Number.isInteger(emblemVariant) || emblemVariant < 0 || emblemVariant > 49) {
      return reply.code(400).send({ error: 'emblem.variant must be integer 0..49' })
    }
    const emblemStyle = String(emb.style ?? 'pond')
    if (emblemStyle !== 'pond' && emblemStyle !== 'stripes') {
      return reply.code(400).send({ error: 'emblem.style must be pond or stripes' })
    }
    const emblemBg = String(emb.bg ?? '')
    if (!HEX_RE.test(emblemBg)) {
      return reply.code(400).send({ error: 'emblem.bg must be #rrggbb hex' })
    }
    const emblemFrog = String(emb.frog ?? '')
    if (!HEX_RE.test(emblemFrog)) {
      return reply.code(400).send({ error: 'emblem.frog must be #rrggbb hex' })
    }

    if (emblemStyle === 'stripes') {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { devFlags: true } })
      if (!user?.devFlags.includes('clan_admin_emblem')) {
        return reply.code(403).send({ error: 'stripes emblem reserved for admin' })
      }
    }

    let emblemTopColor: string | null = null
    let emblemStripeColor: string | null = null
    if (emblemStyle === 'stripes') {
      const tc = String(emb.topColor ?? '')
      const sc = String(emb.stripeColor ?? '')
      if (!HEX_RE.test(tc)) return reply.code(400).send({ error: 'emblem.topColor must be #rrggbb hex' })
      if (!HEX_RE.test(sc)) return reply.code(400).send({ error: 'emblem.stripeColor must be #rrggbb hex' })
      emblemTopColor = tc
      emblemStripeColor = sc
    }

    const minEssence = Number(body.minEssence ?? 0)
    if (!Number.isInteger(minEssence) || minEssence < 0) {
      return reply.code(400).send({ error: 'minEssence must be non-negative integer' })
    }

    const existing = await prisma.clanMember.findUnique({ where: { userId } })
    if (existing) {
      return reply.code(409).send({ error: 'already in a clan' })
    }

    const cooldown = await prisma.userClanCooldown.findUnique({ where: { userId } })
    if (cooldown && cooldown.until > new Date()) {
      return reply.code(409).send({ error: 'cooldown active', until: cooldown.until.toISOString() })
    }

    const taken = await prisma.clan.findUnique({ where: { name } })
    if (taken) {
      return reply.code(409).send({ error: 'name taken' })
    }

    const cosmic = await readCosmic(userId)
    const essence = Number(cosmic.essence ?? 0)
    if (essence < CREATE_COST) {
      return reply.code(400).send({ error: 'insufficient essence', need: CREATE_COST, have: essence })
    }

    await writeCosmic(userId, (b) => { b.essence = (Number(b.essence ?? 0)) - CREATE_COST })

    const clan = await prisma.$transaction(async (tx) => {
      const c = await tx.clan.create({
        data: {
          name,
          emblemVariant,
          emblemStyle,
          emblemBg,
          emblemFrog,
          emblemTopColor,
          emblemStripeColor,
          minEssence,
          leaderId: userId,
        },
      })
      await tx.clanMember.create({
        data: { clanId: c.id, userId, role: ClanRole.LEADER },
      })
      return c
    })

    if (cooldown) {
      await prisma.userClanCooldown.delete({ where: { userId } })
    }

    return getMePayload(userId)
  })

  // POST /clan/:id/join
  app.post('/clan/:id/join', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.id
    const clanId = Number((request.params as { id: string }).id)

    const existing = await prisma.clanMember.findUnique({ where: { userId } })
    if (existing) {
      return reply.code(409).send({ error: 'already in a clan' })
    }

    const cooldown = await prisma.userClanCooldown.findUnique({ where: { userId } })
    if (cooldown && cooldown.until > new Date()) {
      return reply.code(409).send({ error: 'cooldown active', until: cooldown.until.toISOString() })
    }

    const clan = await prisma.clan.findUnique({
      where: { id: clanId },
      include: { _count: { select: { members: true } } },
    })
    if (!clan) return reply.code(404).send({ error: 'clan not found' })

    if (clan._count.members >= MAX_MEMBERS) {
      return reply.code(409).send({ error: 'clan is full' })
    }

    if (clan.minEssence > 0) {
      const cosmic = await readCosmic(userId)
      const essence = Number(cosmic.essence ?? 0)
      if (essence < clan.minEssence) {
        return reply.code(400).send({ error: 'insufficient essence', need: clan.minEssence, have: essence })
      }
    }

    await prisma.clanMember.create({ data: { clanId, userId, role: ClanRole.MEMBER } })
    await prisma.clan.update({ where: { id: clanId }, data: { lastActivityAt: new Date() } })

    return getMePayload(userId)
  })

  // POST /clan/leave
  app.post('/clan/leave', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.id

    const membership = await prisma.clanMember.findUnique({ where: { userId } })
    if (!membership) return reply.code(404).send({ error: 'not in a clan' })

    const clanId = membership.clanId

    if (membership.role === ClanRole.LEADER) {
      const others = await prisma.clanMember.findMany({
        where: { clanId, userId: { not: userId } },
        orderBy: { joinedAt: 'asc' },
      })

      if (others.length === 0) {
        await prisma.clan.delete({ where: { id: clanId } })
      } else {
        const nextLeader =
          others.find((m) => m.role === ClanRole.COLEADER) ?? others[0]
        await prisma.clanMember.update({
          where: { id: nextLeader.id },
          data: { role: ClanRole.LEADER },
        })
        await prisma.clan.update({ where: { id: clanId }, data: { leaderId: nextLeader.userId } })
        await prisma.clanMember.delete({ where: { userId } })
      }
    } else {
      await prisma.clanMember.delete({ where: { userId } })
    }

    const until = new Date(Date.now() + COOLDOWN_MS)
    await prisma.userClanCooldown.upsert({
      where: { userId },
      create: { userId, until },
      update: { until },
    })

    return { ok: true, cooldownUntil: until.toISOString() }
  })

  // POST /clan/:id/kick/:userId
  app.post('/clan/:id/kick/:userId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const requesterId = request.user.id
    const clanId = Number((request.params as { id: string; userId: string }).id)
    const targetId = Number((request.params as { id: string; userId: string }).userId)

    const requesterMembership = await prisma.clanMember.findFirst({
      where: { userId: requesterId, clanId },
    })
    if (
      !requesterMembership ||
      (requesterMembership.role !== ClanRole.LEADER && requesterMembership.role !== ClanRole.COLEADER)
    ) {
      return reply.code(403).send({ error: 'not authorized' })
    }

    const targetMembership = await prisma.clanMember.findFirst({
      where: { userId: targetId, clanId },
    })
    if (!targetMembership) return reply.code(404).send({ error: 'target not in clan' })
    if (targetMembership.role === ClanRole.LEADER) {
      return reply.code(403).send({ error: 'cannot kick leader' })
    }
    if (
      requesterMembership.role === ClanRole.COLEADER &&
      targetMembership.role === ClanRole.COLEADER
    ) {
      return reply.code(403).send({ error: 'coleader cannot kick coleader' })
    }

    await prisma.clanMember.delete({ where: { userId: targetId } })

    const until = new Date(Date.now() + COOLDOWN_MS)
    await prisma.userClanCooldown.upsert({
      where: { userId: targetId },
      create: { userId: targetId, until },
      update: { until },
    })

    return { ok: true }
  })

  // POST /clan/:id/promote/:userId
  app.post('/clan/:id/promote/:userId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const requesterId = request.user.id
    const clanId = Number((request.params as { id: string; userId: string }).id)
    const targetId = Number((request.params as { id: string; userId: string }).userId)

    const requesterMembership = await prisma.clanMember.findFirst({
      where: { userId: requesterId, clanId },
    })
    if (!requesterMembership || requesterMembership.role !== ClanRole.LEADER) {
      return reply.code(403).send({ error: 'only leader can promote' })
    }

    const targetMembership = await prisma.clanMember.findFirst({
      where: { userId: targetId, clanId },
    })
    if (!targetMembership) return reply.code(404).send({ error: 'target not in clan' })
    if (targetMembership.role !== ClanRole.MEMBER) {
      return reply.code(400).send({ error: 'can only promote MEMBER to COLEADER' })
    }

    await prisma.clanMember.update({
      where: { id: targetMembership.id },
      data: { role: ClanRole.COLEADER },
    })

    return { ok: true }
  })

  // POST /clan/:id/demote/:userId
  app.post('/clan/:id/demote/:userId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const requesterId = request.user.id
    const clanId = Number((request.params as { id: string; userId: string }).id)
    const targetId = Number((request.params as { id: string; userId: string }).userId)

    const requesterMembership = await prisma.clanMember.findFirst({
      where: { userId: requesterId, clanId },
    })
    if (!requesterMembership || requesterMembership.role !== ClanRole.LEADER) {
      return reply.code(403).send({ error: 'only leader can demote' })
    }

    const targetMembership = await prisma.clanMember.findFirst({
      where: { userId: targetId, clanId },
    })
    if (!targetMembership) return reply.code(404).send({ error: 'target not in clan' })
    if (targetMembership.role !== ClanRole.COLEADER) {
      return reply.code(400).send({ error: 'can only demote COLEADER to MEMBER' })
    }

    await prisma.clanMember.update({
      where: { id: targetMembership.id },
      data: { role: ClanRole.MEMBER },
    })

    return { ok: true }
  })

  // POST /clan/:id/transfer/:userId
  app.post('/clan/:id/transfer/:userId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const requesterId = request.user.id
    const clanId = Number((request.params as { id: string; userId: string }).id)
    const targetId = Number((request.params as { id: string; userId: string }).userId)

    const requesterMembership = await prisma.clanMember.findFirst({
      where: { userId: requesterId, clanId },
    })
    if (!requesterMembership || requesterMembership.role !== ClanRole.LEADER) {
      return reply.code(403).send({ error: 'only leader can transfer' })
    }

    const targetMembership = await prisma.clanMember.findFirst({
      where: { userId: targetId, clanId },
    })
    if (!targetMembership) return reply.code(404).send({ error: 'target not in clan' })

    await prisma.$transaction([
      prisma.clanMember.update({
        where: { id: targetMembership.id },
        data: { role: ClanRole.LEADER },
      }),
      prisma.clanMember.update({
        where: { userId: requesterId },
        data: { role: ClanRole.MEMBER },
      }),
      prisma.clan.update({
        where: { id: clanId },
        data: { leaderId: targetId },
      }),
    ])

    return { ok: true }
  })

  // GET /clan/:id/messages
  app.get('/clan/:id/messages', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.id
    const clanId = Number((request.params as { id: string }).id)
    const query = request.query as { since?: string }

    const membership = await prisma.clanMember.findFirst({ where: { userId, clanId } })
    if (!membership) return reply.code(403).send({ error: 'not in clan' })

    const since = query.since ? new Date(query.since) : undefined
    const messages = await prisma.clanMessage.findMany({
      where: {
        clanId,
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      include: { user: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    return {
      messages: messages.map((m) => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username ?? null,
        text: m.text,
        createdAt: m.createdAt.toISOString(),
      })),
    }
  })

  // POST /clan/:id/messages
  app.post('/clan/:id/messages', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.id
    const clanId = Number((request.params as { id: string }).id)
    const body = request.body as { text?: string }

    const membership = await prisma.clanMember.findFirst({ where: { userId, clanId } })
    if (!membership) return reply.code(403).send({ error: 'not in clan' })

    const text = (body.text ?? '').trim()
    if (text.length < 1 || text.length > MSG_MAX_LEN) {
      return reply.code(400).send({ error: `text must be 1-${MSG_MAX_LEN} chars` })
    }

    const msg = await prisma.clanMessage.create({
      data: { clanId, userId, text },
      include: { user: { select: { id: true, username: true } } },
    })
    await prisma.clan.update({ where: { id: clanId }, data: { lastActivityAt: new Date() } })

    return {
      id: msg.id,
      userId: msg.userId,
      username: msg.user.username ?? null,
      text: msg.text,
      createdAt: msg.createdAt.toISOString(),
    }
  })

  // POST /clan/:id/requests
  app.post('/clan/:id/requests', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.id
    const clanId = Number((request.params as { id: string }).id)
    const body = request.body as { type?: string; element?: string; amount?: unknown }

    const membership = await prisma.clanMember.findFirst({ where: { userId, clanId } })
    if (!membership) return reply.code(403).send({ error: 'not in clan' })

    const typeStr = body.type?.toUpperCase()
    if (!typeStr || !Object.values(ClanRequestType).includes(typeStr as ClanRequestType)) {
      return reply.code(400).send({ error: 'invalid type' })
    }
    const type = typeStr as ClanRequestType

    let element: string | null = null
    if (type === ClanRequestType.SERUM) {
      if (!body.element || !VALID_ELEMENTS.includes(body.element)) {
        return reply.code(400).send({ error: 'invalid element for SERUM request' })
      }
      element = body.element
    }

    let amount: bigint
    try {
      amount = BigInt(String(body.amount ?? '0'))
    } catch {
      return reply.code(400).send({ error: 'invalid amount' })
    }
    if (amount <= 0n) {
      return reply.code(400).send({ error: 'amount must be positive' })
    }

    if (type === ClanRequestType.SLIME) {
      const cap = await slimeRequestCap(userId)
      if (amount > cap) {
        return reply.code(400).send({ error: 'amount exceeds cap', cap: String(cap) })
      }
    } else if (type === ClanRequestType.ESSENCE) {
      if (amount > ESSENCE_REQUEST_CAP) {
        return reply.code(400).send({ error: 'amount exceeds cap', cap: String(ESSENCE_REQUEST_CAP) })
      }
    } else if (type === ClanRequestType.SERUM) {
      if (amount > SERUM_REQUEST_CAP) {
        return reply.code(400).send({ error: 'amount exceeds cap', cap: String(SERUM_REQUEST_CAP) })
      }
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + REQUEST_TTL_MS)

    const req = await prisma.clanRequest.create({
      data: { clanId, requesterId: userId, type, element, targetAmount: amount, expiresAt },
    })
    await prisma.clan.update({ where: { id: clanId }, data: { lastActivityAt: now } })

    return serializeRequest(req)
  })

  // POST /clan/requests/:id/donate
  app.post('/clan/requests/:id/donate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const donorId = request.user.id
    const requestId = Number((request.params as { id: string }).id)
    const body = request.body as { amount?: unknown }

    let donateAmount: bigint
    try {
      donateAmount = BigInt(String(body.amount ?? '0'))
    } catch {
      return reply.code(400).send({ error: 'invalid amount' })
    }
    if (donateAmount <= 0n) {
      return reply.code(400).send({ error: 'amount must be positive' })
    }

    const req = await prisma.clanRequest.findUnique({ where: { id: requestId } })
    if (!req) return reply.code(404).send({ error: 'request not found' })

    const now = new Date()
    if (req.expiresAt < now) return reply.code(409).send({ error: 'request expired' })
    if (req.completed) return reply.code(409).send({ error: 'request already completed' })

    const remaining = req.targetAmount - req.currentAmount
    if (donateAmount > remaining) {
      return reply.code(400).send({ error: 'amount exceeds remaining', remaining: String(remaining) })
    }

    const donorMembership = await prisma.clanMember.findFirst({
      where: { userId: donorId, clanId: req.clanId },
    })
    if (!donorMembership) return reply.code(403).send({ error: 'not in clan' })

    const donorGs = await prisma.gameState.findUnique({ where: { userId: donorId } })
    if (!donorGs) return reply.code(404).send({ error: 'no game state' })

    const requesterGs = await prisma.gameState.findUnique({ where: { userId: req.requesterId } })
    if (!requesterGs) return reply.code(404).send({ error: 'requester has no game state' })

    if (req.type === ClanRequestType.SLIME) {
      if (donorGs.gold < donateAmount) {
        return reply.code(400).send({ error: 'insufficient gold', have: String(donorGs.gold) })
      }
    } else if (req.type === ClanRequestType.ESSENCE) {
      const cosmic = await readCosmic(donorId)
      const have = Number(cosmic.essence ?? 0)
      if (BigInt(have) < donateAmount) {
        return reply.code(400).send({ error: 'insufficient essence', have })
      }
    } else if (req.type === ClanRequestType.SERUM) {
      const cosmic = await readCosmic(donorId)
      const serums = cosmic.serums ?? {}
      const have = Number(serums[req.element!] ?? 0)
      if (BigInt(have) < donateAmount) {
        return reply.code(400).send({ error: 'insufficient serum', have })
      }
    }

    const newCurrent = req.currentAmount + donateAmount
    const completed = newCurrent >= req.targetAmount

    const updatedReq = await prisma.$transaction(async (tx) => {
      if (req.type === ClanRequestType.SLIME) {
        await tx.gameState.update({
          where: { userId: donorId },
          data: { gold: { decrement: donateAmount } },
        })
        await tx.gameState.update({
          where: { userId: req.requesterId },
          data: { gold: { increment: donateAmount } },
        })
      } else if (req.type === ClanRequestType.ESSENCE) {
        const donorCosmic = (donorGs.cosmic as CosmicBlob | null) ?? {} as CosmicBlob
        donorCosmic.essence = (Number(donorCosmic.essence ?? 0)) - Number(donateAmount)
        await tx.gameState.update({ where: { userId: donorId }, data: { cosmic: donorCosmic as object } })

        const reqCosmic = (requesterGs.cosmic as CosmicBlob | null) ?? {} as CosmicBlob
        reqCosmic.essence = (Number(reqCosmic.essence ?? 0)) + Number(donateAmount)
        await tx.gameState.update({ where: { userId: req.requesterId }, data: { cosmic: reqCosmic as object } })
      } else if (req.type === ClanRequestType.SERUM) {
        const el = req.element!
        const donorCosmic = (donorGs.cosmic as CosmicBlob | null) ?? {} as CosmicBlob
        const donorSerums = donorCosmic.serums ?? {}
        donorSerums[el] = (Number(donorSerums[el] ?? 0)) - Number(donateAmount)
        donorCosmic.serums = donorSerums
        await tx.gameState.update({ where: { userId: donorId }, data: { cosmic: donorCosmic as object } })

        const reqCosmic = (requesterGs.cosmic as CosmicBlob | null) ?? {} as CosmicBlob
        const reqSerums = reqCosmic.serums ?? {}
        reqSerums[el] = (Number(reqSerums[el] ?? 0)) + Number(donateAmount)
        reqCosmic.serums = reqSerums
        await tx.gameState.update({ where: { userId: req.requesterId }, data: { cosmic: reqCosmic as object } })
      }

      await tx.clanDonation.create({
        data: { requestId, donorId, amount: donateAmount },
      })

      return tx.clanRequest.update({
        where: { id: requestId },
        data: { currentAmount: newCurrent, completed },
      })
    })

    return serializeRequest(updatedReq)
  })

  // POST /clan/:id/pin
  app.post('/clan/:id/pin', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.id
    const clanId = Number((request.params as { id: string }).id)
    const body = request.body as { text?: string; missionRef?: string }

    const membership = await prisma.clanMember.findFirst({ where: { userId, clanId } })
    if (
      !membership ||
      (membership.role !== ClanRole.LEADER && membership.role !== ClanRole.COLEADER)
    ) {
      return reply.code(403).send({ error: 'only leader or coleader can pin' })
    }

    const text = (body.text ?? '').trim()
    if (text.length < 1 || text.length > PIN_MAX_LEN) {
      return reply.code(400).send({ error: `text must be 1-${PIN_MAX_LEN} chars` })
    }

    const now = new Date()
    await prisma.clanPin.deleteMany({ where: { clanId } })

    const expiresAt = new Date(now.getTime() + PIN_TTL_MS)
    const pin = await prisma.clanPin.create({
      data: { clanId, authorId: userId, text, missionRef: body.missionRef ?? null, expiresAt },
    })

    return {
      id: pin.id,
      authorId: pin.authorId,
      text: pin.text,
      missionRef: pin.missionRef,
      createdAt: pin.createdAt.toISOString(),
      expiresAt: pin.expiresAt.toISOString(),
    }
  })

  // DELETE /clan/:id/pin
  app.delete('/clan/:id/pin', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.id
    const clanId = Number((request.params as { id: string }).id)

    const membership = await prisma.clanMember.findFirst({ where: { userId, clanId } })
    if (
      !membership ||
      (membership.role !== ClanRole.LEADER && membership.role !== ClanRole.COLEADER)
    ) {
      return reply.code(403).send({ error: 'only leader or coleader can delete pin' })
    }

    await prisma.clanPin.deleteMany({ where: { clanId } })
    return { ok: true }
  })
}
