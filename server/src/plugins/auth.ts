import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import prisma from '../db/prisma'
import { config } from '../config'

const PUBLIC_ROUTES = ['/health', '/auth/telegram', '/telegram/webhook']

const DEV_TELEGRAM_ID = 'dev'

export const authPlugin = fp(async function authPlugin(fastify: FastifyInstance) {
  // В dev-режиме без токена бота — автоматически подставляем dev-юзера
  if (!config.telegramBotToken && !config.isProd) {
    fastify.addHook('preHandler', async (request: FastifyRequest) => {
      const isPublic = PUBLIC_ROUTES.some(
        (route) => request.url === route || request.url.startsWith('/docs')
      )
      if (isPublic) return

      const user = await prisma.user.upsert({
        where: { telegramId: DEV_TELEGRAM_ID },
        update: {},
        create: {
          telegramId: DEV_TELEGRAM_ID,
          username: 'devuser',
          firstName: 'Dev',
          gameState: { create: {} },
        },
      })
      request.user = user
    })
    return
  }

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const isPublic = PUBLIC_ROUTES.some(
      (route) => request.url === route || request.url.startsWith('/docs')
    )
    if (isPublic) return

    try {
      const payload = await request.jwtVerify<{ telegramId: string }>()

      const user = await prisma.user.findUnique({
        where: { telegramId: payload.telegramId },
      })

      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      request.user = user
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' })
    }
  })
})
