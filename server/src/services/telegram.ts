import * as crypto from 'crypto'
import prisma from '../db/prisma'
import { User } from '@prisma/client'

export interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
}

const DEV_MOCK_USER: TelegramUser = {
  id: 1,
  first_name: 'Dev',
  username: 'devuser',
}

// Валидация initData от Telegram Mini App
export function validateInitData(initData: string, botToken: string): TelegramUser | null {
  // Dev-байпас: без токена бота принимаем мок
  if (!botToken && process.env.NODE_ENV !== 'production') {
    try {
      const params = new URLSearchParams(initData)
      const userParam = params.get('user')
      if (userParam) return JSON.parse(userParam) as TelegramUser
    } catch {}
    return DEV_MOCK_USER
  }

  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null

    params.delete('hash')

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    if (expectedHash !== hash) return null

    const userParam = params.get('user')
    if (!userParam) return null

    return JSON.parse(userParam) as TelegramUser
  } catch {
    return null
  }
}

// Создаёт юзера + пустой GameState при первой авторизации
export async function upsertUser(telegramUser: TelegramUser): Promise<User> {
  const telegramId = String(telegramUser.id)

  return prisma.user.upsert({
    where: { telegramId },
    update: {
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      lastName: telegramUser.last_name ?? null,
      photoUrl: telegramUser.photo_url ?? null,
    },
    create: {
      telegramId,
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      lastName: telegramUser.last_name ?? null,
      photoUrl: telegramUser.photo_url ?? null,
      gameState: { create: {} },
    },
  })
}
