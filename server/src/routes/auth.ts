import { FastifyInstance } from 'fastify'
import { validateInitData, upsertUser } from '../services/telegram'
import { config } from '../config'

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/telegram', async (request, reply) => {
    const { initData } = request.body as { initData: string }

    if (!initData) {
      return reply.code(400).send({ error: 'initData is required' })
    }

    const telegramUser = validateInitData(initData, config.telegramBotToken)

    if (!telegramUser) {
      return reply.code(401).send({ error: 'Invalid initData' })
    }

    const user = await upsertUser(telegramUser)

    const token = fastify.jwt.sign(
      { telegramId: user.telegramId },
      { expiresIn: '30d' }
    )

    return reply.send({ payload: { token }, user })
  })
}
