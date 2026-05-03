import { create } from 'zustand'

interface GameState {
  gold: number
  addGold: (amount: number) => void
  spendGold: (amount: number) => boolean
}

export const useGameStore = create<GameState>((set, get) => ({
  gold: 0,

  addGold: (amount) => set((s) => ({ gold: s.gold + amount })),

  spendGold: (amount) => {
    if (get().gold < amount) return false
    set((s) => ({ gold: s.gold - amount }))
    return true
  },
}))
