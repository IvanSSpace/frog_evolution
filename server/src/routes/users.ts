import { FastifyInstance } from 'fastify'

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.get('/users/me', async (request, reply) => {
    const user = request.user!
    return reply.send(user)
  })
}
