import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma'

export async function userRoutes(app: FastifyInstance) {
  app.get(
    '/users/me',
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.id },
      })
      return user
    },
  )
}
