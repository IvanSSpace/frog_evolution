import 'dotenv/config'

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
}

export const isDev = config.nodeEnv !== 'production'
