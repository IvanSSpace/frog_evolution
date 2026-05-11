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

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  return fetch(`${API_URL}${path}`, { ...options, headers })
}

export async function apiJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(path, options)
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${err || res.statusText}`)
  }
  return (await res.json()) as T
}
