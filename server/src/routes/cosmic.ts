import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma'
import { parseOr400 } from '../lib/validate'
import {
  adjustSerum,
  getSerumCount,
  isValidElement,
  type CarrierData,
  type Element,
} from '../config/cosmic'

const ApplySerumBody = z.object({
  frogId: z.string().min(1),
  element: z.string().refine(isValidElement, { message: 'invalid element' }),
  level: z.number().int().min(1).max(24),
})

export async function cosmicRoutes(app: FastifyInstance) {
  // POST /game/cosmic/apply-serum
  // Phase 22: rarity validation removed. Any frog (any level) can accept a serum.
  // Request body: { frogId, element, level }
  app.post(
    '/game/cosmic/apply-serum',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = parseOr400(ApplySerumBody, request.body, reply)
      if (!parsed) return
      const { frogId, element, level } = parsed

      // 2026-05-19: серум applies только на L1 frogs.
      if (level !== 1) {
        return reply.code(400).send({ error: 'serum L1 only' })
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
