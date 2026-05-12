import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma'
import {
  adjustSerum,
  getSerumCount,
  isValidElement,
  isValidRarity,
  RARITY_TO_STARTING_LEVEL,
  type CarrierData,
  type Element,
  type Rarity,
} from '../config/cosmic'

interface ApplySerumBody {
  frogId?: string
  element?: string
  rarity?: string
  level?: number
}

export async function cosmicRoutes(app: FastifyInstance) {
  // POST /game/cosmic/apply-serum
  // Server-validated применение сыворотки на лягушку → создание carrier'а.
  app.post(
    '/game/cosmic/apply-serum',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = request.body as ApplySerumBody
      const { frogId, element, rarity, level } = body

      if (!frogId || typeof frogId !== 'string') {
        return reply.code(400).send({ error: 'frogId required' })
      }
      if (!isValidElement(element)) {
        return reply.code(400).send({ error: 'invalid element' })
      }
      if (!isValidRarity(rarity)) {
        return reply.code(400).send({ error: 'invalid rarity' })
      }
      if (typeof level !== 'number' || level < 1 || level > 24) {
        return reply.code(400).send({ error: 'invalid level' })
      }

      // Eligibility: уровень frog'а должен совпадать с требованием rarity.
      const requiredLevel = RARITY_TO_STARTING_LEVEL[rarity as Rarity]
      if (level !== requiredLevel) {
        return reply.code(400).send({
          error: 'level mismatch',
          required: requiredLevel,
          got: level,
        })
      }

      const state = await prisma.gameState.findUnique({
        where: { userId: request.user.id },
      })
      if (!state) {
        return reply.code(404).send({ error: 'no game state' })
      }

      const cosmic =
        (state.cosmic as Record<string, unknown> | null | undefined) ?? {}
      const serums = cosmic.serums
      const carriers = Array.isArray(cosmic.carriers)
        ? (cosmic.carriers as CarrierData[])
        : []

      // Guard 1: сыворотка доступна?
      const have = getSerumCount(serums, element as Element, rarity as Rarity)
      if (have < 1) {
        return reply.code(400).send({ error: 'no serum', have })
      }

      // Guard 2: frog уже carrier? (idempotency)
      if (carriers.some((c) => c.frogId === frogId)) {
        return reply.code(400).send({ error: 'already carrier' })
      }

      // Apply: decrement serum + add carrier.
      const nextSerums = adjustSerum(
        serums,
        element as Element,
        rarity as Rarity,
        -1,
      )
      const newCarrier: CarrierData = {
        frogId,
        element: element as Element,
        rarity: rarity as Rarity,
        feedCount: 0,
        stabilized: false,
        level,
      }
      const nextCarriers = [...carriers, newCarrier]

      const nextCosmic = {
        ...cosmic,
        serums: nextSerums,
        carriers: nextCarriers,
      }

      await prisma.gameState.update({
        where: { userId: request.user.id },
        data: {
          cosmic: nextCosmic as object,
        },
      })

      return {
        ok: true,
        carrier: newCarrier,
        serums: nextSerums,
      }
    },
  )
}
