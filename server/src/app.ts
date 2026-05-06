import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import fastifyFormbody from '@fastify/formbody'
import { config } from './config'
import { authPlugin } from './plugins/auth'
import { registerRoutes } from './routes'
import { processWebhook } from './bot'
import prisma from './db/prisma'

export async function buildApp() {
  const fastify = Fastify({
    logger: config.isProd,
    // BigInt → строка при сериализации (gold хранится как BigInt)
    serializerOpts: { rounding: 'trunc' },
  })

  // Кастомный сериализатор для BigInt — fastify по умолчанию падает на нём
  fastify.setReplySerializer((payload) =>
    JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  )

  await fastify.register(fastifyFormbody)
  await fastify.register(fastifyCors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
  await fastify.register(fastifyJwt, { secret: config.jwtSecret })

  await fastify.register(authPlugin)

  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }))

  // Telegram webhook (для прода — настраивается через setWebhook)
  fastify.post('/telegram/webhook', async (request, reply) => {
    await processWebhook(request.body)
    return reply.send({ ok: true })
  })

  await fastify.register(registerRoutes)

  return fastify
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$connect()
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ PostgreSQL connected')
    return true
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error)
    return false
  }
}
