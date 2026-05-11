import { FastifyInstance } from 'fastify'

// STUB — серверная rarity-логика будет добавлена следующим коммитом.
// Сейчас возвращаем заглушку чтобы клиент мог интегрироваться с эндпоинтом.
export async function boxRoutes(app: FastifyInstance) {
  app.post(
    '/game/box/open',
    { preHandler: [app.authenticate] },
    async (request) => {
      const body = request.body as { type?: 'regular' | 'rare' }
      const type = body.type ?? 'regular'

      // TODO: port rarityRoll from client/src/utils/rarityRoll.ts
      // TODO: update PityState
      // TODO: roll drop contents based on rarity
      return {
        stub: true,
        type,
        rarity: 'common' as const,
        contents: [] as Array<{ kind: string; payload: unknown }>,
      }
    },
  )
}
