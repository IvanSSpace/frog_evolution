import { create } from 'zustand'
import type { ClanSnapshot, ClanListItem } from '../../api/clan'

export interface ClanState {
  snapshot: ClanSnapshot | null
  cooldownUntil: string | null
  list: ClanListItem[]
  listTotal: number
  listSearch: string
  listPage: number
  isLoading: boolean
  setSnapshot(s: ClanSnapshot | null): void
  setCooldown(iso: string | null): void
  setList(items: ClanListItem[], total: number): void
  setListQuery(search: string, page: number): void
  setLoading(v: boolean): void
  reset(): void
}

export const useClanStore = create<ClanState>((set) => ({
  snapshot: null,
  cooldownUntil: null,
  list: [],
  listTotal: 0,
  listSearch: '',
  listPage: 0,
  isLoading: false,

  setSnapshot: (s) => set({ snapshot: s }),
  setCooldown: (iso) => set({ cooldownUntil: iso }),
  setList: (items, total) => set({ list: items, listTotal: total }),
  setListQuery: (search, page) => set({ listSearch: search, listPage: page }),
  setLoading: (v) => set({ isLoading: v }),
  reset: () =>
    set({
      snapshot: null,
      cooldownUntil: null,
      list: [],
      listTotal: 0,
      listSearch: '',
      listPage: 0,
      isLoading: false,
    }),
}))
