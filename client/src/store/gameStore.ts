import { create } from 'zustand'

interface GameState {
  gold: number
  addGold: (amount: number) => void
  spendGold: (amount: number) => boolean

  // Прогресс падения следующей коробки 0..1; waiting=true когда лимит сущностей
  boxProgress: number
  boxWaiting: boolean
  setBoxProgress: (v: number) => void
  setBoxWaiting: (v: boolean) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  gold: 0,

  addGold: (amount) => set((s) => ({ gold: s.gold + amount })),

  spendGold: (amount) => {
    if (get().gold < amount) return false
    set((s) => ({ gold: s.gold - amount }))
    return true
  },

  boxProgress: 0,
  boxWaiting: false,
  setBoxProgress: (v) => set({ boxProgress: v }),
  setBoxWaiting: (v) => set({ boxWaiting: v }),
}))
