// Минимальный API-клиент: base URL + JWT auth header.
// VITE_API_URL фоллбечит на localhost:3000 для dev.

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000'
const TOKEN_KEY = 'frog_evolution_jwt'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function doFetch(
  path: string,
  options: RequestInit,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`${API_URL}${path}`, { ...options, headers })
}

// Auto-recovery: при 401 один раз re-auth через Telegram initData + retry original.
// Помогает в dev когда server restart / JWT_SECRET change инвалидирует token.
// _retry guard блокирует infinite loop если auth снова fails.
export async function apiFetch(
  path: string,
  options: RequestInit = {},
  _retry = true,
): Promise<Response> {
  const res = await doFetch(path, options)
  if (res.status === 401 && _retry && path !== '/auth/telegram') {
    clearToken()
    try {
      const tgInitData = window.Telegram?.WebApp?.initData
      const initData =
        tgInitData && tgInitData.length > 0
          ? tgInitData
          : 'telegramId=dev&username=dev-user&firstName=Dev'
      const authRes = await doFetch('/auth/telegram', {
        method: 'POST',
        body: JSON.stringify({ initData }),
      })
      if (authRes.ok) {
        const { token } = (await authRes.json()) as { token: string }
        setToken(token)
        return apiFetch(path, options, false)
      }
    } catch {
      // fall through — return original 401
    }
  }
  return res
}

export class ApiError extends Error {
  status: number
  body: string
  constructor(status: number, body: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export async function apiJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(path, options)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(
      res.status,
      body,
      `API ${res.status}: ${body || res.statusText}`,
    )
  }
  return (await res.json()) as T
}

export interface HealthResponse {
  status: string
  ts: number
}

export async function pingHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${API_URL}/health`)
    if (!res.ok) return null
    return (await res.json()) as HealthResponse
  } catch {
    return null
  }
}
