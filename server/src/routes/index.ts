import { FastifyInstance } from 'fastify'
import { healthRoutes } from './health'
import { authRoutes } from './auth'
import { userRoutes } from './users'
import { gameStateRoutes } from './gameState'
import { boxRoutes } from './box'
import { shopRoutes } from './shop'

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(userRoutes)
  await app.register(gameStateRoutes)
  await app.register(boxRoutes)
  await app.register(shopRoutes)
}
