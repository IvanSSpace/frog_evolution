import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma'

export async function gameStateRoutes(app: FastifyInstance) {
  app.get(
    '/game/state',
    { preHandler: [app.authenticate] },
    async (request) => {
      let state = await prisma.gameState.findUnique({
        where: { userId: request.user.id },
      })
      if (!state) {
        state = await prisma.gameState.create({
          data: { userId: request.user.id },
        })
      }
      return {
        ...state,
        gold: state.gold.toString(), // BigInt → string for JSON
      }
    },
  )

  app.put(
    '/game/state',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>
      const allowed = [
        'gold',
        'upgrades',
        'frogPurchases',
        'discoveredLevels',
        'magnetEnabled',
        'currentLocation',
        'locationFrogs',
        'cosmic',
        'lastSessionAt',
      ]
      const data: Record<string, unknown> = {}
      for (const key of allowed) {
        if (key in body) {
          if (key === 'gold' && typeof body.gold === 'string') {
            data.gold = BigInt(body.gold)
          } else if (key === 'lastSessionAt' && typeof body.lastSessionAt === 'string') {
            data.lastSessionAt = new Date(body.lastSessionAt)
          } else {
            data[key] = body[key]
          }
        }
      }

      const state = await prisma.gameState.upsert({
        where: { userId: request.user.id },
        update: data,
        create: { userId: request.user.id, ...data },
      })

      return {
        ...state,
        gold: state.gold.toString(),
      }
    },
  )
}
