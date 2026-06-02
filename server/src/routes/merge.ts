import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma'
import { parseOr400 } from '../lib/validate'
import { getFrogLocation, MAX_LEVEL } from '../config/economy'

const MergeBody = z.object({
  fromLevel: z.number().int().min(1).max(MAX_LEVEL),
  locationId: z.number().int().min(1).max(3),
})

export async function mergeRoutes(app: FastifyInstance) {
  app.post(
    '/game/merge',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = parseOr400(MergeBody, request.body, reply)
      if (!parsed) return
      const { fromLevel, locationId } = parsed

      // Serializable tx — read+merge+write атомарно (AUDIT §3C): два параллельных
      // merge на одну пару не должны срабатывать дважды.
      const result = await prisma.$transaction(
        async (tx) => {
          const state = await tx.gameState.findUnique({
            where: { userId: request.user.id },
          })
          if (!state) return { error: 'no game state', code: 404 } as const

          // Parse и validate locationFrogs
          const locFrogs = (state.locationFrogs as number[][]) ?? [[], [], []]
          const sourceLoc = locFrogs[locationId - 1] ?? []

          // Count occurrences of fromLevel в source
          const matches: number[] = []
          sourceLoc.forEach((lvl, idx) => {
            if (lvl === fromLevel && matches.length < 2) matches.push(idx)
          })

          if (matches.length < 2) {
            // Desync: клиент сделал merge визуально, но новые лягушки (из бокса,
            // открытого дроном) ещё не дошли до сервера (PUT throttled 5с). НЕ 400 —
            // иначе спам ошибок по кд. Возвращаем 200 skipped; клиент сделает
            // форс-PUT со своим authoritative-стейтом и сервер дозаполнит.
            return {
              ok: false as const,
              skipped: true as const,
              reason: 'not_enough_frogs',
              gold: state.gold.toString(),
              locationFrogs: state.locationFrogs,
              discoveredLevels: state.discoveredLevels,
            }
          }

          // Apply merge — clone locFrogs
          const nextLocFrogs = locFrogs.map((arr) => [...arr])
          // Remove 2 from source — by index in reverse чтобы не сбить ordering
          const removeIndices = [...matches].sort((a, b) => b - a)
          for (const idx of removeIndices) {
            nextLocFrogs[locationId - 1].splice(idx, 1)
          }

          const isSentinel = fromLevel === MAX_LEVEL // L18+L18 → sentinel L19
          const newLevel = isSentinel ? 19 : fromLevel + 1
          const targetLocId = isSentinel ? 0 : getFrogLocation(newLevel)

          if (!isSentinel) {
            nextLocFrogs[targetLocId - 1].push(newLevel)
          }

          const discovered = (state.discoveredLevels as number[]) ?? []
          const nextDiscovered = discovered.includes(newLevel)
            ? discovered
            : [...discovered, newLevel].sort((a, b) => a - b)

          const updated = await tx.gameState.update({
            where: { userId: request.user.id },
            data: {
              locationFrogs: nextLocFrogs,
              discoveredLevels: nextDiscovered,
              lastSessionAt: new Date(),
            },
          })

          return {
            ok: true as const,
            gold: updated.gold.toString(),
            locationFrogs: updated.locationFrogs,
            discoveredLevels: updated.discoveredLevels,
            newLevel,
            targetLocationId: targetLocId, // 0 для sentinel
            isSentinel,
            crossLocation: !isSentinel && targetLocId !== locationId,
          }
        },
        { isolationLevel: 'Serializable' },
      )

      if ('error' in result) {
        const r = result as { error: string; code: number }
        return reply.code(r.code).send({ error: r.error })
      }
      return result
    },
  )
}
