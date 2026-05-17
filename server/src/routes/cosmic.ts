import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma'
import {
  adjustSerum,
  getSerumCount,
  isValidElement,
  type CarrierData,
  type Element,
} from '../config/cosmic'

interface ApplySerumBody {
  frogId?: string
  element?: string
  level?: number
}

export async function cosmicRoutes(app: FastifyInstance) {
  // POST /game/cosmic/apply-serum
  // Phase 22: rarity validation removed. Any frog (any level) can accept a serum.
  // Request body: { frogId, element, level }
  app.post(
    '/game/cosmic/apply-serum',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = request.body as ApplySerumBody
      const { frogId, element, level } = body

      if (!frogId || typeof frogId !== 'string') {
        return reply.code(400).send({ error: 'frogId required' })
      }
      if (!isValidElement(element)) {
        return reply.code(400).send({ error: 'invalid element' })
      }
      if (typeof level !== 'number' || level < 1 || level > 24) {
        return reply.code(400).send({ error: 'invalid level' })
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
      const have = getSerumCount(serums, element as Element)
      if (have < 1) {
        return reply.code(400).send({ error: 'no serum', have })
      }

      // Guard 2: frog уже carrier? (idempotency)
      if (carriers.some((c) => c.frogId === frogId)) {
        return reply.code(400).send({ error: 'already carrier' })
      }

      // Apply: decrement serum + add carrier.
      const nextSerums = adjustSerum(serums, element as Element, -1)
      const newCarrier: CarrierData = {
        frogId,
        element: element as Element,
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
