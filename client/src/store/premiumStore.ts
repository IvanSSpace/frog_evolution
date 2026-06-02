// Премиум-валюта «звёзды» (⭐) — внутриигровой эквивалент Telegram Stars.
// Пока чисто внутриигровая (начисляется за ачивки). Хранится отдельно от
// gameStore (свой localStorage-ключ), чтобы не трогать горячий gameStore и не
// конфликтовать с параллельными правками. Позже сюда же ляжет интеграция с
// реальными Telegram Stars (покупки).

import { create } from 'zustand'

const KEY = 'premium.stars'

function load(): number {
  try {
    const n = Number(localStorage.getItem(KEY))
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

function save(n: number): void {
  try {
    localStorage.setItem(KEY, String(n))
  } catch {
    /* нет localStorage — игнорируем */
  }
}

interface PremiumState {
  stars: number
  /** Начислить звёзды (награды ачивок и т.п.). */
  addStars: (n: number) => void
  /** Списать звёзды. Возвращает false если не хватает (баланс не меняется). */
  spendStars: (n: number) => boolean
}

export const usePremiumStore = create<PremiumState>((set, get) => ({
  stars: load(),
  addStars: (n) => {
    const v = Math.max(0, get().stars + Math.floor(n))
    save(v)
    set({ stars: v })
  },
  spendStars: (n) => {
    if (get().stars < n) return false
    const v = get().stars - Math.floor(n)
    save(v)
    set({ stars: v })
    return true
  },
}))
