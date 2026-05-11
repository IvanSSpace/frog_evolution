import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma'

// Anti-cheat threshold для idle income.
// 100B gold/sec — заведомо больше любого realistic дохода.
// Ловит только грубые читы (gold = 1e20 через DevTools), не trip'ает на legit play.
const MAX_GOLD_PER_SEC = 100_000_000_000n // 1e11 как BigInt

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
        'boxOpenCount',
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

      // Idle income clamp: если новый gold превышает разумный максимум
      // (старый + max_rate * elapsed) — clamp'им к этому максимуму.
      // Существующая state нужна для вычисления — fetch если ещё не получали.
      if ('gold' in data && typeof data.gold === 'bigint') {
        const current = await prisma.gameState.findUnique({
          where: { userId: request.user.id },
        })
        if (current) {
          const elapsedMs = Date.now() - current.lastSessionAt.getTime()
          const elapsedSec = BigInt(Math.max(0, Math.floor(elapsedMs / 1000)))
          const maxGain = MAX_GOLD_PER_SEC * elapsedSec
          const maxAllowed = current.gold + maxGain
          if (data.gold > maxAllowed) {
            app.log.warn({
              userId: request.user.id,
              oldGold: current.gold.toString(),
              attempted: data.gold.toString(),
              clamped: maxAllowed.toString(),
              elapsedSec: elapsedSec.toString(),
            }, 'gold clamp: idle income exceeded')
            data.gold = maxAllowed
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
