import { FastifyInstance } from 'fastify'
import { authRoutes } from './auth'
import { usersRoutes } from './users'
import { gameStateRoutes } from './gameState'

export async function registerRoutes(fastify: FastifyInstance) {
  await fastify.register(authRoutes)
  await fastify.register(usersRoutes)
  await fastify.register(gameStateRoutes)
}
