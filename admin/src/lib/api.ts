import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 → logout + redirect
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('admin_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)
