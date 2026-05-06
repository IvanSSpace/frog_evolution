import { User } from '@prisma/client'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { telegramId: string }
    user: User
  }
}
