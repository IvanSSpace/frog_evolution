import 'dotenv/config'

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  // Admin panel auth (single super-admin)
  adminEmail: process.env.ADMIN_EMAIL ?? '',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? '',
  adminOrigin: process.env.ADMIN_ORIGIN ?? '*',
}

export const isDev = config.nodeEnv !== 'production'
