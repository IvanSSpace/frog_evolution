import { api, setToken } from './api'
import { getInitData, isInsideTelegram } from './telegram'

export interface AuthUser {
  id: number
  telegramId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  photoUrl: string | null
}

export interface AuthResult {
  user: AuthUser | null
  mode: 'telegram' | 'dev' | 'failed'
}

// Авторизация через Telegram initData.
//
// Поведение:
// - В Telegram (есть initData) — обмениваем initData на JWT через /auth/telegram.
// - В dev-режиме браузера (нет initData, vite dev) — пропускаем проверку:
//   сервер с пустым TELEGRAM_BOT_TOKEN автоматически подставляет dev-юзера
//   и не требует JWT. Просто стартуем игру без логина.
// - В проде без initData — это ошибка (приложение должно открываться только
//   из Telegram), возвращаем mode='failed'.
export async function authenticate(): Promise<AuthResult> {
  if (isInsideTelegram()) {
    try {
      const { data } = await api.post('/auth/telegram', { initData: getInitData() })
      setToken(data.payload.token)
      return { user: data.user, mode: 'telegram' }
    } catch (err) {
      console.error('[auth] Telegram auth failed:', err)
      return { user: null, mode: 'failed' }
    }
  }

  // Не в Telegram
  if (import.meta.env.DEV) {
    console.log('[auth] dev-режим: проверка Telegram отключена')
    return { user: null, mode: 'dev' }
  }

  console.warn('[auth] Telegram WebApp не обнаружен — приложение должно запускаться внутри Telegram')
  return { user: null, mode: 'failed' }
}
