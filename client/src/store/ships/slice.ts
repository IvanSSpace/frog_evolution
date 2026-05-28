import { create } from 'zustand'
import type { ShipView } from '../../api/expedition'
import { getShips } from '../../api/expedition'

export interface ShipsState {
  ships: ShipView[] | null
  isLoading: boolean
  lastFetched: number | null
  setShips(ships: ShipView[]): void
  setLoading(v: boolean): void
  fetchShips(): Promise<void>
}

export const useShipsStore = create<ShipsState>((set) => ({
  ships: null,
  isLoading: false,
  lastFetched: null,

  setShips: (ships) => set({ ships, lastFetched: Date.now() }),
  setLoading: (v) => set({ isLoading: v }),

  fetchShips: async () => {
    set({ isLoading: true })
    try {
      const res = await getShips()
      set({ ships: res.ships, lastFetched: Date.now() })
    } catch (e) {
      console.error('[ships] fetchShips failed', e)
    } finally {
      set({ isLoading: false })
    }
  },
}))
