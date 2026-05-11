import '@fastify/jwt'

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: number; telegramId: string }
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: number; telegramId: string }
    user: { id: number; telegramId: string }
  }
}
