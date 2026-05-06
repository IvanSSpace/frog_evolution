import * as dotenv from 'dotenv'
dotenv.config()

export const config = {
  port: parseInt(process.env.PORT ?? '3000'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? 'dev_secret',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  isProd: process.env.NODE_ENV === 'production',
}
