import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import { FastifyInstance } from 'fastify'
import { config } from '../config'

async function authPlugin(app: FastifyInstance) {
  await app.register(jwt, { secret: config.jwtSecret })

  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.code(401).send({ error: 'unauthorized' })
    }
  })
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
  }
}

export default fp(authPlugin)
