import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import authPlugin from './plugins/auth'
import { registerRoutes } from './routes'

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
  await app.register(formbody)
  await app.register(authPlugin)
  await registerRoutes(app)

  return app
}
