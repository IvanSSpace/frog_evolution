import type { FastifyReply } from 'fastify'
import { z } from 'zod'

// Парсит body по zod-схеме. При ошибке шлёт 400 и возвращает null —
// хэндлер делает `if (!parsed) return`. Заменяет ручные typeof-проверки
// типизированным single-source валидатором (AUDIT §3E).
export function parseOr400<S extends z.ZodTypeAny>(
  schema: S,
  body: unknown,
  reply: FastifyReply,
): z.infer<S> | null {
  const r = schema.safeParse(body)
  if (!r.success) {
    reply.code(400).send({ error: 'invalid request', issues: r.error.issues })
    return null
  }
  return r.data
}
