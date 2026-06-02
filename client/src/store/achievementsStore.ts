// Стейт ачивок: какие награды уже забраны (claimed). Прогресс НЕ хранится —
// он живой из gameStore (см. evaluator). «Можно забрать» = достигнут target и
// ещё не claimed. claim() начисляет звёзды (premiumStore) и помечает claimed.

import { create } from 'zustand'
import { ACHIEVEMENTS, achievementById } from '../game/achievements/config'
import { metricValue } from '../game/achievements/evaluator'
import { usePremiumStore } from './premiumStore'

const KEY = 'achievements.claimed'

function load(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw) as Record<string, boolean>
    return obj && typeof obj === 'object' ? obj : {}
  } catch {
    return {}
  }
}

function save(claimed: Record<string, boolean>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(claimed))
  } catch {
    /* нет localStorage — игнорируем */
  }
}

export type AchStatus = 'locked' | 'claimable' | 'claimed'

interface AchievementsState {
  claimed: Record<string, boolean>
  isClaimed: (id: string) => boolean
  /** Достигнут target и ещё не забрана. */
  isClaimable: (id: string) => boolean
  status: (id: string) => AchStatus
  /** Забрать награду. true если начислено (была claimable). */
  claim: (id: string) => boolean
  /** id'шники достигнутых, но не забранных — для тостов/бейджа. */
  pendingIds: () => string[]
}

export const useAchievementsStore = create<AchievementsState>((set, get) => ({
  claimed: load(),

  isClaimed: (id) => !!get().claimed[id],

  isClaimable: (id) => {
    if (get().claimed[id]) return false
    const def = achievementById(id)
    if (!def) return false
    return metricValue(def.metric) >= def.target
  },

  status: (id) => {
    if (get().claimed[id]) return 'claimed'
    return get().isClaimable(id) ? 'claimable' : 'locked'
  },

  claim: (id) => {
    if (!get().isClaimable(id)) return false
    const def = achievementById(id)
    if (!def) return false
    usePremiumStore.getState().addStars(def.reward)
    const next = { ...get().claimed, [id]: true }
    save(next)
    set({ claimed: next })
    return true
  },

  pendingIds: () => {
    const claimed = get().claimed
    return ACHIEVEMENTS.filter(
      (a) => !claimed[a.id] && metricValue(a.metric) >= a.target,
    ).map((a) => a.id)
  },
}))
