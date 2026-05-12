import { apiJson, setToken, getToken } from './client'

interface AuthResponse {
  token: string
  user: { id: number; telegramId: string; username?: string | null }
}

// Window.Telegram уже типизирован в vite-env.d.ts (TelegramWebApp shape).

export async function loginWithTelegram(
  initData: string,
): Promise<AuthResponse> {
  const result = await apiJson<AuthResponse>('/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ initData }),
  })
  setToken(result.token)
  return result
}

// При запуске игры — гарантировать что есть JWT.
// В Telegram среде берёт реальный initData из Telegram.WebApp.
// В dev-браузере (без TG SDK) — мок-initData, сервер примет в dev-режиме.
export async function ensureLogin(): Promise<AuthResponse | null> {
  // Если уже залогинены — можно skip; но для простоты ре-логин всегда (дёшево в dev).
  // TODO: позже добавить decode-JWT + check expiry.
  void getToken()

  const tgInitData = window.Telegram?.WebApp?.initData
  const initData =
    tgInitData && tgInitData.length > 0
      ? tgInitData
      : 'telegramId=dev&username=dev-user&firstName=Dev'

  try {
    return await loginWithTelegram(initData)
  } catch (e) {
    console.error('[server-auth] login failed:', e)
    return null
  }
}
