import { FastifyInstance } from 'fastify'
import { healthRoutes } from './health'
import { authRoutes } from './auth'
import { userRoutes } from './users'
import { gameStateRoutes } from './gameState'
import { boxRoutes } from './box'
import { shopRoutes } from './shop'
import { mergeRoutes } from './merge'
import { cosmicRoutes } from './cosmic'
import { expeditionRoutes } from './expedition'
import { adminRoutes } from './admin'
import { clanRoutes } from './clan'
import { restartRoutes } from './restart'

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(userRoutes)
  await app.register(gameStateRoutes)
  await app.register(boxRoutes)
  await app.register(shopRoutes)
  await app.register(mergeRoutes)
  await app.register(cosmicRoutes)
  await app.register(expeditionRoutes)
  await app.register(adminRoutes)
  await app.register(clanRoutes)
  await app.register(restartRoutes)
}
