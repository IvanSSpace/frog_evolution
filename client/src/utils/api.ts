import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const TOKEN_KEY = 'frog_evolution_jwt'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
})

api.interceptors.request.use((cfg) => {
  const token = getToken()
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`
  }
  return cfg
})

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {/* ignore */}
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {/* ignore */}
}
