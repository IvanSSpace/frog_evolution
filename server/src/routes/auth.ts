import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma'
import { validateInitData } from '../services/telegram'

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/telegram', async (request, reply) => {
    const body = request.body as { initData?: string }
    if (!body.initData) {
      return reply.code(400).send({ error: 'missing initData' })
    }

    const parsed = validateInitData(body.initData)
    if (!parsed) {
      return reply.code(401).send({ error: 'invalid initData' })
    }

    const user = await prisma.user.upsert({
      where: { telegramId: parsed.telegramId },
      update: {
        username: parsed.username,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        photoUrl: parsed.photoUrl,
      },
      create: {
        telegramId: parsed.telegramId,
        username: parsed.username,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        photoUrl: parsed.photoUrl,
      },
    })

    const token = app.jwt.sign({ id: user.id, telegramId: user.telegramId })
    return { token, user }
  })
}
