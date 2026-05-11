import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma'
import { getFrogLocation, MAX_LEVEL } from '../config/economy'

export async function mergeRoutes(app: FastifyInstance) {
  app.post(
    '/game/merge',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = request.body as {
        fromLevel?: number
        locationId?: number
      }
      const fromLevel = body.fromLevel
      const locationId = body.locationId

      if (
        typeof fromLevel !== 'number' ||
        fromLevel < 1 ||
        fromLevel > MAX_LEVEL ||
        typeof locationId !== 'number' ||
        locationId < 1 ||
        locationId > 3
      ) {
        return reply.code(400).send({ error: 'invalid merge params' })
      }

      const state = await prisma.gameState.findUnique({
        where: { userId: request.user.id },
      })
      if (!state) {
        return reply.code(404).send({ error: 'no game state' })
      }

      // Parse и validate locationFrogs
      const locFrogs = (state.locationFrogs as number[][]) ?? [[], [], []]
      const sourceLoc = locFrogs[locationId - 1] ?? []

      // Count occurrences of fromLevel в source
      const matches: number[] = []
      sourceLoc.forEach((lvl, idx) => {
        if (lvl === fromLevel && matches.length < 2) matches.push(idx)
      })

      if (matches.length < 2) {
        return reply.code(400).send({
          error: 'not enough frogs of this level on location',
          have: sourceLoc.filter((l) => l === fromLevel).length,
          need: 2,
        })
      }

      // Apply merge — clone locFrogs
      const nextLocFrogs = locFrogs.map((arr) => [...arr])

      // Remove 2 from source — remove by index in reverse чтобы не сбить ordering
      const removeIndices = [...matches].sort((a, b) => b - a)
      for (const idx of removeIndices) {
        nextLocFrogs[locationId - 1].splice(idx, 1)
      }

      // Compute newLevel
      const isSentinel = fromLevel === MAX_LEVEL // L18+L18 → sentinel L19
      const newLevel = isSentinel ? 19 : fromLevel + 1
      const targetLocId = isSentinel ? 0 : getFrogLocation(newLevel)

      // Spawn новую лягушку (или skip для sentinel)
      if (!isSentinel) {
        nextLocFrogs[targetLocId - 1].push(newLevel)
      }

      // Update discoveredLevels
      const discovered = (state.discoveredLevels as number[]) ?? []
      const nextDiscovered = discovered.includes(newLevel)
        ? discovered
        : [...discovered, newLevel].sort((a, b) => a - b)

      // Apply
      const updated = await prisma.gameState.update({
        where: { userId: request.user.id },
        data: {
          locationFrogs: nextLocFrogs,
          discoveredLevels: nextDiscovered,
          lastSessionAt: new Date(),
        },
      })

      return {
        ok: true,
        gold: updated.gold.toString(),
        locationFrogs: updated.locationFrogs,
        discoveredLevels: updated.discoveredLevels,
        newLevel,
        targetLocationId: targetLocId, // 0 для sentinel
        isSentinel,
        crossLocation: !isSentinel && targetLocId !== locationId,
      }
    },
  )
}
