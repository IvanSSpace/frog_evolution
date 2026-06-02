import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import rateLimit from '@fastify/rate-limit'
import authPlugin from './plugins/auth'
import { registerRoutes } from './routes'
import { config, isDev } from './config'

export async function buildApp() {
  const app = Fastify({ logger: true })

  // Rate-limit (AUDIT §3F): глобальный потолок на IP. Щедрый — throttled-PUT
  // (раз в 5с) + heartbeat (15с) клиента далеко внутри лимита; ловит только
  // явный флуд/перебор эндпоинтов.
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  })

  // CORS: в dev отражаем любой origin; в prod — allowlist из CLIENT_ORIGIN
  // (CSV), если задан. Пусто в prod → fallback на reflect-any (не ломаем
  // деплой), но логируем предупреждение (AUDIT §3F).
  const corsOrigin =
    isDev || !config.clientOrigin
      ? true
      : config.clientOrigin.split(',').map((s) => s.trim())
  if (!isDev && corsOrigin === true) {
    app.log.warn('CORS: CLIENT_ORIGIN не задан в prod — отражаем любой origin')
  }
  await app.register(cors, {
    origin: corsOrigin,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
  await app.register(formbody)
  await app.register(authPlugin)
  await registerRoutes(app)

  return app
}
