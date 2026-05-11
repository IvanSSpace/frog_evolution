import crypto from 'node:crypto'
import { config, isDev } from '../config'

// Validate Telegram WebApp initData per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export interface ParsedInitData {
  telegramId: string
  username?: string
  firstName?: string
  lastName?: string
  photoUrl?: string
}

export function validateInitData(initData: string): ParsedInitData | null {
  // Dev fallback: no bot token, no real validation. Accept mock initData like "telegramId=dev".
  if (isDev && !config.telegramBotToken) {
    const params = new URLSearchParams(initData)
    return {
      telegramId: params.get('telegramId') ?? 'dev',
      username: params.get('username') ?? 'dev-user',
      firstName: params.get('firstName') ?? 'Dev',
    }
  }

  const urlParams = new URLSearchParams(initData)
  const hash = urlParams.get('hash')
  if (!hash) return null
  urlParams.delete('hash')

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(config.telegramBotToken)
    .digest()

  const computed = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (computed !== hash) return null

  const userRaw = urlParams.get('user')
  if (!userRaw) return null

  try {
    const user = JSON.parse(userRaw)
    return {
      telegramId: String(user.id),
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      photoUrl: user.photo_url,
    }
  } catch {
    return null
  }
}
