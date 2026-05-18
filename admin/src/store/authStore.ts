// Simple auth state using sessionStorage directly
// Exported helpers used by components

export function getToken(): string | null {
  return sessionStorage.getItem('admin_token')
}

export function setToken(token: string): void {
  sessionStorage.setItem('admin_token', token)
}

export function clearToken(): void {
  sessionStorage.removeItem('admin_token')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}
